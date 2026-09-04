import { sendSmtp } from '../lib/smtp.js';
import { getSmtpSettings, toSmtpConfig } from './settings.js';

export interface OutboundEmail {
  to: string[];
  subject: string;
  body: string;
}

/** Optional UAT funnel — leave unset to deliver to real recipients (default). */
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
  const isProd = process.env.NODE_ENV === 'production';

  if (provider === 'smtp' || (isProd && provider !== 'console')) {
    throw new Error(
      'Outgoing mail requires SMTP. Configure host/credentials under Masters → Email & Templates → Outgoing mail (or SMTP_* env vars).',
    );
  }

  if (provider === 'console') {
    console.log('\n--- Urb TecTrack email ---');
    console.log('To:', outbound.to.join(', '));
    if (email.to.join(', ') !== outbound.to.join(', ')) {
      console.log('Intended:', email.to.join(', '));
    }
    console.log('Subject:', outbound.subject);
    console.log(outbound.body);
    console.log('--- end email ---\n');
    return;
  }

  throw new Error(
    `EMAIL_PROVIDER "${provider}" is not configured. Use "console" or save SMTP settings in Masters.`,
  );
}
