import type { Prisma } from '@prisma/client';
import {
  deriveTax,
  deriveTotal,
  getPayStatus,
  settledPaise,
  matTotal,
  recoveryFor,
  rupeesToPaise,
  unpaidCloseMessage,
  formatMrnNumber,
  formatForm6Number,
  getFY,
  type MaterialGroupCode,
} from '@urb-tectrack/shared';
import type { SessionUser } from '../lib/auth-context.js';
import { AppError } from '../lib/errors.js';
import { roundKg, round2, toKg } from '../lib/decimal.js';
import { prisma } from '../lib/prisma.js';
import {
  loadInvoiceForActor,
  loadSubmissionForActor,
  requireAdmin,
  requireFactory,
  requirePermission,
  syncSubmissionClosure,
} from '../lib/access.js';
import { deriveInvoiceStage, withDerivedStages } from '../lib/stage-mapper.js';
import { auditLog } from './audit.js';
import { logSoD, sodCheck } from './compliance.js';
import { assertFilesExist } from './file-service.js';
import { assertCategoryCapacityOrOverride } from './category-capacity.js';
import { assertClientInvoiceNoUnique, assertClientSerialsUnique } from './duplicate-service.js';
import { notifyClient } from './submission-notify.js';
import { notifyAdmins, notifyClientUsers } from './notifications.js';

async function emailInvoiceGenerated(
  sub: Awaited<ReturnType<typeof loadSubmissionForActor>>,
  invoice: { invoiceNo: string; ewayBillNo: string; billingWeight: unknown; totalPaise: bigint },
) {
  await notifyClient(sub, 'invoice_generated', {
    invoice_no: invoice.invoiceNo,
    eway_bill_no: invoice.ewayBillNo,
    billing_weight: Number(invoice.billingWeight),
    invoice_total: `₹${(Number(invoice.totalPaise) / 100).toLocaleString('en-IN')}`,
  });
}

async function emailMrnGenerated(
  sub: Awaited<ReturnType<typeof loadSubmissionForActor>>,
  invoiceNo: string,
  mrnNo: string,
  factoryName: string,
) {
  await notifyClient(sub, 'mrn_generated', {
    invoice_no: invoiceNo,
    mrn_no: mrnNo,
    factory_name: factoryName,
  });
}

async function emailRecyclingForm6(
  sub: Awaited<ReturnType<typeof loadSubmissionForActor>>,
  invoiceNo: string,
  form6No: string,
) {
  await notifyClient(sub, 'recycling_form6', {
    invoice_no: invoiceNo,
    form6_no: form6No,
  });
}

async function emailCodGenerated(
  sub: Awaited<ReturnType<typeof loadSubmissionForActor>>,
  invoiceNo: string,
  certNo: string,
  certDate: Date,
) {
  await notifyClient(sub, 'cod_generated', {
    invoice_no: invoiceNo,
    cert_no: certNo,
    cert_date: certDate.toISOString().slice(0, 10),
  });
}

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

async function allocateForm6InTx(tx: Prisma.TransactionClient, processedAt: Date) {
  const fy = getFY(processedAt);
  if (!fy) throw new AppError('Invalid processing date for Form 6 numbering.');

  const counter = await tx.form6Counter.upsert({
    where: { fy: fy.short },
    create: { fy: fy.short, lastValue: 1 },
    update: { lastValue: { increment: 1 } },
  });

  return formatForm6Number(fy.short, counter.lastValue);
}

function resolveForm6Vehicles(
  invoice: Awaited<ReturnType<typeof loadInvoiceForActor>>,
  inputIds?: string[],
) {
  const allowed = invoice.submission.vehicles.filter(
    (v) => !invoice.vehicleIds.length || invoice.vehicleIds.includes(v.id),
  );
  const allowedIds = new Set(allowed.map((v) => v.id));
  const selected = [...new Set(inputIds?.length ? inputIds : [...allowedIds])];
  if (!selected.length) {
    throw new AppError('Select at least one vehicle for this Form 6.');
  }
  if (selected.some((id) => !allowedIds.has(id))) {
    throw new AppError('A selected vehicle is not linked to this invoice.');
  }
  return selected;
}

export interface CreateInvoiceInput {
  invoiceNo: string;
  invoiceDate: string;
  taxableAmount: number;
  taxRatePct: number;
  billingWeight: number;
  deviationNote?: string;
  billingMode?: string;
  ewayBillNo: string;
  ewayBillDate: string;
  vehicleIds?: string[];
  invoiceFileId?: string;
  ewayFileId?: string;
  invoiceFileIds?: string[];
  ewayFileIds?: string[];
}

