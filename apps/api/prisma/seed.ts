import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const prisma = new PrismaClient();
const here = dirname(fileURLToPath(import.meta.url));

async function main() {
  const passwordHash = await bcrypt.hash('demo', 12);

  const factories = [
    {
      id: 'URB-BLR',
      name: 'Urbeno Bengaluru Facility',
      address: 'Plot 47, Peenya Industrial Area, Phase II, Bengaluru 560058',
      gstin: '29AABCU1234R1ZX',
      kspcbConsent: 'KSPCB/HWM/AUTH/2024-27/1142',
      cpcbEpr: 'CPCB/EPR/2022/KA/00817',
    },
    {
      id: 'URB-KGF',
      name: 'Urbeno KGF Integrated Facility',
      address: 'Survey 112/2, KIADB Industrial Area, Kolar Gold Fields, Kolar 563120',
      gstin: '29AABCU1234R1ZX',
      kspcbConsent: 'KSPCB/HWM/AUTH/2024-27/1142',
      cpcbEpr: 'CPCB/EPR/2022/KA/00817',
    },
  ];

  for (const f of factories) {
    await prisma.factorySite.upsert({
      where: { id: f.id },
      update: f,
      create: f,
    });
  }

  const client = await prisma.client.upsert({
    where: { id: 'TCPL' },
    update: {},
    create: {
      id: 'TCPL',
      name: 'TechCorp Pvt Ltd',
      city: 'Bengaluru',
      contact: 'Ramesh Kumar',
      phone: '+91 98450 10001',
      email: 'ramesh@techcorp.in',
      payTermsDays: 30,
    },
  });

  const site = await prisma.site.upsert({
    where: { clientId_code: { clientId: client.id, code: 'BLR' } },
    update: {},
    create: {
      clientId: client.id,
      code: 'BLR',
      name: 'Embassy Tech Village',
      address: 'Tower B, Embassy Tech Village, Bengaluru',
      gstin: '29AABCT1234R1Z5',
      contactName: 'Ramesh Kumar',
      contactPhone: '+91 98450 10001',
    },
  });

  const users = [
    { email: 'admin@urbeno.in', name: 'Urbeno Admin', role: UserRole.admin },
    { email: 'blr@urbeno.in', name: 'Suresh Babu', role: UserRole.factory, factoryIds: ['URB-BLR'] },
    { email: 'kgf@urbeno.in', name: 'Ravi Shankar', role: UserRole.factory, factoryIds: ['URB-KGF'] },
    {
      email: 'ramesh@techcorp.in',
      name: 'Ramesh Kumar',
      role: UserRole.client,
      clientId: 'TCPL',
      siteIds: [site.id],
    },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {
        name: u.name,
        role: u.role,
        clientId: u.clientId ?? null,
        factoryIds: u.factoryIds ?? [],
        siteIds: u.siteIds ?? [],
        passwordHash,
        active: true,
      },
      create: {
        email: u.email,
        name: u.name,
        role: u.role,
        clientId: u.clientId ?? null,
        factoryIds: u.factoryIds ?? [],
        siteIds: u.siteIds ?? [],
        passwordHash,
      },
    });
  }

  const categories = JSON.parse(
    readFileSync(join(here, 'data/category-master-seed.json'), 'utf8'),
  ) as Array<{
    facId: string;
    entryId: string;
    desc: string;
    groupCode: string;
    activity: string;
    capacityTPA: number;
    active: boolean;
  }>;

  for (const c of categories) {
    await prisma.categoryMaster.upsert({
      where: {
        factoryId_entryId: { factoryId: c.facId, entryId: c.entryId },
      },
      update: {
        description: c.desc,
        groupCode: c.groupCode,
        activity: c.activity,
        capacityTpa: c.capacityTPA,
        active: c.active,
      },
      create: {
        factoryId: c.facId,
        entryId: c.entryId,
        description: c.desc,
        groupCode: c.groupCode,
        activity: c.activity,
        capacityTpa: c.capacityTPA,
        active: c.active,
      },
    });
  }

  for (const seq of [
    { key: 'f6', prefix: 'F6-', pad: 5, nextValue: 120 },
    { key: 'dcod', prefix: 'DCOD-', pad: 6, nextValue: 340 },
  ]) {
    await prisma.idSequence.upsert({
      where: { key: seq.key },
      update: {},
      create: seq,
    });
  }

  // Demo submissions for development / UAT
  await prisma.submission.upsert({
    where: { id: 'REQ-00046' },
    update: {},
    create: {
      id: 'REQ-00046',
      clientId: client.id,
      siteId: site.id,
      ref: 'PO-DEMO-001',
      requestDate: new Date('2026-08-10'),
      location: 'Tower B, Embassy Tech Village',
      approxQty: 85,
      approxWeight: 180,
      notes: 'Demo request — awaiting acknowledgement',
      createdBy: 'ramesh@techcorp.in',
    },
  });

  const demoAck = await prisma.submission.upsert({
    where: { id: 'REQ-00047' },
    update: {},
    create: {
      id: 'REQ-00047',
      clientId: client.id,
      siteId: site.id,
      ref: 'PO-DEMO-002',
      requestDate: new Date('2026-08-12'),
      location: 'Tower B loading bay',
      approxQty: 40,
      approxWeight: 95,
      notes: 'Demo request — vehicles assigned',
      createdBy: 'ramesh@techcorp.in',
      acknowledgedAt: new Date('2026-08-13'),
      acknowledgedBy: 'admin@urbeno.in',
    },
  });

  const existingVeh = await prisma.vehicle.findFirst({
    where: { submissionId: demoAck.id },
  });
  if (!existingVeh) {
    await prisma.vehicle.create({
      data: {
        submissionId: demoAck.id,
        registration: 'KA-01-DM-2026',
        vehicleType: 'VT2',
        logisticsPartner: 'LP1',
        driverName: 'Demo Driver',
        driverPhone: '+91 99001 00001',
        expectedAt: new Date('2026-08-15'),
        team: {
          create: [{ name: 'Demo Supervisor', role: 'TR1', phone: '+91 99001 00002' }],
        },
      },
    });
  }

  // Demo request at stage 5 (invoiced, ready for MRN)
  const demoInvoiced = await prisma.submission.upsert({
    where: { id: 'REQ-00048' },
    update: {},
    create: {
      id: 'REQ-00048',
      clientId: client.id,
      siteId: site.id,
      ref: 'PO-DEMO-003',
      requestDate: new Date('2026-08-01'),
      location: 'Tower B, loading bay 2',
      approxQty: 120,
      approxWeight: 1200,
      notes: 'Demo request — invoiced, ready for MRN (stage 5)',
      createdBy: 'ramesh@techcorp.in',
      acknowledgedAt: new Date('2026-08-02'),
      acknowledgedBy: 'admin@urbeno.in',
    },
  });

  let demoVeh48 = await prisma.vehicle.findFirst({
    where: { submissionId: demoInvoiced.id },
  });
  if (!demoVeh48) {
    demoVeh48 = await prisma.vehicle.create({
      data: {
        submissionId: demoInvoiced.id,
        registration: 'KA-02-INV-2026',
        vehicleType: 'VT2',
        driverName: 'Invoice Demo Driver',
        driverPhone: '+91 99001 00003',
        team: {
          create: [{ name: 'Load Supervisor', role: 'TR1', phone: '+91 99001 00004' }],
        },
      },
    });
  }

  const existingWeigh = await prisma.weighment.findUnique({
    where: { vehicleId: demoVeh48.id },
  });
  if (!existingWeigh) {
    await prisma.weighment.create({
      data: {
        vehicleId: demoVeh48.id,
        grossKg: 15200,
        tareKg: 14000,
        netKg: 1200,
        slipNumber: 'WB-DEMO-048',
        weighedAt: new Date('2026-08-05'),
        slipPhotoIds: ['seed-slip-demo'],
        pickupPhotoIds: ['seed-pick-demo'],
        createdBy: 'blr@urbeno.in',
      },
    });
  }

  const existingInvoice = await prisma.invoice.findFirst({
    where: { submissionId: demoInvoiced.id },
  });
  if (!existingInvoice) {
    await prisma.invoice.create({
      data: {
        submissionId: demoInvoiced.id,
        invoiceNo: 'INV-DEMO-048',
        invoiceDate: new Date('2026-08-06'),
        taxablePaise: 1_000_000n,
        taxRatePct: 18,
        taxPaise: 180_000n,
        totalPaise: 1_180_000n,
        billingWeight: 1200,
        vehicleNetKg: 1200,
        ewayBillNo: 'EWB-DEMO-048',
        ewayBillDate: new Date('2026-08-06'),
        vehicleIds: [demoVeh48.id],
        createdBy: 'admin@urbeno.in',
      },
    });
  }

  await prisma.idSequence.upsert({
    where: { key: 'sub' },
    update: { nextValue: 49 },
    create: { key: 'sub', prefix: 'REQ-', pad: 5, nextValue: 49 },
  });

  console.log(
    `Seeded ${factories.length} factories, ${users.length} users, ${categories.length} categories, 3 demo requests`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
