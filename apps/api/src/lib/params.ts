import { z } from 'zod';

/** CUID primary keys used across the schema (not UUID). */
export const entityIdSchema = z
  .string()
  .min(8)
  .max(64)
  .regex(/^[a-z0-9_-]+$/i, 'Invalid id');

export const idParamsSchema = z.object({ id: entityIdSchema });

export function parseIdParam(params: unknown): string {
  return idParamsSchema.parse(params).id;
}

export const listCursorQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});
