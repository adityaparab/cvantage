import { BadRequestException, Injectable, HttpException } from '@nestjs/common';
import { Worker } from 'node:worker_threads';
import { join, extname } from 'node:path';
import { MAX_UPLOAD_BYTES } from '../contracts/resume-schema';
import { z } from 'zod';
export function documentExtension(
  name: string,
  bytes: Buffer,
): 'pdf' | 'docx' | 'doc' {
  if (bytes.length === 0 || bytes.length > MAX_UPLOAD_BYTES)
    throw new BadRequestException('File must be between 1 byte and 20 MB');
  const extension = extname(name).slice(1).toLowerCase();
  const valid =
    extension === 'pdf'
      ? bytes.subarray(0, 5).toString() === '%PDF-'
      : extension === 'docx'
        ? bytes.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))
        : extension === 'doc'
          ? bytes.subarray(0, 8).equals(Buffer.from('d0cf11e0a1b11ae1', 'hex'))
          : false;
  if (!valid)
    throw new BadRequestException(
      'Choose a valid PDF, DOCX, or DOC file matching its extension',
    );
  return extension as 'pdf' | 'docx' | 'doc';
}
@Injectable()
export class LocalDocumentExtractor {
  private active = 0;
  async extract(
    bytes: Buffer,
    extension: 'pdf' | 'docx' | 'doc',
    signal?: AbortSignal,
  ): Promise<string> {
    if (this.active >= 2)
      throw new HttpException(
        'Document processing is busy; try again shortly',
        429,
      );
    if (signal?.aborted) throw new BadRequestException('Upload cancelled');
    this.active++;
    try {
      return await new Promise<string>((resolve, reject) => {
        const worker = new Worker(
          join(process.cwd(), 'scripts/document-worker.cjs'),
          {
            workerData: { bytes, extension },
            resourceLimits: { maxOldGenerationSizeMb: 128 },
          },
        );
        let settled = false;
        const finish = (error?: Error, text?: string) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          signal?.removeEventListener('abort', abort);
          void worker.terminate();
          if (error) reject(error);
          else resolve(text!);
        };
        const abort = () => finish(new BadRequestException('Upload cancelled'));
        const timer = setTimeout(
          () =>
            finish(new BadRequestException('Document extraction timed out')),
          20000,
        );
        signal?.addEventListener('abort', abort, { once: true });
        worker.once('message', (message: unknown) => {
          const result = z
            .object({ text: z.string().max(1_000_000) })
            .safeParse(message);
          if (result.success) finish(undefined, result.data.text);
          else
            finish(
              new BadRequestException(
                'No readable text could be extracted. Use an unencrypted text document; scanned documents are not supported.',
              ),
            );
        });
        worker.once('error', () =>
          finish(new BadRequestException('Document extraction failed')),
        );
        worker.once('exit', (code) => {
          if (code !== 0)
            finish(new BadRequestException('Document extraction stopped'));
        });
      });
    } finally {
      this.active--;
    }
  }
}
