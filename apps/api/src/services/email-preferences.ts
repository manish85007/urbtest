export type EmailNotifyMode = 'all' | 'important_only' | 'none';

/**
 * Always delivered — account access and security. Preferences never block these.
 */
export const ALWAYS_SEND_EMAIL_TEMPLATES = new Set([
  'password_reset',
  'login_email_otp',
  'mfa_email_otp',
  'user_welcome',
]);

/**
 * "Important only" lifecycle mail for client portal users.
 * Acknowledgement, vehicle assignment, Form 6, COD, and action-required changes.
 * `payment_recorded` is reserved for a future payment-completed notice.
 */
export const IMPORTANT_CLIENT_EMAIL_TEMPLATES = new Set([
  'request_ack',
  'request_changes',
  'vehicle_assigned',
  'recycling_form6',
  'cod_generated',
  'payment_recorded',
]);

export function allowsClientEmail(mode: EmailNotifyMode, templateKey: string): boolean {
  if (ALWAYS_SEND_EMAIL_TEMPLATES.has(templateKey)) return true;
  if (mode === 'all') return true;
  if (mode === 'none') return false;
  return IMPORTANT_CLIENT_EMAIL_TEMPLATES.has(templateKey);
}

export function emailNotifyModeLabel(mode: EmailNotifyMode): string {
  switch (mode) {
    case 'important_only':
      return 'Important only';
    case 'none':
      return 'None (except sign-in & security)';
    default:
      return 'All emails';
  }
}