export interface PaymentInput {
  utr: string;
  amount: number;
  paidAt: string;
  mode: string;
  note?: string;
  tdsAmount?: number;
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
  vehicleIds?: string[];
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

function todayYmd(timeZone = 'Asia/Kolkata') {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function assertNotFutureDate(raw: string, label: string) {
  const ymd = String(raw || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    throw new AppError(`${label} is required.`);
  }
  if (ymd > todayYmd()) {
    throw new AppError(`${label} cannot be a future date.`);
  }
}

function attachmentIds(ids?: string[], single?: string) {
  return [...new Set([...(ids ?? []), ...(single ? [single] : [])].map((id) => id.trim()).filter(Boolean))];
}

function totalWeighmentKg(vehicles: Array<{ weighment?: { netKg?: unknown } | null }>) {
  return roundKg(vehicles.reduce((sum, v) => sum + toKg(v.weighment?.netKg), 0));
}

function billedWeightKg(
  invoices: Array<{ id: string; billingWeight?: unknown }>,
  excludeId?: string,
) {
  return roundKg(
    invoices
      .filter((inv) => inv.id !== excludeId)
      .reduce((sum, inv) => sum + toKg(inv.billingWeight), 0),
  );
}

function assertOverallBillingWeight(billWt: number, totalNet: number, alreadyBilled: number) {
  if (!(billWt > 0)) {
    throw new AppError('Billing weight is required.');
  }
  if (totalNet <= 0) {
    throw new AppError('Record weighment on all vehicles before raising an invoice.');
  }
  const remaining = roundKg(totalNet - alreadyBilled);
  if (roundKg(billWt - remaining) > 0.001) {
    throw new AppError(
      `Billing weight (${billWt} kg) exceeds the remaining weighment (${remaining} kg). Total vehicle weighment is ${totalNet} kg and ${alreadyBilled} kg is already billed. The sum of all invoice billing weights must equal the total weighment.`,
    );
  }
}

function assertInvoiceEditable(invoice: { closedAt: Date | null }) {
  if (invoice.closedAt) {
    throw new AppError('This invoice is closed and can no longer be changed.');
  }
}

function assertLifecycleOpen(invoice: { closedAt: Date | null; submission: { closedAt: Date | null } }) {
  if (invoice.closedAt || invoice.submission.closedAt) {
    throw new AppError('This request is closed. Edits are no longer available.');
  }
}

function assertInvoiceDeletable(invoice: {
  closedAt: Date | null;
  mrn: unknown;
  recycling: unknown;
  certificates: unknown[];
}) {
  assertInvoiceEditable(invoice);
  if (invoice.mrn) {
    throw new AppError('Goods have been received against this invoice — delete is no longer allowed. You can still edit invoice details.');
  }
  if (invoice.recycling) {
    throw new AppError('This invoice has recycling records and cannot be deleted. You can still edit invoice details.');
  }
  if (invoice.certificates.length) {
    throw new AppError('A certificate has been uploaded for this invoice — it cannot be deleted. You can still edit invoice details.');
  }
}

export async function createInvoice(
  actor: SessionUser,
  submissionId: string,
  input: CreateInvoiceInput,
) {
  requirePermission(actor, 'manageInvoices');
  const sub = await loadSubmissionForActor(submissionId, actor);
  if (sub.closedAt) {
    throw new AppError('This request is closed. Edits are no longer available.');
  }
  if (!sub.loadingCompletedAt) {
    throw new AppError(
      'Acknowledge loading complete after all vehicles are weighed and slips are uploaded before raising an invoice.',
    );
  }

  const trimmedNo = input.invoiceNo.trim();
  const duplicate = sub.invoices.some((i) => i.invoiceNo === trimmedNo);
  if (duplicate) {
    throw new AppError(`Invoice ${trimmedNo} already exists on this request.`);
  }
  await assertClientInvoiceNoUnique(sub.clientId, trimmedNo, { excludeSubmissionId: sub.id });

  assertNotFutureDate(input.invoiceDate, 'Invoice date');
  assertNotFutureDate(input.ewayBillDate, 'E-way bill date');

  const invoiceFileIds = attachmentIds(input.invoiceFileIds, input.invoiceFileId);
  const ewayFileIds = attachmentIds(input.ewayFileIds, input.ewayFileId);
  await assertFilesExist(invoiceFileIds, ['invoice']);
  await assertFilesExist(ewayFileIds, ['eway']);

  const vehicleIds = input.vehicleIds ?? [];
  const totalNet = totalWeighmentKg(sub.vehicles);
  const alreadyBilled = billedWeightKg(sub.invoices);
  const billWt = roundKg(toKg(input.billingWeight));
  assertOverallBillingWeight(billWt, totalNet, alreadyBilled);
  const billedAfter = roundKg(alreadyBilled + billWt);
  const remainingAfter = roundKg(totalNet - billedAfter);

  const taxRatePct = input.taxRatePct;
  if (taxRatePct === undefined || taxRatePct === null || Number.isNaN(Number(taxRatePct))) {
    throw new AppError('Select a tax rate.');
  }
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
      vehicleNetKg: totalNet || null,
      deviationKg: remainingAfter,
      deviationNote: String(input.deviationNote || '').trim() || null,
      billingMode: input.billingMode || 'urbeno',
      ewayBillNo: input.ewayBillNo.trim(),
      ewayBillDate: new Date(input.ewayBillDate),
      invoiceFileId: invoiceFileIds[0] ?? null,
      ewayFileId: ewayFileIds[0] ?? null,
      invoiceFileIds,
      ewayFileIds,
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
  await emailInvoiceGenerated(refreshed, invoice);
  return withDerivedStages(refreshed);
}

export async function updateInvoice(actor: SessionUser, invoiceId: string, input: CreateInvoiceInput) {
  requirePermission(actor, 'manageInvoices');
  const invoice = await loadInvoiceForActor(invoiceId, actor);
  assertLifecycleOpen(invoice);
  const sub = await loadSubmissionForActor(invoice.submissionId, actor);

  const nextNo = input.invoiceNo.trim();
  const duplicate = sub.invoices.some((i) => i.id !== invoiceId && i.invoiceNo === nextNo);
  if (duplicate) {
    throw new AppError(`Invoice ${nextNo} already exists on this request.`);
  }
  await assertClientInvoiceNoUnique(sub.clientId, nextNo, {
    excludeInvoiceId: invoiceId,
    excludeSubmissionId: sub.id,
  });

  assertNotFutureDate(input.invoiceDate, 'Invoice date');
  assertNotFutureDate(input.ewayBillDate, 'E-way bill date');

  const invoiceFileIds = attachmentIds(input.invoiceFileIds, input.invoiceFileId);
  const ewayFileIds = attachmentIds(input.ewayFileIds, input.ewayFileId);
  await assertFilesExist(invoiceFileIds, ['invoice']);
  await assertFilesExist(ewayFileIds, ['eway']);

  const vehicleIds = input.vehicleIds ?? [];
  const totalNet = totalWeighmentKg(sub.vehicles);
  const alreadyBilled = billedWeightKg(sub.invoices, invoiceId);
  const billWt = roundKg(toKg(input.billingWeight));
  assertOverallBillingWeight(billWt, totalNet, alreadyBilled);
  const remainingAfter = roundKg(totalNet - alreadyBilled - billWt);

  const taxRatePct = input.taxRatePct;
  if (taxRatePct === undefined || taxRatePct === null || Number.isNaN(Number(taxRatePct))) {
    throw new AppError('Select a tax rate.');
  }
  const taxablePaise = BigInt(rupeesToPaise(input.taxableAmount));
  const taxPaise = BigInt(deriveTax(Number(taxablePaise), taxRatePct));
  const totalPaise = BigInt(deriveTotal(Number(taxablePaise), taxRatePct));

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      invoiceNo: nextNo,
      invoiceDate: new Date(input.invoiceDate),
      taxablePaise,
      taxRatePct,
      taxPaise,
      totalPaise,
      billingWeight: billWt,
      vehicleNetKg: totalNet || null,
      deviationKg: remainingAfter,
      deviationNote: String(input.deviationNote || '').trim() || null,
      billingMode: input.billingMode || 'urbeno',
      ewayBillNo: input.ewayBillNo.trim(),
      ewayBillDate: new Date(input.ewayBillDate),
      invoiceFileId: invoiceFileIds[0] ?? null,
      ewayFileId: ewayFileIds[0] ?? null,
      invoiceFileIds,
      ewayFileIds,
      vehicleIds,
    },
  });

  await auditLog({
    actorEmail: actor.email,
    actorId: actor.id,
    action: 'inv.update',
    entity: 'invoice',
    entityId: nextNo,
    details: { submissionId: sub.id, from: invoice.invoiceNo, to: nextNo },
  });

  const refreshed = await loadSubmissionForActor(sub.id, actor);
  return { submission: withDerivedStages(refreshed) };
}

