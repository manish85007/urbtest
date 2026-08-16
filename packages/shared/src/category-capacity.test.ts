import { describe, expect, it } from 'vitest';
import { checkCategoryCapacity, capacityExceedMessage } from './category-capacity.js';

describe('checkCategoryCapacity', () => {
  it('flags exceedance when projected weight exceeds TPA cap', () => {
    const check = checkCategoryCapacity(900, 200, 1);
    expect(check.capKg).toBe(1000);
    expect(check.exceeds).toBe(true);
    expect(capacityExceedMessage('REC-ITEW1', { ...check, entryId: 'REC-ITEW1' })).toContain(
      'EXCEEDING',
    );
  });

  it('warns at 80% utilization without blocking', () => {
    const check = checkCategoryCapacity(750, 50, 1);
    expect(check.exceeds).toBe(false);
    expect(check.warn).toBe(true);
  });
});
