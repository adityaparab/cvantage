import { BadRequestException, HttpException, Injectable } from '@nestjs/common';
import { lookup } from 'node:dns/promises';
import type { LookupAddress } from 'node:dns';
import { request } from 'node:https';
import { isIP } from 'node:net';
import * as ipaddr from 'ipaddr.js';
import { loadBuffer } from 'cheerio';
import { z } from 'zod';
import { ResumeRepository } from '../database/resume.repository';
import { redactPii } from '../documents/pii';

const failure = () =>
  new BadRequestException(
    'Could not import this public HTTPS job page. Paste the job description instead.',
  );
export function publicJobUrl(input: string) {
  const url = new URL(input);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    (url.port && url.port !== '443')
  )
    throw failure();
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (
    !host.includes('.') ||
    host.endsWith('.localhost') ||
    host.endsWith('.local')
  )
    throw failure();
  if (isIP(host) && !publicAddress(host)) throw failure();
  url.hash = '';
  return url;
}
export function publicAddress(address: string) {
  return (
    ipaddr.isValid(address) && ipaddr.process(address).range() === 'unicast'
  );
}
export function jobPageText(body: Buffer, contentType: string) {
  let text: string;
  if (contentType.startsWith('text/plain')) text = body.toString('utf8');
  else {
    const $ = loadBuffer(body);
    $(
      'script, style, noscript, nav, header, footer, iframe, svg, form, [hidden], [aria-hidden="true"]',
    ).remove();
    $('br').replaceWith('\n');
    $('p, li, h1, h2, h3, h4, div, section').append('\n');
    const main = $('main, article').first();
    text = (main.length ? main : $('body')).text();
  }
  text = text
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim();
  if (text.length < 20 || text.length > 30000) throw failure();
  return text;
}
export interface JobPage {
  status: number;
  location?: string;
  type: string;
  body: Buffer;
}
@Injectable()
export class JobPageNetwork {
  resolve(host: string): Promise<LookupAddress[]> {
    return lookup(host, { all: true });
  }
  read(
    url: URL,
    address: LookupAddress,
    signal: AbortSignal,
  ): Promise<JobPage> {
    return new Promise((resolve, reject) => {
      const req = request(
        url,
        {
          signal,
          agent: false,
          family: address.family,
          // Connect only to the address checked above; preserve hostname for TLS/Host.
          lookup: (_host, options, callback) => {
            if (options.all) callback(null, [address]);
            else callback(null, address.address, address.family);
          },
          headers: {
            Accept: 'text/html, text/plain',
            'Accept-Encoding': 'identity',
            'User-Agent': 'CVantage-JobImport/1.0',
          },
        },
        (res) => {
          const status = res.statusCode ?? 0;
          if ([301, 302, 303, 307, 308].includes(status)) {
            res.destroy();
            resolve({
              status,
              location: res.headers.location,
              type: '',
              body: Buffer.alloc(0),
            });
            return;
          }
          const type = res.headers['content-type'] ?? '';
          if (
            status !== 200 ||
            !/^(text\/html|text\/plain|application\/xhtml\+xml)(;|$)/i.test(
              type,
            ) ||
            (res.headers['content-encoding'] &&
              res.headers['content-encoding'] !== 'identity') ||
            Number(res.headers['content-length']) > 1_000_000
          ) {
            res.destroy();
            reject(failure());
            return;
          }
          const chunks: Buffer[] = [];
          let size = 0;
          res.on('data', (chunk: Buffer) => {
            size += chunk.length;
            if (size > 1_000_000) {
              res.destroy();
              reject(failure());
            } else chunks.push(chunk);
          });
          res.on('end', () =>
            resolve({
              status,
              type: type.toLowerCase(),
              body: Buffer.concat(chunks),
            }),
          );
          res.on('error', reject);
          res.on('aborted', () => reject(failure()));
        },
      );
      req.on('error', reject);
      req.end();
    });
  }
}
@Injectable()
export class JobDescriptionService {
  private readonly active = new Set<string>();
  constructor(
    private readonly resumes: ResumeRepository,
    private readonly network: JobPageNetwork,
  ) {}
  async import(ownerId: string, resumeId: string, input: unknown) {
    const parsed = z
      .object({ url: z.string().max(2048) })
      .strict()
      .safeParse(input);
    if (!parsed.success) throw failure();
    await this.resumes.get(ownerId, resumeId);
    if (this.active.has(ownerId) || this.active.size >= 4)
      throw new HttpException('Job import is busy; try again shortly', 429);
    this.active.add(ownerId);
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const deadline = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          abort.abort();
          reject(failure());
        }, 10000);
      });
      const text = await Promise.race([
        this.fetchText(parsed.data.url, abort.signal),
        deadline,
      ]);
      const pii = await this.resumes.getPii(ownerId, resumeId);
      if (!pii) throw failure();
      return { text: redactPii(text, pii) };
    } catch {
      throw failure();
    } finally {
      clearTimeout(timer);
      abort.abort();
      this.active.delete(ownerId);
    }
  }
  private async fetchText(input: string, signal: AbortSignal) {
    let url = publicJobUrl(input);
    for (let redirects = 0; redirects <= 3; redirects++) {
      const host = url.hostname.replace(/^\[|\]$/g, '');
      const addresses = isIP(host)
        ? [{ address: host, family: isIP(host) }]
        : await this.network.resolve(host);
      signal.throwIfAborted();
      if (
        !addresses.length ||
        addresses.some((item) => !publicAddress(item.address))
      )
        throw failure();
      const page = await this.network.read(url, addresses[0], signal);
      if (page.status === 200) return jobPageText(page.body, page.type);
      if (!page.location) throw failure();
      url = publicJobUrl(new URL(page.location, url).href);
    }
    throw failure();
  }
}
