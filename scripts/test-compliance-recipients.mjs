#!/usr/bin/env node
/**
 * Checks the compliance-document recipient picker: candidate list, site linkage flags
 * and the guard that refuses addresses which are not recipients on the request.
 *
 *   node scripts/test-compliance-recipients.mjs [--send]
 *
 * UAT_URL / STAFF_EMAIL / UAT_PASSWORD override the target. --send actually queues
 * the email to the suggested recipients (leave it off for a read-only check).
 */
const BASE = process.env.UAT_URL || 'http://localhost:8080';
const STAFF_EMAIL = process.env.STAFF_EMAIL || 'admin@urbeno.in';
const PASS = process.env.UAT_PASSWORD || 'demo';
const DO_SEND = process.argv.includes('--send');

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
  console.log(`Compliance recipient picker @ ${BASE}\n`);

  let login = await api('POST', '/auth/login', {
    email: STAFF_EMAIL,
    password: PASS,
    ...(await solveChallenge()),
  });
  if (login.status === 400 && login.data?.mfaRequired && login.data?.demoCode) {
    const code = { [login.data.emailOtpRequired ? 'emailOtp' : 'mfaCode']: login.data.demoCode };
    login = await api('POST', '/auth/login', { email: STAFF_EMAIL, password: PASS, ...code });
  }
  if (login.status !== 200) throw new Error(`Login failed: ${login.status} ${JSON.stringify(login.data)}`);

  const list = await api('GET', '/submissions?limit=200');
  const rows = list.data?.items ?? [];
  let target = null;
  let docs = null;
  for (const row of rows) {
    const sub = (await api('GET', `/submissions/${row.id}`)).data;
    const certs = [];
    const form6 = [];
    for (const inv of sub?.invoices ?? []) {
      if (!inv.recycling?.clientPublishedAt) continue;
      if (inv.recycling.reviewStatus === 'approved') form6.push(inv.id);
      for (const c of inv.certificates ?? []) if (c.id) certs.push(c.id);
    }
    if (certs.length) {
      target = sub;
      docs = { certificateIds: certs.slice(0, 1), form6InvoiceIds: form6.slice(0, 1) };
      break;
    }
  }
  if (!target) throw new Error('No request with published compliance documents found.');
  console.log(`Request ${target.id} — ${target.clientName} / ${target.siteName}\n`);

  const rec = await api('GET', `/submissions/${target.id}/compliance/recipients`);
  check('GET compliance/recipients', rec.status === 200, `status ${rec.status}`);
  const recipients = rec.data?.recipients ?? [];
  check('candidate list returned', recipients.length > 0, `${recipients.length} candidates`);
  check('site name resolved', !!rec.data?.siteName, rec.data?.siteName ?? '');
  for (const r of recipients) {
    console.log(
      `      ${r.suggested ? '[x]' : '[ ]'} ${r.email.padEnd(26)} ${r.roleLabel.padEnd(18)} ${r.group.padEnd(10)} ${r.note}`,
    );
  }
  const offSite = recipients.filter((r) => r.group === 'other-site');
  check(
    'users off this site are never pre-ticked',
    offSite.every((r) => !r.suggested),
    offSite.length ? `${offSite.length} off-site user(s)` : 'none on this account',
  );

  const bad = await api('POST', `/submissions/${target.id}/compliance/email`, {
    ...docs,
    recipientEmails: ['stranger@example.com'],
  });
  check(
    'rejects an address that is not a recipient on the request',
    bad.status === 400 && /not a recipient/i.test(bad.data?.message ?? ''),
    `status ${bad.status} ${bad.data?.message ?? ''}`,
  );

  const none = await api('POST', `/submissions/${target.id}/compliance/email`, {
    ...docs,
    recipientEmails: [],
  });
  check(
    'refuses an empty selection',
    none.status === 400 && /at least one recipient/i.test(none.data?.message ?? ''),
    `status ${none.status} ${none.data?.message ?? ''}`,
  );

  if (DO_SEND) {
    const pick = recipients.filter((r) => r.suggested).map((r) => r.email).slice(0, 1);
    const sent = await api('POST', `/submissions/${target.id}/compliance/email`, {
      ...docs,
      recipientEmails: pick,
    });
    check(
      'sends only to the chosen recipient',
      sent.status === 200 && sent.data?.sent === pick.length,
      JSON.stringify(sent.data),
    );
    check(
      'reports who was left out',
      Array.isArray(sent.data?.notSent),
      `${sent.data?.notSent?.length ?? 0} not sent`,
    );
  } else {
    console.log('\n(skipped the real send — pass --send to queue an email)');
  }

  console.log(`\n${failures ? `${failures} check(s) failed` : 'All checks passed'}`);
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
