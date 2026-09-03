/** Shared HTTP security / caching helpers for the API + SPA shell. */

export function isSecureDeployment(): boolean {
  const env = process.env.NODE_ENV;
  return (
    process.env.COOKIE_SECURE === 'true' ||
    env === 'production' ||
    env === 'uat'
  );
}

/** ASCII-safe Content-Disposition value (avoids ERR_INVALID_CHAR from raw filenames). */
export function contentDisposition(type: 'inline' | 'attachment', filename: string): string {
  const base = String(filename || 'download')
    .replace(/[\\/"]/g, '_')
    .replace(/[^\x20-\x7E]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
  const safe = base || 'download';
  return `${type}; filename="${safe}"`;
}

export const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https://challenges.cloudflare.com",
    "frame-src 'self' https://challenges.cloudflare.com",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '),
};

export const HSTS_HEADER = 'max-age=63072000; includeSubDomains; preload';

/** Cache-Control for SPA HTML shell — never store; always revalidate after deploy. */
export const HTML_CACHE_CONTROL = 'no-cache, no-store, must-revalidate';

/** Cache-Control for content-hashed build assets. */
export const ASSET_CACHE_CONTROL = 'public, max-age=31536000, immutable';

export function cacheControlForPath(filePath: string): string | null {
  const normalized = filePath.replace(/\\/g, '/');
  if (normalized.endsWith('.html') || /\/index\.html$/i.test(normalized)) {
    return HTML_CACHE_CONTROL;
  }
  // Vite hashed assets live under /assets/ or include a content hash in the name.
  if (
    /\/assets\//i.test(normalized) ||
    /\.[a-f0-9]{8,}\.(js|css|map|woff2?|ttf|otf|png|jpe?g|svg|webp)$/i.test(normalized)
  ) {
    return ASSET_CACHE_CONTROL;
  }
  return null;
}
