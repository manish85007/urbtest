const base = import.meta.env.VITE_API_URL ?? '/api';

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(`${base}${path}`, {
    credentials: 'include',
    ...init,
    headers,
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
  factoryIds?: string[];
  siteIds?: string[];
}

export type RegisterType = 'summary' | 'invoices' | 'mrn' | 'form6' | 'cod';

export interface CapacityReport {
  factoryId: string;
  fy: string;
  stats: {
    authorized: number;
    processed: number;
    utilization: number;
    atRisk: number;
  };
  entries: Array<{
    entryId: string;
    description: string;
    groupCode: string;
    activity: string;
    capacityTpa: string;
    usedKg: number;
    capKg: number;
    pct: number;
    atRisk: boolean;
    exceeded: boolean;
  }>;
  alerts: CapacityReport['entries'];
}

export interface HeroesReport {
  period: { fy: string; kind?: string; label?: string };
  impact: {
    kg: number;
    tonnes: number;
    co2: number;
    landfill: number;
    trees: number;
    water: number;
    energy: number;
    invoices: number;
    submissions: number;
  };
  treesEarned: number;
  treesPlanted: number;
  outstanding: number;
  plantings: Array<{
    id: string;
    trees: number;
    plantedAt: string;
    location: string | null;
    note: string | null;
    clientId: string | null;
    progress?: Array<{ id: string; notedAt: string; photoFileId: string; note: string | null }>;
  }>;
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

export interface CategorySummary {
  id: number;
  entryId: string;
  description: string;
  groupCode: string;
  capacityTpa: string;
}

export interface FactorySummary {
  id: string;
  name: string;
  city: string | null;
}

export interface SubmissionSummary {
  id: string;
  clientId: string;
  clientName: string;
  siteId: string;
  siteName: string;
  requestDate: string;
  approxWeight: string;
  ref?: string | null;
  stage: number;
  invoiceCount: number;
  invoices?: Array<{ invoiceNo: string; stage: number }>;
  netKg?: number;
}

export interface QueryThread {
  id: string;
  fromRole: string;
  authorName: string;
  authorEmail: string;
  stage: number;
  text: string;
  status: string;
  createdAt: string;
  replies: Array<{ id: string; authorName: string; text: string; createdAt: string }>;
}

export interface SerialRow {
  id: string;
  serialNo: string;
  assetTag: string | null;
  make: string | null;
  model: string | null;
  dcodNo: string | null;
  destroyStd: string | null;
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
  invoiceDate?: string;
  billingWeight: string;
  totalPaise: string;
  ewayBillNo?: string;
  derivedStage: number;
  closedAt: string | null;
  mrn: { mrnNo: string; factoryId: string; receivedAt?: string } | null;
  recycling: {
    form6No: string;
    processedAt?: string;
    serials?: SerialRow[];
    serialFileId?: string | null;
  } | null;
  certificates: Array<{
    certNo: string;
    certDate?: string;
    department?: string | null;
    fileId?: string;
    mailedAt?: string | null;
  }>;
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
  bomFileId?: string | null;
  rejectNote?: string | null;
  rejectAt?: string | null;
  createdBy: string;
  acknowledgedAt: string | null;
  derivedStage: number;
  client: { id: string; name: string };
  site: { id: string; name: string; code: string };
  vehicles: VehicleDetail[];
  invoices: InvoiceDetail[];
  queries?: QueryThread[];
}

export interface QueueItem {
  submissionId: string;
  invoiceId: string;
  invoiceNo: string;
  clientName: string;
}

export interface StaffDashboardReport {
  kind: 'staff';
  stats: {
    newRequests: number;
    openRequests: number;
    openInvoices: number;
    pendingPayments: number;
    fyNetKg: number;
    fyLabel: string;
  };
  newRequests: Array<{
    id: string;
    clientName: string;
    siteName: string;
    approxWeight: number;
    approxQty: number;
    requestDate: string;
    ref: string | null;
  }>;
  overdue: Array<{
    submissionId: string;
    invoiceNo: string;
    clientName: string;
    outstandingPaise: string;
    overdueDays: number;
    reminders: number;
  }>;
  slaAtRisk: Array<{
    submissionId: string;
    invoiceNo: string;
    clientName: string;
    receivedDate: string;
    daysUsed: number;
    slaDays: number;
    stateLabel: string;
  }>;
  queues: {
    awaitingMrn: QueueItem[];
    awaitingRecycling: QueueItem[];
    awaitingCod: QueueItem[];
    awaitingClose: QueueItem[];
  };
}

export interface ClientDashboardReport {
  kind: 'client';
  period: { fy: string; kind?: string; label?: string };
  impact: {
    kg: number;
    tonnes: number;
    co2: number;
    landfill: number;
    trees: number;
    water: number;
    energy: number;
    invoices: number;
    submissions: number;
  };
  treesEarned: number;
  pendingClose: Array<{
    submissionId: string;
    invoiceNo: string;
    certificates: string[];
    issuedAt: string | null;
  }>;
}

export type DashboardReport = StaffDashboardReport | ClientDashboardReport;

export const authApi = {
  login: (email: string, password: string) =>
    api<{ user: SessionUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  logout: () => api<{ ok: boolean }>('/auth/logout', { method: 'POST' }),
  me: () => api<{ user: SessionUser }>('/auth/me'),
  legalStatus: () =>
    api<{
      compliant: boolean;
      pending: Array<{ key: string; version: string; title: string }>;
    }>('/auth/legal-status'),
  acceptLegal: (keys: string[]) =>
    api<{ compliant: boolean }>('/auth/accept-legal', {
      method: 'POST',
      body: JSON.stringify({ keys }),
    }),
  changePassword: (currentPassword: string, newPassword: string) =>
    api<{ ok: boolean }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
  requestReset: (email: string) =>
    api<{ sent: true; demoCode?: string | null }>('/auth/reset/request', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  confirmReset: (email: string, code: string, newPassword: string) =>
    api<{ ok: boolean }>('/auth/reset', {
      method: 'POST',
      body: JSON.stringify({ email, code, newPassword }),
    }),
};

export type PeriodQuery = {
  period?: string;
  fy?: string;
  year?: string;
  from?: string;
  to?: string;
};

function qs(params: Record<string, string | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) p.set(k, v);
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}

export const legalApi = {
  list: () =>
    api<Array<{ key: string; version: string; title: string; effectiveDate: string }>>('/legal'),
  document: (key: string) =>
    api<{ key: string; version: string; title: string; body: string; effectiveDate: string }>(
      `/legal/${key}`,
    ),
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
  categories: (factoryId: string) =>
    api<CategorySummary[]>(`/factories/${factoryId}/categories`),
  reportsDashboard: (siteId?: string, period?: PeriodQuery) =>
    api<DashboardReport>(
      `/reports/dashboard${qs({ siteId, ...(period ?? {}) })}`,
    ),
  auditLog: (limit = 50, q?: string, entity?: string) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (q) params.set('q', q);
    if (entity) params.set('entity', entity);
    return api<Array<{
      id: string;
      ts: string;
      actorEmail: string;
      action: string;
      entity: string;
      entityId: string | null;
    }>>(`/audit?${params}`);
  },
  capacity: (factoryId: string) =>
    api<CapacityReport>(`/reports/capacity?factoryId=${encodeURIComponent(factoryId)}`),
  heroes: (period?: PeriodQuery) =>
    api<HeroesReport>(`/reports/heroes${qs(period ?? {})}`),
  register: (type: RegisterType, period?: PeriodQuery) =>
    api<Record<string, unknown>[]>(`/reports/register/${type}${qs(period ?? {})}`),
  lookups: (category: string) =>
    api<Array<{ id: string; category: string; label: string; active: boolean; rate?: number; description?: string }>>(
      `/lookups/${category}`,
    ),
  search: (q: string) =>
    api<Array<{ grp: string; label: string; sub: string; href: string }>>(
      `/search?q=${encodeURIComponent(q)}`,
    ),
  notifications: () =>
    api<{
      unread: number;
      items: Array<{ id: string; kind: string; text: string; link: string | null; read: boolean; createdAt: string }>;
    }>('/notifications'),
  markNotificationRead: (id: string) =>
    api<{ ok: boolean }>(`/notifications/${id}/read`, { method: 'POST' }),
  markAllNotificationsRead: () =>
    api<{ ok: boolean }>('/notifications/read-all', { method: 'POST' }),
  users: () =>
    api<
      Array<{
        id: string;
        email: string;
        name: string;
        role: string;
        clientId: string | null;
        factoryIds: string[];
        active: boolean;
      }>
    >('/users'),
  createClient: (body: {
    id: string;
    name: string;
    city?: string;
    contact?: string;
    phone?: string;
    email?: string;
  }) => api<{ id: string; name: string }>('/clients', { method: 'POST', body: JSON.stringify(body) }),
  createSite: (
    clientId: string,
    body: {
      code: string;
      name: string;
      address?: string;
      gstin?: string;
      contactName?: string;
      contactPhone?: string;
    },
  ) =>
    api<{ id: string; code: string; name: string }>(`/clients/${clientId}/sites`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  createUser: (body: {
    email: string;
    name: string;
    role: 'admin' | 'factory' | 'client';
    password?: string;
    clientId?: string | null;
    factoryIds?: string[];
    siteIds?: string[];
  }) => api<{ id: string; email: string }>('/users', { method: 'POST', body: JSON.stringify(body) }),
  upsertLookup: (body: { category: string; id: string; label: string }) =>
    api<unknown>('/lookups', { method: 'POST', body: JSON.stringify(body) }),
  recordPlanting: (body: {
    trees: number;
    plantedAt: string;
    location?: string;
    note?: string;
    clientId?: string;
  }) =>
    api<{ id: string }>('/reports/heroes/plantings', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  addTreeProgress: (
    plantingId: string,
    body: { notedAt: string; photoFileId: string; note?: string },
  ) =>
    api<{ id: string }>(`/trees/${plantingId}/progress`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateClient: (
    id: string,
    body: { name?: string; city?: string; payTermsDays?: number; active?: boolean },
  ) => api<unknown>(`/clients/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  updateSite: (id: string, body: { active?: boolean; name?: string }) =>
    api<unknown>(`/sites/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  upsertFactory: (body: { id: string; name: string; address?: string; gstin?: string }) =>
    api<unknown>('/factories', { method: 'POST', body: JSON.stringify(body) }),
  upsertCategory: (body: {
    factoryId: string;
    entryId: string;
    description: string;
    groupCode: string;
    capacityTpa: number;
  }) => api<unknown>('/categories', { method: 'POST', body: JSON.stringify(body) }),
};

export const adminApi = {
  runEmailQueue: () => api<{ processed: number; sent: number; failed: number }>('/admin/jobs/email-queue', { method: 'POST' }),
  runReminders: () =>
    api<{ reminders: unknown; email: { processed: number; sent: number; failed: number } }>(
      '/admin/jobs/reminders',
      { method: 'POST' },
    ),
};

export const emailsApi = {
  outbox: (limit = 50) =>
    api<Array<{ id: string; subject: string; status: string; createdAt: string; to: string[] }>>(
      `/emails/outbox?limit=${limit}`,
    ),
  templates: () =>
    api<
      Array<{
        id: string;
        key: string | null;
        name: string;
        subject: string;
        body: string;
        editable: boolean;
      }>
    >('/email-templates'),
  createTemplate: (body: { key: string; name: string; subject: string; body: string }) =>
    api<unknown>('/email-templates', { method: 'POST', body: JSON.stringify(body) }),
  updateTemplate: (key: string, body: { name?: string; subject?: string; body?: string }) =>
    api<unknown>(`/email-templates/${key}`, { method: 'PUT', body: JSON.stringify(body) }),
  sendCampaign: (key: string, to: string[]) =>
    api<{ queued: boolean }>(`/email-templates/${key}/campaign`, {
      method: 'POST',
      body: JSON.stringify({ to }),
    }),
};

export const filesApi = {
  upload: async (file: File, kind: string) => {
    const form = new FormData();
    form.append('file', file);
    form.append('kind', kind);
    const res = await fetch(`${base}/files`, {
      method: 'POST',
      credentials: 'include',
      body: form,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.message ?? 'Upload failed');
    }
    return res.json() as Promise<{
      id: string;
      name: string;
      mimeType: string;
      sizeBytes: number;
      kind: string;
    }>;
  },
  url: (id: string) => `${base}/files/${id}`,
  pdf: (path: string) => `${base}${path}`,
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
    bomFileId?: string;
  }) => api<SubmissionDetail>('/submissions', { method: 'POST', body: JSON.stringify(body) }),

  acknowledge: (id: string) =>
    api<SubmissionDetail>(`/submissions/${id}/acknowledge`, { method: 'POST' }),

  reject: (id: string, reason: string) =>
    api<SubmissionDetail>(`/submissions/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  updateSubmission: (
    id: string,
    body: {
      location?: string;
      approxQty?: number;
      approxWeight?: number;
      notes?: string;
      ref?: string;
      bomFileId?: string | null;
    },
  ) =>
    api<SubmissionDetail>(`/submissions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
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
      taxRatePct?: number;
      invoiceFileId?: string;
      ewayFileId?: string;
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

  createMrn: (
    invoiceId: string,
    body: {
      factoryId: string;
      receivedAt: string;
      driverSign?: string;
      managerSign?: string;
      securitySign?: string;
      note?: string;
    },
  ) =>
    api<{ mrnNo: string }>(`/invoices/${invoiceId}/mrn`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  createRecycling: (
    invoiceId: string,
    body: {
      processedAt: string;
      factoryId?: string;
      categories: Array<{ entryId: string; groupCode: string; weightKg: number }>;
    },
  ) =>
    api<{ form6No: string }>(`/invoices/${invoiceId}/recycling`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  uploadCertificate: (
    invoiceId: string,
    body: { certNo: string; certDate: string; fileId: string; department?: string },
  ) =>
    api<{ certNo: string }>(`/invoices/${invoiceId}/certificates`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  closeInvoice: (invoiceId: string, body?: { rating?: number; note?: string; forced?: boolean }) =>
    api<unknown>(`/invoices/${invoiceId}/close`, {
      method: 'POST',
      body: JSON.stringify(body ?? {}),
    }),

  raiseQuery: (submissionId: string, text: string) =>
    api<QueryThread>(`/submissions/${submissionId}/queries`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),

  replyQuery: (queryId: string, text: string) =>
    api<unknown>(`/queries/${queryId}/replies`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),

  importSerials: (invoiceId: string, body: { csv?: string; serialFileId?: string }) =>
    api<SerialRow[]>(`/invoices/${invoiceId}/serials`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  destroySerials: (invoiceId: string, body: { serialNos?: 'all' | string[]; std: string; method?: string }) =>
    api<{ destroyed: number }>(`/invoices/${invoiceId}/serials/destroy`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};
