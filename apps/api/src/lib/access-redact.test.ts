import { describe, expect, it } from 'vitest';
import { redactSubmissionForActor } from '../lib/access.js';
import type { SessionUser } from '../lib/auth-context.js';

const client: SessionUser = {
  id: 'u1',
  email: 'ramesh@techcorp.in',
  name: 'Ramesh',
  role: 'client',
  clientId: 'TCPL',
  factoryIds: [],
  siteIds: [],
  featureAccess: null,
};

const admin: SessionUser = {
  id: 'u2',
  email: 'admin@urbeno.in',
  name: 'Admin',
  role: 'admin',
  clientId: null,
  factoryIds: [],
  siteIds: [],
  featureAccess: null,
};

type Inv = { invoiceNo: string; hasMrn?: boolean; mrn: { mrnNo: string } | null; recycling?: { form6No: string } | null };

describe('redactSubmissionForActor', () => {
  it('strips MRN for clients but preserves hasMrn for lifecycle UI', () => {
    const sub = {
      id: 'REQ-00090',
      invoices: [
        {
          invoiceNo: 'INV-1',
          hasMrn: true,
          mrn: { mrnNo: 'MRN/URB-BLR/2627/0001' },
          recycling: { form6No: 'F6/1' },
        },
      ] satisfies Inv[],
    };

    const redacted = redactSubmissionForActor(sub, client);
    expect(redacted.invoices[0].mrn).toBeNull();
    expect(redacted.invoices[0].hasMrn).toBe(true);
    expect(redacted.invoices[0].recycling).toEqual({ form6No: 'F6/1' });
  });

  it('infers hasMrn from mrn when flag was not pre-set', () => {
    const sub: { id: string; invoices: Inv[] } = {
      id: 'REQ-00090',
      invoices: [{ invoiceNo: 'INV-1', mrn: { mrnNo: 'MRN/1' } }],
    };
    const redacted = redactSubmissionForActor(sub, client);
    expect(redacted.invoices[0].hasMrn).toBe(true);
    expect(redacted.invoices[0].mrn).toBeNull();
  });

  it('does not redact MRN for staff', () => {
    const sub = {
      id: 'REQ-00090',
      invoices: [{ invoiceNo: 'INV-1', hasMrn: true, mrn: { mrnNo: 'MRN/1' } }] satisfies Inv[],
    };
    const out = redactSubmissionForActor(sub, admin);
    expect(out.invoices[0].mrn).toEqual({ mrnNo: 'MRN/1' });
  });
});
