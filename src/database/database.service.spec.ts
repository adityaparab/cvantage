import { ConfigService } from '@nestjs/config';
import { MongoServerError, MongoServerSelectionError } from 'mongodb';
import { AppConfig } from '../config/app-config';
import { DatabaseService } from './database.service';

const settings = {
  MONGODB_URI: 'mongodb://127.0.0.1',
  SESSION_SECRET: 'x'.repeat(32),
  LITELLM_API_KEY: 'test-key',
  LITELLM_WORKER_MODEL: 'worker',
  LITELLM_JUDGE_MODEL: 'judge',
};

afterEach(() => jest.restoreAllMocks());

function databaseWithHello(hello: Record<string, unknown>) {
  const database = new DatabaseService(
    new AppConfig(new ConfigService(settings)),
  );
  jest.spyOn(database.client, 'connect').mockResolvedValue(database.client);
  const close = jest.spyOn(database.client, 'close').mockResolvedValue();
  const admin = database.db.admin();
  jest.spyOn(database.db, 'admin').mockReturnValue(admin);
  jest.spyOn(admin, 'command').mockResolvedValue(hello);
  const indexes = jest.spyOn(database, 'createIndexes').mockResolvedValue();
  return { database, close, indexes };
}

it('rejects standalone MongoDB before writing indexes and closes its connection', async () => {
  const { database, close, indexes } = databaseWithHello({
    isWritablePrimary: true,
  });
  await expect(database.onModuleInit()).rejects.toThrow('standalone server');
  expect(indexes).not.toHaveBeenCalled();
  expect(close).toHaveBeenCalled();
});

it.each([{ setName: 'cvantage' }, { msg: 'isdbgrid' }])(
  'allows transaction-capable topology %j',
  async (hello) => {
    const { database, indexes } = databaseWithHello(hello);
    await database.onModuleInit();
    expect(indexes).toHaveBeenCalled();
  },
);

it('explains replica-set selection failures without exposing driver details', async () => {
  const { database, close } = databaseWithHello({});
  const error = new Error('private-connection-details');
  Object.setPrototypeOf(error, MongoServerSelectionError.prototype);
  jest.spyOn(database.client, 'connect').mockRejectedValue(error);
  await expect(database.onModuleInit()).rejects.toThrow('replicaSet name');
  expect(close).toHaveBeenCalled();
});

it.each([
  [18, 'authentication failed'],
  [13, 'access denied'],
  [85, 'existing index definitions'],
])('reports safe MongoDB failure for code %s', async (code, message) => {
  const { database } = databaseWithHello({ setName: 'cvantage' });
  jest
    .spyOn(database, 'createIndexes')
    .mockRejectedValue(
      new MongoServerError({ code, message: 'private-database-value' }),
    );
  await expect(database.onModuleInit()).rejects.toThrow(message);
});

it('reports malformed URI options without exposing credentials', () => {
  expect(
    () =>
      new DatabaseService(
        new AppConfig(
          new ConfigService({
            ...settings,
            MONGODB_URI:
              'mongodb://user:private-password@localhost/?directConnection=invalid',
          }),
        ),
      ),
  ).toThrow('Invalid MongoDB connection configuration');
});
