import { EventEmitter } from 'node:events';
import { request } from 'node:https';
import { JobPageNetwork } from './job-description.service';
jest.mock('node:https', () => ({ request: jest.fn() }));
const mockedRequest = jest.mocked(request);
function response(headers: Record<string, string>, body: string) {
  const res = Object.assign(new EventEmitter(), {
    statusCode: 200,
    headers,
    destroy: jest.fn(),
  });
  mockedRequest.mockImplementation((_url, _options, callback) => {
    queueMicrotask(() => {
      callback!(res as never);
      res.emit('data', Buffer.from(body));
      res.emit('end');
    });
    return Object.assign(new EventEmitter(), { end: jest.fn() }) as never;
  });
  return res;
}
it('enforces byte, MIME and encoding limits on the network response', async () => {
  for (const [headers, body] of [
    [{ 'content-type': 'text/html' }, 'x'.repeat(1_000_001)],
    [{ 'content-type': 'application/pdf' }, 'binary'],
    [{ 'content-type': 'text/html', 'content-encoding': 'gzip' }, 'compressed'],
  ] as [Record<string, string>, string][]) {
    const res = response(headers, body);
    await expect(
      new JobPageNetwork().read(
        new URL('https://example.com'),
        { address: '93.184.216.34', family: 4 },
        new AbortController().signal,
      ),
    ).rejects.toThrow('Paste');
    expect(res.destroy).toHaveBeenCalled();
  }
});
it('keeps TLS hostname and connects using only the previously validated address', async () => {
  response({ 'content-type': 'text/plain' }, 'A public job description.');
  const url = new URL('https://example.com/job');
  const address = { address: '93.184.216.34', family: 4 };
  await new JobPageNetwork().read(url, address, new AbortController().signal);
  const options = mockedRequest.mock.calls.at(-1)![1];
  expect(mockedRequest.mock.calls.at(-1)![0]).toEqual(url);
  expect(options).toMatchObject({ agent: false, family: 4 });
  const callback = jest.fn();
  options.lookup!('example.com', { all: true }, callback);
  expect(callback).toHaveBeenCalledWith(null, [address]);
});
