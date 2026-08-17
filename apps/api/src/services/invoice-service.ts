import type { Prisma } from '@prisma/client';
import {
  deriveTax,
  deriveTotal,
  getPayStatus,
  matTotal,
  recoveryFor,
  rupeesToPaise,
  unpaidCloseMessage,
  formatMrnNumber,
  getFY,
  type MaterialGroupCode,
} from '@urb-tectrack/shared';
import type { SessionUser } from '../lib/auth-context.js';
import { AppError } from '../lib/errors.js';
import { roundKg, round2, toKg } from '../lib/decimal.js';
import { prisma } from '../lib/prisma.js';
import { nextSequence } from '../lib/db-helpers.js';
import {
  loadInvoiceForActor,
  loadSubmissionForActor,
  requireAdmin,
  requireFactory,
  requireStaff,
  syncSubmissionClosure,
} from '../lib/access.js';
import { deriveInvoiceStage, withDerivedStages } from '../lib/stage-mapper.js';
import { auditLog } from './audit.js';
import { assertFilesExist } from './file-service.js';
import { assertCategoryCapacityOrOverride } from './category-capacity.js';
import { sendTransactionalEmail } from './email.js';
import { notifyAdmins, notifyClientUsers } from './notifications.js';

async function allocateMrnInTx(
  tx: Prisma.TransactionClient,
  factoryId: string,
  receivedAt: Date,
) {
  const fy = getFY(receivedAt);
  if (!fy) throw new AppError('Invalid receipt date for MRN numbering.');

  const counter = await tx.mrnCounter.upsert({
    where: { factoryId_fy: { factoryId, fy: fy.short } },
    create: { factoryId, fy: fy.short, lastValue: 1 },
    update: { lastValue: { increment: 1 } },
  });

  return {
    mrnNo: formatMrnNumber(factoryId, fy.short, counter.lastValue),
    sequence: counter.lastValue,
  };
}

export interface CreateInvoiceInput {
  invoiceNo: string;
  invoiceDate: string;
  taxableAmount: number;
  taxRatePct?: number;
  billingWeight?: number;
  deviationNote?: string;
  billingMode?: string;
  ewayBillNo: string;
  ewayBillDate: string;
  vehicleIds?: string[];
  invoiceFileId?: string;
  ewayFileId?: string;
}

export interface PaymentInput {
  utr: string;
  amount: number;
  paidAt: string;
  mode: string;
  note?: string;
}

export interface MrnInput {
  factoryId: string;
  receivedAt: string;
  driverSign?: string;
  managerSign?: string;
  securitySign?: string;
  materials?: Array<{ name: string; qty: number; weight: number }>;
  condition?: string;
  note?: string;
  gatePhotoIds?: string[];
  materialPhotoIds?: string[];
}

export interface RecyclingCategoryInput {
  entryId: string;
  groupCode: MaterialGroupCode;
  weightKg: number;
  recoveryFe?: number;
  recoveryNfe?: number;
  recoveryPl?: number;
  recoveryPcb?: number;
  overrideReason?: string;
}

export interface RecyclingInput {
  processedAt: string;
  factoryId?: string;
  divertedPct?: number;
  devicesDestroyed?: number;
  categories: RecyclingCategoryInput[];
  photoIds?: string[];
  reportIds?: string[];
  serialFileId?: string;
  serials?: Array<{ serialNo: string; assetTag?: string; make?: string; model?: string }>;
}

export interface CertificateInput {
  certNo: string;
  certDate: string;
  department?: string;
  fileId: string;
  note?: string;
}

export interface CloseInvoiceInput {
  rating?: number;
  note?: string;
  forced?: boolean;
}

