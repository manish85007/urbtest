import { createHash } from 'node:crypto';

export function sha256Hex(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/** jsonb reorders keys; hash the sorted shape so verify matches what was stored. */
export function canonicalize(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  const obj = value as Record<string, unknown>;
  return Object.fromEntries(Object.keys(obj).sort().map((k) => [k, canonicalize(obj[k])]));
}

/** Canonical payload hashed for each audit entry. Field order is part of the spec. */
export function auditHashPayload(entry: {
  seq: number;
  id: string;
  ts: string;
  actor: string;
  action: string;
  entity: string;
  entityId: string | null;
  details: unknown;
  prevHash: string;
}): string {
  return sha256Hex(
    JSON.stringify({
      seq: entry.seq,
      id: entry.id,
      ts: entry.ts,
      actor: entry.actor,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      details: canonicalize(entry.details ?? {}),
      prevHash: entry.prevHash,
    }),
  );
}

