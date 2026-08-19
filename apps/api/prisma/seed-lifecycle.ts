import { FileKind, type PrismaClient } from '@prisma/client';
import {
  deriveTax,
  deriveTotal,
  formatForm6Number,
  formatMrnNumber,
  getFY,
  recoveryFor,
  rupeesToPaise,
  type MaterialGroupCode,
} from '@urb-tectrack/shared';

type SampleSpec = {
  n: number;
  clientId: 'TCPL' | 'INFR' | 'BHRT';
  kg: number;
  qty: number;
  location: string;
  pickup: string;
  factoryId: 'URB-BLR' | 'URB-KGF';
  group: MaterialGroupCode;
  entryId: string;
  tdsPct: number;
  createdBy: string;
};

const SAMPLES: SampleSpec[] = [
  { n: 50, clientId: 'TCPL', kg: 220, qty: 48, location: 'Tower A basement', pickup: '2026-05-04', factoryId: 'URB-BLR', group: 'ITEW', entryId: 'REC-ITEW2', tdsPct: 0.02, createdBy: 'ramesh@techcorp.in' },
  { n: 51, clientId: 'TCPL', kg: 85, qty: 16, location: 'Embassy loading bay 2', pickup: '2026-05-12', factoryId: 'URB-BLR', group: 'CEEW', entryId: 'REC-CEEW1', tdsPct: 0, createdBy: 'priya@techcorp.in' },
  { n: 52, clientId: 'TCPL', kg: 410, qty: 90, location: 'Tower C store', pickup: '2026-05-20', factoryId: 'URB-KGF', group: 'LSEEW', entryId: 'REC-LSEEW1', tdsPct: 0.01, createdBy: 'ramesh@techcorp.in' },
  { n: 53, clientId: 'TCPL', kg: 132, qty: 28, location: 'Facilities cage', pickup: '2026-06-02', factoryId: 'URB-BLR', group: 'ITEW', entryId: 'REC-ITEW2', tdsPct: 0.02, createdBy: 'priya@techcorp.in' },
  { n: 54, clientId: 'TCPL', kg: 67, qty: 12, location: 'IT store room', pickup: '2026-06-11', factoryId: 'URB-BLR', group: 'ITEW', entryId: 'REC-ITEW1', tdsPct: 0, createdBy: 'ramesh@techcorp.in' },
  { n: 55, clientId: 'TCPL', kg: 255, qty: 54, location: 'Tower B parking', pickup: '2026-06-18', factoryId: 'URB-BLR', group: 'CEEW', entryId: 'REC-CEEW1', tdsPct: 0.02, createdBy: 'priya@techcorp.in' },
  { n: 56, clientId: 'TCPL', kg: 178, qty: 33, location: 'Security office', pickup: '2026-07-01', factoryId: 'URB-KGF', group: 'ITEW', entryId: 'REC-ITEW2', tdsPct: 0, createdBy: 'ramesh@techcorp.in' },
  { n: 57, clientId: 'TCPL', kg: 96, qty: 21, location: 'L3 server room', pickup: '2026-07-09', factoryId: 'URB-BLR', group: 'ITEW', entryId: 'REC-ITEW2', tdsPct: 0.01, createdBy: 'priya@techcorp.in' },
  { n: 58, clientId: 'TCPL', kg: 340, qty: 70, location: 'Warehouse 4', pickup: '2026-07-16', factoryId: 'URB-BLR', group: 'LSEEW', entryId: 'REC-LSEEW1', tdsPct: 0.02, createdBy: 'ramesh@techcorp.in' },
  { n: 59, clientId: 'TCPL', kg: 54, qty: 9, location: 'Reception stores', pickup: '2026-07-24', factoryId: 'URB-BLR', group: 'CEEW', entryId: 'REC-CEEW1', tdsPct: 0, createdBy: 'priya@techcorp.in' },
  { n: 60, clientId: 'INFR', kg: 190, qty: 40, location: 'Koramangala gate 1', pickup: '2026-05-08', factoryId: 'URB-BLR', group: 'ITEW', entryId: 'REC-ITEW2', tdsPct: 0.02, createdBy: 'meera@infosoft.in' },
  { n: 61, clientId: 'INFR', kg: 73, qty: 14, location: 'Lab annex', pickup: '2026-05-22', factoryId: 'URB-BLR', group: 'ITEW', entryId: 'REC-ITEW1', tdsPct: 0, createdBy: 'meera@infosoft.in' },
  { n: 62, clientId: 'INFR', kg: 310, qty: 62, location: 'Old campus store', pickup: '2026-06-05', factoryId: 'URB-KGF', group: 'CEEW', entryId: 'REC-CEEW1', tdsPct: 0.01, createdBy: 'meera@infosoft.in' },
  { n: 63, clientId: 'INFR', kg: 118, qty: 25, location: '6th floor IT', pickup: '2026-06-19', factoryId: 'URB-BLR', group: 'ITEW', entryId: 'REC-ITEW2', tdsPct: 0.02, createdBy: 'meera@infosoft.in' },
  { n: 64, clientId: 'INFR', kg: 44, qty: 8, location: 'Cafeteria stores', pickup: '2026-07-03', factoryId: 'URB-BLR', group: 'LSEEW', entryId: 'REC-LSEEW1', tdsPct: 0, createdBy: 'meera@infosoft.in' },
  { n: 65, clientId: 'INFR', kg: 205, qty: 47, location: 'Dock 3', pickup: '2026-07-14', factoryId: 'URB-BLR', group: 'ITEW', entryId: 'REC-ITEW2', tdsPct: 0.02, createdBy: 'meera@infosoft.in' },
  { n: 66, clientId: 'INFR', kg: 88, qty: 19, location: 'Training centre', pickup: '2026-07-28', factoryId: 'URB-KGF', group: 'CEEW', entryId: 'REC-CEEW1', tdsPct: 0.01, createdBy: 'meera@infosoft.in' },
  { n: 67, clientId: 'INFR', kg: 160, qty: 30, location: 'Backup store', pickup: '2026-08-04', factoryId: 'URB-BLR', group: 'ITEW', entryId: 'REC-ITEW2', tdsPct: 0, createdBy: 'meera@infosoft.in' },
  { n: 68, clientId: 'BHRT', kg: 275, qty: 80, location: 'HQ receiving', pickup: '2026-05-06', factoryId: 'URB-BLR', group: 'CEEW', entryId: 'REC-CEEW1', tdsPct: 0.02, createdBy: 'anand@bharatretail.in' },
  { n: 69, clientId: 'BHRT', kg: 91, qty: 22, location: 'Whitefield DC', pickup: '2026-05-27', factoryId: 'URB-KGF', group: 'LSEEW', entryId: 'REC-LSEEW1', tdsPct: 0, createdBy: 'anand@bharatretail.in' },
  { n: 70, clientId: 'BHRT', kg: 148, qty: 35, location: 'Store 12 backroom', pickup: '2026-06-09', factoryId: 'URB-BLR', group: 'ITEW', entryId: 'REC-ITEW2', tdsPct: 0.01, createdBy: 'anand@bharatretail.in' },
  { n: 71, clientId: 'BHRT', kg: 360, qty: 95, location: 'Regional warehouse', pickup: '2026-06-23', factoryId: 'URB-BLR', group: 'CEEW', entryId: 'REC-CEEW1', tdsPct: 0.02, createdBy: 'anand@bharatretail.in' },
  { n: 72, clientId: 'BHRT', kg: 62, qty: 11, location: 'Admin block', pickup: '2026-07-07', factoryId: 'URB-BLR', group: 'ITEW', entryId: 'REC-ITEW1', tdsPct: 0, createdBy: 'anand@bharatretail.in' },
  { n: 73, clientId: 'BHRT', kg: 214, qty: 50, location: 'Cold room stores', pickup: '2026-07-21', factoryId: 'URB-KGF', group: 'LSEEW', entryId: 'REC-LSEEW1', tdsPct: 0.02, createdBy: 'anand@bharatretail.in' },
  { n: 74, clientId: 'BHRT', kg: 125, qty: 27, location: 'Returns cage', pickup: '2026-08-02', factoryId: 'URB-BLR', group: 'ITEW', entryId: 'REC-ITEW2', tdsPct: 0.01, createdBy: 'anand@bharatretail.in' },
];

