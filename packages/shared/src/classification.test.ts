import { describe, expect, it } from 'vitest';
import { DATA_CLASSES, FILE_CLASS, RETENTION_YEARS, SOD_RULES } from './classification.js';

describe('classification X10', () => {
  it('has four data classes', () => {
    expect(Object.keys(DATA_CLASSES)).toHaveLength(4);
  });

  it('classifies at least eight document types', () => {
    expect(Object.keys(FILE_CLASS).length).toBeGreaterThanOrEqual(8);
  });

  it('rates device serials as restricted', () => {
    expect(FILE_CLASS.serials).toBe('restricted');
  });

  it('keeps retention periods from the kit', () => {
    expect(RETENTION_YEARS.compliance).toBe(5);
    expect(RETENTION_YEARS.certificate).toBe(10);
    expect(RETENTION_YEARS.audit).toBe(7);
  });

  it('names at least three segregation-of-duties rules', () => {
    expect(SOD_RULES.length).toBeGreaterThanOrEqual(3);
  });
});
