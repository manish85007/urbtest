import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { isAppError } from '../lib/errors.js';
import { attachSession, requireAdmin, requireAuth } from '../middleware/session.js';
import {
  acknowledgeSubmission,
  createSubmission,
  rejectSubmission,
  updateSubmission,
} from '../services/submission-service.js';
import { addVehicle, completeLoading, deleteVehicle, recordWeighment, updateVehicle } from '../services/vehicle-service.js';
import {
  addPayment,
  updatePayment,
  deletePayment,
  closeInvoice,
  createInvoice,
  createMrn,
  createRecycling,
  deleteInvoice,
  updateInvoice,
  updateMrn,
  updateRecycling,
  uploadCertificate,
} from '../services/invoice-service.js';
import { raiseQuery, replyToQuery } from '../services/query-service.js';
import { sendComplianceDocuments } from '../services/compliance-docs.js';
import { destroySerials, importSerials, parseSerialCsv, SERIAL_TEMPLATE_CSV } from '../services/serial-service.js';

function handleServiceError(err: unknown, reply: FastifyReply) {
  if (isAppError(err)) {
    return reply.status(err.statusCode).send({ message: err.message });
  }
  throw err;
}

const mrnBodySchema = z.object({
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
  gatePhotoIds: z.array(z.string()).optional(),
  materialPhotoIds: z.array(z.string()).optional(),
});

const lineItemSchema = z.object({
  name: z.string().min(1),
  qty: z.number().int().nonnegative().optional(),
  weightKg: z.number().nonnegative().optional(),
  hsn: z.string().optional(),
});

const createSubmissionSchema = z.object({
  clientId: z.string().length(4),
  siteId: z.string().min(1),
  ref: z.string().optional(),
  requestDate: z.string(),
  location: z.string().optional(),
  approxQty: z.number().int().nonnegative().optional(),
  approxWeight: z.number().nonnegative().optional(),
  bomFileId: z.string().optional(),
  bomFileIds: z.array(z.string()).optional(),
  notes: z.string().optional(),
  items: z.array(lineItemSchema).optional(),
  onBehalfOf: z.string().email().optional(),
});