export async function createInvoice(
  actor: SessionUser,
  submissionId: string,
  input: CreateInvoiceInput,
) {
  requireStaff(actor);
  const sub = await loadSubmissionForActor(submissionId, actor);

  const duplicate = sub.invoices.some((i) => i.invoiceNo === input.invoiceNo.trim());
  if (duplicate) {
    throw new AppError(`Invoice ${input.invoiceNo.trim()} already exists on this request.`);
  }

  const vehicleIds = input.vehicleIds ?? [];
  const vehNet = sub.vehicles
    .filter((v) => vehicleIds.includes(v.id))
    .reduce((sum, v) => sum + toKg(v.weighment?.netKg), 0);

  const billWt =
    input.billingWeight !== undefined && input.billingWeight !== null
      ? toKg(input.billingWeight)
      : roundKg(vehNet);

  const dev = vehNet ? round2(billWt - vehNet) : 0;
  if (vehNet && Math.abs(dev) >= 0.01 && !String(input.deviationNote || '').trim()) {
    throw new AppError(
      `Billing weight (${billWt} kg) does not match the weighed vehicle net (${vehNet} kg). Record the reason for the ${dev > 0 ? 'excess' : 'shortfall'} of ${Math.abs(dev)} kg in the deviation note.`,
    );
  }

  const taxRatePct = input.taxRatePct ?? 18;
  const taxablePaise = BigInt(rupeesToPaise(input.taxableAmount));
  const taxPaise = BigInt(deriveTax(Number(taxablePaise), taxRatePct));
  const totalPaise = BigInt(deriveTotal(Number(taxablePaise), taxRatePct));

  const invoice = await prisma.invoice.create({
    data: {
      submissionId,
      invoiceNo: input.invoiceNo.trim(),
      invoiceDate: new Date(input.invoiceDate),
      taxablePaise,
      taxRatePct,
      taxPaise,
      totalPaise,
      billingWeight: billWt,
      vehicleNetKg: vehNet || null,
      deviationKg: dev,
      deviationNote: String(input.deviationNote || '').trim() || null,
      billingMode: input.billingMode || 'urbeno',
      ewayBillNo: input.ewayBillNo.trim(),
      ewayBillDate: new Date(input.ewayBillDate),
      invoiceFileId: input.invoiceFileId ?? null,
      ewayFileId: input.ewayFileId ?? null,
      vehicleIds,
      createdBy: actor.email,
    },
  });

  await auditLog({
    actorEmail: actor.email,
    actorId: actor.id,
    action: 'inv.create',
    entity: 'invoice',
    entityId: invoice.invoiceNo,
    details: { submissionId, amount: input.taxableAmount, eway: invoice.ewayBillNo },
  });

  await notifyClientUsers(
    sub.clientId,
    'inv.new',
    `Invoice ${invoice.invoiceNo} raised for ${sub.id}`,
    sub.id,
  );

  const refreshed = await loadSubmissionForActor(submissionId, actor);
  return withDerivedStages(refreshed);
}

export async function addPayment(actor: SessionUser, invoiceId: string, input: PaymentInput) {
  requireStaff(actor);
  const invoice = await loadInvoiceForActor(invoiceId, actor);

  const payment = await prisma.payment.create({
    data: {
      invoiceId,
      utr: input.utr.trim(),
      amountPaise: BigInt(rupeesToPaise(input.amount)),
      paidAt: new Date(input.paidAt),
      mode: input.mode,
      note: input.note?.trim() || null,
    },
  });

  await auditLog({
    actorEmail: actor.email,
    actorId: actor.id,
    action: 'inv.payment',
    entity: 'invoice',
    entityId: invoice.invoiceNo,
    details: { submissionId: invoice.submissionId, utr: payment.utr, amount: input.amount },
  });

  return payment;
}

