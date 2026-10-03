import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, unknown>();

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    appSetting: {
      findUnique: vi.fn(async ({ where }: { where: { key: string } }) =>
        store.has(where.key) ? { key: where.key, value: store.get(where.key) } : null,
      ),
      upsert: vi.fn(async ({ where, create }: { where: { key: string }; create: { value: unknown } }) => {
        store.set(where.key, create.value);
      }),
    },
  },
}));

vi.mock('./settings.js', () => ({
  getSmtpSettings: vi.fn(async () => ({})),
  toSmtpConfig: vi.fn(() => null),
}));

const { recordEmailHealth } = await import('./email-health.js');

describe('recordEmailHealth', () => {
  beforeEach(() => {
    store.clear();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  it('keeps the original failingSince across repeated failures and clears it on recovery', async () => {
    const first = await recordEmailHealth(false, '535 5.7.8 BadCredentials', 'probe');
    expect(first.ok).toBe(false);
    expect(first.failingSince).toBeTruthy();

    await new Promise((r) => setTimeout(r, 5));
    const second = await recordEmailHealth(false, '535 5.7.8 BadCredentials', 'delivery');
    expect(second.failingSince).toBe(first.failingSince);

    const recovered = await recordEmailHealth(true, null, 'probe');
    expect(recovered.ok).toBe(true);
    expect(recovered.failingSince).toBeNull();
    expect(recovered.error).toBeNull();
    expect(recovered.lastOkAt).toBeTruthy();
  });

  it('emits a structured smtp_down alert log on failure', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await recordEmailHealth(false, '535 Username and Password not accepted', 'delivery');
    const payload = JSON.parse(String(spy.mock.calls.at(-1)?.[0]));
    expect(payload).toMatchObject({ severity: 'ERROR', alert: 'smtp_down', authFailure: true });
  });
});
