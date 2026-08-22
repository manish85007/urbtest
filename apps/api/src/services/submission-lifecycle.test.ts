import { describe, expect, it } from 'vitest';
import { summarizeSubmissionChanges } from './submission-lifecycle.js';

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
