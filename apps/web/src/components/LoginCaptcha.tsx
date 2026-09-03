import { useCallback, useEffect, useRef, useState } from 'react';
import { authApi } from '../api';

export type CaptchaPayload = {
  turnstileToken?: string;
  challengeToken?: string;
  challengeAnswer?: string;
};

type CaptchaState =
  | { provider: 'none'; required: false }
  | { provider: 'turnstile'; required: true; siteKey: string }
  | { provider: 'challenge'; required: true; challengeToken: string; question: string };

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: {
          sitekey: string;
          callback: (token: string) => void;
          'expired-callback'?: () => void;
          'error-callback'?: () => void;
          theme?: 'light' | 'dark' | 'auto';
        },
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

let turnstileScriptPromise: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (turnstileScriptPromise) return turnstileScriptPromise;
  turnstileScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-turnstile]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Turnstile failed to load')));
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.dataset.turnstile = '1';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Turnstile failed to load'));
    document.head.appendChild(s);
  });
  return turnstileScriptPromise;
}

interface LoginCaptchaProps {
  /** Bump to force a fresh challenge (e.g. after failed login). */
  refreshKey?: number;
  onChange: (payload: CaptchaPayload | null, ready: boolean) => void;
}

export function LoginCaptcha({ refreshKey = 0, onChange }: LoginCaptchaProps) {
  const [state, setState] = useState<CaptchaState | null>(null);
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');
  const widgetRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const turnstileTokenRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    setError('');
    setAnswer('');
    turnstileTokenRef.current = null;
    onChange(null, false);
    try {
      const cfg = await authApi.captcha();
      if (cfg.provider === 'none' || !cfg.required) {
        setState({ provider: 'none', required: false });
        onChange({}, true);
        return;
      }
      if (cfg.provider === 'turnstile' && cfg.siteKey) {
        setState({ provider: 'turnstile', required: true, siteKey: cfg.siteKey });
        return;
      }
      if (cfg.provider === 'challenge' && cfg.challengeToken && cfg.question) {
        setState({
          provider: 'challenge',
          required: true,
          challengeToken: cfg.challengeToken,
          question: cfg.question,
        });
        onChange({ challengeToken: cfg.challengeToken, challengeAnswer: '' }, false);
        return;
      }
      setState({ provider: 'none', required: false });
      onChange({}, true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load security check');
      setState({ provider: 'none', required: false });
      onChange({}, true);
    }
  }, [onChange]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  useEffect(() => {
    if (state?.provider !== 'turnstile' || !widgetRef.current) return;
    let cancelled = false;
    void loadTurnstileScript()
      .then(() => {
        if (cancelled || !widgetRef.current || !window.turnstile) return;
        if (widgetIdRef.current) {
          try {
            window.turnstile.remove(widgetIdRef.current);
          } catch {
            /* ignore */
          }
          widgetIdRef.current = null;
        }
        widgetIdRef.current = window.turnstile.render(widgetRef.current, {
          sitekey: state.siteKey,
          callback: (token) => {
            turnstileTokenRef.current = token;
            onChange({ turnstileToken: token }, true);
          },
          'expired-callback': () => {
            turnstileTokenRef.current = null;
            onChange(null, false);
          },
          'error-callback': () => {
            turnstileTokenRef.current = null;
            onChange(null, false);
          },
          theme: 'light',
        });
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Security widget failed'));
    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          /* ignore */
        }
        widgetIdRef.current = null;
      }
    };
  }, [state, onChange]);

  if (!state || state.provider === 'none') {
    return error ? <p className="error">{error}</p> : null;
  }

  if (state.provider === 'turnstile') {
    return (
      <div className="fg" style={{ marginTop: '.2rem' }}>
        <label>Security check</label>
        <div ref={widgetRef} />
        {error ? <p className="error">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="fg" style={{ marginTop: '.2rem' }}>
      <label htmlFor="li-captcha">{state.question}</label>
      <div style={{ display: 'flex', gap: '.4rem', alignItems: 'center' }}>
        <input
          id="li-captcha"
          className="mono"
          inputMode="numeric"
          autoComplete="off"
          value={answer}
          onChange={(e) => {
            const v = e.target.value.replace(/[^\d]/g, '').slice(0, 3);
            setAnswer(v);
            onChange(
              { challengeToken: state.challengeToken, challengeAnswer: v },
              v.length > 0,
            );
          }}
          placeholder="Answer"
          style={{ maxWidth: 120 }}
          required
        />
        <button
          type="button"
          className="btn bs bsm"
          onClick={() => void load()}
          title="New question"
        >
          Refresh
        </button>
      </div>
      <p className="dim" style={{ fontSize: '.72rem', marginTop: '.25rem' }}>
        Helps block automated sign-in attempts.
      </p>
      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}
