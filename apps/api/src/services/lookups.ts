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
  days?: number;
  code?: string;
  phone?: string;
  gstin?: string;
  transporterId?: string;
  address?: string;
  gst?: number;
  data: Record<string, unknown>;
}

function asRecord(data: unknown): Record<string, unknown> {
  return data && typeof data === 'object' && !Array.isArray(data) ? (data as Record<string, unknown>) : {};
}

function str(data: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = data[k];
    if (typeof v === 'string' && v.trim()) return v;
  }
  return undefined;
}

function num(data: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const k of keys) {
    const v = data[k];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
  }
  return undefined;
}

export function toLookupRow(r: { id: string; category: string; data: unknown; active: boolean }): LookupRow {
  const data = asRecord(r.data);
  return {
    id: r.id,
    category: r.category,
    label: str(data, 'label', 'nm') || r.id,
    active: r.active,
    rate: num(data, 'rate', 'pct'),
    description: str(data, 'description', 'ds', 'note'),
    days: num(data, 'days'),
    code: str(data, 'code', 'cd'),
    phone: str(data, 'phone', 'ph'),
    gstin: str(data, 'gstin'),
    transporterId: str(data, 'transporterId', 'trId'),
    address: str(data, 'address', 'addr'),
    gst: num(data, 'gst'),
    data,
  };
}

export async function listLookups(category: string, includeInactive = false): Promise<LookupRow[]> {
  const rows = await prisma.lookupMaster.findMany({
    where: { category, ...(includeInactive ? {} : { active: true }) },
    orderBy: { id: 'asc' },
  });
  return rows.map(toLookupRow);
}

export async function listAllLookups(includeInactive = true): Promise<LookupRow[]> {
  const rows = await prisma.lookupMaster.findMany({
    where: includeInactive ? {} : { active: true },
    orderBy: [{ category: 'asc' }, { id: 'asc' }],
  });
  return rows.map(toLookupRow);
}

function nextLookupId(category: string) {
  const prefix = category.replace(/[^a-z]/gi, '').slice(0, 2).toUpperCase() || 'MD';
  return `${prefix}${Date.now().toString(36).slice(-4).toUpperCase()}`;
}

export async function upsertLookup(input: {
  category: string;
  id?: string;
  label?: string;
  active?: boolean;
  rate?: number;
  description?: string;
  days?: number;
  code?: string;
  phone?: string;
  gstin?: string;
  transporterId?: string;
  address?: string;
  gst?: number;
  data?: Record<string, unknown>;
}) {
  const category = input.category.trim();
  if (!category) throw new AppError('Lookup category is required.');

  let id = input.id?.trim().toUpperCase() || '';
  const existing = id
    ? await prisma.lookupMaster.findUnique({ where: { category_id: { category, id } } })
    : null;

  if (!id) id = nextLookupId(category);

  const prev = existing ? asRecord(existing.data) : {};
  const extra = input.data ? asRecord(input.data) : {};
  const label = (input.label ?? str(extra, 'label', 'nm') ?? str(prev, 'label', 'nm') ?? '').trim();
  if (!existing && !label && !str(extra, 'code', 'cd')) {
    throw new AppError('A name or code is required.');
  }

  const data: Record<string, unknown> = {
    ...prev,
    ...extra,
    ...(label ? { label } : {}),
    ...(input.rate !== undefined ? { rate: input.rate } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.days !== undefined ? { days: input.days } : {}),
    ...(input.code !== undefined ? { code: input.code } : {}),
    ...(input.phone !== undefined ? { phone: input.phone } : {}),
    ...(input.gstin !== undefined ? { gstin: input.gstin } : {}),
    ...(input.transporterId !== undefined ? { transporterId: input.transporterId } : {}),
    ...(input.address !== undefined ? { address: input.address } : {}),
    ...(input.gst !== undefined ? { gst: input.gst } : {}),
  };

  return prisma.lookupMaster.upsert({
    where: { category_id: { category, id } },
    create: {
      id,
      category,
      data: data as Prisma.InputJsonValue,
      active: input.active ?? true,
    },
    update: {
      data: data as Prisma.InputJsonValue,
      ...(input.active !== undefined ? { active: input.active } : {}),
    },
  });
}

