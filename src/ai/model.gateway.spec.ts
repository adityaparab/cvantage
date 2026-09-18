import { LiteLlmGateway } from './model.gateway';
import { AppConfig } from '../config/app-config';
const stream = jest.fn<
  Promise<AsyncIterable<{ content: string }>>,
  unknown[]
>();
jest.mock('@langchain/openai', () => ({
  ChatOpenAI: jest.fn().mockImplementation(() => ({
    stream: (...args: unknown[]) => stream(...args),
  })),
}));
const config = {
  values: {
    LITELLM_API_KEY: 'synthetic',
    LITELLM_BASE_URL: 'http://localhost/v1',
    LITELLM_WORKER_MODEL: 'worker',
    LITELLM_JUDGE_MODEL: 'judge',
  },
} as AppConfig;
async function* chunks() {
  await Promise.resolve();
  yield { content: '{"ok":' };
  yield {
    content: 'true}',
    additional_kwargs: { reasoning_content: 'private reasoning' },
  };
}
beforeEach(() => stream.mockReset());
it('streams answer chunks and explicitly reports bounded transient retries', async () => {
  stream.mockRejectedValueOnce({ status: 429 }).mockResolvedValueOnce(chunks());
  const observe = jest.fn().mockResolvedValue(undefined);
  expect(
    await new LiteLlmGateway(config).generate('worker', '', {}, observe),
  ).toEqual({ ok: true });
  expect(observe.mock.calls).toEqual([
    [{ type: 'retry', attempt: 1 }],
    [{ type: 'delta', text: '{"ok":' }],
    [{ type: 'delta', text: 'true}' }],
  ]);
  expect(stream).toHaveBeenCalledTimes(2);
});
it('stops after two retries and never exposes provider errors', async () => {
  stream.mockRejectedValue({
    status: 503,
    message: 'private provider response',
  });
  await expect(
    new LiteLlmGateway(config).generate('judge', '', {}),
  ).rejects.toThrow('MODEL_UNAVAILABLE');
  expect(stream).toHaveBeenCalledTimes(3);
});
it('does not retry permanent failures or a cancelled progress observer', async () => {
  stream.mockRejectedValueOnce({ status: 401 });
  await expect(
    new LiteLlmGateway(config).generate('worker', '', {}),
  ).rejects.toThrow('MODEL_UNAVAILABLE');
  expect(stream).toHaveBeenCalledTimes(1);
  stream.mockReset().mockResolvedValueOnce(chunks());
  await expect(
    new LiteLlmGateway(config).generate('worker', '', {}, () =>
      Promise.reject(Object.assign(new Error('Cancelled'), { status: 503 })),
    ),
  ).rejects.toThrow('MODEL_UNAVAILABLE');
  expect(stream).toHaveBeenCalledTimes(1);
});
