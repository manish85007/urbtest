import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SUSTAINABILITY, getFY, type ReportPeriod } from '@urb-tectrack/shared';
import type { SessionUser } from '../lib/auth-context.js';
import { canSeeMrn } from '../lib/auth-context.js';
import { AppError } from '../lib/errors.js';
import { loadInvoiceForActor } from '../lib/access.js';
import { buildTextPdf, type PdfLetterhead } from '../lib/simple-pdf.js';
import { prisma } from '../lib/prisma.js';
import { auditLog } from './audit.js';
import { getImpactReport, getRegisterReport, type RegisterType } from './reporting-service.js';
import { getCompanyProfile } from './settings.js';
import { readStoredFileSilent } from './file-service.js';

function bundledUrbenoLogoJpeg(): Buffer | undefined {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(here, '../../assets/urbeno-logo.jpg'),
    join(here, '../assets/urbeno-logo.jpg'),
    join(process.cwd(), 'apps/api/assets/urbeno-logo.jpg'),
    join(process.cwd(), 'assets/urbeno-logo.jpg'),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return readFileSync(p);
  }
  return undefined;
}

function applyBrandLetterhead(letterhead: PdfLetterhead) {
  const logo = bundledUrbenoLogoJpeg();
  if (!logo) return;
  letterhead.logoJpeg = logo;
  letterhead.variant = 'document';
  letterhead.logoMaxWidth = 155;
  letterhead.logoMaxHeight = 38;
}

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
  applyBrandLetterhead(letterhead);
  letterhead.docNo = mrn.mrnNo;
  letterhead.docLabel = `Invoice ${invoice.invoiceNo}`;
  letterhead.docDate = fmt(mrn.receivedAt);
  const mats = Array.isArray(mrn.materials)
    ? (mrn.materials as Array<{ n?: string; q?: number; w?: number }>)
    : [];

  const receivedKg = mats.reduce((s, m) => s + Number(m.w ?? 0), 0);

  const buffer = buildTextPdf(
    'MATERIAL RECEIPT NOTE',
    `Linked to invoice ${invoice.invoiceNo} · Request ${sub.id} · one MRN per invoice`,
    [
      {
        heading: 'REFERENCE',
        pairs: [
          ['Request ID', sub.id, 'Client PO / Ref', sub.ref || '—'],
          ['Invoice Number', invoice.invoiceNo, 'Invoice Date', fmt(invoice.invoiceDate)],
          ['Invoice billing weight', `${num(invoice.billingWeight.toString())} kg`, 'Material received', `${num(receivedKg)} kg`],
          ['MRN Number', mrn.mrnNo, 'Receiving facility', factory?.name ?? mrn.factoryId],
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
          total: ['TOTAL RECEIVED', '', num(receivedKg)],
          aligns: ['l', 'r', 'r'],
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
    `${mrn.mrnNo} · Invoice ${invoice.invoiceNo} · ${co.name} · ${factory?.kspcbConsent || co.kspcb}`,
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
  if (actor.role === 'client' && recy.reviewStatus !== 'approved') {
    throw new AppError('Form 6 is awaiting admin approval and is not available yet.');
  }

  const factory = await prisma.factorySite.findUnique({ where: { id: recy.factoryId } });
  const sub = invoice.submission;
  const cats = recy.categories;
  const fe = Number(recy.recoveryFe);
  const nfe = Number(recy.recoveryNfe);
  const pl = Number(recy.recoveryPl);
  const pcb = Number(recy.recoveryPcb);
  const sum = fe + nfe + pl + pcb;
  const { co, letterhead } = await letterheadFromProfile();
  applyBrandLetterhead(letterhead);
  letterhead.docNo = recy.form6No;
  letterhead.docLabel = `Invoice ${invoice.invoiceNo}`;
  letterhead.docDate = fmt(recy.processedAt);

  const formVehicles = sub.vehicles.filter((v) =>
    recy.vehicleIds?.length
      ? recy.vehicleIds.includes(v.id)
      : invoice.vehicleIds.includes(v.id) || !invoice.vehicleIds.length,
  );
  const invoiceQty = Array.isArray(invoice.mrn?.materials)
    ? (invoice.mrn!.materials as Array<{ q?: number }>).reduce((s, m) => s + Number(m.q ?? 0), 0)
    : 0;

  const buffer = buildTextPdf(
    'FORM 6 — MANIFEST FOR E-WASTE',
    `E-Waste (Management) Rules, 2022 · Rule 12 · linked to invoice ${invoice.invoiceNo}`,
    [
      {
        heading: 'CONSIGNMENT',
        pairs: [
          ['Manifest Number', recy.form6No, 'Processing Date', fmt(recy.processedAt)],
          ['Request ID', sub.id, 'Invoice Number', invoice.invoiceNo],
          ['E-way Bill Number', invoice.ewayBillNo || '—', 'MRN Reference', invoice.mrn?.mrnNo || '—'],
          ['Invoice billed weight', `${num(invoice.billingWeight.toString())} kg`, 'Invoice quantity', String(invoiceQty || recy.devicesDestroyed || '—')],
          ['Devices destroyed', String(recy.devicesDestroyed ?? 0), 'Serial records', String(recy.serials.length)],
        ],
      },
      {
        heading: 'VEHICLES ON THIS MANIFEST',
        table: {
          headers: ['Vehicle', 'Driver', 'Net kg', 'Slip'],
          rows: formVehicles.length
            ? formVehicles.map((v) => [
                v.registration,
                v.driverName,
                v.weighment ? num(v.weighment.netKg.toString()) : '—',
                v.weighment?.slipNumber || '—',
              ])
            : [['—', '—', '—', '—']],
        },
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
          ['Phone', co.phone, 'Email', co.email],
        ],
      },
      {
        heading: 'E-WASTE CATEGORIES PROCESSED (SCHEDULE I)',
        table: {
          headers: ['Entry', 'Group', 'Weight (kg)'],
          rows: cats.map((c) => [c.entryId, c.groupCode, num(c.weightKg.toString())]),
          total: ['TOTAL', '', num(cats.reduce((a, c) => a + Number(c.weightKg), 0))],
          aligns: ['l', 'l', 'r'],
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
          aligns: ['l', 'r', 'r'],
        },
      },
      {
        heading: 'NOTES',
        lines: [
          'This manifest is issued under Rule 12 of the E-Waste (Management) Rules, 2022. Original to be retained for a minimum of five years.',
        ],
      },
    ],
    `Form 6 manifest ${recy.form6No} · Invoice ${invoice.invoiceNo} · ${co.name}`,
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

  return {
    filename: `${recy.form6No.replace(/\//g, '-')}-${invoice.invoiceNo.replace(/[^\w]/g, '')}.pdf`,
    buffer,
  };
}

export async function impactPdf(
  actor: SessionUser,
  period?: ReportPeriod,
  clientId?: string,
): Promise<{ filename: string; buffer: Buffer }> {
  if (actor.role === 'client' && clientId && clientId !== actor.clientId) {
    throw new AppError('You can only download your organisation’s impact certificate.');
  }
  const report = await getImpactReport(actor, undefined, period, clientId);
  if (!report.impact.invoices) {
    throw new AppError('No completed submissions in this period — nothing to certify yet.');
  }

  const scopedId = actor.role === 'client' ? actor.clientId : clientId;
  const clientName = scopedId
    ? (await prisma.client.findUnique({ where: { id: scopedId } }))?.name ?? 'Client'
    : report.clientName || 'Urbeno portfolio';
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
          ['Trees earned', String(report.treesEarned), 'Nurture', `${SUSTAINABILITY.nurtureYears} years`],
        ],
      },
      {
        heading: 'METHODOLOGY',
        lines: [
          `CO2e avoided: ${SUSTAINABILITY.co2PerKg} kg per kg — ${SUSTAINABILITY.cite.co2}`,
          `Landfill diversion: ${SUSTAINABILITY.landfillRatio} — ${SUSTAINABILITY.cite.landfill}`,
          `Saplings: ${SUSTAINABILITY.treesPerTonne} per tonne closed, nurtured ${SUSTAINABILITY.nurtureYears} years — ${SUSTAINABILITY.cite.sapling}`,
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
    entityId: scopedId ?? 'portfolio',
  });

  return { filename: `sustainability-${scopedId ?? 'portfolio'}.pdf`, buffer };
}

export async function methodologyPdf(actor?: SessionUser): Promise<{ filename: string; buffer: Buffer }> {
  const S = SUSTAINABILITY;
  const fy = getFY(new Date());
  const today = new Date().toISOString().slice(0, 10);
  const { co, letterhead } = await letterheadFromProfile();
  applyBrandLetterhead(letterhead);
  letterhead.docLabel = 'Methodology';
  letterhead.docNo = `MTH/${fy?.short ?? 'v2'}/v2`;
  letterhead.docDate = today;

  const buffer = buildTextPdf(
    'HOW WE MEASURE IMPACT',
    'Simple guide to Urb TecTrack sustainability figures · Recycling Heroes™',
    [
      {
        heading: 'AT A GLANCE',
        pairs: [
          ['1 tonne e-waste recycled', '1 sapling earned', 'Nurture promise', `${S.nurtureYears} years`],
          ['CO2e avoided', `${S.co2PerKg} kg / kg`, 'Landfill diverted', `${(S.landfillRatio * 100).toFixed(0)}%`],
          ['Water saved', `${S.waterPerKg} kL / kg`, 'Energy saved', `${S.energyPerKg} kWh / kg`],
        ],
        lines: [
          'Every figure below comes from closed requests only — weighed, received, recycled, certified, and acknowledged by the client.',
        ],
      },
      {
        heading: '1 · THE RECYCLING HEROES PROMISE',
        lines: [
          `For every 1 tonne of e-waste a client contributes through a completed lifecycle, Urbeno earns eligibility to plant 1 sapling.`,
          `That sapling is not a one-day gesture. Urbeno promises to nurture it until it is self-reliant and sustainable — for a period of ${S.nurtureYears} years — with care, observation, and growth records kept in the portal.`,
          'Part-tonnes do not earn a sapling until the next full tonne is closed. Trees are counted only after the client acknowledges closure, so every sapling is backed by audited tonnage.',
        ],
      },
      {
        heading: '2 · WHY ONE SMALL CONTRIBUTION MATTERS',
        lines: [
          'A single tonne of e-waste kept out of landfill avoids toxic leaching into soil and groundwater, recovers metals that would otherwise need virgin mining, and reduces the energy and water footprint of new manufacture.',
          'That same tonne unlocks one sapling. Over three years of care, a young tree begins to cool air, hold soil, support birds and insects, and quietly sequester carbon — benefits that accrue to the neighbourhood and the wider community, not only to the organisation that recycled.',
          'When many organisations each contribute a few tonnes, the effect compounds: cleaner cities, fewer hazardous dumps, more living trees, and a shared story employees and stakeholders can see and verify. Small, closed loops add up to a measurable public good.',
        ],
      },
      {
        heading: '3 · WHAT COUNTS (AND WHAT DOES NOT)',
        lines: [
          'Counted — Net weighbridge weight on closed invoices (stage 9): weighment slip, MRN, Form 6, Certificate of Destruction, and client acknowledgement.',
          'Not counted — Material still in transit, awaiting processing, or awaiting client close. Estimates raised at request time are never used for impact or sapling eligibility.',
          'Avoided impact (recycling) and tree sequestration are reported separately. We never add them into one headline number, and we do not claim carbon credits or offsets.',
        ],
      },
      {
        heading: '4 · HOW THE NUMBERS ARE BUILT',
        table: {
          headers: ['METRIC', 'HOW IT IS CALCULATED', 'SOURCE'],
          rows: [
            ['Saplings earned', `floor(net kg / 1000) x ${S.treesPerTonne}`, S.cite.sapling],
            ['CO2e avoided', `net kg x ${S.co2PerKg}`, S.cite.co2],
            ['Landfill diverted', `net kg x ${S.landfillRatio}`, S.cite.landfill],
            ['Water / energy', `net kg x ${S.waterPerKg} kL / ${S.energyPerKg} kWh`, `${S.cite.water}`],
            [
              'CO2 sequestered',
              `trees x days since planting x ${(S.co2PerTree / 365).toFixed(4)} kg/day`,
              S.cite.tree,
            ],
          ],
        },
        lines: [
          'Factors are published averages for mixed electronics. They can be restated with India- or facility-specific factors if a client’s assurance team requires it — the method stays the same.',
        ],
      },
      {
        heading: '5 · TREE LEDGER IN THE PORTAL',
        lines: [
          `Urbeno plantings — Saplings planted against closed tonnage (${S.treesPerTonne} per tonne), nurtured for ${S.nurtureYears} years toward self-reliance.`,
          'Client CSR plantings — Trees the client plants through its own programmes and logs in Recycling Heroes. Shown separately; they do not reduce Urbeno’s planting obligation.',
          'Each batch records date, count, species, location, partner, and dated growth photos — an auditable timeline for CSR and ESG reviews.',
        ],
      },
      {
        heading: '6 · EVIDENCE',
        lines: [
          'Every number traces to consignments in Urb TecTrack: weighment, MRN, Form 6, certificate, closure, and planting photos. Records are retained to support Rule 12 of the E-Waste (Management) Rules, 2022.',
          `Prepared by ${co.name} · ${co.brand} · Version v2 · ${today}`,
        ],
      },
    ],
    `Sustainability methodology v2 · ${co.name} · Recycling Heroes™`,
    letterhead,
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

  return { filename: 'Urbeno-Sustainability-Methodology-v2.pdf', buffer };
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

  const skipIdx = new Set(
    report.head.map((h, i) => (h === 'Download' ? i : -1)).filter((i) => i >= 0),
  );
  const headers = report.head.filter((_, i) => !skipIdx.has(i));
  const shown = report.rows
    .slice(0, 80)
    .map((r) => r.filter((_, i) => !skipIdx.has(i)).map((c) => String(c ?? '')));
  const buffer = buildTextPdf(
    report.title,
    `${report.periodLabel} · ${report.scopeLabel} · ${report.total} rows`,
    [
      {
        heading: 'REGISTER',
        table: { headers, rows: shown },
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
