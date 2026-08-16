import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/errors.js';

export interface LookupRow {
  id: string;
  category: string;
  label: string;
  active: boolean;
  rate?: number;
  description?: string;
}

function labelFromData(data: unknown): string {
  if (data && typeof data === 'object' && 'label' in data) {
    return String((data as { label: string }).label);
  }
  return '';
}

export async function listLookups(category: string): Promise<LookupRow[]> {
  const rows = await prisma.lookupMaster.findMany({
    where: { category, active: true },
    orderBy: { id: 'asc' },
  });
  return rows.map((r) => {
    const data = r.data && typeof r.data === 'object' ? (r.data as Record<string, unknown>) : {};
    return {
      id: r.id,
      category: r.category,
      label: labelFromData(r.data) || r.id,
      active: r.active,
      rate: typeof data.rate === 'number' ? data.rate : undefined,
      description: typeof data.description === 'string' ? data.description : undefined,
    };
  });
}

export async function upsertLookup(input: {
  category: string;
  id: string;
  label: string;
  active?: boolean;
  rate?: number;
  description?: string;
}) {
  const id = input.id.trim().toUpperCase();
  if (!id) throw new AppError('Lookup code is required.');

  const data: Prisma.InputJsonValue = {
    label: input.label.trim(),
    ...(input.rate !== undefined ? { rate: input.rate } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
  };

  return prisma.lookupMaster.upsert({
    where: { category_id: { category: input.category, id } },
    create: {
      id,
      category: input.category,
      data,
      active: input.active ?? true,
    },
    update: {
      data,
      active: input.active ?? true,
    },
  });
}

export const LOOKUP_SEED: Array<{
  category: string;
  id: string;
  label: string;
  rate?: number;
  description?: string;
}> = [
  { category: 'vehicleType', id: 'VT1', label: 'Small truck (≤3.5T)' },
  { category: 'vehicleType', id: 'VT2', label: 'Large truck (>3.5T)' },
  { category: 'teamRole', id: 'TR1', label: 'Driver' },
  { category: 'teamRole', id: 'TR2', label: 'Loader' },
  { category: 'paymentMode', id: 'PM1', label: 'NEFT / RTGS' },
  { category: 'paymentMode', id: 'PM2', label: 'Cheque' },
  { category: 'paymentMode', id: 'PM3', label: 'UPI' },
  { category: 'taxRate', id: 'GST18', label: 'GST 18%', rate: 18 },
  { category: 'taxRate', id: 'GST12', label: 'GST 12%', rate: 12 },
  { category: 'taxRate', id: 'GST5', label: 'GST 5%', rate: 5 },
  { category: 'taxRate', id: 'GST0', label: 'Nil rated', rate: 0 },
  { category: 'destructStd', id: 'NIST', label: 'NIST SP 800-88', description: 'Clear / Purge / Destroy' },
  { category: 'destructStd', id: 'DIN', label: 'DIN 66399 H-5', description: 'Cross-cut shred to 2 mm' },
];

export async function seedLookups() {
  for (const row of LOOKUP_SEED) {
    await upsertLookup(row);
  }
}
