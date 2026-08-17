import { prisma } from '../lib/prisma.js';
import { auditLog } from './audit.js';

export const REQUIRED_LEGAL_KEYS = ['terms', 'privacy'] as const;

export async function listLegalDocuments() {
  return prisma.legalDocument.findMany({
    orderBy: { key: 'asc' },
    select: {
      key: true,
      version: true,
      title: true,
      effectiveDate: true,
    },
  });
}

export async function getLegalDocument(key: string) {
  return prisma.legalDocument.findUnique({ where: { key } });
}

export async function getLegalStatus(userId: string) {
  const docs = await prisma.legalDocument.findMany({
    where: { key: { in: [...REQUIRED_LEGAL_KEYS] } },
  });

  const acceptances = await prisma.legalAcceptance.findMany({
    where: { userId, documentKey: { in: [...REQUIRED_LEGAL_KEYS] } },
  });

  const acceptedKeys = new Set(
    acceptances
      .filter((a) => docs.some((d) => d.key === a.documentKey && d.version === a.version))
      .map((a) => a.documentKey),
  );

  const pending = docs
    .filter((d) => !acceptedKeys.has(d.key))
    .map((d) => ({ key: d.key, version: d.version, title: d.title }));

  return {
    compliant: pending.length === 0,
    pending,
    documents: docs.map((d) => ({
      key: d.key,
      version: d.version,
      title: d.title,
      accepted: acceptedKeys.has(d.key),
    })),
  };
}

export async function acceptLegalDocuments(
  userId: string,
  userEmail: string,
  keys: string[],
  ipAddress?: string,
) {
  const unique = [...new Set(keys)];
  const docs = await prisma.legalDocument.findMany({
    where: { key: { in: unique } },
  });

  if (docs.length !== unique.length) {
    throw new Error('One or more legal documents were not found.');
  }

  for (const doc of docs) {
    await prisma.legalAcceptance.upsert({
      where: {
        userId_documentKey_version: {
          userId,
          documentKey: doc.key,
          version: doc.version,
        },
      },
      update: { acceptedAt: new Date(), ipAddress: ipAddress ?? null },
      create: {
        userId,
        documentKey: doc.key,
        version: doc.version,
        ipAddress: ipAddress ?? null,
      },
    });
  }

  await auditLog({
    actorEmail: userEmail,
    actorId: userId,
    action: 'legal.accept',
    entity: 'legal',
    details: { keys: unique, versions: docs.map((d) => ({ key: d.key, version: d.version })) },
  });

  const privacy = docs.find((d) => d.key === 'privacy');
  if (privacy) {
    await prisma.consentRecord.create({
      data: {
        userId,
        email: userEmail,
        version: privacy.version,
        ip: ipAddress ?? 'recorded server-side',
      },
    });
    await auditLog({
      actorEmail: userEmail,
      actorId: userId,
      action: 'consent.record',
      entity: 'user',
      entityId: userEmail,
      details: { version: privacy.version },
    });
  }

  return getLegalStatus(userId);
}

export async function purgeExpiredSessions(): Promise<number> {
  const result = await prisma.session.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return result.count;
}
