import '../lib/load-env.js';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { FileKind } from '@prisma/client';
import { invStage, localYmd } from '@urb-tectrack/shared';
import { prisma } from '../lib/prisma.js';
import { toSessionUser } from '../lib/auth-context.js';
import { deriveSubmissionStage } from '../lib/stage-mapper.js';
import { submissionInclude } from '../lib/db-helpers.js';
import { createSubmission, acknowledgeSubmission } from '../services/submission-service.js';
import {
  addPayment,
  approveRecycling,
  certifyCompliancePublish,
  closeInvoice,
  createInvoice,
  createMrn,
  createRecycling,
  updateMrn,
  updateRecycling,
  uploadCertificate,
} from '../services/invoice-service.js';
import { addVehicle, completeLoading, recordWeighment, updateVehicle } from '../services/vehicle-service.js';

const hasDb = !!process.env.DATABASE_URL;

async function actor(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(`Missing seeded user: ${email}`);
  return toSessionUser(user);
}

async function seedFile(kind: FileKind, uploadedBy: string) {
  return prisma.storedFile.create({
    data: {
      name: `test-${kind}.bin`,
      mimeType: kind === 'certificate' ? 'application/pdf' : 'image/jpeg',
      sizeBytes: 128,
      kind,
      storageKey: `test/${crypto.randomUUID()}`,
      uploadedBy,
    },
  });
}

