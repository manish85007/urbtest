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

  await prisma.idSequence.upsert({
    where: { key: 'sub' },
    update: {},
    create: { key: 'sub', prefix: 'REQ-', pad: 5, nextValue: 46 },
  });

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

  console.log(`Seeded ${factories.length} factories, ${users.length} users, ${categories.length} categories`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