export async function createMrn(actor: SessionUser, invoiceId: string, input: MrnInput) {
  const invoice = await loadInvoiceForActor(invoiceId, actor);
  requireFactory(actor, input.factoryId);

  if (invoice.mrn) throw new AppError('This invoice already has an MRN.');

  const factory = await prisma.factorySite.findUnique({ where: { id: input.factoryId } });
  if (!factory) throw new AppError('Select a factory site.');

  const materials = (input.materials ?? [])
    .map((m) => ({
      n: String(m.name ?? '').trim(),
      q: Number(m.qty) || 0,
      w: Number(m.weight) || 0,
    }))
    .filter((m) => m.n);
  if (!materials.length) {
    throw new AppError('Record at least one material line counted at the gate.');
  }

  const driverSign = input.driverSign?.trim() || '';
  const managerSign = input.managerSign?.trim() || '';
  const securitySign = input.securitySign?.trim() || '';
  if (!driverSign || !managerSign || !securitySign) {
    throw new AppError('All three signatures are required on the gate document (driver, factory manager, security).');
  }

  const gatePhotoIds = [...new Set(input.gatePhotoIds ?? [])];
  const materialPhotoIds = [...new Set(input.materialPhotoIds ?? [])];
  if (!gatePhotoIds.length) {
    throw new AppError('Upload at least one photograph of the vehicle at the gate.');
  }
  if (!materialPhotoIds.length) {
    throw new AppError('Upload at least one photograph of the material inside the vehicle.');
  }
  await assertFilesExist(gatePhotoIds, ['pickPhoto']);
  await assertFilesExist(materialPhotoIds, ['processing', 'pickPhoto']);

  const invoiceVehs = invoice.submission.vehicles.filter(
    (v) => !invoice.vehicleIds.length || invoice.vehicleIds.includes(v.id),
  );
  if (!invoiceVehs.length) {
    throw new AppError('This invoice has no vehicles to receive.');
  }
  if (invoiceVehs.some((v) => !v.weighment)) {
    throw new AppError(
      'Every vehicle on this invoice must have a recorded weighment before the MRN can be raised.',
    );
  }

  const receivedAt = new Date(input.receivedAt);

  const mrn = await prisma.$transaction(async (tx) => {
    const { mrnNo } = await allocateMrnInTx(tx, input.factoryId, receivedAt);

    return tx.mrn.create({
      data: {
        invoiceId,
        mrnNo,
        factoryId: input.factoryId,
        receivedAt,
        receivedBy: actor.email,
        driverSign,
        managerSign,
        securitySign,
        materials,
        condition: input.condition?.trim() || 'Good',
        note: input.note?.trim() || null,
        gatePhotoIds,
        materialPhotoIds,
      },
    });
  });

  await auditLog({
    actorEmail: actor.email,
    actorId: actor.id,
    action: 'mrn.create',
    entity: 'mrn',
    entityId: mrn.mrnNo,
    details: { submissionId: invoice.submissionId, invNo: invoice.invoiceNo, factoryId: input.factoryId },
  });

  await notifyAdmins(
    'mrn.new',
    `Goods received at ${factory.name} — MRN ${mrn.mrnNo} for ${invoice.invoiceNo}`,
    invoice.submissionId,
  );

  return mrn;
}

