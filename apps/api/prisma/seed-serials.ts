import { FileKind, type PrismaClient } from '@prisma/client';
import {
  formatForm6Number,
  formatMrnNumber,
  getFY,
  recoveryFor,
  type MaterialGroupCode,
} from '@urb-tectrack/shared';

type SerialSeed = {
  serialNo: string;
  assetTag?: string;
  make?: string;
  model?: string;
  destroyed?: boolean;
  dcodNo?: string;
};

/** Stable demo id — avoid numeric REQ-xxxxx collisions with live UAT data. */
const LAST_MILE_SUBMISSION_ID = 'REQ-LM-001';
const LAST_MILE_REF = 'PO-LASTMILE-001';
const LAST_MILE_SERIAL_PREFIXES = ['TRACK-', 'LASTMILE-'];

/** Memorable device serials for marketing / UAT demos (last-mile tracking). */
const DEMO_SERIAL_SETS: Record<string, SerialSeed[]> = {
  'REQ-00050': [
    { serialNo: 'LIFE50-LAP-01', assetTag: 'AT-LIFE-5001', make: 'Dell', model: 'Latitude 5520', destroyed: true, dcodNo: 'DCOD-00050-001' },
    { serialNo: 'LIFE50-LAP-02', assetTag: 'AT-LIFE-5002', make: 'HP', model: 'ProBook 440', destroyed: true, dcodNo: 'DCOD-00050-002' },
  ],
  'REQ-00051': [
    { serialNo: 'DELL-SN-A1023X', assetTag: 'AT-BLR-1001', make: 'Dell', model: 'Latitude 5420', destroyed: true, dcodNo: 'DCOD-00051-010' },
    { serialNo: 'DELL-SN-B2044Y', assetTag: 'AT-BLR-1002', make: 'Dell', model: 'Latitude 5420', destroyed: true, dcodNo: 'DCOD-00051-011' },
    { serialNo: 'HP-ELITE-78421', assetTag: 'AT-BLR-1003', make: 'HP', model: 'EliteBook 840', destroyed: true, dcodNo: 'DCOD-00051-012' },
    { serialNo: 'LPT-TCPL-99120', assetTag: 'AT-BLR-1004', make: 'Lenovo', model: 'ThinkPad T14', destroyed: true, dcodNo: 'DCOD-00051-013' },
    { serialNo: 'WD-A1023X', assetTag: 'AT-BLR-1005', make: 'Western Digital', model: 'WD Blue 1TB', destroyed: true, dcodNo: 'DCOD-00051-014' },
    { serialNo: 'SAMSUNG-TV-4410', assetTag: 'AT-BLR-2001', make: 'Samsung', model: 'QN55Q80', destroyed: true, dcodNo: 'DCOD-00051-001' },
    { serialNo: 'LG-MON-9921', assetTag: 'AT-BLR-2002', make: 'LG', model: '27UL850', destroyed: true, dcodNo: 'DCOD-00051-002' },
    { serialNo: 'CISCO-SW-7740', assetTag: 'AT-BLR-2003', make: 'Cisco', model: 'Catalyst 2960', destroyed: true, dcodNo: 'DCOD-00051-003' },
  ],
  'REQ-00054': [
    { serialNo: 'TCPL-HDD-301', assetTag: 'AT-IT-0301', make: 'Seagate', model: 'Barracuda 2TB', destroyed: true, dcodNo: 'DCOD-00054-001' },
    { serialNo: 'TCPL-HDD-302', assetTag: 'AT-IT-0302', make: 'Seagate', model: 'Barracuda 2TB', destroyed: true, dcodNo: 'DCOD-00054-002' },
    { serialNo: 'TCPL-SSD-401', assetTag: 'AT-IT-0401', make: 'Samsung', model: '860 EVO 500GB', destroyed: true, dcodNo: 'DCOD-00054-003' },
    { serialNo: 'TCPL-SSD-402', assetTag: 'AT-IT-0402', make: 'Samsung', model: '860 EVO 500GB', destroyed: true, dcodNo: 'DCOD-00054-004' },
  ],
  'REQ-00057': [
    { serialNo: 'TCPL-SRV-001', assetTag: 'AT-BLR-1101', make: 'Dell', model: 'PowerEdge R640', destroyed: true, dcodNo: 'DCOD-00057-010' },
    { serialNo: 'TCPL-SRV-002', assetTag: 'AT-BLR-1102', make: 'Dell', model: 'PowerEdge R640', destroyed: true, dcodNo: 'DCOD-00057-011' },
    { serialNo: 'APPLE-MBP-88K2', assetTag: 'AT-BLR-1201', make: 'Apple', model: 'MacBook Pro 14', destroyed: true, dcodNo: 'DCOD-00057-012' },
    { serialNo: 'SRV-L3-ALPHA', assetTag: 'AT-L3-001', make: 'HPE', model: 'ProLiant DL380', destroyed: true, dcodNo: 'DCOD-00057-001' },
    { serialNo: 'SRV-L3-BETA', assetTag: 'AT-L3-002', make: 'HPE', model: 'ProLiant DL380', destroyed: true, dcodNo: 'DCOD-00057-002' },
    { serialNo: 'NAS-L3-01', assetTag: 'AT-L3-010', make: 'Synology', model: 'DS1821+', destroyed: true, dcodNo: 'DCOD-00057-003' },
  ],
  /** Open last-mile demo — mix of destroyed + in-process devices. */
  [LAST_MILE_SUBMISSION_ID]: [
    { serialNo: 'TRACK-DELL-9001', assetTag: 'AT-LM-9001', make: 'Dell', model: 'OptiPlex 7090', destroyed: true, dcodNo: 'DCOD-LM-001' },
    { serialNo: 'TRACK-DELL-9002', assetTag: 'AT-LM-9002', make: 'Dell', model: 'OptiPlex 7090', destroyed: true, dcodNo: 'DCOD-LM-002' },
    { serialNo: 'TRACK-HP-9003', assetTag: 'AT-LM-9003', make: 'HP', model: 'ProBook 450', destroyed: false },
    { serialNo: 'TRACK-LENOVO-9004', assetTag: 'AT-LM-9004', make: 'Lenovo', model: 'ThinkCentre M90', destroyed: false },
    { serialNo: 'TRACK-APPLE-9005', assetTag: 'AT-LM-9005', make: 'Apple', model: 'iMac 24', destroyed: false },
    { serialNo: 'LASTMILE-SSD-01', assetTag: 'AT-LM-9101', make: 'Crucial', model: 'MX500 1TB', destroyed: true, dcodNo: 'DCOD-LM-003' },
    { serialNo: 'LASTMILE-SSD-02', assetTag: 'AT-LM-9102', make: 'Crucial', model: 'MX500 1TB', destroyed: false },
    { serialNo: 'LASTMILE-PHONE-77', assetTag: 'AT-LM-9201', make: 'Samsung', model: 'Galaxy S21', destroyed: false },
  ],
};

