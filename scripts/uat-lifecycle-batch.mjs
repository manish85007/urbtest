#!/usr/bin/env node
/**
 * Full lifecycle batch test — Local UAT (or BASE env).
 * Creates 10 requests across clients, runs stages 1–9 via API, verifies emails.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BASE = process.env.BASE ?? 'http://localhost:8080';
const PHOTO = path.join(ROOT, 'apps/web/e2e/fixtures/sample.jpg');
const PDF = path.join(ROOT, 'apps/web/e2e/fixtures/sample.pdf');

const SAMPLES = [
  { label: 'TCPL client direct', clientId: 'TCPL', siteIdx: 0, creator: 'ramesh@techcorp.in', onBehalfOf: null, kg: 55, qty: 12 },
  { label: 'TCPL client priya', clientId: 'TCPL', siteIdx: 0, creator: 'priya@techcorp.in', onBehalfOf: null, kg: 80, qty: 20 },
  { label: 'TCPL admin→ramesh', clientId: 'TCPL', siteIdx: 0, creator: 'admin@urbeno.in', onBehalfOf: 'ramesh@techcorp.in', kg: 65, qty: 15 },
  { label: 'INFR client meera', clientId: 'INFR', siteIdx: 0, creator: 'meera@infosoft.in', onBehalfOf: null, kg: 120, qty: 40 },
  { label: 'INFR admin→meera', clientId: 'INFR', siteIdx: 0, creator: 'admin@urbeno.in', onBehalfOf: 'meera@infosoft.in', kg: 95, qty: 30 },
  { label: 'BHRT client anand', clientId: 'BHRT', siteIdx: 0, creator: 'anand@bharatretail.in', onBehalfOf: null, kg: 45, qty: 10 },
  { label: 'BHRT admin→anand', clientId: 'BHRT', siteIdx: 0, creator: 'admin@urbeno.in', onBehalfOf: 'anand@bharatretail.in', kg: 70, qty: 18 },
  { label: 'TCPL admin→priya GTV', clientId: 'TCPL', siteIdx: 1, creator: 'admin@urbeno.in', onBehalfOf: 'priya@techcorp.in', kg: 90, qty: 25 },
  { label: 'TCPL client ramesh GTV', clientId: 'TCPL', siteIdx: 1, creator: 'ramesh@techcorp.in', onBehalfOf: null, kg: 110, qty: 35 },
  { label: 'BHRT client anand #2', clientId: 'BHRT', siteIdx: 0, creator: 'anand@bharatretail.in', onBehalfOf: null, kg: 60, qty: 14 },
];

const SITE_CACHE = {};
const EMAIL_CHECKS = [
  'request_new_client',
  'request_ack',
  'vehicle_assigned',
  'loading_complete',
  'invoice_generated',
  'mrn_generated',
  'recycling_form6',
  'cod_generated',
  'request_closed',
];

function todayYmd() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}

function clientEmail(sub) {
  return sub.onBehalfOf?.trim() || sub.createdBy;
}

class Api {
  #cookies = [];

  #mergeCookies(res) {
    const set = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
    for (const raw of set) {
      const part = raw.split(';')[0];
      const name = part.split('=')[0];
      this.#cookies = this.#cookies.filter((c) => !c.startsWith(`${name}=`));
      this.#cookies.push(part);
    }
  }

  async login(email) {
    const res = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'demo' }),
    });
    this.#mergeCookies(res);
    const body = await res.json();
    if (!res.ok) throw new Error(`Login ${email}: ${body.message ?? res.status}`);
    return body;
  }

  async request(method, urlPath, body) {
    const headers = { Cookie: this.#cookies.join('; ') };
    let payload;
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    const res = await fetch(`${BASE}${urlPath}`, { method, headers, body: payload });
    this.#mergeCookies(res);
    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    if (!res.ok) {
      const msg = data?.message ?? text ?? res.statusText;
      throw new Error(`${method} ${urlPath}: ${msg}`);
    }
    return data;
  }

  get(urlPath) {
    return this.request('GET', urlPath);
  }
  post(urlPath, body = {}) {
    return this.request('POST', urlPath, body);
  }

  async upload(kind, filePath) {
    const buf = fs.readFileSync(filePath);
    const name = path.basename(filePath);
    const blob = new Blob([buf], { type: filePath.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg' });
    const form = new FormData();
    form.append('file', blob, name);
    form.append('kind', kind);
    const res = await fetch(`${BASE}/files?kind=${kind}`, {
      method: 'POST',
      headers: { Cookie: this.#cookies.join('; ') },
      body: form,
    });
    this.#mergeCookies(res);
    const data = await res.json();
    if (!res.ok) throw new Error(`Upload ${kind}: ${data.message ?? res.status}`);
    return data.id;
  }
}

async function siteId(api, clientId, siteIdx) {
  if (!SITE_CACHE[clientId]) {
    SITE_CACHE[clientId] = await api.get(`/clients/${clientId}/sites`);
  }
  const sites = SITE_CACHE[clientId];
  if (!sites[siteIdx]) throw new Error(`No site index ${siteIdx} for ${clientId}`);
  return sites[siteIdx].id;
}

async function runSample(sample, idx) {
  const uniq = `${Date.now()}${idx}`.slice(-8);
  const api = new Api();
  const today = todayYmd();
  const clientRecipient = sample.onBehalfOf ?? sample.creator;

  console.log(`\n[${idx + 1}/10] ${sample.label}`);

  await api.login(sample.creator);
  const site = await siteId(api, sample.clientId, sample.siteIdx);
  const createBody = {
    clientId: sample.clientId,
    siteId: site,
    requestDate: today,
    location: `Batch test bay ${uniq}`,
    approxQty: sample.qty,
    approxWeight: sample.kg,
    items: [{ name: `Mixed e-waste ${uniq}`, qty: sample.qty, weightKg: sample.kg }],
    notes: `UAT batch ${idx + 1}: ${sample.label}`,
  };
  if (sample.onBehalfOf) createBody.onBehalfOf = sample.onBehalfOf;

  const sub = await api.post('/submissions', createBody);
  console.log(`  created ${sub.id} stage=${sub.derivedStage}`);

  await api.login('ops@urbeno.in');
  await api.post(`/submissions/${sub.id}/acknowledge`);
  console.log('  acknowledged');

  const reg = `KA${uniq}`.slice(0, 10);
  await api.post(`/submissions/${sub.id}/vehicles`, {
    registration: reg,
    vehicleType: 'VT2',
    driverName: 'Batch Driver',
    driverPhone: '9900112233',
    team: [],
  });
  console.log('  vehicle assigned');

  const refreshed = await api.get(`/submissions/${sub.id}`);
  const vehicleId = refreshed.vehicles[0].id;

  await api.login('ops@urbeno.in');
  const slipId = await api.upload('weighPhoto', PHOTO);
  const pickId = await api.upload('pickPhoto', PHOTO);
  const gross = sample.kg + 100;
  const tare = 100;
  await api.post(`/vehicles/${vehicleId}/weighment`, {
    manual: false,
    gross,
    tare,
    slipNumber: `WB-${uniq}`,
    weighedAt: `${today}T10:00:00`,
    slipPhotoIds: [slipId],
    pickupPhotoIds: [pickId],
  });
  console.log('  weighment recorded');

  await api.post(`/submissions/${sub.id}/loading-complete`);
  console.log('  loading complete');

  await api.login('admin@urbeno.in');
  const invFile = await api.upload('invoice', PDF);
  const ewayFile = await api.upload('eway', PDF);
  const taxable = 5000 + idx * 100;
  const taxRate = 18;
  const total = Math.round(taxable * (1 + taxRate / 100));
  const invNo = `INV-B${uniq}`;
  await api.post(`/submissions/${sub.id}/invoices`, {
    invoiceNo: invNo,
    invoiceDate: today,
    taxableAmount: taxable,
    taxRatePct: taxRate,
    billingWeight: sample.kg,
    ewayBillNo: `EWB-${uniq}`,
    ewayBillDate: today,
    invoiceFileIds: [invFile],
    ewayFileIds: [ewayFile],
    vehicleIds: [vehicleId],
  });
  console.log('  invoice created');

  const afterInv = await api.get(`/submissions/${sub.id}`);
  const invoice = afterInv.invoices.find((i) => i.invoiceNo === invNo);
  if (!invoice) throw new Error('Invoice not found after create');

  await api.login('blr@urbeno.in');
  const gateId = await api.upload('pickPhoto', PHOTO);
  const matId = await api.upload('processing', PHOTO);
  await api.post(`/invoices/${invoice.id}/mrn`, {
    factoryId: 'URB-BLR',
    receivedAt: `${today}T14:00:00`,
    driverSign: 'Driver',
    managerSign: 'Manager',
    securitySign: 'Security',
    materials: [{ name: 'Mixed e-waste', qty: sample.qty, weight: sample.kg }],
    gatePhotoIds: [gateId],
    materialPhotoIds: [matId],
  });
  console.log('  MRN created');

  await api.post(`/invoices/${invoice.id}/recycling`, {
    processedAt: `${today}T16:00:00`,
    categories: [{ entryId: 'REC-ITEW1', groupCode: 'ITEW', weightKg: sample.kg }],
    vehicleIds: [vehicleId],
  });
  console.log('  Form 6 issued');

  await api.login('admin@urbeno.in');
  const certFile = await api.upload('certificate', PDF);
  await api.post(`/invoices/${invoice.id}/certificate`, {
    certNo: `COD-${uniq}`,
    certDate: today,
    fileId: certFile,
  });
  console.log('  COD uploaded');

  await api.post(`/invoices/${invoice.id}/payments`, {
    utr: `UTR-${uniq}`,
    amount: total,
    paidAt: today,
    mode: 'NEFT',
  });
  console.log('  payment recorded');

  await api.login(clientRecipient);
  await api.post(`/invoices/${invoice.id}/close`, { rating: 5 });
  console.log('  closed by client');

  const closed = await api.get(`/submissions/${sub.id}`);
  if (!closed.closedAt) throw new Error('Submission not closed');
  if (closed.derivedStage !== 9) throw new Error(`Expected stage 9, got ${closed.derivedStage}`);

  return { subId: sub.id, invNo, clientRecipient, invoiceId: invoice.id };
}

async function verifyEmails(api, subId, clientRecipient) {
  await api.login('admin@urbeno.in');
  const outbox = await api.get('/emails/outbox?limit=200');
  const forSub = outbox.filter((e) => {
    const vars = e.subject + (e.body ?? '');
    return vars.includes(subId);
  });
  const missing = [];
  for (const key of EMAIL_CHECKS) {
    const hit = forSub.some((e) => e.templateKey === key);
    if (!hit) missing.push(key);
    else {
      const row = forSub.find((e) => e.templateKey === key);
      if (key !== 'request_new_admin' && !row.to.some((t) => t.toLowerCase() === clientRecipient.toLowerCase())) {
        missing.push(`${key}(wrong recipient: ${row.to.join(',')})`);
      }
    }
  }
  return missing;
}

async function main() {
  if (!fs.existsSync(PHOTO) || !fs.existsSync(PDF)) {
    console.error('Missing test fixtures');
    process.exit(1);
  }

  console.log(`UAT lifecycle batch — ${BASE}`);
  const results = [];
  let lastSub = null;

  for (let i = 0; i < SAMPLES.length; i++) {
    try {
      const r = await runSample(SAMPLES[i], i);
      results.push({ ok: true, ...r, label: SAMPLES[i].label });
      lastSub = r;
    } catch (err) {
      console.error(`  FAILED: ${err.message}`);
      results.push({ ok: false, label: SAMPLES[i].label, error: err.message });
    }
  }

  if (lastSub) {
    const api = new Api();
    const missing = await verifyEmails(api, lastSub.subId, lastSub.clientRecipient);
    if (missing.length) {
      console.error(`\nEmail gaps for ${lastSub.subId}: ${missing.join(', ')}`);
      results.push({ ok: false, label: 'email-check', error: missing.join(', ') });
    } else {
      console.log(`\nAll 9 milestone emails verified for ${lastSub.subId} → ${lastSub.clientRecipient}`);
    }
  }

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  console.log(`\n======== SUMMARY ========`);
  console.log(`Passed: ${passed}/${SAMPLES.length}`);
  for (const f of failed) {
    console.log(`  ✗ ${f.label}: ${f.error}`);
  }
  for (const r of results.filter((x) => x.ok && x.subId)) {
    console.log(`  ✓ ${r.label} → ${r.subId}`);
  }

  if (failed.length) process.exit(1);
  console.log('\nAll batch lifecycle tests passed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
