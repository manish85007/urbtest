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

export interface ClientSummary {
  id: string;
  name: string;
  city: string | null;
}

export interface SiteSummary {
  id: string;
  code: string;
  name: string;
  address: string | null;
}

export interface FactorySummary {
  id: string;
  name: string;
}

export interface SubmissionSummary {
  id: string;
  clientId: string;
  clientName: string;
  siteId: string;
  siteName: string;
  requestDate: string;
  approxWeight: string;
  stage: number;
  invoiceCount: number;
}

export interface VehicleDetail {
  id: string;
  registration: string;
  vehicleType: string;
  driverName: string;
  driverPhone: string;
  team: Array<{ name: string; role: string; phone: string }>;
  weighment: {
    netKg: string;
    manual: boolean;
    slipNumber: string | null;
  } | null;
}

export interface InvoiceDetail {
  id: string;
  invoiceNo: string;
  billingWeight: string;
  totalPaise: string;
  derivedStage: number;
  closedAt: string | null;
  mrn: { mrnNo: string } | null;
  recycling: { form6No: string } | null;
  certificates: Array<{ certNo: string }>;
  payments: Array<{ amountPaise: string }>;
}

export interface SubmissionDetail {
  id: string;
  clientId: string;
  siteId: string;
  ref: string | null;
  requestDate: string;
  location: string | null;
  approxQty: number;
  approxWeight: string;
  notes: string | null;
  createdBy: string;
  acknowledgedAt: string | null;
  derivedStage: number;
  client: { id: string; name: string };
  site: { id: string; name: string; code: string };
  vehicles: VehicleDetail[];
  invoices: InvoiceDetail[];
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

export const dataApi = {
  submissions: () => api<SubmissionSummary[]>('/submissions'),
  submission: (id: string) => api<SubmissionDetail>(`/submissions/${id}`),
  dashboard: () =>
    api<{ openRequests: number; openInvoices: number; activeClients: number }>(
      '/health/dashboard',
    ),
  clients: () => api<ClientSummary[]>('/clients'),
  sites: (clientId: string) => api<SiteSummary[]>(`/clients/${clientId}/sites`),
  factories: () => api<FactorySummary[]>('/factories'),
};

export const lifecycleApi = {
  createSubmission: (body: {
    clientId: string;
    siteId: string;
    requestDate: string;
    location?: string;
    approxQty?: number;
    approxWeight?: number;
    notes?: string;
    ref?: string;
  }) => api<SubmissionDetail>('/submissions', { method: 'POST', body: JSON.stringify(body) }),

  acknowledge: (id: string) =>
    api<SubmissionDetail>(`/submissions/${id}/acknowledge`, { method: 'POST' }),

  reject: (id: string, reason: string) =>
    api<SubmissionDetail>(`/submissions/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  addVehicle: (
    submissionId: string,
    body: {
      registration: string;
      vehicleType: string;
      driverName: string;
      driverPhone: string;
      team: Array<{ name: string; role: string; phone: string }>;
    },
  ) =>
    api<{ submission: SubmissionDetail }>(`/submissions/${submissionId}/vehicles`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  weigh: (
    vehicleId: string,
    body: {
      manual?: boolean;
      gross?: number;
      tare?: number;
      net?: number;
      slipNumber?: string;
      reason?: string;
      weighedAt: string;
      slipPhotoIds?: string[];
      pickupPhotoIds?: string[];
    },
  ) =>
    api<{ submission: SubmissionDetail }>(`/vehicles/${vehicleId}/weighment`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  createInvoice: (
    submissionId: string,
    body: {
      invoiceNo: string;
      invoiceDate: string;
      taxableAmount: number;
      ewayBillNo: string;
      ewayBillDate: string;
      vehicleIds?: string[];
      billingWeight?: number;
      deviationNote?: string;
    },
  ) =>
    api<SubmissionDetail>(`/submissions/${submissionId}/invoices`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  addPayment: (invoiceId: string, body: { utr: string; amount: number; paidAt: string; mode: string }) =>
    api<unknown>(`/invoices/${invoiceId}/payments`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};
