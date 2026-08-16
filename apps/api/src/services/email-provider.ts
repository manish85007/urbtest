export interface OutboundEmail {
  to: string[];
  subject: string;
  body: string;
}

/** Deliver outbound email via configured provider (console in dev; SES/SendGrid in prod). */
export async function deliverEmail(email: OutboundEmail): Promise<void> {
  const provider = process.env.EMAIL_PROVIDER ?? 'console';

  if (provider === 'console') {
    console.log('\n--- Urb TecTrack email ---');
    console.log('To:', email.to.join(', '));
    console.log('Subject:', email.subject);
    console.log(email.body);
    console.log('--- end email ---\n');
    return;
  }

  throw new Error(
    `EMAIL_PROVIDER "${provider}" is not configured. Use "console" for local development.`,
  );
}