export async function createRecycling(
  actor: SessionUser,
  invoiceId: string,
  input: RecyclingInput,
) {
  const invoice = await loadInvoiceForActor(invoiceId, actor);
  if (!invoice.mrn) throw new AppError('Create the MRN before recycling this invoice.');
  if (invoice.recycling) throw new AppError('This invoice already has a recycling record.');

  const factoryId = input.factoryId || invoice.mrn.factoryId;
  requireFactory(actor, factoryId);

  const target = roundKg(toKg(invoice.billingWeight));
  const split = round2(input.categories.reduce((sum, c) => sum + toKg(c.weightKg), 0));
  if (Math.abs(split - target) >= 0.01) {
    throw new AppError(
      `The category split totals ${split} kg but this invoice covers ${target} kg. Every kilogram received has to land in an authorised category — adjust the split by ${Math.abs(round2(target - split))} kg.`,
    );
  }

  const categoryRows = [];
  let totalFe = 0;
  let totalNfe = 0;
  let totalPl = 0;
  let totalPcb = 0;

  for (const cat of input.categories) {
    const kg = toKg(cat.weightKg);
    const mat =
      cat.recoveryFe !== undefined
        ? {
            fe: cat.recoveryFe,
            nfe: cat.recoveryNfe ?? 0,
            pl: cat.recoveryPl ?? 0,
            pcb: cat.recoveryPcb ?? 0,
          }
        : recoveryFor(cat.groupCode, kg);

    const mt = round2(matTotal(mat));
    if (Math.abs(mt - kg) >= 0.05) {
      throw new AppError(
        `Recovery for ${cat.entryId} totals ${mt} kg against ${kg} kg received in that category. The fractions must account for the whole weight.`,
      );
    }

    const master = await prisma.categoryMaster.findUnique({
      where: { factoryId_entryId: { factoryId, entryId: cat.entryId } },
    });
    if (!master) throw new AppError(`Category ${cat.entryId} is not authorised at ${factoryId}.`);

    const capacityCheck = await assertCategoryCapacityOrOverride({
      factoryId,
      entryId: cat.entryId,
      addKg: kg,
      capacityTpa: Number(master.capacityTpa),
      processedAt: new Date(input.processedAt),
      overrideReason: cat.overrideReason,
    });

    if (capacityCheck.exceeds && cat.overrideReason?.trim()) {
      await auditLog({
        actorEmail: actor.email,
        actorId: actor.id,
        action: 'capacity.override',
        entity: 'invoice',
        entityId: invoice.invoiceNo,
        details: {
          submissionId: invoice.submissionId,
          entryId: cat.entryId,
          projectedKg: capacityCheck.projectedKg,
          capKg: capacityCheck.capKg,
          reason: cat.overrideReason.trim(),
        },
      });
    }

    categoryRows.push({
      categoryId: master.id,
      entryId: cat.entryId,
      groupCode: cat.groupCode,
      weightKg: kg,
      recoveryFe: mat.fe,
      recoveryNfe: mat.nfe,
      recoveryPl: mat.pl,
      recoveryPcb: mat.pcb,
      overrideReason: cat.overrideReason ?? null,
    });

    totalFe += mat.fe;
    totalNfe += mat.nfe;
    totalPl += mat.pl;
    totalPcb += mat.pcb;
  }

  if (input.photoIds?.length) await assertFilesExist(input.photoIds, ['processing']);
  if (input.reportIds?.length) await assertFilesExist(input.reportIds, ['report']);
  if (input.serialFileId) await assertFilesExist([input.serialFileId], ['serials']);

  const form6No = await nextSequence('f6');

  const recycling = await prisma.recycling.create({
    data: {
      invoiceId,
      form6No,
      processedAt: new Date(input.processedAt),
      factoryId,
      divertedPct: input.divertedPct ?? 0,
      devicesDestroyed: Math.max(0, Math.floor(Number(input.devicesDestroyed) || 0)),
      recoveryFe: roundKg(totalFe),
      recoveryNfe: roundKg(totalNfe),
      recoveryPl: roundKg(totalPl),
      recoveryPcb: roundKg(totalPcb),
      photoIds: input.photoIds ?? [],
      reportIds: input.reportIds ?? [],
      serialFileId: input.serialFileId ?? null,
      createdBy: actor.email,
      categories: { create: categoryRows },
      serials: input.serials?.length
        ? {
            create: input.serials.map((s) => ({
              serialNo: s.serialNo,
              assetTag: s.assetTag ?? null,
              make: s.make ?? null,
              model: s.model ?? null,
            })),
          }
        : undefined,
    },
    include: { categories: true },
  });

  await auditLog({
    actorEmail: actor.email,
    actorId: actor.id,
    action: 'recy.create',
    entity: 'recycling',
    entityId: recycling.form6No,
    details: {
      submissionId: invoice.submissionId,
      invNo: invoice.invoiceNo,
      cats: input.categories.map((c) => c.entryId),
    },
  });

  await notifyClientUsers(
    invoice.submission.clientId,
    'recy.done',
    `${invoice.invoiceNo} processed — Form 6 ${recycling.form6No} issued`,
    invoice.submissionId,
  );

  return recycling;
}

