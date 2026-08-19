import { describe, expect, it } from 'vitest';
import { FILE_CLASS } from '@urb-tectrack/shared';

describe('file access policy', () => {
  it('treats certificate files as confidential', () => {
    expect(FILE_CLASS.certificate).toBe('confidential');
  });

  it('blocks client access to internal weigh photos', () => {
    expect(FILE_CLASS.weighPhoto).toBe('internal');
  });

  it('blocks client access to restricted serial uploads', () => {
    expect(FILE_CLASS.serials).toBe('restricted');
  });
});
