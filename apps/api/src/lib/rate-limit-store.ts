import { AppError } from './errors.js';
import { prisma } from './prisma.js';

/**
 * Atomic sliding-window counter stored in Postgres so Cloud Run instances
 * share the same login / reset budgets.
 */
export async function bumpRateLimit(
  key: string,
  windowMs: number,
  max: number,
  message: string,
): Promise<void> {
  if (process.env.E2E_TEST === 'true' || process.env.NODE_ENV === 'test') return;

  const now = new Date();
  const resetAt = new Date(now.getTime() + windowMs);

  const rows = await prisma.$queryRaw<Array<{ count: number }>>`
    INSERT INTO rate_limit_buckets (key, count, reset_at, updated_at)
    VALUES (${key}, 1, ${resetAt}, ${now})
    ON CONFLICT (key) DO UPDATE SET
      count = CASE
        WHEN rate_limit_buckets.reset_at <= ${now} THEN 1
        ELSE rate_limit_buckets.count + 1
      END,
      reset_at = CASE
        WHEN rate_limit_buckets.reset_at <= ${now} THEN ${resetAt}
        ELSE rate_limit_buckets.reset_at
      END,
      updated_at = ${now}
    RETURNING count
  `;

  const count = Number(rows[0]?.count ?? 0);
  if (count > max) {
    throw new AppError(message, 429);
  }
}