describe.skipIf(!hasDb)('full lifecycle integration', () => {
  let submissionId = '';
  let invoiceId = '';
  let vehicleId = '';

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    if (submissionId) {
      await prisma.submission.deleteMany({ where: { id: submissionId } });
    }
    await prisma.$disconnect();
  });

  it('walks stages 1–9 for a new submission', async (ctx) => {
    try {
      await prisma.user.findFirst({ select: { passwordSetAt: true } });
    } catch {
      ctx.skip();
      return;
    }

    const client = await actor('ramesh@techcorp.in');
    const admin = await actor('admin@urbeno.in');
    const factory = await actor('blr@urbeno.in');

    const today = localYmd();
    const site = await prisma.site.findFirst({ where: { clientId: 'TCPL', code: 'BLR' } });
    expect(site).toBeTruthy();

    await expect(
      createSubmission(client, {
        clientId: 'TCPL',
        siteId: site!.id,
        requestDate: '2020-01-15',
        location: 'Past date should fail',
        approxQty: 10,
        approxWeight: 50,
        notes: 'Automated lifecycle test',
        items: [{ name: 'Mixed e-waste', qty: 10, weightKg: 50, hsn: '854890' }],
      }),
    ).rejects.toMatchObject({ message: expect.stringMatching(/past/i) });

    const sub = await createSubmission(client, {
      clientId: 'TCPL',
      siteId: site!.id,
      requestDate: today,
      location: 'Integration test bay',
      approxQty: 10,
      approxWeight: 50,
      notes: 'Automated lifecycle test',
      items: [{ name: 'Mixed e-waste', qty: 10, weightKg: 50, hsn: '854890' }],
    });
    submissionId = sub.id;
    expect(sub.derivedStage).toBe(1);

    const ack = await acknowledgeSubmission(admin, submissionId);
    expect(ack.derivedStage).toBeGreaterThanOrEqual(2);

    const { vehicle } = await addVehicle(admin, submissionId, {
      registration: 'KAINT2026',
      vehicleType: 'VT2',
      driverName: 'Test Driver',
      driverPhone: '+91 99000 00000',
      team: [{ name: 'Test Driver', role: 'TR1', phone: '+91 99000 00000' }],
    });
    vehicleId = vehicle.id;

    await expect(
      updateVehicle(admin, vehicleId, {
        registration: 'KAINTBROKE',
        vehicleType: 'VT3',
        driverName: 'Test Driver',
        driverPhone: '+91 99000 00000',
        team: [{ name: 'Test Driver', role: 'TR1', phone: '+91 99000 00000' }],
      }),
    ).rejects.toThrow(/remark/i);

    await updateVehicle(admin, vehicleId, {
      registration: 'KAINTBROKE',
      vehicleType: 'VT3',
      driverName: 'Test Driver',
      driverPhone: '+91 99000 00000',
      team: [{ name: 'Test Driver', role: 'TR1', phone: '+91 99000 00000' }],
      changeRemark: 'Breakdown at client gate — replacement vehicle assigned.',
    });

    await updateVehicle(admin, vehicleId, {
      registration: 'KAINT2026',
      vehicleType: 'VT2',
      driverName: 'Test Driver',
      driverPhone: '+91 99000 00000',
      team: [{ name: 'Test Driver', role: 'TR1', phone: '+91 99000 00000' }],
      changeRemark: 'Original vehicle restored after the test swap.',
    });

    const slip = await seedFile('weighPhoto', admin.email);
    const pick = await seedFile('pickPhoto', admin.email);

    await recordWeighment(admin, vehicleId, {
      gross: 1200,
      tare: 1150,
      slipNumber: 'WB-INT-001',
      weighedAt: '2026-08-16',
      slipPhotoIds: [slip.id],
      pickupPhotoIds: [pick.id],
    });

    await completeLoading(admin, submissionId);

    const invoiced = await createInvoice(admin, submissionId, {
      invoiceNo: `INV-INT-${Date.now()}`,
      invoiceDate: '2026-08-16',
      taxableAmount: 5000,
      taxRatePct: 18,
      billingWeight: 50,
      ewayBillNo: 'EWB-INT-001',
      ewayBillDate: '2026-08-16',
      vehicleIds: [vehicleId],
    });
    expect(invoiced.invoices.length).toBe(1);
    invoiceId = invoiced.invoices[0].id;
    expect(invoiced.invoices[0].derivedStage).toBe(5);

    const gate = await seedFile('pickPhoto', factory.email);
    const inside = await seedFile('processing', factory.email);

    await createMrn(factory, invoiceId, {
      factoryId: 'URB-BLR',
      receivedAt: '2026-08-16',
      driverSign: 'Driver',
      managerSign: 'Manager',
      securitySign: 'Security',
      materials: [{ name: 'Mixed e-waste', qty: 10, weight: 50 }],
      gatePhotoIds: [gate.id],
      materialPhotoIds: [inside.id],
    });

    await expect(
      updateMrn(factory, invoiceId, {
        factoryId: 'URB-BLR',
        receivedAt: '2026-08-16',
        driverSign: 'Driver',
        managerSign: 'Manager',
        securitySign: 'Security',
        materials: [{ name: 'Mixed e-waste', qty: 10, weight: 50 }],
        gatePhotoIds: [gate.id],
        materialPhotoIds: [inside.id],
      }),
    ).rejects.toMatchObject({ message: expect.stringMatching(/permission|Admin/i), statusCode: 403 });

    await expect(
      updateMrn(admin, invoiceId, {
        factoryId: 'URB-BLR',
        receivedAt: '2026-08-16',
        driverSign: 'Driver',
        managerSign: 'Manager',
        securitySign: 'Security',
        materials: [{ name: 'Mixed e-waste', qty: 10, weight: 49 }],
        gatePhotoIds: [gate.id],
        materialPhotoIds: [inside.id],
      }),
    ).rejects.toMatchObject({ message: expect.stringMatching(/billing weight/i) });

    const corrected = await updateMrn(admin, invoiceId, {
      factoryId: 'URB-BLR',
      receivedAt: '2026-08-16',
      driverSign: 'Driver',
      managerSign: 'Factory Manager',
      securitySign: 'Security',
      materials: [{ name: 'Mixed e-waste', qty: 10, weight: 50 }],
      condition: 'Good — corrected',
      gatePhotoIds: [gate.id],
      materialPhotoIds: [inside.id],
    });
    expect(corrected.managerSign).toBe('Factory Manager');
    expect(corrected.condition).toBe('Good — corrected');

    const certTooSoon = await seedFile('certificate', admin.email);
    await expect(
      uploadCertificate(admin, invoiceId, {
        certNo: `URB/EARLY/${Date.now()}`,
        certDate: '2026-08-16',
        fileId: certTooSoon.id,
      }),
    ).rejects.toMatchObject({ message: expect.stringMatching(/Form 6/i) });

    await createRecycling(factory, invoiceId, {
      processedAt: today,
      factoryId: 'URB-BLR',
      devicesDestroyed: 10,
      categories: [{ entryId: 'REC-ITEW2', groupCode: 'ITEW', weightKg: 50 }],
    });

    const edited = await updateRecycling(factory, invoiceId, {
      processedAt: today,
      factoryId: 'URB-BLR',
      devicesDestroyed: 11,
      categories: [{ entryId: 'REC-ITEW2', groupCode: 'ITEW', weightKg: 50 }],
    });
    expect(edited.devicesDestroyed).toBe(11);
    expect(edited.reviewStatus).toBe('pending_review');
    expect(edited.clientPublishedAt).toBeNull();

    await expect(
      uploadCertificate(admin, invoiceId, {
        certNo: `URB/INT/${Date.now()}`,
        certDate: today,
        fileId: (await seedFile('certificate', admin.email)).id,
      }),
    ).rejects.toMatchObject({ message: expect.stringMatching(/approve Form 6/i) });

    await approveRecycling(admin, invoiceId);

    const certFile = await seedFile('certificate', admin.email);
    await uploadCertificate(admin, invoiceId, {
      certNo: `URB/INT/${Date.now()}`,
      certDate: today,
      fileId: certFile.id,
    });

    await expect(
      closeInvoice(client, invoiceId, { rating: 5, note: 'too early' }),
    ).rejects.toMatchObject({ message: expect.stringMatching(/certificate|stage|Upload/i) });

    await certifyCompliancePublish(admin, invoiceId, { acknowledged: true });

    const invoice = await prisma.invoice.findUniqueOrThrow({
      where: { id: invoiceId },
      include: { payments: true },
    });

    const rupees = Number(invoice.totalPaise) / 100;
    await addPayment(admin, invoiceId, {
      utr: `UTR-INT-${Date.now()}`,
      amount: rupees - 118,
      tdsAmount: 118,
      paidAt: today,
      mode: 'PM1',
    });

    await closeInvoice(client, invoiceId, { rating: 5, note: 'Integration test close' });

    await expect(
      updateRecycling(factory, invoiceId, {
        processedAt: today,
        factoryId: 'URB-BLR',
        devicesDestroyed: 12,
        categories: [{ entryId: 'REC-ITEW2', groupCode: 'ITEW', weightKg: 50 }],
      }),
    ).rejects.toMatchObject({ message: expect.stringMatching(/closed/i) });

    await expect(
      addPayment(admin, invoiceId, {
        utr: `UTR-CLOSED-${Date.now()}`,
        amount: 1,
        paidAt: today,
        mode: 'PM1',
      }),
    ).rejects.toMatchObject({ message: expect.stringMatching(/closed/i) });

    const final = await prisma.submission.findUniqueOrThrow({
      where: { id: submissionId },
      include: submissionInclude,
    });

    expect(final.closedAt).toBeTruthy();
    expect(final.invoices.every((i) => i.closedAt)).toBe(true);
    expect(
      invStage({
        closedAt: final.invoices[0].closedAt,
        hasCertificate: final.invoices[0].certificates.length > 0,
        hasRecycling: !!final.invoices[0].recycling,
        hasMrn: !!final.invoices[0].mrn,
      }),
    ).toBe(9);
    expect(deriveSubmissionStage(final)).toBe(9);
  });
});