export const LOOKUP_SEED: Array<{
  category: string;
  id: string;
  label: string;
  rate?: number;
  description?: string;
  days?: number;
  code?: string;
  phone?: string;
  gstin?: string;
  transporterId?: string;
  address?: string;
  gst?: number;
}> = [
  {
    category: 'logistics',
    id: 'LP1',
    label: 'Ravi Logistics',
    phone: '+91 98450 11111',
    gstin: '29AAFCR1234M1Z8',
    transporterId: '88AAFCR1234M1',
    address: '12 Peenya Industrial Area, Bengaluru 560058',
  },
  {
    category: 'logistics',
    id: 'LP2',
    label: 'SwiftMove',
    phone: '+91 98450 22222',
    gstin: '29AAGCS5678N1Z5',
    transporterId: '88AAGCS5678N1',
    address: 'Warehouse 4, Bommasandra, Bengaluru 560099',
  },
  {
    category: 'logistics',
    id: 'LP3',
    label: 'SecureMove',
    phone: '+91 98450 33333',
    gstin: '27AAHCS9012P1Z2',
    transporterId: '88AAHCS9012P1',
    address: 'Unit 9, MIDC Andheri East, Mumbai 400093',
  },
  {
    category: 'logistics',
    id: 'LP4',
    label: 'Urbeno Own Fleet',
    phone: '+91 98450 44444',
    gstin: '29AABCU1234R1ZX',
    transporterId: '88AABCU1234R1',
    address: 'Plot 47, Peenya Industrial Area Phase II, Bengaluru 560058',
  },
  { category: 'vehicleType', id: 'VT1', label: 'Tempo (1-2 T)' },
  { category: 'vehicleType', id: 'VT2', label: 'LCV Truck (3-5 T)' },
  { category: 'vehicleType', id: 'VT3', label: 'Truck (7-10 T)' },
  { category: 'vehicleType', id: 'VT4', label: 'Container (20 ft)' },
  { category: 'teamRole', id: 'TR1', label: 'Supervisor' },
  { category: 'teamRole', id: 'TR2', label: 'Loader' },
  { category: 'teamRole', id: 'TR3', label: 'Helper' },
  { category: 'teamRole', id: 'TR4', label: 'Technician' },
  { category: 'teamRole', id: 'TR5', label: 'Security Escort' },
  { category: 'paymentMode', id: 'PM1', label: 'RTGS' },
  { category: 'paymentMode', id: 'PM2', label: 'NEFT' },
  { category: 'paymentMode', id: 'PM3', label: 'IMPS' },
  { category: 'paymentMode', id: 'PM4', label: 'UPI' },
  { category: 'paymentMode', id: 'PM5', label: 'Cheque' },
  { category: 'paymentMode', id: 'PM6', label: 'Cash' },
  { category: 'payTerms', id: 'PT0', label: 'Advance / against delivery', days: 0 },
  { category: 'payTerms', id: 'PT7', label: 'Net 7 days', days: 7 },
  { category: 'payTerms', id: 'PT15', label: 'Net 15 days', days: 15 },
  { category: 'payTerms', id: 'PT30', label: 'Net 30 days', days: 30 },
  { category: 'payTerms', id: 'PT45', label: 'Net 45 days', days: 45 },
  { category: 'payTerms', id: 'PT60', label: 'Net 60 days', days: 60 },
  { category: 'taxRate', id: 'TX0', label: 'Nil / Exempt', rate: 0, description: 'Exempt supply — no GST charged' },
  { category: 'taxRate', id: 'TX5', label: 'GST 5%', rate: 5 },
  { category: 'taxRate', id: 'TX12', label: 'GST 12%', rate: 12, description: 'Medical devices (HSN 9018)' },
  { category: 'taxRate', id: 'TX18', label: 'GST 18%', rate: 18, description: 'Standard rate for e-waste (HSN 8548)' },
  { category: 'taxRate', id: 'TX28', label: 'GST 28%', rate: 28 },
  { category: 'hsn', id: 'H1', label: '854890', code: '854890', description: 'Electrical/electronic waste and scrap', gst: 18 },
  { category: 'hsn', id: 'H2', label: '847150', code: '847150', description: 'Processing units — computers', gst: 18 },
  { category: 'hsn', id: 'H3', label: '852852', code: '852852', description: 'Monitors and projectors', gst: 18 },
  { category: 'hsn', id: 'H4', label: '901890', code: '901890', description: 'Medical instruments and appliances', gst: 12 },
  { category: 'hsn', id: 'H5', label: '853710', code: '853710', description: 'Control panels/boards <1000V', gst: 18 },
  {
    category: 'destructStd',
    id: 'NIST_PURGE',
    label: 'NIST 800-88 Purge',
    code: 'NIST-P',
    description: 'Cryptographic erase or degauss — irreversible',
  },
  {
    category: 'destructStd',
    id: 'NIST_CLEAR',
    label: 'NIST 800-88 Clear',
    code: 'NIST-C',
    description: 'Single-pass overwrite — suitable for reuse',
  },
  {
    category: 'destructStd',
    id: 'DOD_3PASS',
    label: 'DoD 5220.22-M (3-pass)',
    code: 'DOD-3P',
    description: 'Three-pass overwrite pattern',
  },
  {
    category: 'destructStd',
    id: 'PHY_SHRED',
    label: 'Physical Shred (≤6mm)',
    code: 'PHY-SH',
    description: 'Media reduced to particles ≤6 mm',
  },
  {
    category: 'destructStd',
    id: 'DEGAUSS',
    label: 'Magnetic Degauss',
    code: 'DEGAUSS',
    description: 'Magnetic media only — irreversible',
  },
];

const RETIRED_LOOKUPS = [
  { category: 'taxRate', id: 'GST18' },
  { category: 'taxRate', id: 'GST12' },
  { category: 'taxRate', id: 'GST5' },
  { category: 'taxRate', id: 'GST0' },
  { category: 'destructStd', id: 'NIST' },
  { category: 'destructStd', id: 'DIN' },
];

export async function seedLookups() {
  for (const row of LOOKUP_SEED) {
    await upsertLookup(row);
  }
  for (const row of RETIRED_LOOKUPS) {
    await prisma.lookupMaster.updateMany({
      where: { category: row.category, id: row.id },
      data: { active: false },
    });
  }
}
