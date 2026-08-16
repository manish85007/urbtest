import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { isAppError } from '../lib/errors.js';
import { attachSession, requireAuth } from '../middleware/session.js';
import {
  acknowledgeSubmission,
  createSubmission,
  rejectSubmission,
} from '../services/submission-service.js';
import { addVehicle, recordWeighment } from '../services/vehicle-service.js';
import {
  addPayment,
  closeInvoice,
  createInvoice,
  createMrn,
  createRecycling,
  uploadCertificate,
} from '../services/invoice-service.js';

function handleServiceError(err: unknown, reply: FastifyReply) {
  if (isAppError(err)) {
    return reply.status(err.statusCode).send({ message: err.message });
  }
  throw err;
}

const createSubmissionSchema = z.object({
  clientId: z.string().length(4),
  siteId: z.string().min(1),
  ref: z.string().optional(),
  requestDate: z.string(),
  location: z.string().optional(),
  approxQty: z.number().int().nonnegative().optional(),
  approxWeight: z.number().nonnegative().optional(),
  bomFileId: z.string().optional(),
  notes: z.string().optional(),
});

const vehicleSchema = z.object({
  registration: z.string().min(1),
  vehicleType: z.string().min(1),
  logisticsPartner: z.string().optional(),
  driverName: z.string().min(1),
  driverPhone: z.string().min(1),
  expectedAt: z.string().optional(),
  team: z
    .array(
      z.object({
        name: z.string().min(1),
        role: z.string().min(1),
        phone: z.string().min(1),
      }),
    )
    .min(1),
});

const weighmentSchema = z.object({
  manual: z.boolean().optional(),
  gross: z.number().optional(),
  tare: z.number().optional(),
  net: z.number().optional(),
  slipNumber: z.string().optional(),
  method: z.string().optional(),
  reason: z.string().optional(),
  weighedAt: z.string(),
  slipPhotoIds: z.array(z.string()).optional(),
  pickupPhotoIds: z.array(z.string()).optional(),
});

const invoiceSchema = z.object({
  invoiceNo: z.string().min(1),
  invoiceDate: z.string(),
  taxableAmount: z.number().nonnegative(),
  taxRatePct: z.number().nonnegative().optional(),
  billingWeight: z.number().nonnegative().optional(),
  deviationNote: z.string().optional(),
  billingMode: z.string().optional(),
  ewayBillNo: z.string().min(1),
  ewayBillDate: z.string(),
  vehicleIds: z.array(z.string()).optional(),
  invoiceFileId: z.string().optional(),
  ewayFileId: z.string().optional(),
});

export async function lifecycleRoutes(app: FastifyInstance) {
  app.addHook('preHandler', attachSession);

  app.post('/submissions', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const body = createSubmissionSchema.parse(request.body);
      return await createSubmission(request.user!, body);
    } catch (err) {
      return handleServiceError(err, reply);
    }
  });

  app.post('/submissions/:id/acknowledge', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      return await acknowledgeSubmission(request.user!, id);
    } catch (err) {
      return handleServiceError(err, reply);
    }
  });

  app.post('/submissions/:id/reject', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = z.object({ reason: z.string().min(1) }).parse(request.body);
      return await rejectSubmission(request.user!, id, body.reason);
    } catch (err) {
      return handleServiceError(err, reply);
    }
  });

  app.post('/submissions/:id/vehicles', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = vehicleSchema.parse(request.body);
      return await addVehicle(request.user!, id, body);
    } catch (err) {
      return handleServiceError(err, reply);
    }
  });

  app.post('/vehicles/:id/weighment', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = weighmentSchema.parse(request.body);
      return await recordWeighment(request.user!, id, body);
    } catch (err) {
      return handleServiceError(err, reply);
    }
  });

  app.post('/submissions/:id/invoices', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = invoiceSchema.parse(request.body);
      return await createInvoice(request.user!, id, body);
    } catch (err) {
      return handleServiceError(err, reply);
    }
  });

  app.post('/invoices/:id/payments', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = z
        .object({
          utr: z.string().min(1),
          amount: z.number().positive(),
          paidAt: z.string(),
          mode: z.string().min(1),
          note: z.string().optional(),
        })
        .parse(request.body);
      return await addPayment(request.user!, id, body);
    } catch (err) {
      return handleServiceError(err, reply);
    }
  });

  app.post('/invoices/:id/mrn', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = z
        .object({
          factoryId: z.string().min(1),
          receivedAt: z.string(),
          driverSign: z.string().optional(),
          managerSign: z.string().optional(),
          securitySign: z.string().optional(),
          materials: z
            .array(
              z.object({
                name: z.string(),
                qty: z.number(),
                weight: z.number(),
              }),
            )
            .optional(),
          condition: z.string().optional(),
          note: z.string().optional(),
        })
        .parse(request.body);
      return await createMrn(request.user!, id, body);
    } catch (err) {
      return handleServiceError(err, reply);
    }
  });

  app.post('/invoices/:id/recycling', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = z
        .object({
          processedAt: z.string(),
          factoryId: z.string().optional(),
          divertedPct: z.number().optional(),
          categories: z
            .array(
              z.object({
                entryId: z.string(),
                groupCode: z.string(),
                weightKg: z.number().positive(),
                recoveryFe: z.number().optional(),
                recoveryNfe: z.number().optional(),
                recoveryPl: z.number().optional(),
                recoveryPcb: z.number().optional(),
                overrideReason: z.string().optional(),
              }),
            )
            .min(1),
          photoIds: z.array(z.string()).optional(),
          reportIds: z.array(z.string()).optional(),
        })
        .parse(request.body);
      return await createRecycling(request.user!, id, {
        ...body,
        categories: body.categories.map((c) => ({
          ...c,
          groupCode: c.groupCode as 'ITEW',
        })),
      });
    } catch (err) {
      return handleServiceError(err, reply);
    }
  });

  app.post('/invoices/:id/certificates', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = z
        .object({
          certNo: z.string().min(1),
          certDate: z.string(),
          department: z.string().optional(),
          fileId: z.string().min(1),
          note: z.string().optional(),
        })
        .parse(request.body);
      return await uploadCertificate(request.user!, id, body);
    } catch (err) {
      return handleServiceError(err, reply);
    }
  });

  app.post('/invoices/:id/close', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = z
        .object({
          rating: z.number().int().min(1).max(5).optional(),
          note: z.string().optional(),
          forced: z.boolean().optional(),
        })
        .parse(request.body ?? {});
      return await closeInvoice(request.user!, id, body);
    } catch (err) {
      return handleServiceError(err, reply);
    }
  });
}
