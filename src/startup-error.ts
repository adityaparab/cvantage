// Only application-authored messages may be printed during startup. Driver
// errors can contain connection strings, credentials, or database values.
export class StartupError extends Error {}

export function startupFailureMessage(error: unknown): string {
  if (error instanceof StartupError) return error.message;
  if (error && typeof error === 'object' && 'code' in error) {
    if (error.code === 'EADDRINUSE')
      return 'The configured PORT is already in use. Stop the other application or choose a free PORT in .env.';
    if (error.code === 'EACCES')
      return 'Permission denied when opening the configured PORT. Choose an unprivileged PORT in .env.';
  }
  return 'An unexpected initialization error occurred. Check configuration and service availability; see docs/development.md.';
}
