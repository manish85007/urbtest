#!/usr/bin/env node
/**
 * Checks that the payment reminder is an internal Super Admin reminder: the template
 * no longer addresses the client, the nightly job runs, and every payment_reminder in
 * the outbox is addressed to Super Admins only.
 *
 *   node scripts/test-payment-reminder.mjs
 *
 * UAT_URL / STAFF_EMAIL / UAT_PASSWORD override the target.
 */
const BASE = process.env.UAT_URL || 'http://localhost:8080';
const STAFF_EMAIL = process.env.STAFF_EMAIL || 'admin@urbeno.in';
const PASS = process.env.UAT_PASSWORD || 'demo';

const jar = new Map();

function keepCookies(res) {
  const raw = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  for (const line of raw.length ? raw : [res.headers.get('set-cookie')].filter(Boolean)) {
    const [pair] = String(line).split(';');
    const eq = pair.indexOf('=');
    if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
}

async function api(method, path, body) {
  // Secure deployments (UAT/prod) require the SPA's CSRF header on mutating calls.
  const headers = { 'X-Requested-With': 'UrbTecTrack' };
  if (jar.size) headers.Cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  keepCookies(res);
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text.slice(0, 300);
  }
  return { status: res.status, data };
}

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}

/** Answers the arithmetic security question when the deployment asks for one. */
async function solveChallenge() {
  const cfg = await api('GET', '/auth/captcha');
  if (cfg.data?.provider !== 'challenge') return {};
  const [, a, b] = /What is (\d+) \+ (\d+)\?/.exec(cfg.data.question ?? '') ?? [];
  if (!a) throw new Error(`Unexpected security question: ${cfg.data.question}`);
  return { challengeToken: cfg.data.challengeToken, challengeAnswer: String(Number(a) + Number(b)) };
}

async function main() {
  console.log(`Payment reminder recipients @ ${BASE}\n`);

  let login = await api('POST', '/auth/login', {
    email: STAFF_EMAIL,
    password: PASS,
    ...(await solveChallenge()),
  });
  if (login.status === 400 && login.data?.mfaRequired && login.data?.demoCode) {
    const code = { [login.data.emailOtpRequired ? 'emailOtp' : 'mfaCode']: login.data.demoCode };
    login = await api('POST', '/auth/login', { email: STAFF_EMAIL, password: PASS, ...code });
  }
  if (login.status !== 200) {
    throw new Error(`Login failed: ${login.status} ${JSON.stringify(login.data)}`);
  }

  const templates = await api('GET', '/email-templates');
  const tpl = (templates.data ?? []).find((t) => t.key === 'payment_reminder');
  check('payment_reminder template present', Boolean(tpl));
  if (tpl) {
    check(
      'template is the Super Admin reminder',
      /Super Admin/i.test(tpl.name) && tpl.subject.includes('Record payment'),
      tpl.subject,
    );
    check(
      'template no longer addresses the client',
      !/Dear \{\{contact_name\}\}/.test(tpl.body) && !/arrange payment/i.test(tpl.body),
    );
    check(
      'template lists the pending invoices',
      tpl.body.includes('{{invoice_list}}') && tpl.body.includes('{{total_outstanding}}'),
    );
  }

  const job = await api('POST', '/admin/jobs/reminders');
  check('reminders job runs', job.status === 200, JSON.stringify(job.data));

  const users = await api('GET', '/users');
  const staff = new Set(
    (users.data?.items ?? users.data ?? [])
      .filter((u) => u.role === 'admin')
      .map((u) => String(u.email).toLowerCase()),
  );
  check('at least one active Super Admin', staff.size > 0, [...staff].join(', '));

  const outbox = await api('GET', '/emails/outbox?limit=200');
  const mails = (outbox.data?.items ?? outbox.data ?? []).filter(
    (m) => m.templateKey === 'payment_reminder',
  );
  const misdirected = mails.flatMap((m) =>
    (m.to ?? []).filter((addr) => !staff.has(String(addr).toLowerCase())),
  );
  check(
    'no payment reminder addressed outside Super Admins',
    misdirected.length === 0,
    misdirected.length ? [...new Set(misdirected)].join(', ') : `${mails.length} in outbox`,
  );

  const latest = mails[0];
  if (latest) {
    console.log(`\nLatest payment reminder → ${latest.to.join(', ')}\n${latest.subject}`);
  } else {
    console.log('\nNo payment reminder queued — no invoice is overdue on this instance.');
  }

  console.log(`\n${failures ? `${failures} check(s) failed` : 'All checks passed'}`);
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