const vehicleSchema = z.object({
  registration: z
    .string()
    .min(1)
    .transform((v) => v.replace(/[^A-Za-z0-9]/g, '').toUpperCase())
    .refine((v) => /^[A-Z0-9]+$/.test(v), {
      message: 'Vehicle registration can only contain letters and numbers — no spaces or special characters.',
    }),
  vehicleType: z.string().min(1),
  logisticsPartner: z.string().optional(),
  driverName: z.string().min(1),
  driverPhone: z.string().min(1),
  expectedAt: z.string().optional(),
  changeRemark: z.string().optional(),
  team: z
    .array(
      z.object({
        name: z.string().min(1),
        role: z.string().min(1),
        phone: z.string().min(1),
      }),
    )
    .default([]),
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
  taxRatePct: z.number().min(0),
  billingWeight: z.number().positive(),
  deviationNote: z.string().optional(),
  billingMode: z.string().optional(),
  ewayBillNo: z.string().min(1),
  ewayBillDate: z.string(),
  vehicleIds: z.array(z.string()).optional(),
  invoiceFileId: z.string().optional(),
  ewayFileId: z.string().optional(),
  invoiceFileIds: z.array(z.string()).optional(),
  ewayFileIds: z.array(z.string()).optional(),
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

  app.patch('/submissions/:id', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = z
        .object({
          location: z.string().optional(),
          approxQty: z.number().int().nonnegative().optional(),
          approxWeight: z.number().nonnegative().optional(),
          notes: z.string().optional(),
          ref: z.string().optional(),
          bomFileId: z.string().nullable().optional(),
          bomFileIds: z.array(z.string()).optional(),
          items: z.array(lineItemSchema).optional(),
          siteId: z.string().min(1).optional(),
          requestDate: z.string().optional(),
          responseNote: z.string().optional(),
        })
        .parse(request.body);
      return await updateSubmission(request.user!, id, body);
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

  app.patch('/vehicles/:id', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = vehicleSchema.parse(request.body);
      return await updateVehicle(request.user!, id, body);
    } catch (err) {
      return handleServiceError(err, reply);
    }
  });

  app.delete('/vehicles/:id', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      return await deleteVehicle(request.user!, id);
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

  app.post('/submissions/:id/loading-complete', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      return await completeLoading(request.user!, id);
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

  app.patch('/invoices/:id', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = invoiceSchema.parse(request.body);
      return await updateInvoice(request.user!, id, body);
    } catch (err) {
      return handleServiceError(err, reply);
    }
  });

  app.delete('/invoices/:id', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      return await deleteInvoice(request.user!, id);
    } catch (err) {
      return handleServiceError(err, reply);
    }
  });

  const paymentBodySchema = z.object({
    utr: z.string().min(1),
    amount: z.number().min(0),
    tdsAmount: z.number().min(0).optional(),
    paidAt: z.string().min(1),
    mode: z.string().min(1),
    note: z.string().optional(),
  });

  app.post('/invoices/:id/payments', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = paymentBodySchema.parse(request.body);
      return await addPayment(request.user!, id, body);
    } catch (err) {
      return handleServiceError(err, reply);
    }
  });

  app.patch('/payments/:id', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = paymentBodySchema.parse(request.body);
      return await updatePayment(request.user!, id, body);
    } catch (err) {
      return handleServiceError(err, reply);
    }
  });

  app.delete('/payments/:id', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      return await deletePayment(request.user!, id);
    } catch (err) {
      return handleServiceError(err, reply);
    }
  });

  app.post('/invoices/:id/mrn', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = mrnBodySchema.parse(request.body);
      return await createMrn(request.user!, id, body);
    } catch (err) {
      return handleServiceError(err, reply);
    }
  });

  app.patch('/invoices/:id/mrn', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = mrnBodySchema.parse(request.body);
      return await updateMrn(request.user!, id, body);
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
          devicesDestroyed: z.number().optional(),
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
          serialFileId: z.string().optional(),
          vehicleIds: z.array(z.string()).optional(),
          serials: z
            .array(
              z.object({
                serialNo: z.string(),
                assetTag: z.string().optional(),
                make: z.string().optional(),
                model: z.string().optional(),
              }),
            )
            .optional(),
        })
        .parse(request.body);
      return await createRecycling(request.user!, id, {
        ...body,
        categories: body.categories.map((c) => ({
          ...c,
          groupCode: c.groupCode as
            | 'ITEW'
            | 'CEEW'
            | 'LSEEW'
            | 'EETW'
            | 'TLSEW'
            | 'MDW'
            | 'LIW',
        })),
      });
    } catch (err) {
      return handleServiceError(err, reply);
    }
  });

  app.patch('/invoices/:id/recycling', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = z
        .object({
          processedAt: z.string(),
          factoryId: z.string().optional(),
          divertedPct: z.number().optional(),
          devicesDestroyed: z.number().optional(),
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
          serialFileId: z.string().optional(),
          vehicleIds: z.array(z.string()).optional(),
        })
        .parse(request.body);
      return await updateRecycling(request.user!, id, {
        ...body,
        categories: body.categories.map((c) => ({
          ...c,
          groupCode: c.groupCode as
            | 'ITEW'
            | 'CEEW'
            | 'LSEEW'
            | 'EETW'
            | 'TLSEW'
            | 'MDW'
            | 'LIW',
        })),
      });
    } catch (err) {
      return handleServiceError(err, reply);
    }
  });

  app.post('/invoices/:id/certificate', { preHandler: requireAuth }, async (request, reply) => {
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

  app.post('/submissions/:id/compliance/email', { preHandler: [requireAuth, requireAdmin] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = z
        .object({
          certificateIds: z.array(z.string().min(1)).max(50).optional(),
          form6InvoiceIds: z.array(z.string().min(1)).max(50).optional(),
        })
        .parse(request.body);
      return await sendComplianceDocuments(request.user!, id, body);
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

  app.post('/submissions/:id/queries', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = z.object({ text: z.string().min(1) }).parse(request.body);
      return await raiseQuery(request.user!, id, body.text);
    } catch (err) {
      return handleServiceError(err, reply);
    }
  });

  app.post('/queries/:id/replies', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = z.object({ text: z.string().min(1) }).parse(request.body);
      return await replyToQuery(request.user!, id, body.text);
    } catch (err) {
      return handleServiceError(err, reply);
    }
  });

  app.get('/serials/template.csv', { preHandler: requireAuth }, async (_request, reply) => {
    return reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', 'attachment; filename="urbeno-serial-import-template.csv"')
      .send(SERIAL_TEMPLATE_CSV);
  });

  app.post('/invoices/:id/serials', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = z
        .object({
          csv: z.string().optional(),
          rows: z
            .array(
              z.object({
                serialNo: z.string(),
                assetTag: z.string().optional(),
                make: z.string().optional(),
                model: z.string().optional(),
              }),
            )
            .optional(),
          serialFileId: z.string().optional(),
        })
        .parse(request.body);
      const rows = body.rows?.length ? body.rows : body.csv ? parseSerialCsv(body.csv) : [];
      return await importSerials(request.user!, id, rows, body.serialFileId);
    } catch (err) {
      return handleServiceError(err, reply);
    }
  });

  app.post('/invoices/:id/serials/destroy', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = z
        .object({
          serialNos: z.union([z.literal('all'), z.array(z.string())]).optional(),
          std: z.string().min(1),
          method: z.string().optional(),
        })
        .parse(request.body);
      return await destroySerials(request.user!, id, body);
    } catch (err) {
      return handleServiceError(err, reply);
    }
  });
}
