import { describe, expect, it } from 'vitest';
import { SOD_RULES } from '@urb-tectrack/shared';
import { sodCheck } from './compliance.js';

describe('segregation of duties X11 / A.5.3', () => {
  it('names at least three rules', () => {
    expect(SOD_RULES.length).toBeGreaterThanOrEqual(3);
  });

  it('flags force-closing an invoice you raised', () => {
    const conflicts = sodCheck('force-close', { invCreatedBy: 'admin@urbeno.in' }, 'admin@urbeno.in');
    expect(conflicts.length).toBeGreaterThan(0);
  });

  it('is silent when someone else raised the invoice', () => {
    const conflicts = sodCheck(
      'force-close',
      { invCreatedBy: 'someone.else@urbeno.in' },
      'admin@urbeno.in',
    );
    expect(conflicts).toHaveLength(0);
  });
});
