import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { seedLookups } from '../src/services/lookups.js';
import { backfillAuditHashes } from '../src/services/audit.js';
import { seedLifecycleSamples } from './seed-lifecycle.js';
import { seedSerialTrackingDemo } from './seed-serials.js';

const here = dirname(fileURLToPath(import.meta.url));
for (const envPath of [resolve(here, '../.env'), resolve(here, '../../../.env')]) {
  if (existsSync(envPath)) {
    config({ path: envPath });
    break;
  }
}

const prisma = new PrismaClient();

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
      managerEmail: 'blr@urbeno.in',
    },
    {
      id: 'URB-KGF',
      name: 'Urbeno KGF Integrated Facility',
      address: 'Survey 112/2, KIADB Industrial Area, Kolar Gold Fields, Kolar 563120',
      gstin: '29AABCU1234R1ZX',
      kspcbConsent: 'KSPCB/HWM/AUTH/2024-27/1142',
      cpcbEpr: 'CPCB/EPR/2022/KA/00817',
      managerEmail: 'kgf@urbeno.in',
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

  const infosoft = await prisma.client.upsert({
    where: { id: 'INFR' },
    update: {},
    create: {
      id: 'INFR',
      name: 'Infosoft Solutions',
      city: 'Bengaluru',
      contact: 'Meera Iyer',
      phone: '+91 98450 20002',
      email: 'meera@infosoft.in',
      payTermsDays: 30,
    },
  });
  const infrSite = await prisma.site.upsert({
    where: { clientId_code: { clientId: infosoft.id, code: 'BLR' } },
    update: {},
    create: {
      clientId: infosoft.id,
      code: 'BLR',
      name: 'Infosoft Koramangala',
      address: 'Koramangala, Bengaluru',
      contactName: 'Meera Iyer',
      contactPhone: '+91 98450 20002',
    },
  });
  const bharat = await prisma.client.upsert({
    where: { id: 'BHRT' },
    update: {},
    create: {
      id: 'BHRT',
      name: 'Bharat Retail',
      city: 'Bengaluru',
      contact: 'Anand Desai',
      phone: '+91 98450 30003',
      email: 'anand@bharatretail.in',
      payTermsDays: 45,
    },
  });
  const bhrtSite = await prisma.site.upsert({
    where: { clientId_code: { clientId: bharat.id, code: 'BLR' } },
    update: {},
    create: {
      clientId: bharat.id,
      code: 'BLR',
      name: 'Bharat Retail HQ',
      address: 'Whitefield, Bengaluru',
      contactName: 'Anand Desai',
      contactPhone: '+91 98450 30003',
    },
  });

  const users = [
    { email: 'admin@urbeno.in', name: 'Manish Jain', role: UserRole.admin },
    { email: 'ops@urbeno.in', name: 'Deepa Rao', role: UserRole.operations },
    { email: 'blr@urbeno.in', name: 'Suresh Babu', role: UserRole.factory, factoryIds: ['URB-BLR'] },
    { email: 'kgf@urbeno.in', name: 'Ravi Shankar', role: UserRole.factory, factoryIds: ['URB-KGF'] },
    {
      email: 'ramesh@techcorp.in',
      name: 'Ramesh Kumar',
      role: UserRole.client,
      clientId: 'TCPL',
      siteIds: [],
    },
    {
      email: 'priya@techcorp.in',
      name: 'Priya Sharma',
      role: UserRole.client,
      clientId: 'TCPL',
      siteIds: [],
    },
    {
      email: 'meera@infosoft.in',
      name: 'Meera Iyer',
      role: UserRole.client,
      clientId: 'INFR',
      siteIds: [],
    },
    {
      email: 'anand@bharatretail.in',
      name: 'Anand Desai',
      role: UserRole.client,
      clientId: 'BHRT',
      siteIds: [],
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

  const emailTemplates = JSON.parse(
    readFileSync(join(here, 'data/email-templates-seed.json'), 'utf8'),
  ) as Array<{
    key: string;
    name: string;
    subject: string;
    body: string;
    variables: string[];
  }>;

  for (const t of emailTemplates) {
    await prisma.emailTemplate.upsert({
      where: { key: t.key },
      update: {
        name: t.name,
        subject: t.subject,
        body: t.body,
        variables: t.variables,
        editable: false,
      },
      create: {
        key: t.key,
        name: t.name,
        subject: t.subject,
        body: t.body,
        variables: t.variables,
        editable: false,
      },
    });
  }

  const legalDocs = JSON.parse(
    readFileSync(join(here, 'data/legal-documents-seed.json'), 'utf8'),
  ) as Array<{
    key: string;
    version: string;
    title: string;
    body: string;
    effectiveDate: string;
  }>;

  for (const doc of legalDocs) {
    await prisma.legalDocument.upsert({
      where: { key: doc.key },
      update: {
        version: doc.version,
        title: doc.title,
        body: doc.body,
        effectiveDate: new Date(doc.effectiveDate),
      },
      create: {
        key: doc.key,
        version: doc.version,
        title: doc.title,
        body: doc.body,
        effectiveDate: new Date(doc.effectiveDate),
      },
    });
  }

  const allUsers = await prisma.user.findMany({ where: { active: true }, select: { id: true } });
  for (const u of allUsers) {
    for (const doc of legalDocs.filter((d) => d.key === 'terms' || d.key === 'privacy')) {
      await prisma.legalAcceptance.upsert({
        where: {
          userId_documentKey_version: {
            userId: u.id,
            documentKey: doc.key,
            version: doc.version,
          },
        },
        update: {},
        create: {
          userId: u.id,
          documentKey: doc.key,
          version: doc.version,
        },
      });
    }
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
    update: {},
    create: { key: 'sub', prefix: 'REQ-', pad: 5, nextValue: 49 },
  });

  await seedLifecycleSamples(prisma, {
    TCPL: site.id,
    INFR: infrSite.id,
    BHRT: bhrtSite.id,
  });

  await seedSerialTrackingDemo(prisma, site.id);

  await seedLookups();

  await prisma.treePlanting.upsert({
    where: { id: 'seed-plant-1' },
    update: {
      trees: 5,
      plantedAt: new Date('2025-12-15'),
      location: 'Hesaraghatta',
      state: 'Karnataka',
      partner: 'Say Trees Foundation',
      species: 'Ficus religiosa, Neem',
      source: 'urbeno',
    },
    create: {
      id: 'seed-plant-1',
      clientId: 'TCPL',
      trees: 5,
      plantedAt: new Date('2025-12-15'),
      location: 'Hesaraghatta',
      state: 'Karnataka',
      partner: 'Say Trees Foundation',
      species: 'Ficus religiosa, Neem',
      source: 'urbeno',
    },
  });
  await prisma.treePlanting.upsert({
    where: { id: 'seed-plant-2' },
    update: {},
    create: {
      id: 'seed-plant-2',
      clientId: 'TCPL',
      trees: 8,
      plantedAt: new Date('2026-03-20'),
      location: 'Kanakapura Road',
      state: 'Karnataka',
      partner: 'Say Trees Foundation',
      species: 'Neem, Pongamia',
      source: 'urbeno',
    },
  });
  await prisma.treePlanting.upsert({
    where: { id: 'seed-plant-3' },
    update: {},
    create: {
      id: 'seed-plant-3',
      clientId: 'TCPL',
      trees: 25,
      plantedAt: new Date('2026-06-05'),
      location: 'Nandi Hills foothills',
      state: 'Karnataka',
      partner: 'TechCorp CSR — World Environment Day drive',
      species: 'Mixed native',
      source: 'client',
    },
  });

  await prisma.submission.upsert({
    where: { id: 'REQ-00043' },
    update: {},
    create: {
      id: 'REQ-00043',
      clientId: infosoft.id,
      siteId: infrSite.id,
      ref: 'PO-INFR-001',
      requestDate: new Date('2026-08-08'),
      location: 'Infosoft Koramangala',
      approxQty: 20,
      approxWeight: 40,
      notes: 'Infosoft demo request — used for tenancy tests',
      createdBy: 'meera@infosoft.in',
    },
  });

  for (const em of ['ramesh@techcorp.in', 'meera@infosoft.in'] as const) {
    const u = await prisma.user.findUnique({ where: { email: em } });
    const existingConsent = await prisma.consentRecord.findFirst({ where: { email: em } });
    if (u && !existingConsent) {
      await prisma.consentRecord.create({
        data: { userId: u.id, email: u.email, version: '1.0', ip: 'seed' },
      });
    }
  }

  const existingDsr = await prisma.dsrRequest.findUnique({ where: { ref: 'DSR-0001' } });
  if (!existingDsr) {
    await prisma.dsrRequest.create({
      data: {
        ref: 'DSR-0001',
        kind: 'access',
        subject: 'priya@techcorp.in',
        clientId: 'TCPL',
        raisedBy: 'admin@urbeno.in',
        due: new Date('2026-08-20'),
        note: 'Seeded access request',
        status: 'closed',
        closedAt: new Date('2026-08-12'),
        closedBy: 'admin@urbeno.in',
        outcome: 'Subject-access pack emailed to the requestor.',
      },
    });
  }

  const existingInc = await prisma.incident.findUnique({ where: { ref: 'INC-0001' } });
  if (!existingInc) {
    await prisma.incident.create({
      data: {
        ref: 'INC-0001',
        title: 'Failed sign-in burst on a client account',
        severity: 'medium',
        category: 'access',
        detectedAt: new Date('2026-08-10'),
        raisedBy: 'admin@urbeno.in',
        description: 'Five failed attempts against meera@infosoft.in within the lock window.',
        summary: 'Five failed attempts against meera@infosoft.in within the lock window.',
        status: 'closed',
        closedAt: new Date('2026-08-11'),
        closedBy: 'admin@urbeno.in',
        rootCause: 'User mistyped a newly rotated password.',
        action: 'Account unlocked after identity check; password reset issued.',
        reportable: false,
      },
    });
  }

  await backfillAuditHashes();

  console.log(
    `Seeded ${factories.length} factories, ${users.length} users, ${categories.length} categories, ${emailTemplates.length} email templates, ${legalDocs.length} legal documents, demo requests, 25 closed lifecycle samples, device serials (last-mile search), lookups, v6.4 compliance registers`,
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
