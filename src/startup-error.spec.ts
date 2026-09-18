import { StartupError, startupFailureMessage } from './startup-error';
import { validateEnvironment } from './config/app-config';

it('surfaces safe configuration failures without their values', () => {
  let failure: unknown;
  try {
    validateEnvironment({ SESSION_SECRET: 'private-session-value' });
  } catch (error) {
    failure = error;
  }
  expect(startupFailureMessage(failure)).toContain('SESSION_SECRET');
  expect(startupFailureMessage(failure)).not.toContain('private-session-value');
});

it('never prints arbitrary dependency messages or stacks', () => {
  const error = new Error('mongodb://user:private-password@host/private-db');
  expect(startupFailureMessage(error)).toContain(
    'unexpected initialization error',
  );
  expect(startupFailureMessage(error)).not.toContain('private-password');
  expect(startupFailureMessage({ message: 'private-value' })).not.toContain(
    'private-value',
  );
  expect(startupFailureMessage(new StartupError('Safe explanation'))).toBe(
    'Safe explanation',
  );
});

it('explains a port conflict without printing the underlying error', () => {
  expect(
    startupFailureMessage({ code: 'EADDRINUSE', message: 'private-value' }),
  ).toContain('PORT is already in use');
  expect(startupFailureMessage({ code: 'EACCES' })).toContain(
    'Permission denied',
  );
});
