import type { FileKind, Prisma } from '@prisma/client';
import type { SessionUser } from '../lib/auth-context.js';
import { AppError } from '../lib/errors.js';
import { isMimeAllowed, maxBytesForKind, maxMbForKind } from '../lib/file-limits.js';
import { prisma } from '../lib/prisma.js';
import { assertFileAccess } from '../lib/file-access.js';
import { getStorage } from '../lib/storage.js';
import { auditLog } from './audit.js';
import { recordSecurityEvent } from './security-log.js';
import { FILE_CLASS } from '@urb-tectrack/shared';

export interface UploadInput {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  buffer: Buffer;
  kind: FileKind;
  context?: Record<string, unknown>;
}

export async function uploadFile(actor: SessionUser, input: UploadInput) {
  const name = input.filename.trim();
  if (!name) throw new AppError('File name is required.');

  const maxBytes = maxBytesForKind(input.kind);
  if (input.sizeBytes > maxBytes) {
    const mb = (input.sizeBytes / (1024 * 1024)).toFixed(1);
    throw new AppError(
      `${name} is ${mb} MB — limit for this upload is ${maxMbForKind(input.kind)} MB.`,
    );
  }

  if (!isMimeAllowed(input.kind, input.mimeType, input.filename)) {
    throw new AppError(`File type ${input.mimeType || 'unknown'} is not allowed for ${input.kind}.`);
  }

  const record = await prisma.storedFile.create({
    data: {
      name,
      mimeType: input.mimeType || 'application/octet-stream',
      sizeBytes: input.sizeBytes,
      kind: input.kind,
      storageKey: 'pending',
      uploadedBy: actor.email,
      context: (input.context ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });

  const storageKey = `${record.id}/${sanitizeFilename(name)}`;
  await getStorage().save(storageKey, input.buffer);

  await prisma.storedFile.update({
    where: { id: record.id },
    data: { storageKey },
  });

  await auditLog({
    actorEmail: actor.email,
    actorId: actor.id,
    action: 'file.upload',
    entity: 'file',
    entityId: record.id,
    details: { name, kind: input.kind, size: input.sizeBytes, ...input.context },
  });

  return {
    id: record.id,
    name: record.name,
    mimeType: record.mimeType,
    sizeBytes: record.sizeBytes,
    kind: record.kind,
    createdAt: record.createdAt.toISOString(),
  };
}

export async function readFileBlob(actor: SessionUser, fileId: string) {
  const file = await prisma.storedFile.findUnique({ where: { id: fileId } });
  if (!file) throw new AppError('File not found.', 404);

  await assertFileAccess(actor, file);

  const blob = await getStorage().read(file.storageKey);
  if (FILE_CLASS[file.kind] === 'restricted') {
    await recordSecurityEvent('access.restricted', actor.email, { ref: file.name, cls: 'restricted' });
  }
  await auditLog({
    actorEmail: actor.email,
    actorId: actor.id,
    action: 'file.download',
    entity: 'file',
    entityId: file.id,
    details: { name: file.name },
  });

  return { file, buffer: blob.buffer };
}

/** Authorize + optionally return a GCS signed URL for browser redirect downloads. */
export async function authorizeFileDownload(actor: SessionUser, fileId: string) {
  const file = await prisma.storedFile.findUnique({ where: { id: fileId } });
  if (!file) throw new AppError('File not found.', 404);
  await assertFileAccess(actor, file);

  if (process.env.USE_SIGNED_URLS === 'true') {
    const storage = getStorage();
    if (typeof storage.signedUrl === 'function') {
      const url = await storage.signedUrl(file.storageKey, 300);
      if (url) {
        if (FILE_CLASS[file.kind] === 'restricted') {
          await recordSecurityEvent('access.restricted', actor.email, {
            ref: file.name,
            cls: 'restricted',
          });
        }
        await auditLog({
          actorEmail: actor.email,
          actorId: actor.id,
          action: 'file.download',
          entity: 'file',
          entityId: file.id,
          details: { name: file.name, via: 'signed-url' },
        });
        return { file, signedUrl: url as string | undefined, buffer: undefined as Buffer | undefined };
      }
    }
  }

  const { buffer } = await (async () => {
    const blob = await getStorage().read(file.storageKey);
    if (FILE_CLASS[file.kind] === 'restricted') {
      await recordSecurityEvent('access.restricted', actor.email, { ref: file.name, cls: 'restricted' });
    }
    await auditLog({
      actorEmail: actor.email,
      actorId: actor.id,
      action: 'file.download',
      entity: 'file',
      entityId: file.id,
      details: { name: file.name },
    });
    return blob;
  })();
  return { file, buffer, signedUrl: undefined as string | undefined };
}

export async function assertFilesExist(fileIds: string[], kinds?: FileKind[]) {
  if (!fileIds.length) return;
  const unique = [...new Set(fileIds)];
  const files = await prisma.storedFile.findMany({ where: { id: { in: unique } } });
  if (files.length !== unique.length) {
    throw new AppError('One or more attached files were not found. Upload them first.');
  }
  if (kinds?.length) {
    const bad = files.filter((f) => !kinds.includes(f.kind));
    if (bad.length) {
      throw new AppError(`Invalid file type for this upload (${bad.map((f) => f.name).join(', ')}).`);
    }
  }
}

export async function readStoredFileSilent(fileId: string) {
  const file = await prisma.storedFile.findUnique({ where: { id: fileId } });
  if (!file) return null;
  try {
    const blob = await getStorage().read(file.storageKey);
    return { file, buffer: blob.buffer };
  } catch {
    return null;
  }
}

function sanitizeFilename(name: string) {
  return name.replace(/[^\w.\-()+ ]/g, '_').slice(0, 180);
}
