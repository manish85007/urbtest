import { describe, expect, it } from 'vitest';
import {
  ALWAYS_SEND_EMAIL_TEMPLATES,
  IMPORTANT_CLIENT_EMAIL_TEMPLATES,
  allowsClientEmail,
} from './email-preferences.js';

describe('allowsClientEmail', () => {
  it('always sends security and welcome mail', () => {
    for (const key of ALWAYS_SEND_EMAIL_TEMPLATES) {
      expect(allowsClientEmail('none', key)).toBe(true);
      expect(allowsClientEmail('important_only', key)).toBe(true);
      expect(allowsClientEmail('all', key)).toBe(true);
    }
  });

  it('sends every lifecycle mail when mode is all', () => {
    expect(allowsClientEmail('all', 'invoice_generated')).toBe(true);
    expect(allowsClientEmail('all', 'announcement')).toBe(true);
    expect(allowsClientEmail('all', 'request_ack')).toBe(true);
  });

  it('under important_only keeps acknowledgement, vehicle, Form 6, COD and changes', () => {
    for (const key of IMPORTANT_CLIENT_EMAIL_TEMPLATES) {
      expect(allowsClientEmail('important_only', key)).toBe(true);
    }
    expect(allowsClientEmail('important_only', 'invoice_generated')).toBe(false);
    expect(allowsClientEmail('important_only', 'loading_complete')).toBe(false);
    expect(allowsClientEmail('important_only', 'impact_share')).toBe(false);
    expect(allowsClientEmail('important_only', 'announcement')).toBe(false);
    expect(allowsClientEmail('important_only', 'compliance_docs_share')).toBe(false);
  });

  it('under none blocks lifecycle and reminders but not security', () => {
    expect(allowsClientEmail('none', 'request_ack')).toBe(false);
    expect(allowsClientEmail('none', 'vehicle_assigned')).toBe(false);
    expect(allowsClientEmail('none', 'announcement')).toBe(false);
    expect(allowsClientEmail('none', 'password_reset')).toBe(true);
  });
});