function addDays(ymd: string, days: number) {
  const d = new Date(`${ymd}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d;
}

async function bumpAtLeast(prisma: PrismaClient, key: 'sub', atLeast: number) {
  const current = await prisma.idSequence.findUnique({ where: { key } });
  const nextValue = Math.max(current?.nextValue ?? 0, atLeast);
  await prisma.idSequence.upsert({
    where: { key },
    update: { nextValue },
    create: { key, prefix: 'REQ-', pad: 5, nextValue },
  });
}

export async function seedLifecycleSamples(
  prisma: PrismaClient,
  sites: { TCPL: string; INFR: string; BHRT: string },
) {
  const certFile = await prisma.storedFile.upsert({
    where: { id: 'seed-cert-lifecycle' },
    update: {},
    create: {
      id: 'seed-cert-lifecycle',
      name: 'seed-certificate.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 256,
      kind: FileKind.certificate,
      storageKey: 'seed/lifecycle-certificate.pdf',
      uploadedBy: 'admin@urbeno.in',
    },
  });
  const slipFile = await prisma.storedFile.upsert({
    where: { id: 'seed-slip-lifecycle' },
    update: {},
    create: {
      id: 'seed-slip-lifecycle',
      name: 'seed-slip.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 128,
      kind: FileKind.weighPhoto,
      storageKey: 'seed/lifecycle-slip.jpg',
      uploadedBy: 'admin@urbeno.in',
    },
  });

  const fy = getFY(new Date('2026-08-01'));
  if (!fy) throw new Error('Could not resolve FY 2026-27 for lifecycle seed');

  const form6 = await prisma.form6Counter.findUnique({ where: { fy: fy.short } });
  const blrMrn = await prisma.mrnCounter.findUnique({
    where: { factoryId_fy: { factoryId: 'URB-BLR', fy: fy.short } },
  });
  const kgfMrn = await prisma.mrnCounter.findUnique({
    where: { factoryId_fy: { factoryId: 'URB-KGF', fy: fy.short } },
  });

  let f6Seq = Math.max(800, (form6?.lastValue ?? 0) + 1);
  const mrnSeq: Record<string, number> = {
    'URB-BLR': Math.max(800, (blrMrn?.lastValue ?? 0) + 1),
    'URB-KGF': Math.max(800, (kgfMrn?.lastValue ?? 0) + 1),
  };

  let created = 0;
  for (const s of SAMPLES) {
    const id = `REQ-${String(s.n).padStart(5, '0')}`;
    const existing = await prisma.submission.findUnique({ where: { id } });
    if (existing) continue;

    const siteId = sites[s.clientId];
    const ackAt = addDays(s.pickup, 1);
    const weighAt = addDays(s.pickup, 2);
    const invAt = addDays(s.pickup, 3);
    const mrnAt = addDays(s.pickup, 4);
    const recyAt = addDays(s.pickup, 8);
    const certAt = addDays(s.pickup, 12);
    const closeAt = addDays(s.pickup, 14);

    const taxablePaise = BigInt(rupeesToPaise(Math.round(s.kg * 85)));
    const taxPaise = BigInt(deriveTax(Number(taxablePaise), 18));
    const totalPaise = BigInt(deriveTotal(Number(taxablePaise), 18));
    const tdsPaise = BigInt(Math.round(Number(totalPaise) * s.tdsPct));
    const paidPaise = totalPaise - tdsPaise;
    const rec = recoveryFor(s.group, s.kg);
    const form6No = formatForm6Number(fy.short, f6Seq++);
    const mrnNo = formatMrnNumber(s.factoryId, fy.short, mrnSeq[s.factoryId]++);

    const category = await prisma.categoryMaster.findUnique({
      where: { factoryId_entryId: { factoryId: s.factoryId, entryId: s.entryId } },
    });
    if (!category) {
      throw new Error(`Missing category ${s.entryId} at ${s.factoryId} for seed ${id}`);
    }

    const sub = await prisma.submission.create({
      data: {
        id,
        clientId: s.clientId,
        siteId,
        ref: `PO-LIFE-${s.n}`,
        requestDate: new Date(s.pickup),
        location: s.location,
        approxQty: s.qty,
        approxWeight: s.kg,
        notes: 'Seeded full-lifecycle sample for UAT',
        createdBy: s.createdBy,
        acknowledgedAt: ackAt,
        acknowledgedBy: 'admin@urbeno.in',
        closedAt: closeAt,
        items: {
          create: [{ name: `${s.group} mixed e-waste`, qty: s.qty, weightKg: s.kg, hsn: '854890', sortOrder: 0 }],
        },
      },
    });

    const vehicle = await prisma.vehicle.create({
      data: {
        submissionId: sub.id,
        registration: `KA${String(10 + (s.n % 80)).padStart(2, '0')}LC${String(1000 + s.n)}`,
        vehicleType: 'VT2',
        driverName: s.n % 2 ? 'Raju Driver' : 'Imran Khan',
        driverPhone: '+91 99000 11000',
        expectedAt: weighAt,
        team: { create: [{ name: 'Raju Driver', role: 'TR1', phone: '+91 99000 11000' }] },
        weighment: {
          create: {
            netKg: s.kg,
            grossKg: 5200 + s.kg,
            tareKg: 5200,
            slipNumber: `WB-LIFE-${s.n}`,
            weighedAt: weighAt,
            slipPhotoIds: [slipFile.id],
            pickupPhotoIds: [slipFile.id],
            createdBy: 'admin@urbeno.in',
          },
        },
      },
    });

    const invoice = await prisma.invoice.create({
      data: {
        submissionId: sub.id,
        invoiceNo: `INV-LIFE-${s.n}`,
        invoiceDate: invAt,
        taxablePaise,
        taxRatePct: 18,
        taxPaise,
        totalPaise,
        billingWeight: s.kg,
        vehicleNetKg: s.kg,
        ewayBillNo: `EWB-LIFE-${s.n}`,
        ewayBillDate: invAt,
        vehicleIds: [vehicle.id],
        createdBy: 'admin@urbeno.in',
        closedAt: closeAt,
        closedBy: s.createdBy,
        closeRating: 5,
        closeNote: 'Seeded closure',
      },
    });

    await prisma.payment.create({
      data: {
        invoiceId: invoice.id,
        utr: `UTR-LIFE-${s.n}`,
        amountPaise: paidPaise,
        tdsPaise,
        paidAt: certAt,
        mode: s.tdsPct ? 'PM1' : 'PM2',
      },
    });

    await prisma.mrn.create({
      data: {
        invoiceId: invoice.id,
        mrnNo,
        factoryId: s.factoryId,
        receivedAt: mrnAt,
        receivedBy: 'blr@urbeno.in',
        driverSign: 'Driver',
        managerSign: 'Factory Manager',
        securitySign: 'Security',
        materials: [{ n: `${s.group} mixed e-waste`, q: s.qty, w: s.kg }],
        condition: 'Good',
        gatePhotoIds: [slipFile.id],
        materialPhotoIds: [slipFile.id],
      },
    });

    await prisma.recycling.create({
      data: {
        invoiceId: invoice.id,
        form6No,
        processedAt: recyAt,
        factoryId: s.factoryId,
        devicesDestroyed: s.qty,
        recoveryFe: rec.fe,
        recoveryNfe: rec.nfe,
        recoveryPl: rec.pl,
        recoveryPcb: rec.pcb,
        vehicleIds: [vehicle.id],
        createdBy: 'blr@urbeno.in',
        categories: {
          create: [
            {
              categoryId: category.id,
              entryId: s.entryId,
              groupCode: s.group,
              weightKg: s.kg,
              recoveryFe: rec.fe,
              recoveryNfe: rec.nfe,
              recoveryPl: rec.pl,
              recoveryPcb: rec.pcb,
            },
          ],
        },
      },
    });

    await prisma.certificate.create({
      data: {
        invoiceId: invoice.id,
        certNo: `DCOD-LIFE-${s.n}`,
        certDate: certAt,
        fileId: certFile.id,
        uploadedBy: 'admin@urbeno.in',
        mailedAt: certAt,
      },
    });
    created += 1;
  }

  await bumpAtLeast(prisma, 'sub', 75);
  if (created) {
    await prisma.form6Counter.upsert({
      where: { fy: fy.short },
      create: { fy: fy.short, lastValue: f6Seq - 1 },
      update: { lastValue: Math.max(form6?.lastValue ?? 0, f6Seq - 1) },
    });
    for (const factoryId of ['URB-BLR', 'URB-KGF'] as const) {
      const previous = factoryId === 'URB-BLR' ? blrMrn?.lastValue ?? 0 : kgfMrn?.lastValue ?? 0;
      await prisma.mrnCounter.upsert({
        where: { factoryId_fy: { factoryId, fy: fy.short } },
        create: { factoryId, fy: fy.short, lastValue: mrnSeq[factoryId] - 1 },
        update: { lastValue: Math.max(previous, mrnSeq[factoryId] - 1) },
      });
    }
  }
  console.log(`Seeded ${created} closed lifecycle samples (REQ-00050–REQ-00074)`);
}
