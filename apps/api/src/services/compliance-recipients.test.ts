import { describe, expect, it } from 'vitest';
import {
  buildComplianceRecipients,
  selectComplianceRecipients,
  type RecipientContext,
} from './compliance-recipients.js';

const ctx = (over: Partial<RecipientContext> = {}): RecipientContext => ({
  siteId: 'site-hq',
  siteName: 'Bengaluru HQ',
  createdBy: 'ops@urbeno.in',
  onBehalfOf: null,
  siteContactEmail: null,
  siteContactName: null,
  users: [
    { email: 'hq@techcorp.in', name: 'HQ User', role: 'client', siteIds: ['site-hq'] },
    { email: 'plant@techcorp.in', name: 'Plant User', role: 'client', siteIds: ['site-plant'] },
    { email: 'audit@techcorp.in', name: 'Audit User', role: 'client_readonly', siteIds: [] },
    { email: 'ops@urbeno.in', name: 'Urbeno Ops', role: 'operations', siteIds: [] },
  ],
  ...over,
});

describe('buildComplianceRecipients', () => {
  it('suggests only users who can see the request site, plus the Urbeno raiser', () => {
    const list = buildComplianceRecipients(ctx());
    const suggested = list.filter((r) => r.suggested).map((r) => r.email);

    expect(suggested).toEqual(['hq@techcorp.in', 'audit@techcorp.in', 'ops@urbeno.in']);
    expect(list.find((r) => r.email === 'plant@techcorp.in')).toMatchObject({
      group: 'other-site',
      siteLinked: false,
      suggested: false,
      note: 'Not linked to Bengaluru HQ',
    });
  });

  it('treats an empty site list as access to every site on the account', () => {
    const list = buildComplianceRecipients(ctx());
    expect(list.find((r) => r.email === 'audit@techcorp.in')).toMatchObject({
      group: 'site',
      allSites: true,
      siteLinked: true,
    });
  });

  it('labels the Urbeno raiser as an internal copy', () => {
    const list = buildComplianceRecipients(ctx());
    expect(list.find((r) => r.email === 'ops@urbeno.in')).toMatchObject({
      group: 'internal',
      roleLabel: 'Operations Manager',
      raisedRequest: true,
      note: 'Urbeno — raised this request',
    });
  });

  it('keeps staff who are not part of this request out of the list', () => {
    const list = buildComplianceRecipients(
      ctx({
        users: [
          ...ctx().users,
          { email: 'other@urbeno.in', name: 'Other Staff', role: 'operations', siteIds: [] },
        ],
      }),
    );
    expect(list.map((r) => r.email)).not.toContain('other@urbeno.in');
  });

  it('suggests an on-behalf-of user even when they are not linked to the site', () => {
    const list = buildComplianceRecipients(ctx({ onBehalfOf: 'plant@techcorp.in' }));
    expect(list.find((r) => r.email === 'plant@techcorp.in')).toMatchObject({
      onBehalfOf: true,
      suggested: true,
    });
  });

  it('offers the site contact as an unticked option and skips inactive users', () => {
    const list = buildComplianceRecipients(
      ctx({
        siteContactEmail: 'Facility@techcorp.in',
        siteContactName: 'Facility Desk',
        users: [
          { email: 'hq@techcorp.in', name: 'HQ User', role: 'client', siteIds: ['site-hq'] },
          { email: 'left@techcorp.in', name: 'Left Co', role: 'client', siteIds: [], active: false },
        ],
      }),
    );
    expect(list.map((r) => r.email)).toEqual(['hq@techcorp.in', 'facility@techcorp.in']);
    expect(list[1]).toMatchObject({ group: 'contact', suggested: false, roleLabel: 'Site contact' });
  });

  it('deduplicates when the client user who raised the request is also a portal user', () => {
    const list = buildComplianceRecipients(
      ctx({
        createdBy: 'HQ@techcorp.in',
        users: [{ email: 'hq@techcorp.in', name: 'HQ User', role: 'client', siteIds: ['site-hq'] }],
      }),
    );
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ group: 'site', raisedRequest: true, suggested: true });
    expect(list[0].note).toContain('raised this request');
  });
});

describe('selectComplianceRecipients', () => {
  const candidates = buildComplianceRecipients(ctx());

  it('falls back to the suggested addresses when the caller sends no selection', () => {
    const res = selectComplianceRecipients(candidates, null);
    expect(res.mode).toBe('default');
    expect(res.emails).toEqual(['hq@techcorp.in', 'audit@techcorp.in', 'ops@urbeno.in']);
    expect(res.skipped).toEqual(['plant@techcorp.in']);
  });

  it('honours an explicit selection and records who was left out', () => {
    const res = selectComplianceRecipients(candidates, ['HQ@techcorp.in ', 'plant@techcorp.in']);
    expect(res.mode).toBe('selected');
    expect(res.emails).toEqual(['hq@techcorp.in', 'plant@techcorp.in']);
    expect(res.skipped).toEqual(['audit@techcorp.in', 'ops@urbeno.in']);
    expect(res.unknown).toEqual([]);
  });

  it('rejects addresses that are not recipients on the request', () => {
    const res = selectComplianceRecipients(candidates, ['stranger@example.com']);
    expect(res.unknown).toEqual(['stranger@example.com']);
    expect(res.emails).toEqual([]);
  });

  it('returns nothing when the selection is empty', () => {
    const res = selectComplianceRecipients(candidates, []);
    expect(res.mode).toBe('selected');
    expect(res.emails).toEqual([]);
  });
});
