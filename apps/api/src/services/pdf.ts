import { SUSTAINABILITY, getFY, type ReportPeriod } from '@urb-tectrack/shared';
import type { SessionUser } from '../lib/auth-context.js';
import { canSeeMrn, isStaff } from '../lib/auth-context.js';
import { AppError } from '../lib/errors.js';
import { loadInvoiceForActor } from '../lib/access.js';
import { buildTextPdf, type PdfLetterhead } from '../lib/simple-pdf.js';
import { prisma } from '../lib/prisma.js';
import { auditLog } from './audit.js';
import { getImpactReport, getRegisterReport, type RegisterType } from './reporting-service.js';
import { getCompanyProfile } from './settings.js';
import { readStoredFileSilent } from './file-service.js';

async function letterheadFromProfile(): Promise<{ co: Awaited<ReturnType<typeof getCompanyProfile>>; letterhead: PdfLetterhead }> {
  const co = await getCompanyProfile();
  const letterhead: PdfLetterhead = {
    name: co.name,
    brand: co.brand,
    address: co.address,
    gst: co.gst,
    cin: co.cin,
    phone: co.phone,
    email: co.email,
    cpcb: co.cpcb,
    kspcb: co.kspcb,
  };
  if (co.logoFileId) {
    const stored = await readStoredFileSilent(co.logoFileId);
    if (stored && /jpeg|jpg/i.test(stored.file.mimeType)) {
      letterhead.logoJpeg = stored.buffer;
    } else if (stored && stored.buffer[0] === 0xff && stored.buffer[1] === 0xd8) {
      letterhead.logoJpeg = stored.buffer;
    }
  }
  return { co, letterhead };
}

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
  const { co, letterhead } = await letterheadFromProfile();
  const mats = Array.isArray(mrn.materials)
    ? (mrn.materials as Array<{ n?: string; q?: number; w?: number }>)
    : [];

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
        heading: 'MATERIALS RECEIVED',
        table: {
          headers: ['Description', 'Qty', 'Weight kg'],
          rows: mats.length
            ? mats.map((m) => [String(m.n || '—'), String(m.q ?? 0), num(m.w)])
            : [['—', '—', '—']],
        },
      },
      {
        heading: 'GATE SIGNATURES',
        pairs: [
          ['Driver', mrn.driverSign || '—', 'Factory Manager', mrn.managerSign || '—'],
          ['Security Officer', mrn.securitySign || '—', '', ''],
        ],
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
    `${mrn.mrnNo} · ${co.name} · ${factory?.kspcbConsent || co.kspcb}`,
    letterhead,
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
  const { co, letterhead } = await letterheadFromProfile();

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
          ['Devices destroyed', String(recy.devicesDestroyed ?? 0), '', ''],
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
          ['Facility', factory?.name || co.name, 'Facility Code', recy.factoryId],
          ['CPCB / EPR', factory?.cpcbEpr || co.cpcb, 'KSPCB Consent', factory?.kspcbConsent || co.kspcb],
          ['GST', factory?.gstin || co.gst, 'CIN', co.cin || '—'],
          ['Phone', co.phone, 'R2v3', co.r2],
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
    `Form 6 ${recy.form6No} · Invoice ${invoice.invoiceNo} · ${co.name}`,
    letterhead,
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
  const co = await getCompanyProfile();

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
    `${co.name} · ${co.brand} · generated by Urb TecTrack`,
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

export async function methodologyPdf(actor?: SessionUser): Promise<{ filename: string; buffer: Buffer }> {
  const S = SUSTAINABILITY;
  const fy = getFY(new Date());
  const daily = (S.co2PerTree / 365).toFixed(6);
  const today = new Date().toISOString().slice(0, 10);
  const co = await getCompanyProfile();

  const buffer = buildTextPdf(
    'SUSTAINABILITY METRICS — METHODOLOGY',
    `MTH/${fy?.short ?? 'v1'}/v1 · How Urb TecTrack calculates every environmental figure it reports`,
    [
      {
        heading: '1 · PURPOSE AND SCOPE',
        lines: [
          'This document sets out how every environmental figure shown in Urb TecTrack is derived, which source each conversion factor comes from, and what evidence sits behind it. It is written so that a client\'s sustainability team, an internal auditor, or an external assurance provider can reproduce any number we publish without needing access to our systems.',
          'Two distinct effects are reported, and they are never added together:',
          'A · Avoided impact from recycling — The emissions, landfill volume, water and energy that were NOT incurred because end-of-life equipment was recycled instead of landfilled and replaced with virgin manufacture. This is a counterfactual saving, recognised once, at the point the consignment completes its lifecycle.',
          'B · Sequestration from trees planted — Carbon dioxide actually absorbed by trees planted under the Recycle Heroes programme. This is a physical removal that accrues day by day for as long as the tree stands. It is reported separately from (A) because combining an avoided emission with a removal would overstate the total.',
        ],
      },
      {
        heading: '2 · WHAT COUNTS, AND WHEN',
        lines: [
          'Only fully completed consignments are counted. A consignment enters the numbers when all of the following are true:',
          'Weighed — Net weight recorded on a weighbridge at pickup, evidenced by a weighment slip photograph.',
          'Received — Material receipt note (MRN) raised at the receiving facility, signed by driver, factory manager and security.',
          'Processed — Recycling recorded against the facility\'s authorised categories, with a Form 6 manifest issued under Rule 12 of the E-Waste (Management) Rules, 2022.',
          'Certified — A Certificate of Destruction issued and delivered to the client.',
          'Acknowledged — The client has confirmed receipt of the certificate and closed the request in the portal.',
          'Material still in transit, awaiting processing, or awaiting client acknowledgement is deliberately excluded. This is conservative by design: a number that has been certified and acknowledged can be defended; a number that is still moving cannot.',
          'The weight used is the NET weighbridge figure (gross minus tare), not the client\'s declared estimate at the time of raising the request. Where one pickup is invoiced in parts, weight is apportioned across invoices in proportion to the item weights assigned to each.',
        ],
      },
      {
        heading: '3 · CONVERSION FACTORS',
        table: {
          headers: ['METRIC', 'FACTOR', 'UNIT', 'SOURCE'],
          rows: [
            ['CO2e avoided', String(S.co2PerKg), 'kg CO2e / kg', S.cite.co2],
            ['Landfill diverted', `${(S.landfillRatio * 100).toFixed(0)}%`, 'of net weight', S.cite.landfill],
            ['Tree sequestration', String(S.co2PerTree), 'kg CO2 / tree / yr', S.cite.tree],
            ['Water saved', String(S.waterPerKg), 'kL / kg', S.cite.water],
            ['Energy saved', String(S.energyPerKg), 'kWh / kg', S.cite.energy],
            ['Trees earned', String(S.treesPerTonne), 'tree / tonne', 'Urbeno Recycle Heroes commitment'],
          ],
        },
        lines: [
          'These factors are published averages for mixed electronic waste. They are not Urbeno-specific measurements. Where a client requires India-specific or facility-specific factors for assurance purposes, we will substitute them and restate the figures — the calculation method does not change.',
        ],
      },
      {
        heading: '4 · FORMULAS',
        lines: [
          `CO2e avoided (recycling):  CO2e_kg  =  net_weight_kg  x  ${S.co2PerKg}`,
          'Recognised once, on the date the client acknowledges closure.',
          `Landfill diverted:  landfill_kg  =  net_weight_kg  x  ${S.landfillRatio}`,
          `Water and energy saved:  water_kL = net_weight_kg x ${S.waterPerKg}     energy_kWh = net_weight_kg x ${S.energyPerKg}`,
          `Trees earned:  trees_earned  =  floor( net_weight_kg / 1000 )  x  ${S.treesPerTonne}`,
          'Rounded down. A part-tonne earns nothing until the next full tonne completes.',
          `CO2 sequestered by trees (daily accrual):  CO2_kg  =  SUM over plantings of  ( trees  x  days_since_planting  x  ${daily} )`,
          `Daily rate = ${S.co2PerTree} kg per tree per year divided by 365. A tree planted yesterday has banked one day of absorption, not a year of it. This is why the Recycle Heroes figure rises every day without any new activity.`,
          `Tree-equivalent (illustrative only):  tree_years  =  CO2e_avoided_kg  /  ${S.co2PerTree}`,
          'A comparison device to make an abstract tonnage tangible. It is NOT a claim that these trees exist. Trees actually planted are counted separately and evidenced with dated photographs.',
        ],
      },
      {
        heading: '5 · THE RECYCLE HEROES TREE LEDGER',
        lines: [
          `Trees are recorded in two categories and reported separately. Trees planted by Urbeno are those we plant against a client's completed tonnage, at the rate of ${S.treesPerTonne} tree per tonne. Trees logged as client CSR are those the client plants through its own programmes and records in the portal so that its Recycle Heroes page reflects the whole picture. Only the first category counts against what Urbeno owes.`,
          'Each planting batch carries a planting date, count, species, location, and planting partner. Growth photographs are added over time, each carrying its own date and observation, producing a timeline that can be sampled during a CSR audit. Sequestration is calculated from the planting date of each batch independently, so batches planted in different years accrue at different totals.',
          'Survival is not currently modelled. Where a sapling is replaced, the replacement is recorded as an observation on the growth timeline rather than as a new planting, so the count is not inflated.',
        ],
      },
      {
        heading: '6 · WHAT WE DO NOT CLAIM',
        lines: [
          '— We do not claim carbon credits, offsets, or any tradable instrument. Nothing in this report has been registered with a crediting body.',
          '— We do not count material that is in progress, and we do not restate previous periods when factors are updated — a change of factor applies from the date of change and is disclosed.',
          '— We do not combine avoided emissions with tree sequestration into a single headline number.',
          '— We do not extrapolate beyond the reporting period, and we do not model future tree growth.',
        ],
      },
      {
        heading: '7 · EVIDENCE AND TRACEABILITY',
        lines: [
          'Every figure decomposes to individual consignments. For any number in any report, the underlying records — weighment slip, MRN, Form 6 manifest, Certificate of Destruction, closure acknowledgement and, for trees, the dated growth photographs — are retained in Urb TecTrack and can be produced on request. Compliance records are held for a minimum of five years and certificates for ten, in line with Rule 12(4) of the E-Waste (Management) Rules, 2022.',
          'Where an assurance provider wishes to sample, we recommend selecting consignments at random from the Certificate Log report for the period and tracing each back through the portal. Every document referenced is downloadable.',
          `Prepared by — ${co.name} · ${co.cpcb}`,
          `Version / Date — v1 · ${today}`,
        ],
      },
    ],
    `Sustainability methodology v1 · ${co.name} · applies to all impact figures in Urb TecTrack`,
  );

  if (actor) {
    await auditLog({
      actorEmail: actor.email,
      actorId: actor.id,
      action: 'pdf.methodology',
      entity: 'report',
      entityId: 'methodology',
    });
  }

  return { filename: 'Urbeno-Sustainability-Methodology-v1.pdf', buffer };
}

export async function registerPdf(
  actor: SessionUser,
  type: RegisterType,
  period?: ReportPeriod,
  filters?: { clientId?: string; siteId?: string },
): Promise<{ filename: string; buffer: Buffer }> {
  const report = await getRegisterReport(actor, type, period, filters);
  if (!report.rows.length) throw new AppError('Nothing to export for this period.');
  const co = await getCompanyProfile();

  const shown = report.rows.slice(0, 80).map((r) => r.map((c) => String(c ?? '')));
  const buffer = buildTextPdf(
    report.title,
    `${report.periodLabel} · ${report.scopeLabel} · ${report.total} rows`,
    [
      {
        heading: 'REGISTER',
        table: { headers: report.head, rows: shown },
      },
      ...(report.total > 80
        ? [{ heading: 'NOTE', lines: [`Showing 80 of ${report.total} rows. Export CSV for the full set.`] }]
        : []),
    ],
    `${report.title} · ${report.periodLabel} · ${co.name}`,
  );

  await auditLog({
    actorEmail: actor.email,
    actorId: actor.id,
    action: 'pdf.report',
    entity: 'report',
    entityId: type,
    details: { period: report.periodLabel, rows: report.total },
  });

  const slug = report.periodLabel.replace(/[^\w]+/g, '-');
  return { filename: `urbeno-${type}-${slug}.pdf`, buffer };
}
