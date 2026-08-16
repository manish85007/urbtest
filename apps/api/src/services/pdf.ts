import { SUSTAINABILITY, type ReportPeriod } from '@urb-tectrack/shared';
import type { SessionUser } from '../lib/auth-context.js';
import { canSeeMrn, isStaff } from '../lib/auth-context.js';
import { AppError } from '../lib/errors.js';
import { loadInvoiceForActor } from '../lib/access.js';
import { buildTextPdf } from '../lib/simple-pdf.js';
import { prisma } from '../lib/prisma.js';
import { auditLog } from './audit.js';
import { getImpactReport } from './reporting-service.js';

const CO = {
  name: process.env.URBENO_NAME ?? 'Urbeno Private Limited',
  brand: 'Urb TecTrack',
  gst: process.env.URBENO_GST ?? '29AABCU1234R1ZX',
  cpcb: process.env.URBENO_CPCB ?? 'CPCB/EPR/2022/KA/00817',
  kspcb: process.env.URBENO_KSPCB ?? 'KSPCB/HWM/AUTH/2024-27/1142',
  r2: process.env.URBENO_R2 ?? 'R2V3-2024-IN-0341',
};

function fmt(d: Date | null | undefined): string {
  return d ? d.toISOString().slice(0, 10) : '—';
}

function num(n: number | string | null | undefined): string {
  return Number(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 3 });
}

export async function mrnPdf(actor: SessionUser, invoiceId: string): Promise<{ filename: string; buffer: Buffer }> {
  if (!canSeeMrn(actor)) throw new AppError('MRN is an internal receiving record.', 404);
  const invoice = await loadInvoiceForActor(invoiceId, actor);
  const mrn = invoice.mrn;
  if (!mrn) throw new AppError('No MRN on this invoice yet.');

  const factory = await prisma.factorySite.findUnique({ where: { id: mrn.factoryId } });
  const sub = invoice.submission;
  const vehs = sub.vehicles.filter((v) => invoice.vehicleIds.includes(v.id) || !invoice.vehicleIds.length);

  const buffer = buildTextPdf(
    'MATERIAL RECEIPT NOTE',
    `${mrn.mrnNo} · ${factory?.name ?? mrn.factoryId}`,
    [
      {
        heading: 'REFERENCE',
        pairs: [
          ['Request ID', sub.id, 'Client PO / Ref', sub.ref || '—'],
          ['Invoice Number', invoice.invoiceNo, 'Invoice Date', fmt(invoice.invoiceDate)],
          ['E-way Bill Number', invoice.ewayBillNo || '—', 'E-way Bill Date', fmt(invoice.ewayBillDate)],
          ['Client', `${sub.client.name} (${sub.clientId})`, 'Origin Site', sub.site.name],
          ['Received On', fmt(mrn.receivedAt), 'Condition', mrn.condition],
        ],
      },
      {
        heading: 'VEHICLES & WEIGHMENT',
        table: {
          headers: ['Vehicle', 'Driver', 'Net kg', 'Slip'],
          rows: vehs.map((v) => [
            v.registration,
            v.driverName,
            v.weighment ? num(v.weighment.netKg.toString()) : '—',
            v.weighment?.slipNumber || '—',
          ]),
        },
      },
      {
        heading: 'NOTES',
        lines: [
          mrn.note || 'No remarks.',
          'Classification into authorised e-waste categories is recorded on the Form 6 manifest after segregation.',
          'Retain for a minimum of five years per Rule 12(4), E-Waste (Management) Rules, 2022.',
        ],
      },
    ],
    `${mrn.mrnNo} · ${CO.name} · ${factory?.kspcbConsent || CO.kspcb}`,
  );

  await auditLog({
    actorEmail: actor.email,
    actorId: actor.id,
    action: 'pdf.mrn',
    entity: 'mrn',
    entityId: mrn.mrnNo,
    details: { submissionId: sub.id, invNo: invoice.invoiceNo },
  });

  return { filename: `${mrn.mrnNo.replace(/\//g, '-')}.pdf`, buffer };
}