export async function deleteInvoice(actor: SessionUser, invoiceId: string) {
  requirePermission(actor, 'manageInvoices');
  const invoice = await loadInvoiceForActor(invoiceId, actor);
  assertInvoiceDeletable(invoice);
  const sub = await loadSubmissionForActor(invoice.submissionId, actor);

  await prisma.invoice.delete({ where: { id: invoiceId } });
  await auditLog({
    actorEmail: actor.email,
    actorId: actor.id,
    action: 'inv.delete',
    entity: 'invoice',
    entityId: invoice.invoiceNo,
    details: { submissionId: sub.id, invoiceNo: invoice.invoiceNo },
  });

  const refreshed = await loadSubmissionForActor(sub.id, actor);
  return { submission: withDerivedStages(refreshed) };
}

function assertPaymentWithinTotal(
  totalPaise: bigint,
  existingPayments: Array<{ amountPaise: bigint; tdsPaise: bigint }>,
  newAmountPaise: bigint,
  newTdsPaise: bigint,
  excludeId?: string,
) {
  const already = existingPayments
    .filter((p: any) => p.id !== excludeId)
    .reduce((s, p) => s + p.amountPaise + p.tdsPaise, BigInt(0));
  const total = already + newAmountPaise + newTdsPaise;
  if (total > totalPaise) {
    const overRs = Number(total - totalPaise) / 100;
    throw new AppError(
      `This payment would exceed the invoice total by ₹${overRs.toFixed(2)}. Reduce the amount.`,
    );
  }
}

