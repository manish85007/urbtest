/**
 * Sentry error-tracking initialisation for the API.
 * Set SENTRY_DSN in your environment to enable. No-op when unset.
 * Activate by running:  pnpm add @sentry/node --filter @urb-tectrack/api
 */

const dsn = process.env.SENTRY_DSN;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _sentry: any = null;

export async function initSentry() {
  if (!dsn) return;
  try {
    // Dynamic import so the module compiles even before @sentry/node is installed
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _sentry = await import('@sentry/node' as any);
    _sentry.init({
      dsn,
      environment: process.env.NODE_ENV ?? 'development',
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
    });
    console.info('[sentry] Initialised — DSN configured.');
  } catch {
    console.warn('[sentry] @sentry/node not installed — run: pnpm add @sentry/node --filter @urb-tectrack/api');
  }
}

export function captureException(err: unknown, context?: Record<string, unknown>) {
  if (!_sentry) return;
  try {
    _sentry.withScope((scope: { setExtras: (e: Record<string, unknown>) => void }) => {
      if (context) scope.setExtras(context);
      _sentry.captureException(err);
    });
  } catch {
    // Never let Sentry crash the app
  }
}