export async function form6Pdf(actor: SessionUser, invoiceId: string): Promise<{ filename: string; buffer: Buffer }> {
  const invoice = await loadInvoiceForActor(invoiceId, actor);
  const recy = invoice.recycling;
  if (!recy) throw new AppError('This invoice has not been processed yet.');

  const factory = await prisma.factorySite.findUnique({ where: { id: recy.factoryId } });
  const sub = invoice.submission;
  const cats = recy.categories;
  const fe = Number(recy.recoveryFe);
  const nfe = Number(recy.recoveryNfe);
  const pl = Number(recy.recoveryPl);
  const pcb = Number(recy.recoveryPcb);
  const sum = fe + nfe + pl + pcb;

  const buffer = buildTextPdf(
    'FORM 6 — MANIFEST FOR E-WASTE',
    `${recy.form6No} · E-Waste (Management) Rules, 2022 · Rule 12`,
    [
      {
        heading: 'CONSIGNMENT',
        pairs: [
          ['Manifest Number', recy.form6No, 'Processing Date', fmt(recy.processedAt)],
          ['Request ID', sub.id, 'Invoice Number', invoice.invoiceNo],
          ['E-way Bill Number', invoice.ewayBillNo || '—', 'MRN Reference', invoice.mrn?.mrnNo || '—'],
        ],
      },
      {
        heading: 'SENDER — BULK CONSUMER',
        pairs: [
          ['Name', sub.client.name, 'Client Code', sub.clientId],
          ['Site', sub.site.name, 'GST', sub.site.gstin || '—'],
        ],
      },
      {
        heading: 'RECEIVER — AUTHORIZED RECYCLER',
        pairs: [
          ['Facility', factory?.name || CO.name, 'Facility Code', recy.factoryId],
          ['CPCB / EPR', factory?.cpcbEpr || CO.cpcb, 'KSPCB Consent', factory?.kspcbConsent || CO.kspcb],
          ['GST', factory?.gstin || CO.gst, 'R2v3', CO.r2],
        ],
      },
      {
        heading: 'E-WASTE CATEGORIES PROCESSED (SCHEDULE I)',
        table: {
          headers: ['Entry', 'Group', 'Weight (kg)'],
          rows: cats.map((c) => [c.entryId, c.groupCode, num(c.weightKg.toString())]),
          total: ['TOTAL', '', num(cats.reduce((a, c) => a + Number(c.weightKg), 0))],
        },
      },
      {
        heading: 'MATERIAL RECOVERY',
        table: {
          headers: ['Fraction', 'Weight (kg)', 'Share'],
          rows: [
            ['Ferrous metals', num(fe), sum ? `${((fe / sum) * 100).toFixed(1)}%` : '—'],
            ['Non-ferrous metals', num(nfe), sum ? `${((nfe / sum) * 100).toFixed(1)}%` : '—'],
            ['Plastics', num(pl), sum ? `${((pl / sum) * 100).toFixed(1)}%` : '—'],
            ['Printed circuit boards', num(pcb), sum ? `${((pcb / sum) * 100).toFixed(1)}%` : '—'],
          ],
        },
      },
      {
        heading: 'SERIALS',
        lines: [`Serial records on file: ${recy.serials.length}`],
      },
    ],
    `Form 6 ${recy.form6No} · Invoice ${invoice.invoiceNo} · ${CO.name}`,
  );

  await auditLog({
    actorEmail: actor.email,
    actorId: actor.id,
    action: 'pdf.form6',
    entity: 'form6',
    entityId: recy.form6No,
    details: { submissionId: sub.id, invNo: invoice.invoiceNo },
  });

  return { filename: `${recy.form6No}-${invoice.invoiceNo.replace(/[^\w]/g, '')}.pdf`, buffer };
}

