import { describe, expect, it } from 'vitest';
import {
  ASSET_CACHE_CONTROL,
  HTML_CACHE_CONTROL,
  cacheControlForPath,
  contentDisposition,
  isSecureDeployment,
} from './http-headers.js';

describe('contentDisposition', () => {
  it('strips quotes, slashes, and non-ascii characters', () => {
    expect(contentDisposition('inline', 'growth “photo”.jpg')).toBe('inline; filename="growth _photo_.jpg"');
    expect(contentDisposition('attachment', 'F6/2627/0001.pdf')).toBe('attachment; filename="F6_2627_0001.pdf"');
  });

  it('falls back when empty', () => {
    expect(contentDisposition('inline', '')).toBe('inline; filename="download"');
  });
});

describe('cacheControlForPath', () => {
  it('marks HTML as no-cache', () => {
    expect(cacheControlForPath('/app/apps/web/dist/index.html')).toBe(HTML_CACHE_CONTROL);
  });

  it('marks hashed assets as immutable', () => {
    expect(cacheControlForPath('/app/apps/web/dist/assets/index-Cg5B_VDI.js')).toBe(ASSET_CACHE_CONTROL);
    expect(cacheControlForPath('/app/apps/web/dist/assets/index-CTm75H5n.css')).toBe(ASSET_CACHE_CONTROL);
  });
});

describe('isSecureDeployment', () => {
  it('is true for uat / production / COOKIE_SECURE', () => {
    const prev = { ...process.env };
    try {
      process.env.NODE_ENV = 'uat';
      delete process.env.COOKIE_SECURE;
      expect(isSecureDeployment()).toBe(true);
      process.env.NODE_ENV = 'development';
      process.env.COOKIE_SECURE = 'true';
      expect(isSecureDeployment()).toBe(true);
    } finally {
      process.env.NODE_ENV = prev.NODE_ENV;
      if (prev.COOKIE_SECURE === undefined) delete process.env.COOKIE_SECURE;
      else process.env.COOKIE_SECURE = prev.COOKIE_SECURE;
    }
  });
});
