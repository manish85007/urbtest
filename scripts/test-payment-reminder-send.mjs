#!/usr/bin/env node
/**
 * End-to-end check of the Super Admin payment reminder. Temporarily sets one client's
 * payment terms to 0 days so an unpaid invoice falls overdue, runs the reminders job,
 * inspects the queued mail, then restores the original terms.
 *
 *   node scripts/test-payment-reminder-send.mjs
 *
 * UAT_URL / STAFF_EMAIL / UAT_PASSWORD override the target. This queues a real email
 * to the active Super Admins on the instance.
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

async function solveChallenge() {
  const cfg = await api('GET', '/auth/captcha');
  if (cfg.data?.provider !== 'challenge') return {};
  const [, a, b] = /What is (\d+) \+ (\d+)\?/.exec(cfg.data.question ?? '') ?? [];
  if (!a) throw new Error(`Unexpected security question: ${cfg.data.question}`);
  return { challengeToken: cfg.data.challengeToken, challengeAnswer: String(Number(a) + Number(b)) };
}

async function login() {
  let res = await api('POST', '/auth/login', {
    email: STAFF_EMAIL,
    password: PASS,
    ...(await solveChallenge()),
  });
  if (res.status === 400 && res.data?.mfaRequired && res.data?.demoCode) {
    const code = { [res.data.emailOtpRequired ? 'emailOtp' : 'mfaCode']: res.data.demoCode };
    res = await api('POST', '/auth/login', { email: STAFF_EMAIL, password: PASS, ...code });
  }
  if (res.status !== 200) throw new Error(`Login failed: ${res.status} ${JSON.stringify(res.data)}`);
}

/** Finds an open invoice that still has money outstanding. */
async function findUnpaidInvoice() {
  const list = await api('GET', '/submissions?limit=200');
  const candidates = (list.data?.items ?? []).filter((s) => (s.invoices ?? []).length);

  for (const row of candidates) {
    const detail = await api('GET', `/submissions/${row.id}`);
    for (const inv of detail.data?.invoices ?? []) {
      const paid = (inv.payments ?? []).reduce((sum, p) => sum + Number(p.amountPaise ?? 0), 0);
      if (!inv.closedAt && paid < Number(inv.totalPaise ?? 0)) {
        return { submissionId: row.id, clientId: row.clientId, invoiceNo: inv.invoiceNo };
      }
    }
  }
  return null;
}

async function main() {
  console.log(`Payment reminder live send @ ${BASE}\n`);
  await login();

  const users = await api('GET', '/users');
  const admins = (users.data?.items ?? users.data ?? [])
    .filter((u) => u.role === 'admin' && u.active !== false)
    .map((u) => String(u.email).toLowerCase());
  check('active Super Admins', admins.length > 0, admins.join(', '));

  const target = await findUnpaidInvoice();
  if (!target) throw new Error('No open invoice with an outstanding balance on this instance.');
  console.log(`Using ${target.invoiceNo} on ${target.submissionId} (client ${target.clientId})\n`);

  const client = await api('GET', `/clients/${target.clientId}`);
  const originalTerms = client.data?.payTermsDays ?? 30;

  const before = await api('GET', '/emails/outbox?limit=200');
  const seen = new Set((before.data?.items ?? before.data ?? []).map((m) => m.id));

  // 0-day terms make the unpaid invoice overdue from its invoice date.
  const patched = await api('PATCH', `/clients/${target.clientId}`, { payTermsDays: 0 });
  check('payment terms set to 0 for the test', patched.status === 200);

  try {
    const job = await api('POST', '/admin/jobs/reminders');
    check('reminders job runs', job.status === 200, JSON.stringify(job.data?.reminders));
    check('job reports invoices pending payment', (job.data?.reminders?.sentPay ?? 0) > 0);

    const after = await api('GET', '/emails/outbox?limit=200');
    const fresh = (after.data?.items ?? after.data ?? []).filter(
      (m) => !seen.has(m.id) && m.templateKey === 'payment_reminder',
    );
    check('one payment reminder queued', fresh.length === 1, `${fresh.length} queued`);

    const mail = fresh[0];
    if (mail) {
      const to = (mail.to ?? []).map((a) => String(a).toLowerCase());
      check(
        'addressed to Super Admins only',
        to.length > 0 && to.every((a) => admins.includes(a)),
        to.join(', '),
      );
      check('subject asks for the payment to be recorded', /Record payment/.test(mail.subject), mail.subject);
      check('body lists the invoice', String(mail.body).includes(target.invoiceNo));
      check(
        'body is not client-facing',
        !/Dear /.test(mail.body) && !/arrange payment/i.test(mail.body),
      );
      console.log(`\n--- queued mail -------------------------------------------`);
      console.log(`TO      ${mail.to.join(', ')}`);
      console.log(`SUBJECT ${mail.subject}`);
      console.log(mail.body);
      console.log(`-----------------------------------------------------------`);
    }
  } finally {
    const restored = await api('PATCH', `/clients/${target.clientId}`, {
      payTermsDays: originalTerms,
    });
    check(`payment terms restored to ${originalTerms}`, restored.status === 200);
  }

  console.log(`\n${failures ? `${failures} check(s) failed` : 'All checks passed'}`);
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
