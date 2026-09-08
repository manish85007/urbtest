import { getPayStatus, settledPaise } from '@urb-tectrack/shared';
import type { SessionUser } from '../lib/auth-context.js';
import { prisma } from '../lib/prisma.js';
import { closeInvoice } from './invoice-service.js';

export const AUTO_CLOSE_DAYS = Number(process.env.AUTO_CLOSE_DAYS ?? 60);

/** Synthetic Super Admin used by the nightly auto-close job. */
export const SYSTEM_AUTO_CLOSE_ACTOR: SessionUser = {
  id: 'system-auto-close',
  email: 'system@urbeno.in',
  name: 'Urb TecTrack (auto-close)',
  role: 'admin',
  clientId: null,
  factoryIds: [],
  siteIds: [],
  featureAccess: null,
  emailNotifyMode: 'all',
};

export interface AutoCloseEligibility {
  closedAt: Date | null;
  clientPublishedAt: Date | null;
  firstCertAt: Date | null;
  totalPaise: bigint | number | string;
  paidPaise: bigint | number | string;
  now?: Date;
  autoCloseDays?: number;
}

function asPaise(v: bigint | number | string): bigint {
  try {
    return typeof v === 'bigint' ? v : BigInt(v);
  } catch {
    return 0n;
  }
}

/**
 * Invoice may auto-close when Form 6 & CoD are published to the client, the
 * invoice is fully paid, and AUTO_CLOSE_DAYS have passed since the first certificate.
 */
export function isEligibleForAutoClose(input: AutoCloseEligibility): boolean {
  if (input.closedAt) return false;
  if (!input.clientPublishedAt) return false;
  if (!input.firstCertAt) return false;
  const days = input.autoCloseDays ?? AUTO_CLOSE_DAYS;
  const now = input.now ?? new Date();
  const ageDays = (now.getTime() - input.firstCertAt.getTime()) / 86_400_000;
  if (ageDays < days) return false;
  const pay = getPayStatus(asPaise(input.totalPaise), asPaise(input.paidPaise));
  return pay.key === 'paid';
}

export interface AutoCloseResult {
  examined: number;
  closed: number;
  skipped: number;
  closedInvoiceNos: string[];
}

/**
 * Close every open invoice that has been certified and fully paid for
 * AUTO_CLOSE_DAYS since the first Certificate of Destruction.
 */
export async function runAutoCloseInvoices(): Promise<AutoCloseResult> {
  const cutoff = new Date(Date.now() - AUTO_CLOSE_DAYS * 86_400_000);

  const candidates = await prisma.invoice.findMany({
    where: {
      closedAt: null,
      recycling: { is: { clientPublishedAt: { not: null } } },
      certificates: { some: { uploadedAt: { lte: cutoff } } },
    },
    include: {
      payments: { select: { amountPaise: true, tdsPaise: true } },
      certificates: {
        select: { uploadedAt: true },
        orderBy: { uploadedAt: 'asc' },
        take: 1,
      },
      recycling: { select: { clientPublishedAt: true } },
    },
  });

  const closedInvoiceNos: string[] = [];
  let skipped = 0;

  for (const inv of candidates) {
    const firstCertAt = inv.certificates[0]?.uploadedAt ?? null;
    const paidPaise = settledPaise(inv.payments);
    if (
      !isEligibleForAutoClose({
        closedAt: null,
        clientPublishedAt: inv.recycling?.clientPublishedAt ?? null,
        firstCertAt,
        totalPaise: inv.totalPaise,
        paidPaise,
      })
    ) {
      skipped++;
      continue;
    }

    try {
      await closeInvoice(SYSTEM_AUTO_CLOSE_ACTOR, inv.id, {
        forced: true,
        auto: true,
        note: `Auto-closed after ${AUTO_CLOSE_DAYS} days from first certificate.`,
      });
      closedInvoiceNos.push(inv.invoiceNo);
    } catch {
      skipped++;
    }
  }

  return {
    examined: candidates.length,
    closed: closedInvoiceNos.length,
    skipped,
    closedInvoiceNos,
  };
}
