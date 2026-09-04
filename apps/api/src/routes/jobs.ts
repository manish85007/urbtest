import type { FastifyInstance } from 'fastify';
import { processEmailQueue } from '../services/email.js';
import { runRemindersIfDue } from '../services/reminders.js';
import { purgeExpiredSessions } from '../services/legal.js';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/errors.js';

function assertJobsAuth(authorization: string | undefined) {
  const secret = process.env.JOBS_SECRET?.trim();
  if (!secret) {
    throw new AppError('JOBS_SECRET is not configured.', 503);
  }
  const expected = `Bearer ${secret}`;
  if (authorization !== expected) {
    throw new AppError('Unauthorized job trigger.', 401);
  }
}

async function markJobRun(key: string) {
  const day = new Date(new Date().toISOString().slice(0, 10));
  await prisma.reminderLog.upsert({
    where: { key },
    create: { key, lastRun: day, count: 1 },
    update: { lastRun: day, count: { increment: 1 } },
  });
}

/**
 * Cloud Scheduler → Cloud Run HTTP triggers.
 * Set ENABLE_JOBS=false on the public service and point Scheduler at these routes
 * with Authorization: Bearer $JOBS_SECRET.
 */
export async function jobsRoutes(app: FastifyInstance) {
  app.post('/internal/jobs/email-queue', async (request) => {
    assertJobsAuth(request.headers.authorization);
    const result = await processEmailQueue();
    await markJobRun('job:email-queue');
    return { ok: true, ...result };
  });

  app.post('/internal/jobs/reminders', async (request) => {
    assertJobsAuth(request.headers.authorization);
    const result = await runRemindersIfDue();
    await markJobRun('job:reminders');
    return { ok: true, ...result };
  });

  app.post('/internal/jobs/session-cleanup', async (request) => {
    assertJobsAuth(request.headers.authorization);
    const purged = await purgeExpiredSessions();
    await markJobRun('job:session-cleanup');
    return { ok: true, purged };
  });
}
