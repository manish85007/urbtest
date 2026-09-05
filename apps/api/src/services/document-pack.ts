import { dateInPeriod, periodLabel, type ReportPeriod } from '@urb-tectrack/shared';
import type { SessionUser } from '../lib/auth-context.js';
import { clientScopeFilter, factoryInScope, hasFeature, isStaff } from '../lib/auth-context.js';
import { AppError } from '../lib/errors.js';
import { buildZip } from '../lib/zip.js';
import { prisma } from '../lib/prisma.js';
import { recyclingClientPublished } from '../lib/stage-mapper.js';
import { readFileBlob } from './file-service.js';
import { form6Pdf } from './pdf.js';

function scopeFilter(actor: SessionUser, clientId?: string, siteId?: string) {
  const base = clientScopeFilter(actor);
  if (!isStaff(actor)) {
    return siteId ? { ...base, siteId } : base;
  }
  return {
    ...base,
    ...(clientId ? { clientId } : {}),
    ...(siteId ? { siteId } : {}),
  };
}

function safeName(s: string): string {
  return s.replace(/[^\w.\-]+/g, '_').slice(0, 80);
}

/**
 * Bulk ZIP of Certificate of Destruction PDFs and/or Form 6 PDFs for a report period.
 * Available to clients (own scope) and Super Admin / operations (optional client filter).
 */
export async function documentsZip(
  actor: SessionUser,
  type: 'cod' | 'form6',
  period: ReportPeriod | null,
  opts?: { clientId?: string; siteId?: string },
): Promise<{ filename: string; buffer: Buffer; count: number }> {
  if (type === 'cod' && !hasFeature(actor, 'reports.cod')) {
    throw new AppError('You do not have access to certificate downloads.', 403);
  }
  if (type === 'form6' && !hasFeature(actor, 'reports.form6')) {
    throw new AppError('You do not have access to Form 6 downloads.', 403);
  }
  if (actor.role === 'factory') {
    throw new AppError('Bulk document download is available to clients and Super Admin.', 403);
  }

  const scope = scopeFilter(actor, opts?.clientId, opts?.siteId);
  const inP = (d: Date | string | null | undefined) =>
    !period || (d != null && dateInPeriod(d instanceof Date ? d : new Date(d), period));

  const entries: Array<{ name: string; data: Buffer }> = [];
  const usedNames = new Set<string>();

  function uniqueName(base: string): string {
    let name = base;
    let n = 2;
    while (usedNames.has(name.toLowerCase())) {
      const dot = base.lastIndexOf('.');
      name = dot > 0 ? `${base.slice(0, dot)}_${n}${base.slice(dot)}` : `${base}_${n}`;
      n += 1;
    }
    usedNames.add(name.toLowerCase());
    return name;
  }

  if (type === 'cod') {
    const certs = await prisma.certificate.findMany({
      where: {
        invoice: { submission: scope },
        NOT: { fileId: '' },
      },
      include: {
        invoice: {
          include: {
            recycling: true,
            submission: { include: { client: true } },
          },
        },
      },
      orderBy: { certDate: 'desc' },
      take: 2000,
    });
    const filtered = certs.filter(
      (c) =>
        !!c.fileId &&
        inP(c.certDate) &&
        (actor.role !== 'client' || recyclingClientPublished(c.invoice.recycling)),
    );
    for (const c of filtered) {
      try {
        const { file, buffer } = await readFileBlob(actor, c.fileId);
        const ext = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : '.pdf';
        const name = uniqueName(
          safeName(`${c.certNo || c.id}_${c.invoice.submission.client.name}${ext}`),
        );
        entries.push({ name, data: Buffer.from(buffer) });
      } catch {
        /* skip inaccessible / missing files */
      }
    }
  } else {
    const recys = await prisma.recycling.findMany({
      where: {
        invoice: { submission: scope },
        ...(actor.role === 'client' ? { reviewStatus: 'approved', clientPublishedAt: { not: null } } : {}),
      },
      include: {
        factory: true,
        invoice: { include: { submission: { include: { client: true } } } },
      },
      orderBy: { processedAt: 'desc' },
      take: 2000,
    });
    const filtered = recys.filter(
      (r) =>
        (actor.role !== 'factory' || factoryInScope(actor, r.factoryId)) &&
        inP(r.processedAt) &&
        (actor.role !== 'client' || recyclingClientPublished(r)),
    );
    for (const r of filtered) {
      try {
        const { filename, buffer } = await form6Pdf(actor, r.invoiceId);
        let name = safeName(
          `${r.form6No || filename.replace(/\.pdf$/i, '')}_${r.invoice.submission.client.name}.pdf`,
        );
        if (!name.toLowerCase().endsWith('.pdf')) name = `${name}.pdf`;
        entries.push({ name: uniqueName(name), data: buffer });
      } catch {
        /* skip invoices that cannot generate Form 6 */
      }
    }
  }

  if (!entries.length) {
    throw new AppError('No documents found for this period and scope.', 404);
  }

  const label = (period ? periodLabel(period) : 'all').replace(/[^\w]+/g, '-');
  const filename = `urbeno-${type}-${label}.zip`;
  return { filename, buffer: buildZip(entries), count: entries.length };
}
