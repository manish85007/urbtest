import { describe, expect, it } from 'vitest';
import { REQUIRED_LEGAL_KEYS } from '../services/legal.js';

describe('legal compliance', () => {
  it('requires terms and privacy acceptance', () => {
    expect(REQUIRED_LEGAL_KEYS).toContain('terms');
    expect(REQUIRED_LEGAL_KEYS).toContain('privacy');
  });
});
