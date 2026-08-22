import { AppError } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';

/** Reject invoice numbers reused on another request for the same client account. */
export async function assertClientInvoiceNoUnique(
  clientId: string,
  invoiceNo: string,
  opts?: { excludeInvoiceId?: string; excludeSubmissionId?: string },
) {
  const normalized = invoiceNo.trim();
  if (!normalized) return;

  const existing = await prisma.invoice.findFirst({
    where: {
      invoiceNo: normalized,
      submission: { clientId },
      ...(opts?.excludeInvoiceId ? { id: { not: opts.excludeInvoiceId } } : {}),
      ...(opts?.excludeSubmissionId ? { submissionId: { not: opts.excludeSubmissionId } } : {}),
    },
    select: {
      invoiceNo: true,
      submissionId: true,
    },
  });

  if (existing) {
    throw new AppError(
      `Invoice number ${normalized} is already used on request ${existing.submissionId} for this client. Each invoice number can only be used once per client account.`,
    );
  }
}

export interface SerialDuplicateHit {
  serialNo: string;
  submissionId: string;
}

/** Reject serial numbers already recorded on another request for the same client. */
export async function findClientSerialDuplicates(
  clientId: string,
  serialNos: string[],
  currentSubmissionId: string,
): Promise<SerialDuplicateHit[]> {
  const normalized = [...new Set(serialNos.map((s) => s.trim()).filter(Boolean))];
  if (!normalized.length) return [];

  const hits = await prisma.serial.findMany({
    where: {
      serialNo: { in: normalized },
      recycling: {
        invoice: {
          submission: {
            clientId,
            id: { not: currentSubmissionId },
          },
        },
      },
    },
    select: {
      serialNo: true,
      recycling: {
        select: {
          invoice: { select: { submissionId: true } },
        },
      },
    },
  });

  const seen = new Map<string, string>();
  for (const hit of hits) {
    if (!seen.has(hit.serialNo)) {
      seen.set(hit.serialNo, hit.recycling.invoice.submissionId);
    }
  }
  return [...seen.entries()].map(([serialNo, submissionId]) => ({ serialNo, submissionId }));
}

export async function assertClientSerialsUnique(
  clientId: string,
  serialNos: string[],
  currentSubmissionId: string,
) {
  const dupes = await findClientSerialDuplicates(clientId, serialNos, currentSubmissionId);
  if (!dupes.length) return;

  const detail = dupes
    .slice(0, 5)
    .map((d) => `${d.serialNo} (already on ${d.submissionId})`)
    .join('; ');
  const more = dupes.length > 5 ? ` (+${dupes.length - 5} more)` : '';
  throw new AppError(
    `Serial number(s) already recorded on another request for this client: ${detail}${more}. A serial can only be updated once per client account.`,
  );
}
