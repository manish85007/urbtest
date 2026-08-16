import type { FastifyInstance, FastifyReply } from 'fastify';
import multipart from '@fastify/multipart';
import { FileKind } from '@prisma/client';
import { isAppError } from '../lib/errors.js';
import { attachSession, requireAuth } from '../middleware/session.js';
import { readFileBlob, uploadFile } from '../services/file-service.js';

const FILE_KINDS = new Set<string>(Object.values(FileKind));

function handleServiceError(err: unknown, reply: FastifyReply) {
  if (isAppError(err)) {
    return reply.status(err.statusCode).send({ message: err.message });
  }
  throw err;
}

export async function filesRoutes(app: FastifyInstance) {
  await app.register(multipart, {
    limits: {
      fileSize: 11 * 1024 * 1024,
      files: 1,
    },
  });

  app.addHook('preHandler', attachSession);

  app.post('/files', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const part = await request.file();
      if (!part) {
        return reply.badRequest('No file uploaded.');
      }

      const kindField = part.fields.kind;
      const kindRaw =
        kindField && typeof kindField === 'object' && 'value' in kindField
          ? String(kindField.value)
          : '';
      if (!FILE_KINDS.has(kindRaw)) {
        return reply.badRequest(`Invalid or missing file kind: ${kindRaw || '(empty)'}`);
      }

      const buffer = await part.toBuffer();
      const result = await uploadFile(request.user!, {
        filename: part.filename,
        mimeType: part.mimetype,
        sizeBytes: buffer.length,
        buffer,
        kind: kindRaw as FileKind,
      });

      return reply.status(201).send(result);
    } catch (err) {
      return handleServiceError(err, reply);
    }
  });

  app.get('/files/:id', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { file, buffer } = await readFileBlob(request.user!, id);
      return reply
        .header('Content-Type', file.mimeType)
        .header('Content-Disposition', `inline; filename="${file.name.replace(/"/g, '')}"`)
        .send(buffer);
    } catch (err) {
      return handleServiceError(err, reply);
    }
  });
}
