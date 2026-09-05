import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { getCompanyProfile, type CompanyProfile } from './settings.js';

/** Frozen company + factory identity printed on MRN / Form 6. */
export interface LetterheadSnapshot {
  capturedAt: string;
  company: {
    name: string;
    brand: string;
    address: string;
    gst: string;
    pan: string;
    cin: string;
    phone: string;
    email: string;
    cpcb: string;
    kspcb: string;
    r2: string;
    logoFileId: string | null;
  };
  factory: {
    id: string;
    name: string;
    address: string | null;
    gstin: string | null;
    kspcbConsent: string | null;
    cpcbEpr: string | null;
  };
}

function asRecord(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

export function parseLetterheadSnapshot(raw: unknown): LetterheadSnapshot | null {
  const root = asRecord(raw);
  const company = asRecord(root.company);
  const factory = asRecord(root.factory);
  if (!str(company.name) || !str(factory.id)) return null;
  return {
    capturedAt: str(root.capturedAt) || new Date(0).toISOString(),
    company: {
      name: str(company.name),
      brand: str(company.brand),
      address: str(company.address),
      gst: str(company.gst),
      pan: str(company.pan),
      cin: str(company.cin),
      phone: str(company.phone),
      email: str(company.email),
      cpcb: str(company.cpcb),
      kspcb: str(company.kspcb),
      r2: str(company.r2),
      logoFileId: company.logoFileId ? String(company.logoFileId) : null,
    },
    factory: {
      id: str(factory.id),
      name: str(factory.name) || str(factory.id),
      address: factory.address != null ? str(factory.address) || null : null,
      gstin: factory.gstin != null ? str(factory.gstin) || null : null,
      kspcbConsent: factory.kspcbConsent != null ? str(factory.kspcbConsent) || null : null,
      cpcbEpr: factory.cpcbEpr != null ? str(factory.cpcbEpr) || null : null,
    },
  };
}

export async function captureLetterheadSnapshot(factoryId: string): Promise<LetterheadSnapshot> {
  const [co, factory] = await Promise.all([
    getCompanyProfile(),
    prisma.factorySite.findUnique({ where: { id: factoryId } }),
  ]);
  if (!factory) {
    throw new Error(`Factory ${factoryId} not found while capturing letterhead snapshot.`);
  }
  return {
    capturedAt: new Date().toISOString(),
    company: {
      name: co.name,
      brand: co.brand,
      address: co.address,
      gst: co.gst,
      pan: co.pan,
      cin: co.cin,
      phone: co.phone,
      email: co.email,
      cpcb: co.cpcb,
      kspcb: co.kspcb,
      r2: co.r2,
      logoFileId: co.logoFileId,
    },
    factory: {
      id: factory.id,
      name: factory.name,
      address: factory.address,
      gstin: factory.gstin,
      kspcbConsent: factory.kspcbConsent,
      cpcbEpr: factory.cpcbEpr,
    },
  };
}

export function letterheadSnapshotJson(snapshot: LetterheadSnapshot): Prisma.InputJsonValue {
  return snapshot as unknown as Prisma.InputJsonValue;
}

/** Company-shaped object for PDF helpers (live profile or snapshot). */
export type LetterheadCompanyView = Pick<
  CompanyProfile,
  'name' | 'brand' | 'address' | 'gst' | 'pan' | 'cin' | 'phone' | 'email' | 'cpcb' | 'kspcb' | 'r2' | 'logoFileId'
>;

export type LetterheadFactoryView = {
  id: string;
  name: string;
  address: string | null;
  gstin: string | null;
  kspcbConsent: string | null;
  cpcbEpr: string | null;
};