function daysFromNow(days: number) {
  const d = new Date();
  d.setHours(10, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
}

async function seedSerialsForRequest(prisma: PrismaClient, submissionId: string, rows: SerialSeed[]) {
  const recycling = await prisma.recycling.findFirst({
    where: { invoice: { submissionId } },
    select: { id: true },
  });
  if (!recycling) return 0;

  const existing = await prisma.serial.findMany({
    where: { recyclingId: recycling.id },
    select: { serialNo: true },
  });
  const have = new Set(existing.map((e) => e.serialNo.toLowerCase()));
  const missing = rows.filter((r) => !have.has(r.serialNo.toLowerCase()));
  if (!missing.length) return 0;

  const destroyedAt = new Date('2026-05-20T10:00:00Z');
  await prisma.serial.createMany({
    data: missing.map((r) => ({
      recyclingId: recycling.id,
      serialNo: r.serialNo,
      assetTag: r.assetTag ?? null,
      make: r.make ?? null,
      model: r.model ?? null,
      destroyedAt: r.destroyed ? destroyedAt : null,
      destroyStd: r.destroyed ? 'NIST' : null,
      destroyMethod: r.destroyed ? 'shred' : null,
      destroyOp: r.destroyed ? 'blr@urbeno.in' : null,
      dcodNo: r.destroyed ? r.dcodNo ?? null : null,
    })),
  });
  return missing.length;
}

/**
 * Open request at recycling stage with serials — primary last-mile tracking demo.
 * Idempotent by id + PO ref (avoids colliding with live numeric REQ ids on UAT).
 */
async function ensureLastMileDemoRequest(prisma: PrismaClient, siteId: string) {
  const existing = await prisma.submission.findUnique({ where: { id: LAST_MILE_SUBMISSION_ID } });
  if (existing) return false;

  // Free the demo PO ref if an older numeric request reused it during collision seeding.
  await prisma.submission.updateMany({
    where: { ref: LAST_MILE_REF, NOT: { id: LAST_MILE_SUBMISSION_ID } },
    data: { ref: `${LAST_MILE_REF}-ARCHIVED` },
  });

  const factoryId = 'URB-BLR' as const;
  const group: MaterialGroupCode = 'ITEW';
  const entryId = 'REC-ITEW2';
  const kg = 96;
  const qty = 8;
  const category = await prisma.categoryMaster.findUnique({
    where: { factoryId_entryId: { factoryId, entryId } },
  });
  if (!category) {
    throw new Error(`Missing category ${entryId} at ${factoryId} for last-mile demo seed`);
  }

  const slipFile = await prisma.storedFile.upsert({
    where: { id: 'seed-slip-lastmile' },
    update: {},
    create: {
      id: 'seed-slip-lastmile',
      name: 'seed-slip-lastmile.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 128,
      kind: FileKind.weighPhoto,
      storageKey: 'seed/lastmile-slip.jpg',
      uploadedBy: 'admin@urbeno.in',
    },
  });

  const rec = recoveryFor(group, kg);
  const fy = getFY(new Date());
  if (!fy) throw new Error('Could not resolve FY for last-mile demo seed');
  const form6No = formatForm6Number(fy.short, 9901);
  const mrnNo = formatMrnNumber(factoryId, fy.short, 9901);
  const requestDate = daysFromNow(-10);
  const ackAt = daysFromNow(-9);
  const weighAt = daysFromNow(-7);
  const invAt = daysFromNow(-6);
  const mrnAt = daysFromNow(-5);
  const recyAt = daysFromNow(-2);

  const sub = await prisma.submission.create({
    data: {
      id: LAST_MILE_SUBMISSION_ID,
      clientId: 'TCPL',
      siteId,
      ref: LAST_MILE_REF,
      requestDate,
      location: 'Tower B — last-mile tracking demo',
      approxQty: qty,
      approxWeight: kg,
      notes:
        'Video / UAT demo — devices in serial-level custody. Search TRACK-DELL-9001 or LASTMILE-SSD-01 in global search.',
      createdBy: 'ramesh@techcorp.in',
      acknowledgedAt: ackAt,
      acknowledgedBy: 'admin@urbeno.in',
      items: {
        create: [{ name: 'IT assets — serial tracked', qty, weightKg: kg, hsn: '854890', sortOrder: 0 }],
      },
    },
  });

  const vehicle = await prisma.vehicle.create({
    data: {
      submissionId: sub.id,
      registration: 'KA-01-LM-9001',
      vehicleType: 'VT2',
      logisticsPartner: 'LP1',
      driverName: 'Last Mile Driver',
      driverPhone: '+91 99001 04901',
      expectedAt: weighAt,
      team: { create: [{ name: 'Last Mile Supervisor', role: 'TR1', phone: '+91 99001 04902' }] },
      weighment: {
        create: {
          netKg: kg,
          grossKg: 5200 + kg,
          tareKg: 5200,
          slipNumber: 'WB-LASTMILE-001',
          weighedAt: weighAt,
          slipPhotoIds: [slipFile.id],
          pickupPhotoIds: [slipFile.id],
          createdBy: 'blr@urbeno.in',
        },
      },
    },
  });

  const taxablePaise = 816_000n;
  const taxPaise = 146_880n;
  const totalPaise = 962_880n;

  const invoice = await prisma.invoice.create({
    data: {
      submissionId: sub.id,
      invoiceNo: 'INV-LASTMILE-001',
      invoiceDate: invAt,
      taxablePaise,
      taxRatePct: 18,
      taxPaise,
      totalPaise,
      billingWeight: kg,
      vehicleNetKg: kg,
      ewayBillNo: 'EWB-LASTMILE-001',
      ewayBillDate: invAt,
      vehicleIds: [vehicle.id],
      createdBy: 'admin@urbeno.in',
    },
  });

  await prisma.mrn.create({
    data: {
      invoiceId: invoice.id,
      mrnNo,
      factoryId,
      receivedAt: mrnAt,
      receivedBy: 'blr@urbeno.in',
      driverSign: 'Driver',
      managerSign: 'Factory Manager',
      securitySign: 'Security',
      materials: [{ n: 'IT assets — serial tracked', q: qty, w: kg }],
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
      factoryId,
      devicesDestroyed: 3,
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
            entryId,
            groupCode: group,
            weightKg: kg,
            recoveryFe: rec.fe,
            recoveryNfe: rec.nfe,
            recoveryPl: rec.pl,
            recoveryPcb: rec.pcb,
          },
        ],
      },
    },
  });

  return true;
}

