import {
  SLA_LABEL,
  getPayStatus,
  settledPaise,
  invoiceDue,
  recyclingSla,
} from '@urb-tectrack/shared';
import { prisma } from '../lib/prisma.js';
import { sendTransactionalEmail } from './email.js';
import { notifyAdmins, notifyStaff } from './notifications.js';
import { buildPaymentDigest, type PendingPayment } from './payment-digest.js';

const SLA_RECYCLE_DAYS = Number(process.env.SLA_RECYCLE_DAYS ?? 30);
const SLA_WARN_AT = Number(process.env.SLA_WARN_AT ?? 0.8);

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

async function reminderSentToday(key: string): Promise<{ already: boolean; count: number }> {
  const day = todayIso();
  const rec = await prisma.reminderLog.findUnique({ where: { key } });
  if (!rec) return { already: false, count: 0 };
  const last = rec.lastRun.toISOString().slice(0, 10);
  return { already: last === day, count: rec.count };
}

async function markReminderSent(key: string) {
  const day = new Date(todayIso());
  const existing = await prisma.reminderLog.findUnique({ where: { key } });
  if (existing) {
    await prisma.reminderLog.update({
      where: { key },
      data: { lastRun: day, count: { increment: 1 } },
    });
  } else {
    await prisma.reminderLog.create({ data: { key, lastRun: day, count: 1 } });
  }
}

async function markReminderOnce(key: string) {
  const existing = await prisma.reminderLog.findUnique({ where: { key } });
  if (existing) return false;
  await prisma.reminderLog.create({
    data: { key, lastRun: new Date(todayIso()), count: 1 },
  });
  return true;
}

/**
 * One daily digest to the Super Admins for invoices that are past their terms with
 * no payment recorded. Clients are never mailed about payment; recording it is an
 * internal step, and the request cannot close until it is done.
 */
async function remindAdminsToRecordPayments(pending: PendingPayment[]): Promise<number> {
  const { already } = await reminderSentToday('pay-digest');
  if (already) return 0;

  const admins = await prisma.user.findMany({
    where: { role: 'admin', active: true },
    select: { email: true },
  });
  if (!admins.length) return 0;

  const digest = buildPaymentDigest(pending);

  await sendTransactionalEmail(
    'payment_reminder',
    admins.map((a) => a.email),
    {
      invoice_count: digest.count,
      total_outstanding: digest.totalOutstanding,
      invoice_list: digest.invoiceList,
    },
  );

  await notifyAdmins(
    'pay.due',
    `${digest.count} invoice${digest.count === 1 ? '' : 's'} overdue with no payment recorded — ${digest.totalOutstanding} outstanding`,
    '/requests',
  );

  await markReminderSent('pay-digest');
  return digest.count;
}

/** Nightly payment + SLA reminders — ported from prototype runReminders(). */
export async function runReminders() {
  const invoices = await prisma.invoice.findMany({
    where: { closedAt: null },
    include: {
      payments: true,
      mrn: true,
      certificates: { orderBy: { uploadedAt: 'asc' }, take: 1 },
      submission: {
        include: {
          client: true,
          site: true,
        },
      },
    },
  });

  const pendingPayments: PendingPayment[] = [];
  let sentSla = 0;

  for (const inv of invoices) {
    const sub = inv.submission;
    const paidPaise = settledPaise(inv.payments);
    const pay = getPayStatus(inv.totalPaise, paidPaise);

    if (pay.key !== 'paid') {
      const due = invoiceDue(inv.invoiceDate, sub.client.payTermsDays);
      if (due.isOverdue) {
        pendingPayments.push({
          invoiceNo: inv.invoiceNo,
          requestId: sub.id,
          clientName: sub.client.name,
          dueDate: due.dueDate,
          overdueDays: due.overdue,
          totalPaise: Number(inv.totalPaise),
          duePaise: Number(pay.duePaise),
        });
      }
    }

    if (inv.mrn) {
      const certAt = inv.certificates[0]?.uploadedAt ?? null;
      const sla = recyclingSla({
        mrnReceivedAt: inv.mrn.receivedAt,
        certificateAt: certAt,
        slaDays: SLA_RECYCLE_DAYS,
        warnAtPct: SLA_WARN_AT,
      });

      if (sla && !sla.done && (sla.state === 'warn' || sla.state === 'breached')) {
        const key = `sla:${inv.id}:${sla.state}`;
        const firstTime = await markReminderOnce(key);
        if (firstTime) {
          const staff = await prisma.user.findMany({
            where: { role: { in: ['admin', 'operations', 'factory'] }, active: true },
            select: { email: true },
          });
          const to = staff.map((u) => u.email);

          await sendTransactionalEmail('sla_alert', to, {
            request_id: sub.id,
            invoice_no: inv.invoiceNo,
            client_name: sub.client.name,
            received_date: inv.mrn.receivedAt.toISOString().slice(0, 10),
            target_date: sla.targetDate,
            days_used: sla.daysUsed,
            sla_days: sla.slaDays,
            sla_state: SLA_LABEL[sla.state],
          });

          await notifyStaff(
            'sla',
            `${inv.invoiceNo} — recycling SLA ${SLA_LABEL[sla.state].toLowerCase()} (${sla.daysUsed} of ${sla.slaDays} days)`,
            sub.id,
          );

          sentSla++;
        }
      }
    }
  }

  const sentPay = pendingPayments.length ? await remindAdminsToRecordPayments(pendingPayments) : 0;

  return { sentPay, sentSla };
}

export async function runRemindersIfDue() {
  const key = 'daily:reminders';
  const { already } = await reminderSentToday(key);
  if (already) return { skipped: true as const, sentPay: 0, sentSla: 0 };

  const result = await runReminders();
  await markReminderSent(key);
  return { skipped: false as const, ...result };
}
