import '../lib/load-env.js';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/prisma.js';
import { toSessionUser } from '../lib/auth-context.js';
import { assertClientInvoiceNoUnique, assertClientSerialsUnique } from '../services/duplicate-service.js';
import { AppError } from '../lib/errors.js';

const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)('client-level duplicate checks', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('rejects invoice numbers already used on another request for the same client', async () => {
    const existing = await prisma.invoice.findFirst({
      where: { submission: { clientId: 'TCPL' } },
      select: { invoiceNo: true, submissionId: true },
    });
    expect(existing).toBeTruthy();

    const otherSub = await prisma.submission.findFirst({
      where: { clientId: 'TCPL', id: { not: existing!.submissionId } },
      select: { id: true },
    });
    expect(otherSub).toBeTruthy();

    await expect(
      assertClientInvoiceNoUnique('TCPL', existing!.invoiceNo, {
        excludeSubmissionId: otherSub!.id,
      }),
    ).rejects.toBeInstanceOf(AppError);

    try {
      await assertClientInvoiceNoUnique('TCPL', existing!.invoiceNo, {
        excludeSubmissionId: otherSub!.id,
      });
    } catch (err) {
      expect(String((err as AppError).message)).toContain(existing!.submissionId);
    }
  });

  it('rejects serial numbers already recorded on another request for the same client', async () => {
    const existing = await prisma.serial.findFirst({
      where: { recycling: { invoice: { submission: { clientId: 'TCPL' } } } },
      select: {
        serialNo: true,
        recycling: { select: { invoice: { select: { submissionId: true } } } },
      },
    });
    if (!existing) return;

    const otherSub = await prisma.submission.findFirst({
      where: { clientId: 'TCPL', id: { not: existing.recycling.invoice.submissionId } },
      select: { id: true },
    });
    expect(otherSub).toBeTruthy();

    await expect(
      assertClientSerialsUnique('TCPL', [existing.serialNo], otherSub!.id),
    ).rejects.toBeInstanceOf(AppError);

    try {
      await assertClientSerialsUnique('TCPL', [existing.serialNo], otherSub!.id);
    } catch (err) {
      expect(String((err as AppError).message)).toContain(existing.recycling.invoice.submissionId);
    }
  });
});
