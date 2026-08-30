import { gstinError, normalizeGstin, panFromGstin } from '@urb-tectrack/shared';
import { AppError } from '../lib/errors.js';

const GST_PORTAL =
  process.env.GST_LOOKUP_PORTAL_URL?.trim() ||
  'https://services.gst.gov.in/services/api/search/taxpayerDetails';
const CUSTOM_LOOKUP = process.env.GST_LOOKUP_URL?.trim() || '';
const TIMEOUT_MS = Number(process.env.GST_LOOKUP_TIMEOUT_MS ?? 12_000);

export interface GstLookupAddress {
  line: string;
  city: string;
  state: string;
  pin: string;
}

export interface GstLookupResult {
  gstin: string;
  validFormat: true;
  pan: string | null;
  lookedUp: boolean;
  source: 'gst_portal' | 'custom' | 'format_only';
  message?: string;
  legalName?: string;
  tradeName?: string | null;
  status?: string;
  address?: GstLookupAddress | null;
}

type PortalRaw = {
  lgnm?: string;
  tradeNam?: string;
  sts?: string;
  errorCode?: string;
  pradr?: {
    bnm?: string;
    bno?: string;
    st?: string;
    loc?: string;
    dst?: string;
    stcd?: string;
    pncd?: string;
    addr?: {
      bnm?: string;
      bno?: string;
      st?: string;
      loc?: string;
      dst?: string;
      stcd?: string;
      pncd?: string;
    };
  } | null;
};

const STATUS: Record<string, string> = {
  ACT: 'Active',
  CNL: 'Cancelled',
  SUS: 'Suspended',
};

function formatAddress(pradr: PortalRaw['pradr']): GstLookupAddress | null {
  if (!pradr) return null;
  const a = pradr.addr ?? pradr;
  const parts = [a.bnm, a.bno, a.st, a.loc, a.dst, a.stcd].filter(Boolean);
  if (!parts.length && !a.pncd) return null;
  return {
    line: parts.join(', '),
    city: String(a.loc || a.dst || '').trim(),
    state: String(a.stcd || '').trim(),
    pin: String(a.pncd || '').trim(),
  };
}

async function fetchJson(url: string): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'UrbTecTrack/1.0 (GSTIN lookup)',
      },
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function fromPortal(gstin: string, data: PortalRaw): GstLookupResult | null {
  if (data.errorCode || !data.lgnm) return null;
  return {
    gstin,
    validFormat: true,
    pan: panFromGstin(gstin),
    lookedUp: true,
    source: 'gst_portal',
    legalName: data.lgnm,
    tradeName: data.tradeNam || null,
    status: STATUS[data.sts ?? ''] ?? data.sts ?? 'Unknown',
    address: formatAddress(data.pradr),
  };
}

function fromCustom(gstin: string, data: Record<string, unknown>): GstLookupResult | null {
  const legalName = String(data.legalName ?? data.lgnm ?? data.legal_name ?? '').trim();
  if (!legalName) return null;
  const addr = (data.address ?? data.pradr) as Record<string, unknown> | string | null | undefined;
  let address: GstLookupAddress | null = null;
  if (typeof addr === 'string' && addr.trim()) {
    address = { line: addr.trim(), city: String(data.city ?? ''), state: String(data.state ?? ''), pin: String(data.pin ?? data.pncd ?? '') };
  } else if (addr && typeof addr === 'object') {
    address = formatAddress(addr as PortalRaw['pradr']);
  }
  return {
    gstin,
    validFormat: true,
    pan: panFromGstin(gstin),
    lookedUp: true,
    source: 'custom',
    legalName,
    tradeName: (data.tradeName ?? data.tradeNam ?? data.trade_name ?? null) as string | null,
    status: String(data.status ?? data.sts ?? 'Unknown'),
    address,
  };
}

/**
 * Validate GSTIN format, then attempt an open taxpayer lookup.
 * Official GST portal search normally uses CAPTCHA in the browser; a public
 * JSON endpoint is tried best-effort for UAT. Set GST_LOOKUP_URL to a GSP /
 * certified provider for production-grade lookups.
 */
export async function lookupGstin(raw: string): Promise<GstLookupResult> {
  const gstin = normalizeGstin(raw);
  const formatErr = gstinError(gstin);
  if (formatErr) throw new AppError(formatErr, 400);

  const formatOnly = (): GstLookupResult => ({
    gstin,
    validFormat: true,
    pan: panFromGstin(gstin),
    lookedUp: false,
    source: 'format_only',
    message:
      'GSTIN format is valid. Live taxpayer lookup was unavailable — enter address details manually, or configure GST_LOOKUP_URL for a certified provider.',
  });

  if (CUSTOM_LOOKUP) {
    try {
      const url = CUSTOM_LOOKUP.includes('{gstin}')
        ? CUSTOM_LOOKUP.replace('{gstin}', encodeURIComponent(gstin))
        : `${CUSTOM_LOOKUP.replace(/\/$/, '')}/${encodeURIComponent(gstin)}`;
      const data = (await fetchJson(url)) as Record<string, unknown>;
      const mapped = fromCustom(gstin, data);
      if (mapped) return mapped;
    } catch {
      /* fall through to portal */
    }
  }

  try {
    const data = (await fetchJson(`${GST_PORTAL.replace(/\/$/, '')}/${encodeURIComponent(gstin)}`)) as PortalRaw;
    const mapped = fromPortal(gstin, data);
    if (mapped) return mapped;
  } catch {
    /* portal often blocks or requires captcha session */
  }

  return formatOnly();
}
