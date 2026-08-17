import { describe, expect, it } from 'vitest';
import { auditHashPayload, sha256Hex } from './audit-hash.js';

describe('audit hash X1', () => {
  it('is stable for the same canonical payload', () => {
    const rec = {
      seq: 1,
      id: 'c1',
      ts: '2026-08-17T00:00:00.000Z',
      actor: 'admin@urbeno.in',
      action: 'auth.login',
      entity: 'user',
      entityId: 'admin@urbeno.in',
      details: { ok: true },
      prevHash: 'GENESIS',
    };
    expect(auditHashPayload(rec)).toBe(auditHashPayload({ ...rec }));
    expect(auditHashPayload(rec)).toHaveLength(64);
  });

  it('changes when details are altered', () => {
    const rec = {
      seq: 1,
      id: 'c1',
      ts: '2026-08-17T00:00:00.000Z',
      actor: 'admin@urbeno.in',
      action: 'auth.login',
      entity: 'user',
      entityId: 'admin@urbeno.in',
      details: { ok: true },
      prevHash: 'GENESIS',
    };
    expect(auditHashPayload(rec)).not.toBe(auditHashPayload({ ...rec, details: { ok: false } }));
  });

  it('hashes utf-8 text with sha-256', () => {
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});