export async function impactPdf(
  actor: SessionUser,
  period?: ReportPeriod,
): Promise<{ filename: string; buffer: Buffer }> {
  if (isStaff(actor) && !actor.clientId) {
    throw new AppError('Impact certificates are issued per client organisation.');
  }
  const report = await getImpactReport(actor, undefined, period);
  if (!report.impact.invoices) {
    throw new AppError('No completed submissions in this period — nothing to certify yet.');
  }

  const clientName =
    actor.role === 'client'
      ? (await prisma.client.findUnique({ where: { id: actor.clientId ?? '' } }))?.name ?? 'Client'
      : 'Urbeno portfolio';

  const buffer = buildTextPdf(
    'SUSTAINABILITY IMPACT CERTIFICATE',
    `Environmental impact statement · ${report.period.label} · for ESG and BRSR reporting`,
    [
      { heading: 'ORGANISATION', lines: [clientName] },
      {
        heading: 'CLOSED LIFECYCLE IMPACT',
        pairs: [
          ['Weight recycled (kg)', num(report.impact.kg), 'Tonnes', num(report.impact.tonnes)],
          ['CO2e avoided (kg)', num(report.impact.co2), 'Landfill diverted (kg)', num(report.impact.landfill)],
          ['Water saved (kL)', num(report.impact.water), 'Energy saved (kWh)', num(report.impact.energy)],
          ['Closed invoices', String(report.impact.invoices), 'Requests', String(report.impact.submissions)],
          ['Trees earned', String(report.treesEarned), '', ''],
        ],
      },
      {
        heading: 'METHODOLOGY',
        lines: [
          `CO2e avoided: ${SUSTAINABILITY.co2PerKg} kg per kg — ${SUSTAINABILITY.cite.co2}`,
          `Landfill diversion: ${SUSTAINABILITY.landfillRatio} — ${SUSTAINABILITY.cite.landfill}`,
          `Tree equivalent: ${SUSTAINABILITY.co2PerTree} kg CO2 per tree-year — ${SUSTAINABILITY.cite.tree}`,
          'Only invoices that reached stage 9 (certified and acknowledged) are counted.',
        ],
      },
    ],
    `${CO.name} · ${CO.brand} · generated by Urb TecTrack`,
  );

  await auditLog({
    actorEmail: actor.email,
    actorId: actor.id,
    action: 'pdf.impact',
    entity: 'report',
    entityId: actor.clientId ?? 'staff',
  });

  return { filename: `sustainability-${actor.clientId ?? 'portfolio'}.pdf`, buffer };
}

export async function methodologyPdf(): Promise<{ filename: string; buffer: Buffer }> {
  const buffer = buildTextPdf(
    'SUSTAINABILITY METHODOLOGY',
    'Citation sheet for Urb TecTrack impact figures',
    [
      {
        heading: 'FACTORS',
        lines: [
          `CO2e avoided: ${SUSTAINABILITY.co2PerKg} kg per kg e-waste. ${SUSTAINABILITY.cite.co2}`,
          `Landfill diverted: ${SUSTAINABILITY.landfillRatio * 100}% of net weight. ${SUSTAINABILITY.cite.landfill}`,
          `Tree equivalent: CO2e / ${SUSTAINABILITY.co2PerTree} kg per tree-year. ${SUSTAINABILITY.cite.tree}`,
          `Water saved: ${SUSTAINABILITY.waterPerKg} kL per kg. ${SUSTAINABILITY.cite.water}`,
          `Energy saved: ${SUSTAINABILITY.energyPerKg} kWh per kg. ${SUSTAINABILITY.cite.energy}`,
          'Trees earned: 1 per tonne of closed, acknowledged recycling — Urbeno commitment.',
          'Tree sequestration accrues daily from each planting date and is never added to avoided emissions.',
        ],
      },
    ],
    `${CO.name} · Urb TecTrack methodology`,
  );
  return { filename: 'urb-tectrack-methodology.pdf', buffer };
}
