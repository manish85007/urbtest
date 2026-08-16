import type { FastifyInstance } from 'fastify';
import { processEmailQueue } from '../services/email.js';
import { runRemindersIfDue } from '../services/reminders.js';
import { purgeExpiredSessions } from '../services/legal.js';

const EMAIL_POLL_MS = Number(process.env.EMAIL_POLL_MS ?? 30_000);
const REMINDER_CHECK_MS = Number(process.env.REMINDER_CHECK_MS ?? 3_600_000);
const SESSION_CLEANUP_MS = Number(process.env.SESSION_CLEANUP_MS ?? 3_600_000);

export function startScheduler(app: FastifyInstance) {
  const runQueue = () => {
    processEmailQueue().catch((err) => app.log.error({ err }, 'Email queue processing failed'));
  };

  const runDailyReminders = () => {
    runRemindersIfDue()
      .then((r) => {
        if (!r.skipped && (r.sentPay > 0 || r.sentSla > 0)) {
          app.log.info(
            `Reminders sent — payment: ${r.sentPay}, SLA: ${r.sentSla}`,
          );
        }
      })
      .catch((err) => app.log.error({ err }, 'Reminder job failed'));
  };

  const runSessionCleanup = () => {
    purgeExpiredSessions()
      .then((n) => {
        if (n > 0) app.log.info(`Purged ${n} expired sessions`);
      })
      .catch((err) => app.log.error({ err }, 'Session cleanup failed'));
  };

  runQueue();
  runDailyReminders();
  runSessionCleanup();

  const emailTimer = setInterval(runQueue, EMAIL_POLL_MS);
  const reminderTimer = setInterval(runDailyReminders, REMINDER_CHECK_MS);
  const sessionTimer = setInterval(runSessionCleanup, SESSION_CLEANUP_MS);

  app.addHook('onClose', async () => {
    clearInterval(emailTimer);
    clearInterval(reminderTimer);
    clearInterval(sessionTimer);
  });

  app.log.info('Background jobs started (email queue + reminders + session cleanup)');
}
