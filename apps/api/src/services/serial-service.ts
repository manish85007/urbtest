import type { SessionUser } from '../lib/auth-context.js';
import { AppError } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';
import { nextSequence } from '../lib/db-helpers.js';
import { loadInvoiceForActor, requireStaff } from '../lib/access.js';
import { auditLog } from './audit.js';
import { assertFilesExist } from './file-service.js';

export interface SerialRowInput {
  serialNo: string;
  assetTag?: string;
  make?: string;
  model?: string;
}

export function parseSerialCsv(text: string): SerialRowInput[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) {
    throw new AppError('The file needs a header row plus at least one serial.');
  }
  const hdr = splitCsvLine(lines[0]).map((h) => h.toLowerCase().trim());
  const iSN = hdr.findIndex((h) => /serial|^sn$/.test(h));
  const iTag = hdr.findIndex((h) => /asset|tag/.test(h));
  const iItem = hdr.findIndex((h) => /item|desc|model/.test(h));
  const iCond = hdr.findIndex((h) => /cond/.test(h));
  if (iSN < 0) throw new AppError('Could not find a "Serial" column in the header row.');

  const rows: SerialRowInput[] = [];
  for (const line of lines.slice(1)) {
    const c = splitCsvLine(line);
    const serialNo = (c[iSN] ?? '').trim();
    if (!serialNo) continue;
    rows.push({
      serialNo,
      assetTag: iTag >= 0 ? c[iTag]?.trim() : '',
      make: iItem >= 0 ? c[iItem]?.trim() : '',
      model: iCond >= 0 ? c[iCond]?.trim() : 'end-of-life',
    });
  }
  if (!rows.length) throw new AppError('No serial rows found in the file.');
  return rows;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQ = !inQ;
      }
    } else if (ch === ',' && !inQ) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export const SERIAL_TEMPLATE_CSV = [
  ['Serial', 'AssetTag', 'Item', 'Condition', 'Weight'],
  ['WD-A1023X', 'TC-HD-9821', 'Seagate 1TB HDD', 'end-of-life', '0.62'],
  ['WD-A1024X', 'TC-HD-9822', 'Seagate 1TB HDD', 'end-of-life', '0.62'],
  ['SG-B2201Y', 'TC-HD-9823', 'WD Blue 500GB SSD', 'end-of-life', '0.09'],
  ['LPT-99120', 'TC-LAP-4410', 'Dell Latitude 5420', 'end-of-life', '1.80'],
  ['LPT-99121', 'TC-LAP-4411', 'Dell Latitude 5420', 'working', '1.80'],
]
  .map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(','))
  .join('\n');

export async function importSerials(
  actor: SessionUser,
  invoiceId: string,
  rows: SerialRowInput[],
  serialFileId?: string,
) {
  requireStaff(actor);
  const invoice = await loadInvoiceForActor(invoiceId, actor);
  if (invoice.closedAt || invoice.submission.closedAt) {
    throw new AppError('This request is closed. Edits are no longer available.');
  }
  if (!invoice.recycling) {
    throw new AppError('Record recycling before importing serials.');
  }
  if (!rows.length) throw new AppError('No serial rows found in the file.');
  if (serialFileId) await assertFilesExist([serialFileId], ['serials']);

  await prisma.serial.createMany({
    data: rows.map((r) => ({
      recyclingId: invoice.recycling!.id,
      serialNo: r.serialNo.trim(),
      assetTag: r.assetTag?.trim() || null,
      make: r.make?.trim() || null,
      model: r.model?.trim() || null,
    })),
  });

  if (serialFileId) {
    await prisma.recycling.update({
      where: { id: invoice.recycling.id },
      data: { serialFileId },
    });
  }

  await auditLog({
    actorEmail: actor.email,
    actorId: actor.id,
    action: 'serial.import',
    entity: 'invoice',
    entityId: invoice.invoiceNo,
    details: { submissionId: invoice.submissionId, count: rows.length },
  });

  return prisma.serial.findMany({
    where: { recyclingId: invoice.recycling.id },
    orderBy: { serialNo: 'asc' },
  });
}

export async function destroySerials(
  actor: SessionUser,
  invoiceId: string,
  input: { serialNos?: string[] | 'all'; std: string; method?: string },
) {
  requireStaff(actor);
  const invoice = await loadInvoiceForActor(invoiceId, actor);
  if (invoice.closedAt || invoice.submission.closedAt) {
    throw new AppError('This request is closed. Edits are no longer available.');
  }
  if (!invoice.recycling?.serials.length) throw new AppError('No serials on this invoice');

  const pending = invoice.recycling.serials.filter((s) => !s.dcodNo);
  const targets =
    input.serialNos === 'all' || !input.serialNos
      ? pending
      : pending.filter((s) => input.serialNos!.includes(s.serialNo));

  let n = 0;
  for (const rec of targets) {
    const dcodNo = await nextSequence('dcod');
    await prisma.serial.update({
      where: { id: rec.id },
      data: {
        destroyStd: input.std,
        destroyMethod: input.method?.trim() || input.std,
        destroyOp: actor.name,
        destroyedAt: new Date(),
        dcodNo,
      },
    });
    n++;
  }

  await auditLog({
    actorEmail: actor.email,
    actorId: actor.id,
    action: 'serial.destroy',
    entity: 'invoice',
    entityId: invoice.invoiceNo,
    details: { submissionId: invoice.submissionId, count: n, std: input.std },
  });

  return { destroyed: n };
}