/** Push pending-pickup demo into the near future so dashboards stay useful for video. */
async function refreshPendingPickupDemo(prisma: PrismaClient) {
  const veh = await prisma.vehicle.findFirst({
    where: { submissionId: 'REQ-00047' },
    orderBy: { createdAt: 'asc' },
  });
  if (!veh) return;
  await prisma.vehicle.update({
    where: { id: veh.id },
    data: { expectedAt: daysFromNow(3) },
  });
}

/** Remove demo serials that were accidentally attached to non-demo requests (e.g. REQ-00090). */
async function cleanupMisplacedLastMileSerials(prisma: PrismaClient) {
  const misplaced = await prisma.serial.findMany({
    where: {
      OR: LAST_MILE_SERIAL_PREFIXES.map((p) => ({ serialNo: { startsWith: p } })),
      recycling: { invoice: { submissionId: { not: LAST_MILE_SUBMISSION_ID } } },
    },
    select: { id: true, serialNo: true },
  });
  if (!misplaced.length) return 0;
  await prisma.serial.deleteMany({ where: { id: { in: misplaced.map((s) => s.id) } } });
  return misplaced.length;
}

export async function seedSerialTrackingDemo(prisma: PrismaClient, tcplSiteId: string) {
  await refreshPendingPickupDemo(prisma);
  const removed = await cleanupMisplacedLastMileSerials(prisma);
  const createdLastMile = await ensureLastMileDemoRequest(prisma, tcplSiteId);

  let serialCount = 0;
  for (const [submissionId, rows] of Object.entries(DEMO_SERIAL_SETS)) {
    serialCount += await seedSerialsForRequest(prisma, submissionId, rows);
  }

  console.log(
    `Serial tracking demo: ${createdLastMile ? `created ${LAST_MILE_SUBMISSION_ID}, ` : ''}` +
      `seeded ${serialCount} device serials` +
      (serialCount === 0 ? ' (already present)' : '') +
      (removed ? `, cleaned ${removed} misplaced demo serials` : ''),
  );
}
