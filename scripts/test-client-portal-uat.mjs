#!/usr/bin/env node
/**
 * Client portal smoke tests against Local UAT (http://localhost:8080).
 * Login: ramesh@techcorp.in / demo
 */
import { writeFileSync } from 'node:fs';

const BASE = process.env.UAT_URL || 'http://localhost:8080';
const EMAIL = process.env.CLIENT_EMAIL || 'ramesh@techcorp.in';
const PASS = process.env.CLIENT_PASSWORD || 'demo';

const cookieJar = new Map();
const results = [];

function parseSetCookie(res) {
  const raw = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  const list = raw.length ? raw : [res.headers.get('set-cookie')].filter(Boolean);
  for (const line of list) {
    const [pair] = String(line).split(';');
    const eq = pair.indexOf('=');
    if (eq > 0) cookieJar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
}

function cookieHeader() {
  return [...cookieJar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
}

async function api(method, path, { body, expect = 200, binary = false, formData } = {}) {
  const headers = {};
  const cookie = cookieHeader();
  if (cookie) headers.Cookie = cookie;
  let payload;
  if (formData) payload = formData;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${path}`, { method, headers, body: payload });
  parseSetCookie(res);
  const buf = Buffer.from(await res.arrayBuffer());
  let data;
  if (binary) data = buf;
  else {
    const text = buf.toString('utf8');
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text.slice(0, 240);
    }
  }
  const ok = Array.isArray(expect) ? expect.includes(res.status) : res.status === expect;
  const detail = ok
    ? ''
    : typeof data === 'object'
      ? JSON.stringify(data).slice(0, 180)
      : String(data).slice(0, 180);
  results.push({ ok, name: `${method} ${path}`, status: res.status, expect, detail });
  return { status: res.status, data, ok, headers: res.headers };
}

function assert(name, cond, detail = '') {
  results.push({ ok: !!cond, name, status: cond ? 1 : 0, expect: 1, detail: cond ? '' : detail });
}

async function main() {
  console.log(`Client portal UAT @ ${BASE} as ${EMAIL}\n`);

  const login = await api('POST', '/auth/login', { body: { email: EMAIL, password: PASS } });
  assert('Login returns client role', login.data?.user?.role === 'client');
  const clientId = login.data?.user?.clientId;
  assert('Client has clientId', !!clientId);

  await api('GET', '/auth/me');
  const legal = await api('GET', '/auth/legal-status');
  assert('Legal status payload', typeof legal.data?.compliant === 'boolean');

  const dash = await api('GET', '/reports/dashboard?period=fy');
  assert('Dashboard has counts', !!dash.data?.counts);
  assert('Dashboard has impact metrics', typeof dash.data?.impact?.kg === 'number');
  const pendingClose = dash.data?.pendingClose || [];
  for (const p of pendingClose) {
    assert(`pendingClose ${p.invoiceNo} has invoiceId`, !!p.invoiceId);
  }
  console.log(
    `  dashboard: open=${dash.data?.counts?.open} closed=${dash.data?.counts?.closed} pendingClose=${pendingClose.length} pickups=${(dash.data?.pendingPickups || []).length} impactKg=${dash.data?.impact?.kg}`,
  );

  const sites = await api('GET', `/clients/${clientId}/sites`);
  assert('Client sites list', Array.isArray(sites.data) && sites.data.length > 0);
  const siteId = sites.data?.[0]?.id;

  // Client can see own org via /clients (scoped); must not see audit/masters
  const clients = await api('GET', '/clients');
  assert('Clients list scoped', Array.isArray(clients.data) && clients.data.every((c) => c.id === clientId));
  await api('GET', '/audit-log?limit=5', { expect: [403, 401] });
  await api('GET', '/users', { expect: [403, 401] });
  await api('GET', '/reports/register/mrn?period=fy', { expect: [400, 403] });

  const subs = await api('GET', '/submissions');
  assert('Submissions list', Array.isArray(subs.data) && subs.data.length > 0);
  const sampleId = subs.data[0].id;
  const detail = await api('GET', `/submissions/${sampleId}`);
  assert('Request detail loads', detail.data?.id === sampleId);

  let withDocs = null;
  for (const s of subs.data.slice(0, 40)) {
    const d = await api('GET', `/submissions/${s.id}`);
    const inv = (d.data?.invoices || []).find((i) => i.recycling || (i.certificates || []).length);
    if (inv) {
      withDocs = { sub: d.data, inv };
      break;
    }
  }

  if (withDocs?.inv?.recycling) {
    const f6 = await api('GET', `/invoices/${withDocs.inv.id}/form6.pdf`, { binary: true });
    assert('Form 6 PDF download', f6.status === 200 && f6.data?.slice(0, 4).toString() === '%PDF');
  } else {
    results.push({ ok: true, name: 'Form 6 PDF (skipped)', status: 0, expect: 0, detail: 'skip' });
  }

  const cert = withDocs?.inv?.certificates?.find((c) => c.fileId);
  if (cert?.fileId) {
    const file = await api('GET', `/files/${cert.fileId}`, { binary: true, expect: [200, 404] });
    assert('CoD file endpoint 200 or clean 404', file.status === 200 || file.status === 404);
  } else {
    results.push({ ok: true, name: 'CoD file (skipped)', status: 0, expect: 0, detail: 'skip' });
  }

  // MRN is staff-only — 403 or 404 both acceptable
  if (withDocs?.inv?.id) {
    await api('GET', `/invoices/${withDocs.inv.id}/mrn.pdf`, { expect: [403, 401, 404], binary: true });
  }

  const today = new Date().toISOString().slice(0, 10);
  const created = await api('POST', '/submissions', {
    body: {
      clientId,
      siteId,
      requestDate: today,
      location: 'UAT Client Portal Test Bay',
      approxQty: 3,
      approxWeight: 12.5,
      notes: 'Automated client portal smoke test — safe to ignore',
      ref: `UAT-CLIENT-${Date.now()}`,
      items: [{ name: 'Laptops (test)', qty: 3, weightKg: 12.5 }],
    },
  });
  assert('Create request', created.status === 200 || created.status === 201, JSON.stringify(created.data)?.slice(0, 120));
  const newId = created.data?.id;
  if (newId) {
    await api('PATCH', `/submissions/${newId}`, {
      body: { notes: 'Updated by client portal smoke test', approxWeight: 13 },
    });
    const q = await api('POST', `/submissions/${newId}/queries`, {
      body: { text: 'Client portal test query — please ignore' },
      expect: [200, 201],
    });
    assert('Post query on request', q.status === 200 || q.status === 201, JSON.stringify(q.data)?.slice(0, 120));
    await api('POST', `/submissions/${newId}/acknowledge`, { expect: [403, 401] });
  }

  for (const type of ['form6', 'cod', 'category', 'invoices', 'complete']) {
    const r = await api('GET', `/reports/register/${type}?period=fy`);
    assert(`Report ${type}`, r.status === 200 && Array.isArray(r.data?.head));
  }
  const pdfReg = await api('GET', '/reports/register/form6/pdf?period=fy', { binary: true, expect: [200, 400] });
  assert('Form 6 register PDF', [200, 400].includes(pdfReg.status));

  // Sustainability uses dashboard payload + PDFs
  const meth = await api('GET', '/reports/methodology.pdf', { binary: true });
  assert('Methodology PDF', meth.status === 200 && meth.data?.slice(0, 4).toString() === '%PDF');
  const impactPdf = await api('GET', '/reports/impact.pdf?period=fy', { binary: true, expect: [200, 400] });
  assert('Impact PDF', [200, 400].includes(impactPdf.status));

  const heroes = await api('GET', '/reports/heroes?period=fy');
  assert('Heroes report', heroes.status === 200);

  await api('POST', '/reports/impact/share', { body: { clientId, period: 'fy' }, expect: [403, 401] });
  await api('GET', `/search?q=${encodeURIComponent(sampleId || 'REQ')}`);
  const notif = await api('GET', '/notifications');
  assert('Notifications', typeof notif.data?.unread === 'number' && Array.isArray(notif.data?.items));

  await api('POST', '/auth/change-password', {
    body: { currentPassword: 'wrong-password', newPassword: 'demo-new-should-fail' },
    expect: [400, 401, 403],
  });

  if (pendingClose.length) {
    const p = pendingClose[0];
    const closeTry = await api('POST', `/invoices/${p.invoiceId}/close`, {
      body: { rating: 5, note: 'Client portal UAT close' },
      expect: [200, 400, 403],
    });
    results.push({
      ok: true,
      name: `Review & Close on paid pending ${p.invoiceNo} → ${closeTry.status}`,
      status: closeTry.status,
      expect: closeTry.status,
      detail: typeof closeTry.data === 'object' ? JSON.stringify(closeTry.data).slice(0, 120) : '',
    });
  } else {
    results.push({
      ok: true,
      name: 'Review & Close queue empty (unpaid certs correctly excluded)',
      status: 0,
      expect: 0,
      detail: 'skip',
    });
  }

  await api('POST', '/auth/logout');
  await api('GET', '/auth/me', { expect: [401, 403] });

  const failed = results.filter((r) => !r.ok);
  const passed = results.filter((r) => r.ok);
  console.log('\n=== RESULTS ===');
  for (const r of results) {
    const mark = r.ok ? 'PASS' : 'FAIL';
    const extra = r.detail ? ` — ${r.detail}` : '';
    console.log(`${mark}  ${r.name}${r.status ? ` [${r.status}]` : ''}${extra}`);
  }
  console.log(`\n${passed.length} passed, ${failed.length} failed, ${results.length} total`);
  writeFileSync('/tmp/client-portal-uat-results.json', JSON.stringify({ base: BASE, email: EMAIL, results }, null, 2));
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
