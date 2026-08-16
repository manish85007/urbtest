import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/errors.js';

export interface LookupRow {
  id: string;
  category: string;
  label: string;
  active: boolean;
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
  return rows.map((r) => ({
    id: r.id,
    category: r.category,
    label: labelFromData(r.data) || r.id,
    active: r.active,
  }));
}

export async function upsertLookup(input: {
  category: string;
  id: string;
  label: string;
  active?: boolean;
}) {
  const id = input.id.trim().toUpperCase();
  if (!id) throw new AppError('Lookup code is required.');

  return prisma.lookupMaster.upsert({
    where: { category_id: { category: input.category, id } },
    create: {
      id,
      category: input.category,
      data: { label: input.label.trim() },
      active: input.active ?? true,
    },
    update: {
      data: { label: input.label.trim() },
      active: input.active ?? true,
    },
  });
}

export const LOOKUP_SEED: Array<{ category: string; id: string; label: string }> = [
  { category: 'vehicleType', id: 'VT1', label: 'Small truck (≤3.5T)' },
  { category: 'vehicleType', id: 'VT2', label: 'Large truck (>3.5T)' },
  { category: 'teamRole', id: 'TR1', label: 'Driver' },
  { category: 'teamRole', id: 'TR2', label: 'Loader' },
  { category: 'paymentMode', id: 'PM1', label: 'NEFT / RTGS' },
  { category: 'paymentMode', id: 'PM2', label: 'Cheque' },
  { category: 'paymentMode', id: 'PM3', label: 'UPI' },
];

export async function seedLookups() {
  for (const row of LOOKUP_SEED) {
    await upsertLookup(row);
  }
}