export async function addPayment(actor: SessionUser, invoiceId: string, input: PaymentInput) {
  requirePermission(actor, 'manageInvoices');
  const invoice = await loadInvoiceForActor(invoiceId, actor);
  assertLifecycleOpen(invoice);
  assertNotFutureDate(input.paidAt, 'Payment date');

  const tdsAmount = Number(input.tdsAmount ?? 0);
  if (tdsAmount < 0) throw new AppError('TDS cannot be negative.');
  if (!(Number(input.amount) > 0) && !(tdsAmount > 0)) {
    throw new AppError('Enter the amount received, TDS deducted, or both.');
  }

  const newAmountPaise = BigInt(rupeesToPaise(input.amount || 0));
  const newTdsPaise = BigInt(rupeesToPaise(tdsAmount));
  assertPaymentWithinTotal(invoice.totalPaise, invoice.payments, newAmountPaise, newTdsPaise);

  const payment = await prisma.payment.create({
    data: {
      invoiceId,
      utr: input.utr.trim(),
      amountPaise: newAmountPaise,
      tdsPaise: newTdsPaise,
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
    details: {
      submissionId: invoice.submissionId,
      utr: payment.utr,
      amount: input.amount,
      tds: tdsAmount,
      paidAt: input.paidAt,
    },
  });

  return payment;
}

export async function updatePayment(actor: SessionUser, paymentId: string, input: PaymentInput) {
  requirePermission(actor, 'manageInvoices');
  const existing = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { invoice: { include: { submission: { include: { client: true, site: true, invoices: true } }, payments: true } } },
  });
  if (!existing) throw new AppError('Payment not found.', 404);
  const invoice = await loadInvoiceForActor(existing.invoiceId, actor);
  assertLifecycleOpen(invoice);
  assertNotFutureDate(input.paidAt, 'Payment date');

  const tdsAmount = Number(input.tdsAmount ?? 0);
  if (tdsAmount < 0) throw new AppError('TDS cannot be negative.');
  if (!(Number(input.amount) > 0) && !(tdsAmount > 0)) {
    throw new AppError('Enter the amount received, TDS deducted, or both.');
  }

  const newAmountPaise = BigInt(rupeesToPaise(input.amount || 0));
  const newTdsPaise = BigInt(rupeesToPaise(tdsAmount));
  assertPaymentWithinTotal(invoice.totalPaise, invoice.payments, newAmountPaise, newTdsPaise, paymentId);

  const payment = await prisma.payment.update({
    where: { id: paymentId },
    data: {
      utr: input.utr.trim(),
      amountPaise: newAmountPaise,
      tdsPaise: newTdsPaise,
      paidAt: new Date(input.paidAt),
      mode: input.mode,
      note: input.note?.trim() || null,
    },
  });

  await auditLog({
    actorEmail: actor.email,
    actorId: actor.id,
    action: 'inv.payment.edit',
    entity: 'invoice',
    entityId: invoice.invoiceNo,
    details: { submissionId: invoice.submissionId, paymentId, utr: payment.utr, amount: input.amount },
  });

  return payment;
}

