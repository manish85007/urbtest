/**
 * Sentry error-tracking for the web frontend.
 * Set VITE_SENTRY_DSN in your build environment to enable. No-op when unset.
 * Activate by running:  pnpm add @sentry/react --filter @urb-tectrack/web
 */

const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;

export async function initSentry() {
  if (!dsn) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Sentry = await import('@sentry/react' as any);
    Sentry.init({
      dsn,
      environment: import.meta.env.MODE,
      tracesSampleRate: import.meta.env.PROD ? 0.1 : 0,
      integrations: [Sentry.browserTracingIntegration?.()].filter(Boolean),
    });
  } catch {
    console.warn('[sentry] @sentry/react not installed — run: pnpm add @sentry/react --filter @urb-tectrack/web');
  }
}
