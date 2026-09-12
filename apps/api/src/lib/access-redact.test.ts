import { describe, expect, it, vi, beforeEach } from 'vitest';
import { redactSubmissionForActor } from '../lib/access.js';
import type { SessionUser } from '../lib/auth-context.js';

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    user: {
      findMany: vi.fn(async () => [
        { email: 'suresh@urbeno.in', role: 'factory' },
        { email: 'admin@urbeno.in', role: 'admin' },
      ]),
    },
  },
}));

const client: SessionUser = {
  id: 'u1',
  email: 'ramesh@techcorp.in',
  name: 'Ramesh',
  role: 'client',
  clientId: 'TCPL',
  factoryIds: [],
  siteIds: [],
  featureAccess: null,
  emailNotifyMode: 'all',
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
  emailNotifyMode: 'all',
};

type Inv = {
  invoiceNo: string;
  hasMrn?: boolean;
  mrn: { mrnNo: string } | null;
  recycling?: {
    form6No: string;
    reviewStatus?: string;
    clientPublishedAt?: string | null;
    clientPublishedBy?: string | null;
  } | null;
  certificates?: Array<{ certNo: string }>;
};

describe('redactSubmissionForActor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('strips MRN for clients but preserves hasMrn for lifecycle UI', async () => {
    const sub = {
      id: 'REQ-00090',
      invoices: [
        {
          invoiceNo: 'INV-1',
          hasMrn: true,
          mrn: { mrnNo: 'MRN/URB-BLR/2627/0001' },
          recycling: {
            form6No: 'F6/1',
            reviewStatus: 'approved',
            clientPublishedAt: '2026-09-01T00:00:00.000Z',
          },
          certificates: [{ certNo: 'COD-1' }],
        },
      ] satisfies Inv[],
    };

    const redacted = await redactSubmissionForActor(sub, client);
    expect(redacted.invoices[0].mrn).toBeNull();
    expect(redacted.invoices[0].hasMrn).toBe(true);
    expect(redacted.invoices[0].recycling).toEqual({
      form6No: 'F6/1',
      reviewStatus: 'approved',
      clientPublishedAt: '2026-09-01T00:00:00.000Z',
      clientPublishedBy: null,
    });
    expect(redacted.invoices[0].certificates).toEqual([{ certNo: 'COD-1' }]);
  });

  it('hides Form 6 from clients until admin approval', async () => {
    const sub = {
      id: 'REQ-00090',
      invoices: [
        {
          invoiceNo: 'INV-1',
          hasMrn: true,
          mrn: { mrnNo: 'MRN/1' },
          recycling: { form6No: 'F6/1', reviewStatus: 'pending_review' },
          certificates: [],
        },
      ] satisfies Inv[],
    };
    const redacted = await redactSubmissionForActor(sub, client);
    expect(redacted.invoices[0].recycling).toBeNull();
    expect(redacted.invoices[0].certificates).toEqual([]);
  });

  it('hides approved Form 6 and CoD from clients until Super Admin certify', async () => {
    const sub = {
      id: 'REQ-00090',
      invoices: [
        {
          invoiceNo: 'INV-1',
          hasMrn: true,
          mrn: { mrnNo: 'MRN/1' },
          recycling: { form6No: 'F6/1', reviewStatus: 'approved', clientPublishedAt: null },
          certificates: [{ certNo: 'COD-1' }],
        },
      ] satisfies Inv[],
    };
    const redacted = await redactSubmissionForActor(sub, client);
    expect(redacted.invoices[0].recycling).toBeNull();
    expect(redacted.invoices[0].certificates).toEqual([]);
  });

  it('infers hasMrn from mrn when flag was not pre-set', async () => {
    const sub: { id: string; invoices: Inv[] } = {
      id: 'REQ-00090',
      invoices: [{ invoiceNo: 'INV-1', mrn: { mrnNo: 'MRN/1' } }],
    };
    const redacted = await redactSubmissionForActor(sub, client);
    expect(redacted.invoices[0].hasMrn).toBe(true);
    expect(redacted.invoices[0].mrn).toBeNull();
  });

  it('does not redact MRN for staff', async () => {
    const sub = {
      id: 'REQ-00090',
      invoices: [{ invoiceNo: 'INV-1', hasMrn: true, mrn: { mrnNo: 'MRN/1' } }] satisfies Inv[],
    };
    const out = await redactSubmissionForActor(sub, admin);
    expect(out.invoices[0].mrn).toEqual({ mrnNo: 'MRN/1' });
  });

  it('replaces staff name/email with role on client portal lifecycle', async () => {
    const sub = {
      id: 'REQ-00090',
      acknowledgedBy: 'suresh@urbeno.in',
      loadingCompletedBy: 'admin@urbeno.in',
      invoices: [] as Inv[],
      lifecycleEvents: [
        {
          id: 'e1',
          event: 'acknowledged',
          summary: 'Acknowledged by Suresh',
          actorEmail: 'suresh@urbeno.in',
          actorRole: 'factory',
          createdAt: '2026-09-01T00:00:00.000Z',
        },
      ],
    };

    const redacted = await redactSubmissionForActor(sub, client);
    expect(redacted.acknowledgedBy).toBe('Factory Manager');
    expect(redacted.loadingCompletedBy).toBe('Super Admin');
    const ev = redacted.lifecycleEvents?.[0] as {
      summary: string;
      actorEmail: string;
      actorLabel?: string;
    };
    expect(ev.summary).toBe('Acknowledged by Factory Manager');
    expect(ev.actorEmail).toBe('');
    expect(ev.actorLabel).toBe('');
  });

  it('keeps staff identity for Urbeno users', async () => {
    const sub = {
      id: 'REQ-00090',
      acknowledgedBy: 'suresh@urbeno.in',
      invoices: [] as Inv[],
      lifecycleEvents: [
        {
          id: 'e1',
          event: 'acknowledged',
          summary: 'Acknowledged by Suresh',
          actorEmail: 'suresh@urbeno.in',
          actorRole: 'factory',
          createdAt: '2026-09-01T00:00:00.000Z',
        },
      ],
    };
    const out = await redactSubmissionForActor(sub, admin);
    expect(out.acknowledgedBy).toBe('suresh@urbeno.in');
    expect(out.lifecycleEvents?.[0].summary).toBe('Acknowledged by Suresh');
    expect(out.lifecycleEvents?.[0].actorEmail).toBe('suresh@urbeno.in');
  });

  it('strips clientPublishedBy for clients', async () => {
    const sub = {
      id: 'REQ-00090',
      invoices: [
        {
          invoiceNo: 'INV-1',
          mrn: null,
          recycling: {
            form6No: 'F6-1',
            reviewStatus: 'approved',
            clientPublishedAt: '2026-09-01T00:00:00.000Z',
            clientPublishedBy: 'admin@urbeno.in',
          },
          certificates: [{ certNo: 'COD-1' }],
        },
      ] satisfies Inv[],
    };
    const redacted = await redactSubmissionForActor(sub, client);
    expect(redacted.invoices[0].recycling?.clientPublishedBy).toBeNull();
    expect(redacted.invoices[0].recycling?.form6No).toBe('F6-1');
  });
});