export async function deletePayment(actor: SessionUser, paymentId: string) {
  requirePermission(actor, 'manageInvoices');
  const existing = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { invoice: { include: { submission: { include: { client: true, site: true, invoices: true } }, payments: true } } },
  });
  if (!existing) throw new AppError('Payment not found.', 404);
  const invoice = await loadInvoiceForActor(existing.invoiceId, actor);
  assertLifecycleOpen(invoice);

  await prisma.payment.delete({ where: { id: paymentId } });

  await auditLog({
    actorEmail: actor.email,
    actorId: actor.id,
    action: 'inv.payment.delete',
    entity: 'invoice',
    entityId: invoice.invoiceNo,
    details: { submissionId: invoice.submissionId, paymentId, utr: existing.utr },
  });
}

type MrnMaterial = { n: string; q: number; w: number };

function parseMrnMaterials(input: MrnInput): MrnMaterial[] {
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
  return materials;
}

function assertReceivedEqualsBilled(materials: MrnMaterial[], billingWeight: unknown) {
  const received = roundKg(materials.reduce((sum, m) => sum + toKg(m.w), 0));
  const billed = roundKg(toKg(billingWeight));
  if (Math.abs(received - billed) >= 0.001) {
    throw new AppError(
      `Material received (${received} kg) must equal the invoice billing weight (${billed} kg). Adjust the gate count so both figures match exactly.`,
    );
  }
}

function requireMrnSignatures(input: MrnInput) {
  const driverSign = input.driverSign?.trim() || '';
  const managerSign = input.managerSign?.trim() || '';
  const securitySign = input.securitySign?.trim() || '';
  if (!driverSign || !managerSign || !securitySign) {
    throw new AppError(
      'All three signatures are required on the gate document (driver, factory manager, security).',
    );
  }
  return { driverSign, managerSign, securitySign };
}

async function resolveMrnPhotos(
  input: MrnInput,
  existing?: { gatePhotoIds?: string[]; materialPhotoIds?: string[] },
) {
  const gatePhotoIds = [...new Set(input.gatePhotoIds ?? existing?.gatePhotoIds ?? [])];
  const materialPhotoIds = [...new Set(input.materialPhotoIds ?? existing?.materialPhotoIds ?? [])];
  if (!gatePhotoIds.length) {
    throw new AppError('Upload at least one photograph of the vehicle at the gate.');
  }
  if (!materialPhotoIds.length) {
    throw new AppError('Upload at least one photograph of the material inside the vehicle.');
  }
  await assertFilesExist(gatePhotoIds, ['pickPhoto']);
  await assertFilesExist(materialPhotoIds, ['processing', 'pickPhoto']);
  return { gatePhotoIds, materialPhotoIds };
}

function assertInvoiceVehiclesWeighed(invoice: Awaited<ReturnType<typeof loadInvoiceForActor>>) {
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
}

export async function createMrn(actor: SessionUser, invoiceId: string, input: MrnInput) {
  requirePermission(actor, 'createMrn');
  const invoice = await loadInvoiceForActor(invoiceId, actor);
  requireFactory(actor, input.factoryId);
  assertLifecycleOpen(invoice);

  if (invoice.mrn) throw new AppError('This invoice already has an MRN. Each invoice takes one MRN.');

  const factory = await prisma.factorySite.findUnique({ where: { id: input.factoryId } });
  if (!factory) throw new AppError('Select a factory site.');

  const materials = parseMrnMaterials(input);
  assertReceivedEqualsBilled(materials, invoice.billingWeight);
  const { driverSign, managerSign, securitySign } = requireMrnSignatures(input);
  const { gatePhotoIds, materialPhotoIds } = await resolveMrnPhotos(input);
  assertInvoiceVehiclesWeighed(invoice);

  assertNotFutureDate(input.receivedAt, 'Receiving date');
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

  const refreshed = await loadSubmissionForActor(invoice.submissionId, actor);
  await emailMrnGenerated(refreshed, invoice.invoiceNo, mrn.mrnNo, factory.name);

  return mrn;
}

