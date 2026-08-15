const base = import.meta.env.VITE_API_URL ?? '/api';

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? 'Request failed');
  }
  return res.json() as Promise<T>;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'factory' | 'client';
  clientId: string | null;
}

export const authApi = {
  login: (email: string, password: string) =>
    api<{ user: SessionUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  logout: () => api<{ ok: boolean }>('/auth/logout', { method: 'POST' }),
  me: () => api<{ user: SessionUser }>('/auth/me'),
};

export interface SubmissionSummary {
  id: string;
  clientId: string;
  clientName: string;
  siteName: string;
  requestDate: string;
  approxWeight: string;
  stage: number;
  invoiceCount: number;
}

export const dataApi = {
  submissions: () => api<SubmissionSummary[]>('/submissions'),
  dashboard: () =>
    api<{ openRequests: number; openInvoices: number; activeClients: number }>(
      '/health/dashboard',
    ),
};
