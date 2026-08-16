import { sendSmtp } from '../lib/smtp.js';
import { getSmtpSettings, toSmtpConfig } from './settings.js';

export interface OutboundEmail {
  to: string[];
  subject: string;
  body: string;
}

/** Deliver outbound email via Masters SMTP settings, else console (dev). */
export async function deliverEmail(email: OutboundEmail): Promise<void> {
  const smtp = toSmtpConfig(await getSmtpSettings());
  if (smtp) {
    await sendSmtp(smtp, email);
    return;
  }

  const provider = process.env.EMAIL_PROVIDER ?? 'console';
  if (provider === 'console' || provider === 'smtp') {
    console.log('\n--- Urb TecTrack email ---');
    console.log('To:', email.to.join(', '));
    console.log('Subject:', email.subject);
    console.log(email.body);
    console.log('--- end email ---\n');
    if (provider === 'smtp') {
      throw new Error(
        'Outgoing mail is set to SMTP but host/credentials are not configured under Masters → Email & Templates → Outgoing mail.',
      );
    }
    return;
  }

  throw new Error(
    `EMAIL_PROVIDER "${provider}" is not configured. Use "console" or save SMTP settings in Masters.`,
  );
}
