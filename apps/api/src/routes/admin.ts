import type { FastifyInstance } from 'fastify';
import { attachSession, requireAdmin } from '../middleware/session.js';
import { runReminders } from '../services/reminders.js';
import { processEmailQueue } from '../services/email.js';
import { prisma } from '../lib/prisma.js';

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

  /* ── Announcements ──────────────────────────────────────────────── */

  // List all announcements (admin view)
  app.get('/admin/announcements', { preHandler: requireAdmin }, async () => {
    const rows = await prisma.announcement.findMany({
      orderBy: { startsAt: 'desc' },
    });
    return rows;
  });

  // Active announcements (all logged-in users)
  app.get('/announcements/active', { preHandler: attachSession }, async () => {
    const now = new Date();
    const rows = await prisma.announcement.findMany({
      where: { startsAt: { lte: now }, endsAt: { gte: now } },
      orderBy: { startsAt: 'asc' },
      select: { id: true, message: true, startsAt: true, endsAt: true },
    });
    return rows;
  });

  // Create announcement + optionally send email blast
  app.post('/admin/announcements', { preHandler: requireAdmin }, async (req, reply) => {
    const { message, startsAt, endsAt, sendEmail } = req.body as {
      message: string;
      startsAt: string;
      endsAt: string;
      sendEmail?: boolean;
    };

    if (!message?.trim()) return reply.status(400).send({ message: 'message required' });
    if (!startsAt || !endsAt) return reply.status(400).send({ message: 'startsAt and endsAt required' });

    const ann = await prisma.announcement.create({
      data: {
        message: message.trim(),
        startsAt: new Date(startsAt),
        endsAt: new Date(endsAt),
        createdBy: req.user!.id,
      },
    });

    if (sendEmail) {
      // Fetch all active client users' emails
      const clients = await prisma.user.findMany({
        where: { role: 'client' },
        select: { email: true, name: true },
      });

      const startStr = new Date(startsAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
      const endStr = new Date(endsAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
      for (const u of clients) {
        await prisma.emailOutbox.create({
          data: {
            templateKey: 'announcement',
            templateName: 'Maintenance Announcement',
            to: [u.email],
            subject: '[Urb TecTrack] Maintenance Notice',
            body:
              `Dear ${u.name},\n\n` +
              `We have a maintenance notice for the Urb TecTrack portal:\n\n` +
              `${message}\n\n` +
              `Active from: ${startStr}\n` +
              `Active until: ${endStr}\n\n` +
              `Warm regards,\nUrbeno Private Limited`,
            status: 'queued',
          },
        });
      }

      await prisma.announcement.update({ where: { id: ann.id }, data: { emailSent: true } });
      await processEmailQueue();
    }

    return ann;
  });

  // Delete announcement
  app.delete('/admin/announcements/:id', { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      await prisma.announcement.delete({ where: { id } });
      return { ok: true };
    } catch {
      return reply.status(404).send({ message: 'Not found' });
    }
  });
}
