import { describe, expect, it } from 'vitest';
import {
  clientFacingLifecycleSummary,
  hideActorIdentityOnClientPortal,
  portalActorRoleLabel,
  summarizeSubmissionChanges,
} from './submission-lifecycle.js';

describe('summarizeSubmissionChanges', () => {
  it('lists changed pickup fields', () => {
    const changes = summarizeSubmissionChanges(
      {
        location: 'Bay A',
        approxQty: 10,
        approxWeight: 100,
        requestDate: new Date('2026-08-22'),
      },
      {
        location: 'Bay B',
        approxQty: 12,
        approxWeight: 110,
        requestDate: '2026-08-23',
      },
    );
    expect(changes).toContain('Pickup location → Bay B');
    expect(changes).toContain('Approx. quantity → 12');
    expect(changes.some((c) => c.includes('Pick-up date'))).toBe(true);
  });
});

describe('client portal actor identity', () => {
  it('hides staff and auditor roles and urbeno emails', () => {
    expect(hideActorIdentityOnClientPortal('admin')).toBe(true);
    expect(hideActorIdentityOnClientPortal('operations')).toBe(true);
    expect(hideActorIdentityOnClientPortal('factory')).toBe(true);
    expect(hideActorIdentityOnClientPortal('auditor')).toBe(true);
    expect(hideActorIdentityOnClientPortal(null, 'someone@urbeno.in')).toBe(true);
    expect(hideActorIdentityOnClientPortal('client')).toBe(false);
    expect(hideActorIdentityOnClientPortal('client_readonly', 'ramesh@techcorp.in')).toBe(false);
  });

  it('maps roles to portal titles', () => {
    expect(portalActorRoleLabel('admin')).toBe('Super Admin');
    expect(portalActorRoleLabel('operations')).toBe('Operations Manager');
    expect(portalActorRoleLabel('factory')).toBe('Factory Manager');
    expect(portalActorRoleLabel(null, 'x@urbeno.in')).toBe('Urbeno');
  });

  it('rewrites staff-named summaries for clients', () => {
    expect(clientFacingLifecycleSummary('acknowledged', 'Factory Manager', 'Acknowledged by Suresh')).toBe(
      'Acknowledged by Factory Manager',
    );
    expect(clientFacingLifecycleSummary('loading_complete', 'Super Admin', 'Loading complete — confirmed by Manish')).toBe(
      'Loading complete — confirmed by Super Admin',
    );
    expect(clientFacingLifecycleSummary('returned', 'Super Admin', 'Returned: need better photos')).toBe(
      'Returned: need better photos',
    );
  });
});
