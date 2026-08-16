import type { FastifyInstance } from 'fastify';
import { attachSession, requireAdmin } from '../middleware/session.js';
import { runReminders } from '../services/reminders.js';
import { processEmailQueue } from '../services/email.js';

export async function adminRoutes(app: FastifyInstance) {
  app.addHook('preHandler', attachSession);

  app.post('/admin/jobs/reminders', { preHandler: requireAdmin }, async () => {
    const reminders = await runReminders();
    const email = await processEmailQueue();
    return { reminders, email };
  });

  app.post('/admin/jobs/email-queue', { preHandler: requireAdmin }, async () => {
    return processEmailQueue();
  });
}
