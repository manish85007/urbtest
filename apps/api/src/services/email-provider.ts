import { sendSmtp } from '../lib/smtp.js';
import { getSmtpSettings, toSmtpConfig } from './settings.js';

export interface OutboundEmail {
  to: string[];
  subject: string;
  body: string;
}

/** In UAT, funnel all outbound mail to one inbox while preserving intended recipients in the body. */
export function applyEmailRedirect(email: OutboundEmail): OutboundEmail {
  const redirect = process.env.EMAIL_REDIRECT_TO?.trim();
  if (!redirect) return email;

  const intended = [...new Set(email.to.filter(Boolean))];
  if (intended.length === 1 && intended[0].toLowerCase() === redirect.toLowerCase()) {
    return email;
  }

  const header =
    intended.length > 0
      ? `[UAT redirect — intended: ${intended.join(', ')}]\n\n`
      : '[UAT redirect]\n\n';

  return {
    to: [redirect],
    subject: intended.length ? `[UAT → ${intended.join(', ')}] ${email.subject}` : email.subject,
    body: `${header}${email.body}`,
  };
}

/** Deliver outbound email via Masters SMTP settings, else console (dev). */
export async function deliverEmail(email: OutboundEmail): Promise<void> {
  const outbound = applyEmailRedirect(email);
  const smtp = toSmtpConfig(await getSmtpSettings());
  if (smtp) {
    await sendSmtp(smtp, outbound);
    return;
  }

  const provider = process.env.EMAIL_PROVIDER ?? 'console';
  if (provider === 'console' || provider === 'smtp') {
    console.log('\n--- Urb TecTrack email ---');
    console.log('To:', outbound.to.join(', '));
    if (email.to.join(', ') !== outbound.to.join(', ')) {
      console.log('Intended:', email.to.join(', '));
    }
    console.log('Subject:', outbound.subject);
    console.log(outbound.body);
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
