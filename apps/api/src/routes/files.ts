import type { FastifyInstance, FastifyReply } from 'fastify';
import multipart from '@fastify/multipart';
import { FileKind } from '@prisma/client';
import { isAppError } from '../lib/errors.js';
import { contentDisposition } from '../lib/http-headers.js';
import { idParamsSchema } from '../lib/params.js';
import { attachSession, requireAuth } from '../middleware/session.js';
import { readFileBlob, authorizeFileDownload, uploadFile } from '../services/file-service.js';

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
      const queryKind =
        typeof (request.query as { kind?: string }).kind === 'string'
          ? (request.query as { kind: string }).kind.trim()
          : '';
      let kindRaw = queryKind;
      let filename = '';
      let mimeType = '';
      let buffer: Buffer | null = null;

      for await (const part of request.parts()) {
        if (part.type === 'file') {
          filename = part.filename;
          mimeType = part.mimetype;
          buffer = await part.toBuffer();
        } else if (part.fieldname === 'kind') {
          kindRaw = String(part.value ?? '').trim();
        }
      }

      if (!buffer) {
        return reply.badRequest('No file uploaded.');
      }
      if (!FILE_KINDS.has(kindRaw)) {
        return reply.badRequest(`Invalid or missing file kind: ${kindRaw || '(empty)'}`);
      }

      const result = await uploadFile(request.user!, {
        filename,
        mimeType,
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
      const parsed = idParamsSchema.safeParse(request.params);
      if (!parsed.success) return reply.badRequest('Invalid file id');
      const forceStream = (request.query as { stream?: string }).stream === '1';

      // Thumbnails / <img> embeds must stay same-origin (CSP). Skip GCS redirect when stream=1.
      if (!forceStream) {
        const authorized = await authorizeFileDownload(request.user!, parsed.data.id);
        if (authorized.signedUrl) {
          return reply.redirect(authorized.signedUrl);
        }
        if (authorized.buffer) {
          return reply
            .header('Content-Type', authorized.file.mimeType)
            .header('Content-Disposition', contentDisposition('inline', authorized.file.name))
            .header('Cache-Control', 'private, max-age=60')
            .send(authorized.buffer);
        }
      }

      const { file, buffer } = await readFileBlob(request.user!, parsed.data.id);
      return reply
        .header('Content-Type', file.mimeType)
        .header('Content-Disposition', contentDisposition('inline', file.name))
        .header('Cache-Control', 'private, max-age=60')
        .send(buffer);
    } catch (err) {
      return handleServiceError(err, reply);
    }
  });
}
