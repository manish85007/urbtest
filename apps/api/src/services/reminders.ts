import {
  SLA_LABEL,
  formatINR,
  getPayStatus,
  invoiceDue,
  paymentTermsLabel,
  recyclingSla,
  sumPaise,
} from '@urb-tectrack/shared';
import { prisma } from '../lib/prisma.js';
import { sendTransactionalEmail } from './email.js';
import { notifyStaff, notifyUsers } from './notifications.js';

const PAY_REMINDER_MAX = Number(process.env.PAY_REMINDER_MAX ?? 12);
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

  let sentPay = 0;
  let sentSla = 0;

  for (const inv of invoices) {
    const sub = inv.submission;
    const paidPaise = sumPaise(inv.payments.map((p) => p.amountPaise));
    const pay = getPayStatus(inv.totalPaise, paidPaise);

    if (pay.key !== 'paid') {
      const due = invoiceDue(inv.invoiceDate, sub.client.payTermsDays);
      const key = `pay:${inv.id}`;
      const { already, count } = await reminderSentToday(key);

      if (due.isOverdue && !already && count < PAY_REMINDER_MAX) {
        const clientUsers = await prisma.user.findMany({
          where: { clientId: sub.clientId, active: true },
          select: { email: true },
        });
        const to = [
          ...new Set([
            sub.createdBy,
            sub.client.email,
            ...clientUsers.map((u) => u.email),
          ]),
        ].filter(Boolean) as string[];

        await sendTransactionalEmail('payment_reminder', to, {
          request_id: sub.id,
          invoice_no: inv.invoiceNo,
          invoice_date: inv.invoiceDate.toISOString().slice(0, 10),
          invoice_total: formatINR(Number(inv.totalPaise)),
          amount_paid: formatINR(Number(paidPaise)),
          amount_due: formatINR(Number(pay.duePaise)),
          payment_terms: paymentTermsLabel(sub.client.payTermsDays),
          due_date: due.dueDate,
          overdue_line: `Overdue by     : ${due.overdue} day${due.overdue === 1 ? '' : 's'}`,
          contact_name: sub.site.contactName ?? sub.client.contact ?? 'Customer',
          client_name: sub.client.name,
        });

        await notifyUsers(
          to,
          'pay.due',
          `Invoice ${inv.invoiceNo} is overdue by ${due.overdue} day${due.overdue === 1 ? '' : 's'} — ${formatINR(Number(pay.duePaise))} outstanding`,
          sub.id,
        );

        await markReminderSent(key);
        sentPay++;
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
            where: { role: { in: ['admin', 'factory'] }, active: true },
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