export async function uploadCertificate(
  actor: SessionUser,
  invoiceId: string,
  input: CertificateInput,
) {
  requireStaff(actor);
  const invoice = await loadInvoiceForActor(invoiceId, actor);
  if (!invoice.recycling) {
    throw new AppError('Complete recycling before uploading the Certificate of Destruction.');
  }

  const certNo = input.certNo.trim();
  if (!certNo) throw new AppError('Certificate number is required.');
  if (!input.certDate) throw new AppError('Certificate date is required.');
  if (!input.fileId) throw new AppError('Attach the signed Certificate of Destruction PDF.');
  await assertFilesExist([input.fileId], ['certificate']);

  const dupe = await prisma.certificate.findFirst({
    where: { certNo, NOT: { invoiceId } },
  });
  if (dupe) throw new AppError(`Certificate number ${certNo} is already used elsewhere.`);

  const certificate = await prisma.certificate.create({
    data: {
      invoiceId,
      certNo,
      certDate: new Date(input.certDate),
      department: input.department?.trim() || null,
      fileId: input.fileId,
      note: input.note?.trim() || null,
      uploadedBy: actor.email,
      mailedAt: new Date(),
    },
  });

  const recipients = [
    ...new Set([
      invoice.submission.createdBy,
      ...(await prisma.user.findMany({
        where: { clientId: invoice.submission.clientId, active: true },
        select: { email: true },
      })).map((u) => u.email),
    ]),
  ];

  await sendTransactionalEmail('cod_delivery', recipients, {
    request_id: invoice.submissionId,
    invoice_no: invoice.invoiceNo,
    cert_no: certificate.certNo,
    cert_date: input.certDate,
    department: certificate.department || 'All departments',
    net_weight: Number(invoice.billingWeight),
    client_name: invoice.submission.client.name,
  });

  await auditLog({
    actorEmail: actor.email,
    actorId: actor.id,
    action: 'cod.upload',
    entity: 'cod',
    entityId: certificate.certNo,
    details: {
      submissionId: invoice.submissionId,
      invNo: invoice.invoiceNo,
      dept: certificate.department,
      emailed: recipients,
    },
  });

  return certificate;
}

function firstCertificateAt(invoice: Awaited<ReturnType<typeof loadInvoiceForActor>>) {
  if (!invoice.certificates.length) return null;
  return invoice.certificates
    .map((c) => c.uploadedAt)
    .sort((a, b) => a.getTime() - b.getTime())[0];
}

export async function closeInvoice(
  actor: SessionUser,
  invoiceId: string,
  input: CloseInvoiceInput = {},
) {
  const invoice = await loadInvoiceForActor(invoiceId, actor);
  const stage = deriveInvoiceStage(invoice);

  if (invoice.closedAt) throw new AppError('This invoice is already closed.');
  if (!invoice.certificates.length) {
    throw new AppError('No Certificate of Destruction has been uploaded yet.');
  }
  if (stage < 8) {
    throw new AppError('Upload a certificate before closing this invoice.');
  }

  const paid = invoice.payments.reduce((sum, p) => sum + p.amountPaise, 0n);
  const status = getPayStatus(invoice.totalPaise, paid);
  if (status.key !== 'paid') {
    throw new AppError(unpaidCloseMessage(invoice.invoiceNo, status.duePaise, invoice.totalPaise));
  }

  const firstCert = firstCertificateAt(invoice);
  const daysSinceCert = firstCert
    ? (Date.now() - firstCert.getTime()) / 86400000
    : 0;

  if (input.forced) {
    requireAdmin(actor);
    if (daysSinceCert < 60) {
      throw new AppError('Admin force-close is only permitted 60 days after the first certificate.');
    }
  } else if (actor.role === 'client') {
    if (actor.clientId !== invoice.submission.clientId) {
      throw new AppError('You do not have permission to close this invoice.', 403);
    }
    const isCreator = actor.email === invoice.submission.createdBy;
    if (!isCreator && daysSinceCert < 30) {
      throw new AppError(
        'Only the requestor can close within 30 days of certificate upload, or any client user after 30 days.',
      );
    }
  } else {
    throw new AppError('Only the client requestor may close this invoice.', 403);
  }

  const closed = await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      closedAt: new Date(),
      closedBy: actor.email,
      closeRating: input.rating ?? null,
      closeNote: input.note?.trim() || null,
      forceClosed: !!input.forced,
    },
  });

  await syncSubmissionClosure(invoice.submissionId);

  await auditLog({
    actorEmail: actor.email,
    actorId: actor.id,
    action: 'inv.close',
    entity: 'invoice',
    entityId: invoice.invoiceNo,
    details: { submissionId: invoice.submissionId, forced: !!input.forced, rating: input.rating },
  });

  await notifyAdmins(
    'inv.closed',
    `${invoice.invoiceNo} closed by ${actor.name}${input.rating ? ` — rated ${input.rating}/5` : ''}`,
    invoice.submissionId,
  );

  return closed;
}
