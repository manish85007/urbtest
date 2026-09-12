import { describe, expect, it } from 'vitest';
import { actorMayCloseInvoice, closeChecklist, requestorCloseBlocker } from './close-readiness.js';

const base = {
  hasCod: true,
  certified: true,
  paid: true,
  audience: 'client' as const,
  actorRole: 'client',
  actorEmail: 'ramesh@techcorp.in',
  onBehalfOf: null as string | null,
  createdBy: 'ramesh@techcorp.in',
  raisedByClient: true,
  daysSinceFirstCertificate: 1,
};

describe('closeChecklist', () => {
  it('names the first missing document gate and keeps later checks visible', () => {
    const items = closeChecklist({ ...base, hasCod: false, certified: false, paid: false });
    expect(items.map((i) => i.id)).toEqual(['cod', 'certified', 'paid', 'requestor']);
    expect(items[0]).toMatchObject({
      ok: false,
      text: 'Certificate of Destruction is not uploaded yet.',
    });
    expect(items[1].text).toMatch(/not published/);
    expect(items[2].text).toMatch(/outstanding/);
    expect(actorMayCloseInvoice({ ...base, hasCod: false })).toBe(false);
  });

  it('blocks peers until 30 days and allows the requestor immediately', () => {
    const peer = closeChecklist({
      ...base,
      actorEmail: 'priya@techcorp.in',
      onBehalfOf: 'ramesh@techcorp.in',
      daysSinceFirstCertificate: 10,
    });
    expect(peer.find((i) => i.id === 'requestor')).toMatchObject({
      ok: false,
      text: 'Only the requestor can close until 30 days after the certificate.',
    });
    expect(actorMayCloseInvoice({ ...base, actorEmail: 'priya@techcorp.in', onBehalfOf: 'ramesh@techcorp.in', daysSinceFirstCertificate: 10 })).toBe(false);

    const requestor = closeChecklist({ ...base, onBehalfOf: 'ramesh@techcorp.in', daysSinceFirstCertificate: 1 });
    expect(requestor.every((i) => i.ok)).toBe(true);
    expect(actorMayCloseInvoice({ ...base, onBehalfOf: 'ramesh@techcorp.in' })).toBe(true);
  });

  it('blocks every client when a staff-raised request has no requestor', () => {
    const items = closeChecklist({
      ...base,
      createdBy: 'admin@urbeno.in',
      raisedByClient: false,
      onBehalfOf: null,
    });
    expect(items.find((i) => i.id === 'requestor')?.text).toMatch(/not been assigned/);
    expect(requestorCloseBlocker({
      actorRole: 'client',
      actorEmail: 'ramesh@techcorp.in',
      createdBy: 'admin@urbeno.in',
      raisedByClient: false,
      daysSinceFirstCertificate: 10,
    })).toBe('no_requestor');
  });

  it('tells staff to assign a requestor instead of offering close', () => {
    const items = closeChecklist({
      ...base,
      audience: 'staff',
      actorRole: 'admin',
      actorEmail: 'admin@urbeno.in',
      createdBy: 'admin@urbeno.in',
      raisedByClient: false,
    });
    expect(items.find((i) => i.id === 'requestor')?.text).toMatch(/Assign a client requestor/);
    expect(actorMayCloseInvoice({ ...base, audience: 'staff', actorRole: 'admin' })).toBe(false);
  });

  it('refuses read-only client accounts', () => {
    const items = closeChecklist({ ...base, actorRole: 'client_readonly' });
    expect(items.find((i) => i.id === 'requestor')?.text).toMatch(/Read-only/);
    expect(actorMayCloseInvoice({ ...base, actorRole: 'client_readonly' })).toBe(false);
  });
});
