/**
 * Production bootstrap — no demo clients, requests, or `demo` password.
 *
 * Env:
 *   ADMIN_BOOTSTRAP_EMAIL     default manish@urbeno.in
 *   ADMIN_BOOTSTRAP_NAME      default Manish Jain
 *   ADMIN_BOOTSTRAP_PASSWORD  required (from Secret Manager on Cloud Run)
 *   ADMIN_BOOTSTRAP_FORCE_PASSWORD  when "true", rotate existing admin password
 *                                   and set must_reset (mandatory change on next login)
 *
 * Idempotent by default: existing admin password is never overwritten unless forced.
 */
import { config } from 'dotenv';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { seedLookups } from '../src/services/lookups.js';
import { backfillAuditHashes } from '../src/services/audit.js';

const here = dirname(fileURLToPath(import.meta.url));
for (const envPath of [resolve(here, '../.env'), resolve(here, '../../../.env')]) {
  if (existsSync(envPath)) {
    config({ path: envPath });
    break;
  }
}

const prisma = new PrismaClient();

const FACTORY_ID = 'URB-ASP1';
const FACTORY_NAME = 'Urbeno - Aerospace Park - Unit 1';

async function main() {
  const adminEmail = (process.env.ADMIN_BOOTSTRAP_EMAIL ?? 'manish@urbeno.in').trim().toLowerCase();
  const adminName = (process.env.ADMIN_BOOTSTRAP_NAME ?? 'Manish Jain').trim();
  const bootstrapPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD?.trim();
  const forcePassword = process.env.ADMIN_BOOTSTRAP_FORCE_PASSWORD === 'true';
  if (!bootstrapPassword || bootstrapPassword.length < 12) {
    throw new Error(
      'ADMIN_BOOTSTRAP_PASSWORD is required (≥ 12 characters). Do not use the UAT demo password.',
    );
  }
  if (/^demo$/i.test(bootstrapPassword)) {
    throw new Error('ADMIN_BOOTSTRAP_PASSWORD must not be the demo password.');
  }

  await seedLookups();

  await prisma.factorySite.upsert({
    where: { id: FACTORY_ID },
    // Preserve Masters → Factory Sites edits across PRODUCTION_SEED restarts.
    update: {},
    create: {
      id: FACTORY_ID,
      name: FACTORY_NAME,
      address: 'KIADB Aerospace Park, Devanahalli, Bengaluru Rural, Karnataka 562110',
      gstin: '29AABCU1234R1ZX',
      kspcbConsent: 'KSPCB/HWM/AUTH/2024-27/1142',
      cpcbEpr: 'CPCB/EPR/2022/KA/00817',
      managerEmail: adminEmail,
      active: true,
    },
  });

  const categories = (
    JSON.parse(readFileSync(join(here, 'data/category-master-seed.json'), 'utf8')) as Array<{
      facId: string;
      entryId: string;
      desc: string;
      groupCode: string;
      activity: string;
      capacityTPA: number;
      active: boolean;
    }>
  ).filter((c) => c.facId === 'URB-BLR');

  let tpa = 0;
  for (const c of categories) {
    tpa += c.capacityTPA;
    await prisma.categoryMaster.upsert({
      where: { factoryId_entryId: { factoryId: FACTORY_ID, entryId: c.entryId } },
      // Preserve Masters → Categories edits across PRODUCTION_SEED restarts.
      update: {},
      create: {
        factoryId: FACTORY_ID,
        entryId: c.entryId,
        description: c.desc,
        groupCode: c.groupCode,
        activity: c.activity,
        capacityTpa: c.capacityTPA,
        active: c.active,
      },
    });
  }

  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  const passwordHash = await bcrypt.hash(bootstrapPassword, 12);
  if (!existingAdmin) {
    await prisma.user.create({
      data: {
        email: adminEmail,
        name: adminName,
        role: UserRole.admin,
        passwordHash,
        passwordSetAt: new Date(),
        mustReset: true,
        active: true,
        factoryIds: [],
        siteIds: [],
      },
    });
  } else if (forcePassword) {
    await prisma.user.update({
      where: { email: adminEmail },
      data: {
        name: adminName,
        role: UserRole.admin,
        active: true,
        passwordHash,
        passwordSetAt: new Date(),
        mustReset: true,
      },
    });
    await prisma.session.deleteMany({ where: { userId: existingAdmin.id } });
  } else {
    await prisma.user.update({
      where: { email: adminEmail },
      data: { name: adminName, role: UserRole.admin, active: true },
    });
  }

  for (const seq of [
    { key: 'sub', prefix: 'REQ-', pad: 5, nextValue: 1 },
    { key: 'f6', prefix: 'F6-', pad: 5, nextValue: 1 },
    { key: 'dcod', prefix: 'DCOD-', pad: 6, nextValue: 1 },
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
      update: {},
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

  await prisma.emailTemplate.deleteMany({ where: { key: 'admin_request_digest' } });

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
      update: {},
      create: {
        key: doc.key,
        version: doc.version,
        title: doc.title,
        body: doc.body,
        effectiveDate: new Date(doc.effectiveDate),
      },
    });
  }

  await backfillAuditHashes();

  console.log(
    `Production seed: factory ${FACTORY_ID} (${FACTORY_NAME}), authorised TPA ${tpa}, admin ${adminEmail}` +
      (forcePassword
        ? ' (password rotated, must_reset=true)'
        : existingAdmin
          ? ''
          : ' (created, must_reset=true)'),
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