export async function updateMrn(actor: SessionUser, invoiceId: string, input: MrnInput) {
  requirePermission(actor, 'editMrn');
  const invoice = await loadInvoiceForActor(invoiceId, actor);
  const existing = invoice.mrn;
  if (!existing) throw new AppError('Create the MRN before editing it.');
  assertLifecycleOpen(invoice);
  if (input.factoryId && input.factoryId !== existing.factoryId) {
    throw new AppError('The receiving factory cannot be changed after the MRN is issued.');
  }

  const materials = parseMrnMaterials(input);
  assertReceivedEqualsBilled(materials, invoice.billingWeight);
  const { driverSign, managerSign, securitySign } = requireMrnSignatures(input);
  const { gatePhotoIds, materialPhotoIds } = await resolveMrnPhotos(input, existing);
  assertInvoiceVehiclesWeighed(invoice);

  assertNotFutureDate(input.receivedAt, 'Receiving date');
  const receivedAt = new Date(input.receivedAt);

  const mrn = await prisma.mrn.update({
    where: { invoiceId },
    data: {
      receivedAt,
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

  await auditLog({
    actorEmail: actor.email,
    actorId: actor.id,
    action: 'mrn.update',
    entity: 'mrn',
    entityId: mrn.mrnNo,
    details: { submissionId: invoice.submissionId, invNo: invoice.invoiceNo },
  });

  return mrn;
}

function resolveRecyclingFactoryId(invoice: { mrn: { factoryId: string } | null }, inputFactoryId?: string) {
  const locked = invoice.mrn?.factoryId;
  if (!locked) throw new AppError('Create the MRN before recycling this invoice.');
  if (inputFactoryId && inputFactoryId !== locked) {
    throw new AppError('The receiving facility is fixed by the MRN and cannot be changed on Form 6.');
  }
  return locked;
}

export async function createRecycling(
  actor: SessionUser,
  invoiceId: string,
  input: RecyclingInput,
) {
  requirePermission(actor, 'manageRecycling');
  const invoice = await loadInvoiceForActor(invoiceId, actor);
  assertLifecycleOpen(invoice);
  if (!invoice.mrn) throw new AppError('Create the MRN before recycling this invoice.');
  if (invoice.recycling) throw new AppError('This invoice already has a recycling record.');

  const factoryId = resolveRecyclingFactoryId(invoice, input.factoryId);
  requireFactory(actor, factoryId);

  const target = roundKg(toKg(invoice.billingWeight));
  const split = round2(input.categories.reduce((sum, c) => sum + toKg(c.weightKg), 0));
  if (Math.abs(split - target) >= 0.01) {
    throw new AppError(
      `The category split totals ${split} kg but this invoice covers ${target} kg. Every kilogram received has to land in an authorised category — adjust the split by ${Math.abs(round2(target - split))} kg.`,
    );
  }

    const categoryRows: Array<{
      categoryId: number;
      entryId: string;
      groupCode: string;
      weightKg: number;
      recoveryFe: number;
      recoveryNfe: number;
      recoveryPl: number;
      recoveryPcb: number;
      overrideReason: string | null;
    }> = [];
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

  if (input.serials?.length) {
    await assertClientSerialsUnique(
      invoice.submission.clientId,
      input.serials.map((s) => s.serialNo),
      invoice.submissionId,
    );
  }

  const vehicleIds = resolveForm6Vehicles(invoice, input.vehicleIds);
  assertNotFutureDate(input.processedAt, 'Processing date');
  const processedAt = new Date(input.processedAt);
  const autoApprove = actor.role === 'admin';

  const recycling = await prisma.$transaction(async (tx) => {
    const form6No = await allocateForm6InTx(tx, processedAt);

    return tx.recycling.create({
      data: {
        invoiceId,
        form6No,
        processedAt,
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
        vehicleIds,
        reviewStatus: autoApprove ? 'approved' : 'pending_review',
        reviewedAt: autoApprove ? new Date() : null,
        reviewedBy: autoApprove ? actor.email : null,
        reviewNote: null,
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
      reviewStatus: recycling.reviewStatus,
    },
  });

  if (autoApprove) {
    await notifyClientUsers(
      invoice.submission.clientId,
      'recy.done',
      `${invoice.invoiceNo} processed — Form 6 ${recycling.form6No} issued`,
      invoice.submissionId,
    );
    const refreshed = await loadSubmissionForActor(invoice.submissionId, actor);
    await emailRecyclingForm6(refreshed, invoice.invoiceNo, recycling.form6No);
  } else {
    await notifyAdmins(
      'form6.review',
      `Form 6 ${recycling.form6No} for ${invoice.invoiceNo} awaits admin review`,
      invoice.submissionId,
    );
  }

  return recycling;
}

export async function updateRecycling(
  actor: SessionUser,
  invoiceId: string,
  input: RecyclingInput,
) {
  requirePermission(actor, 'manageRecycling');
  const invoice = await loadInvoiceForActor(invoiceId, actor);
  assertLifecycleOpen(invoice);
  if (!invoice.mrn) throw new AppError('Create the MRN before recycling this invoice.');
  const existing = invoice.recycling;
  if (!existing) throw new AppError('Issue Form 6 before editing it.');

  const factoryId = resolveRecyclingFactoryId(invoice, input.factoryId);
  requireFactory(actor, factoryId);
  if (existing.factoryId !== factoryId) {
    throw new AppError('The receiving facility is fixed by the MRN and cannot be changed on Form 6.');
  }

  const target = roundKg(toKg(invoice.billingWeight));
  const split = round2(input.categories.reduce((sum, c) => sum + toKg(c.weightKg), 0));
  if (Math.abs(split - target) >= 0.01) {
    throw new AppError(
      `The category split totals ${split} kg but this invoice covers ${target} kg. Every kilogram received has to land in an authorised category — adjust the split by ${Math.abs(round2(target - split))} kg.`,
    );
  }

  const categoryRows: Array<{
    categoryId: number;
    entryId: string;
    groupCode: string;
    weightKg: number;
    recoveryFe: number;
    recoveryNfe: number;
    recoveryPl: number;
    recoveryPcb: number;
    overrideReason: string | null;
  }> = [];
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
      excludeRecyclingId: existing.id,
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

  const vehicleIds = resolveForm6Vehicles(invoice, input.vehicleIds);
  assertNotFutureDate(input.processedAt, 'Processing date');
  const processedAt = new Date(input.processedAt);
  const photoIds = input.photoIds?.length ? input.photoIds : existing.photoIds;
  const reportIds = input.reportIds?.length ? input.reportIds : existing.reportIds;

  const recycling = await prisma.$transaction(async (tx) => {
    await tx.recyclingCategory.deleteMany({ where: { recyclingId: existing.id } });
    const needsReReview = existing.reviewStatus !== 'pending_review' && actor.role !== 'admin';
    return tx.recycling.update({
      where: { id: existing.id },
      data: {
        processedAt,
        factoryId,
        divertedPct: input.divertedPct ?? existing.divertedPct,
        devicesDestroyed: Math.max(0, Math.floor(Number(input.devicesDestroyed) || 0)),
        recoveryFe: roundKg(totalFe),
        recoveryNfe: roundKg(totalNfe),
        recoveryPl: roundKg(totalPl),
        recoveryPcb: roundKg(totalPcb),
        photoIds,
        reportIds,
        serialFileId: input.serialFileId ?? existing.serialFileId,
        vehicleIds,
        ...(needsReReview || existing.reviewStatus === 'rejected'
          ? {
              reviewStatus: 'pending_review',
              reviewedAt: null,
              reviewedBy: null,
              reviewNote: null,
            }
          : {}),
        categories: { create: categoryRows },
      },
      include: { categories: true },
    });
  });

  await auditLog({
    actorEmail: actor.email,
    actorId: actor.id,
    action: 'recy.update',
    entity: 'recycling',
    entityId: recycling.form6No,
    details: {
      submissionId: invoice.submissionId,
      invNo: invoice.invoiceNo,
      cats: input.categories.map((c) => c.entryId),
      reviewStatus: recycling.reviewStatus,
    },
  });

  if (recycling.reviewStatus === 'pending_review' && actor.role !== 'admin') {
    await notifyAdmins(
      'form6.review',
      `Form 6 ${recycling.form6No} for ${invoice.invoiceNo} awaits admin review`,
      invoice.submissionId,
    );
  }

  return recycling;
}

export async function approveRecycling(actor: SessionUser, invoiceId: string) {
  requireAdmin(actor);
  const invoice = await loadInvoiceForActor(invoiceId, actor);
  assertLifecycleOpen(invoice);
  const existing = invoice.recycling;
  if (!existing) throw new AppError('Issue Form 6 before approving it.');
  if (existing.reviewStatus === 'approved') {
    throw new AppError('This Form 6 is already approved.');
  }

  const recycling = await prisma.recycling.update({
    where: { id: existing.id },
    data: {
      reviewStatus: 'approved',
      reviewedAt: new Date(),
      reviewedBy: actor.email,
      reviewNote: null,
    },
  });

  await auditLog({
    actorEmail: actor.email,
    actorId: actor.id,
    action: 'recy.approve',
    entity: 'recycling',
    entityId: recycling.form6No,
    details: { submissionId: invoice.submissionId, invNo: invoice.invoiceNo },
  });

  await notifyClientUsers(
    invoice.submission.clientId,
    'recy.done',
    `${invoice.invoiceNo} processed — Form 6 ${recycling.form6No} issued`,
    invoice.submissionId,
  );
  const refreshed = await loadSubmissionForActor(invoice.submissionId, actor);
  await emailRecyclingForm6(refreshed, invoice.invoiceNo, recycling.form6No);

  return recycling;
}

export async function rejectRecycling(
  actor: SessionUser,
  invoiceId: string,
  input: { note?: string },
) {
  requireAdmin(actor);
  const invoice = await loadInvoiceForActor(invoiceId, actor);
  assertLifecycleOpen(invoice);
  const existing = invoice.recycling;
  if (!existing) throw new AppError('Issue Form 6 before rejecting it.');
  if (existing.reviewStatus === 'approved') {
    throw new AppError('Approved Form 6 cannot be rejected — ask the factory to revise after an admin unlock if needed.');
  }

  const note = input.note?.trim() || null;
  const recycling = await prisma.recycling.update({
    where: { id: existing.id },
    data: {
      reviewStatus: 'rejected',
      reviewedAt: new Date(),
      reviewedBy: actor.email,
      reviewNote: note,
    },
  });

  await auditLog({
    actorEmail: actor.email,
    actorId: actor.id,
    action: 'recy.reject',
    entity: 'recycling',
    entityId: recycling.form6No,
    details: { submissionId: invoice.submissionId, invNo: invoice.invoiceNo, note },
  });

  return recycling;
}

export async function uploadCertificate(
  actor: SessionUser,
  invoiceId: string,
  input: CertificateInput,
) {
  requirePermission(actor, 'uploadCertificate');
  const invoice = await loadInvoiceForActor(invoiceId, actor);
  assertLifecycleOpen(invoice);
  if (!invoice.recycling) {
    throw new AppError('Issue Form 6 before uploading the Certificate of Destruction.');
  }
  if (invoice.recycling.reviewStatus !== 'approved') {
    throw new AppError('Admin must approve Form 6 before the Certificate of Destruction can be uploaded.');
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
      mailedAt: null,
    },
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
    },
  });

  const refreshed = await loadSubmissionForActor(invoice.submissionId, actor);
  await emailCodGenerated(refreshed, invoice.invoiceNo, certificate.certNo, certificate.certDate);

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

  const paid = settledPaise(invoice.payments);
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
    const conflicts = sodCheck('force-close', { invCreatedBy: invoice.createdBy }, actor.email);
    await logSoD(actor, 'force-close', conflicts, invoice.invoiceNo);
  } else if (actor.role === 'client') {
    if (actor.clientId !== invoice.submission.clientId) {
      throw new AppError('You do not have permission to close this invoice.', 403);
    }
    // Determine the effective requestor:
    // - If onBehalfOf is set, that email is the designated requestor (admin raised on their behalf).
    // - Otherwise check if createdBy is actually a client-role user.
    // When admin raised the request (no client creator), any client user of that client may close immediately.
    const effectiveRequestor = invoice.submission.onBehalfOf ?? null;
    if (effectiveRequestor) {
      // onBehalfOf designates the requestor — they may close any time; others must wait 30 days
      const isCreator = actor.email === effectiveRequestor;
      if (!isCreator && daysSinceCert < 30) {
        throw new AppError(
          'Only the requestor can close within 30 days of certificate upload, or any client user after 30 days.',
        );
      }
    } else {
      const creatorUser = await prisma.user.findUnique({
        where: { email: invoice.submission.createdBy },
        select: { role: true },
      });
      const raisedByClient = creatorUser?.role === 'client';
      if (raisedByClient) {
        const isCreator = actor.email === invoice.submission.createdBy;
        if (!isCreator && daysSinceCert < 30) {
          throw new AppError(
            'Only the requestor can close within 30 days of certificate upload, or any client user after 30 days.',
          );
        }
      }
      // If raised by admin with no onBehalfOf, any client user of that client may close immediately.
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

  const wasSubmissionClosed = !!invoice.submission.closedAt;
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
  const refreshed = await loadSubmissionForActor(invoice.submissionId, actor);
  if (refreshed.closedAt && !wasSubmissionClosed) {
    await notifyClient(refreshed, 'request_closed', {});
  }

  return closed;
}
