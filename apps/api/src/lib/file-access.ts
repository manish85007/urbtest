import { FILE_CLASS } from '@urb-tectrack/shared';
import type { SessionUser } from './auth-context.js';
import { factoryInScope, isStaff } from './auth-context.js';
import { AppError } from './errors.js';
import { prisma } from './prisma.js';
import { loadSubmissionForActor } from './access.js';

/** Resolve request IDs that reference a stored file. */
export async function findSubmissionIdsForFile(fileId: string): Promise<string[]> {
  const ids = new Set<string>();

  const [fromSubmission, fromVehicle, fromInvoice, fromCert, fromMrn, fromRecy] = await Promise.all([
    prisma.submission.findMany({
      where: { OR: [{ bomFileId: fileId }, { bomFileIds: { has: fileId } }] },
      select: { id: true },
    }),
    prisma.vehicle.findMany({
      where: {
        weighment: {
          OR: [{ slipPhotoIds: { has: fileId } }, { pickupPhotoIds: { has: fileId } }],
        },
      },
      select: { submissionId: true },
    }),
    prisma.invoice.findMany({
      where: {
        OR: [
          { invoiceFileId: fileId },
          { ewayFileId: fileId },
          { invoiceFileIds: { has: fileId } },
          { ewayFileIds: { has: fileId } },
        ],
      },
      select: { submissionId: true },
    }),
    prisma.certificate.findMany({
      where: { fileId },
      select: { invoice: { select: { submissionId: true } } },
    }),
    prisma.mrn.findMany({
      where: {
        OR: [{ gatePhotoIds: { has: fileId } }, { materialPhotoIds: { has: fileId } }],
      },
      select: { invoice: { select: { submissionId: true } } },
    }),
    prisma.recycling.findMany({
      where: { OR: [{ serialFileId: fileId }, { photoIds: { has: fileId } }] },
      select: { invoice: { select: { submissionId: true } } },
    }),
  ]);

  fromSubmission.forEach((s) => ids.add(s.id));
  fromVehicle.forEach((v) => ids.add(v.submissionId));
  fromInvoice.forEach((i) => ids.add(i.submissionId));
  fromCert.forEach((c) => ids.add(c.invoice.submissionId));
  fromMrn.forEach((m) => ids.add(m.invoice.submissionId));
  fromRecy.forEach((r) => ids.add(r.invoice.submissionId));

  return [...ids];
}

async function assertFactoryFileScope(actor: SessionUser, submissionIds: string[]) {
  if (!actor.factoryIds.length) return; // empty = all facilities
  for (const subId of submissionIds) {
    const linked = await prisma.invoice.findMany({
      where: { submissionId: subId },
      select: {
        mrn: { select: { factoryId: true } },
        recycling: { select: { factoryId: true } },
      },
    });
    const factoryIds = linked
      .flatMap((inv) => [inv.mrn?.factoryId, inv.recycling?.factoryId])
      .filter((id): id is string => !!id);
    if (!factoryIds.length) {
      // Pre-MRN files (weigh slips, BoM) — allow factory staff who uploaded or any factory with empty scope
      continue;
    }
    if (factoryIds.some((fid) => factoryInScope(actor, fid))) return;
  }
  throw new AppError("You don't have access to this file.", 403);
}

/**
 * Authorize download/stream of a stored blob.
 * Admin / operations / auditor: full access.
 * Factory: must be linked to an in-scope submission (or own upload).
 * Client portal: confidential files only via submission clientScopeFilter; internal/restricted denied.
 */
export async function assertFileAccess(
  actor: SessionUser,
  file: { id: string; kind: string; uploadedBy: string | null },
) {
  if (actor.role === 'admin' || actor.role === 'operations' || actor.role === 'auditor') {
    return;
  }

  const cls = FILE_CLASS[file.kind] ?? 'internal';
  if (cls === 'public') return;

  const submissionIds = await findSubmissionIdsForFile(file.id);

  if (actor.role === 'factory') {
    if (file.uploadedBy === actor.email) return;
    if (!submissionIds.length) {
      throw new AppError("You don't have access to this file.", 403);
    }
    for (const subId of submissionIds) {
      await loadSubmissionForActor(subId, actor);
    }
    await assertFactoryFileScope(actor, submissionIds);
    return;
  }

  // Client portal roles (client / client_readonly)
  if (isStaff(actor)) return;

  if (cls === 'internal' || cls === 'restricted') {
    throw new AppError("You don't have access to this file.", 403);
  }

  if (file.uploadedBy === actor.email && !submissionIds.length) {
    // Own upload not yet attached to a request (e.g. BoM before submit)
    return;
  }

  if (submissionIds.length) {
    // Require every linked submission to be in the actor's client/site scope
    for (const subId of submissionIds) {
      await loadSubmissionForActor(subId, actor);
    }
    return;
  }

  const logoClient = await prisma.client.findFirst({
    where: { logoFileId: file.id },
    select: { id: true },
  });
  if (logoClient && logoClient.id === actor.clientId) return;

  const planting = await prisma.treePlanting.findFirst({
    where: { photoIds: { has: file.id } },
    select: { id: true },
  });
  if (planting && (file.kind === 'planting' || file.kind === 'plantPhoto')) return;

  const progress = await prisma.treeProgress.findFirst({
    where: { photoFileId: file.id },
    select: { id: true },
  });
  if (progress && (file.kind === 'planting' || file.kind === 'plantPhoto')) return;

  throw new AppError("You don't have access to this file.", 403);
}
