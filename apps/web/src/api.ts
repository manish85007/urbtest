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

export type RegisterType =
  | 'summary'
  | 'invoices'
  | 'mrn'
  | 'form6'
  | 'cod'
  | 'category'
  | 'sustain'
  | 'heroes';

export interface RegisterReport {
  kind: RegisterType;
  title: string;
  description: string;
  periodLabel: string;
  scopeLabel: string;
  head: string[];
  rows: Array<Array<string | number>>;
  total: number;
}

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

export interface HeroesPlanting {
  id: string;
  clientId: string | null;
  clientName: string;
  trees: number;
  plantedAt: string;
  location: string | null;
  state: string | null;
  partner: string | null;
  species: string | null;
  source: 'urbeno' | 'client';
  photoFileId: string | null;
  progress: Array<{ id: string; notedAt: string; photoFileId: string; note: string | null }>;
}

export interface HeroesMetrics {
  tonnes: number;
  co2: number;
  lifetimeTonnes: number;
  earned: number;
  planted: number;
  earnedAll: number;
  plantedAll: number;
  byUrbeno: number;
  byClient: number;
  owed: number;
  badge: number;
  nextBadge: number;
  toNext: number;
  pctToNext: number;
  badges: Array<{ n: number; unlocked: boolean }>;
}

export interface HeroesClientReport {
  view: 'client';
  clientName: string;
  period: { fy: string; kind?: string; label?: string };
  metrics: HeroesMetrics;
  seq: { kg: number; treeDays: number; perDay: number };
  plantings: HeroesPlanting[];
}

export interface HeroesAdminReport {
  view: 'admin';
  period: { fy: string; kind?: string; label?: string };
  totals: {
    earnedAll: number;
    byUrbeno: number;
    byClient: number;
    owed: number;
    seq: { kg: number; treeDays: number; perDay: number };
  };
  clients: Array<{
    id: string;
    name: string;
    tonnes: number;
    lifetimeTonnes: number;
    earnedAll: number;
    byUrbeno: number;
    byClient: number;
    owed: number;
    badge: number;
  }>;
  plantings: HeroesPlanting[];
}

export type HeroesReport = HeroesClientReport | HeroesAdminReport;

export interface ClientSummary {
  id: string;
  name: string;
  city: string | null;
  contact?: string | null;
  phone?: string | null;
  email?: string | null;
  active?: boolean;
  payTermsDays?: number;
  logoFileId?: string | null;
  siteActive?: number;
  siteInactive?: number;
  requestCount?: number;
}

export interface SiteSummary {
  id: string;
  code: string;
  name: string;
  address: string | null;
  gstin?: string | null;
  city?: string | null;
  state?: string | null;
  pin?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  active?: boolean;
}

export interface CategorySummary {
  id: number;
  entryId: string;
  description: string;
  groupCode: string;
  capacityTpa: string;
  activity?: string;
  authRef?: string | null;
  active?: boolean;
}

export interface FactorySummary {
  id: string;
  name: string;
  address?: string | null;
  gstin?: string | null;
  kspcbConsent?: string | null;
  cpcbEpr?: string | null;
  managerEmail?: string | null;
  active?: boolean;
  approvedTpa?: number;
  categoryLines?: number;
  mrnCount?: number;
  city?: string | null;
}

export interface LookupRow {
  id: string;
  category: string;
  label: string;
  active: boolean;
  rate?: number;
  description?: string;
  days?: number;
  code?: string;
  phone?: string;
  gstin?: string;
  transporterId?: string;
  address?: string;
  gst?: number;
}

export interface UserRow {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'factory' | 'client' | string;
  clientId: string | null;
  factoryIds: string[];
  siteIds?: string[];
  active: boolean;
}

export interface ClientDetail {
  id: string;
  name: string;
  city: string | null;
  contact: string | null;
  phone: string | null;
  email: string | null;
  payTermsDays: number;
  logoFileId: string | null;
  active: boolean;
  sites: SiteSummary[];
  users: UserRow[];
  stats: {
    requests: number;
    open: number;
    tonnes: number;
    treesEarned: number;
    treesPlanted: number;
    treesOwed: number;
  };
  plantings: Array<{
    id: string;
    trees: number;
    plantedAt: string;
    location: string | null;
    note: string | null;
  }>;
}

export interface SubmissionSummary {
  id: string;
  clientId: string;
  clientName: string;
  siteId: string;
  siteName: string;
  requestDate: string;
  approxWeight: string;
  location?: string | null;
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
  destroyOp?: string | null;
}

export interface VehicleDetail {
  id: string;
  registration: string;
  vehicleType: string;
  logisticsPartner?: string | null;
  driverName: string;
  driverPhone: string;
  expectedAt?: string | null;
  team: Array<{ name: string; role: string; phone: string }>;
  weighment: {
    netKg: string;
    grossKg?: string | null;
    tareKg?: string | null;
    manual: boolean;
    slipNumber: string | null;
    method?: string | null;
    reason?: string | null;
    weighedAt?: string;
    slipPhotoIds?: string[];
    pickupPhotoIds?: string[];
  } | null;
}

export interface InvoiceDetail {
  id: string;
  invoiceNo: string;
  invoiceDate?: string;
  taxablePaise?: string;
  taxPaise?: string;
  taxRatePct?: string;
  billingWeight: string;
  vehicleNetKg?: string | null;
  deviationKg?: string;
  deviationNote?: string | null;
  billingMode?: string;
  totalPaise: string;
  ewayBillNo?: string;
  ewayBillDate?: string;
  invoiceFileId?: string | null;
  ewayFileId?: string | null;
  vehicleIds?: string[];
  derivedStage: number;
  closedAt: string | null;
  closedBy?: string | null;
  closeRating?: number | null;
  closeNote?: string | null;
  forceClosed?: boolean;
  mrn: {
    mrnNo: string;
    factoryId: string;
    receivedAt?: string;
    receivedBy?: string;
    driverSign?: string | null;
    managerSign?: string | null;
    securitySign?: string | null;
    condition?: string | null;
    materials?: Array<{ n?: string; q?: number; w?: number }>;
    factory?: { id: string; name: string };
  } | null;
  recycling: {
    form6No: string;
    processedAt?: string;
    factoryId?: string;
    factory?: { id: string; name: string };
    recoveryFe?: string;
    recoveryNfe?: string;
    recoveryPl?: string;
    recoveryPcb?: string;
    photoIds?: string[];
    reportIds?: string[];
    categories?: Array<{
      entryId: string;
      groupCode: string;
      weightKg: string;
      recoveryFe?: string;
      recoveryNfe?: string;
      recoveryPl?: string;
      recoveryPcb?: string;
      category?: { description?: string };
    }>;
    serials?: SerialRow[];
    serialFileId?: string | null;
  } | null;
  certificates: Array<{
    id?: string;
    certNo: string;
    certDate?: string;
    department?: string | null;
    note?: string | null;
    fileId?: string;
    mailedAt?: string | null;
  }>;
  payments: Array<{
    id?: string;
    amountPaise: string;
    utr?: string;
    paidAt?: string;
    mode?: string;
  }>;
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
  createdAt?: string;
  acknowledgedAt: string | null;
  acknowledgedBy?: string | null;
  derivedStage: number;
  client: { id: string; name: string; payTermsDays?: number };
  site: {
    id: string;
    name: string;
    code: string;
    address?: string | null;
    gstin?: string | null;
    contactName?: string | null;
    contactPhone?: string | null;
  };
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
  clients: (includeInactive = false) =>
    api<ClientSummary[]>(`/clients${includeInactive ? '?includeInactive=1' : ''}`),
  client: (id: string) => api<ClientDetail>(`/clients/${id}`),
  sites: (clientId: string, includeInactive = false) =>
    api<SiteSummary[]>(
      `/clients/${clientId}/sites${includeInactive ? '?includeInactive=1' : ''}`,
    ),
  factories: (includeInactive = false) =>
    api<FactorySummary[]>(`/factories${includeInactive ? '?includeInactive=1' : ''}`),
  categories: (factoryId: string, includeInactive = false) =>
    api<CategorySummary[]>(
      `/factories/${factoryId}/categories${includeInactive ? '?includeInactive=1' : ''}`,
    ),
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
  heroes: (period?: PeriodQuery, clientId?: string) =>
    api<HeroesReport>(`/reports/heroes${qs({ ...(period ?? {}), clientId })}`),
  register: (type: RegisterType, period?: PeriodQuery, scope?: { clientId?: string; siteId?: string }) =>
    api<RegisterReport>(
      `/reports/register/${type}${qs({ ...(period ?? {}), clientId: scope?.clientId, siteId: scope?.siteId })}`,
    ),
  lookups: (category: string, includeInactive = false) =>
    api<LookupRow[]>(
      `/lookups/${category}${includeInactive ? '?includeInactive=1' : ''}`,
    ),
  allLookups: () => api<LookupRow[]>('/lookups'),
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
  users: () => api<UserRow[]>('/users'),
  createClient: (body: {
    id: string;
    name: string;
    city?: string;
    contact?: string;
    phone?: string;
    email?: string;
    payTermsDays?: number;
    logoFileId?: string | null;
    sites: Array<{
      code: string;
      name: string;
      address: string;
      gstin: string;
      city?: string;
      state?: string;
      pin?: string;
      contactName?: string;
      contactPhone?: string;
      contactEmail?: string;
    }>;
  }) => api<{ id: string; name: string }>('/clients', { method: 'POST', body: JSON.stringify(body) }),
  createSite: (
    clientId: string,
    body: {
      code: string;
      name: string;
      address: string;
      gstin: string;
      city?: string;
      state?: string;
      pin?: string;
      contactName?: string;
      contactPhone?: string;
      contactEmail?: string;
    },
  ) =>
    api<SiteSummary>(`/clients/${clientId}/sites`, {
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
  }) =>
    api<{ id: string; email: string; tempPassword?: string }>('/users', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  upsertLookup: (body: {
    category: string;
    id?: string;
    label?: string;
    active?: boolean;
    rate?: number;
    description?: string;
    days?: number;
    code?: string;
    phone?: string;
    gstin?: string;
    transporterId?: string;
    address?: string;
    gst?: number;
  }) => api<unknown>('/lookups', { method: 'POST', body: JSON.stringify(body) }),
  recordPlanting: (body: {
    trees: number;
    plantedAt: string;
    location?: string;
    state?: string;
    partner?: string;
    species?: string;
    note?: string;
    photoFileId?: string;
    clientId?: string;
    source?: 'urbeno' | 'client';
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
  removePlanting: (plantingId: string) =>
    api<{ ok: boolean }>(`/trees/${plantingId}`, { method: 'DELETE' }),
  removeTreeProgress: (plantingId: string, progressId: string) =>
    api<{ ok: boolean }>(`/trees/${plantingId}/progress/${progressId}`, { method: 'DELETE' }),
  updateClient: (
    id: string,
    body: {
      name?: string;
      city?: string;
      contact?: string;
      phone?: string;
      email?: string;
      payTermsDays?: number;
      logoFileId?: string | null;
      active?: boolean;
    },
  ) => api<unknown>(`/clients/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  updateSite: (
    id: string,
    body: {
      active?: boolean;
      name?: string;
      address?: string;
      gstin?: string;
      city?: string;
      state?: string;
      pin?: string;
      contactName?: string;
      contactPhone?: string;
      contactEmail?: string;
    },
  ) => api<unknown>(`/sites/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  updateUser: (
    id: string,
    body: {
      name?: string;
      role?: 'admin' | 'factory' | 'client';
      clientId?: string | null;
      factoryIds?: string[];
      siteIds?: string[];
      active?: boolean;
    },
  ) => api<UserRow>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  upsertFactory: (body: {
    id: string;
    name: string;
    address?: string;
    gstin?: string;
    kspcbConsent?: string;
    cpcbEpr?: string;
    managerEmail?: string;
    active?: boolean;
  }) => api<unknown>('/factories', { method: 'POST', body: JSON.stringify(body) }),
  upsertCategory: (body: {
    factoryId: string;
    entryId: string;
    description: string;
    groupCode: string;
    capacityTpa: number;
    activity?: string;
    authRef?: string;
    active?: boolean;
  }) => api<unknown>('/categories', { method: 'POST', body: JSON.stringify(body) }),
  patchCategory: (
    id: number,
    body: {
      description?: string;
      groupCode?: string;
      capacityTpa?: number;
      activity?: string;
      authRef?: string;
      active?: boolean;
    },
  ) => api<unknown>(`/categories/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
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
    api<
      Array<{
        id: string;
        subject: string;
        status: string;
        createdAt: string;
        sentAt: string | null;
        to: string[];
        body?: string;
        templateKey?: string;
        templateName?: string | null;
      }>
    >(`/emails/outbox?limit=${limit}`),
  templates: () =>
    api<
      Array<{
        id: string;
        key: string | null;
        name: string;
        subject: string;
        body: string;
        editable: boolean;
        variables?: string[];
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
      logisticsPartner?: string;
      expectedAt?: string;
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
      categories: Array<{ entryId: string; groupCode: string; weightKg: number; overrideReason?: string }>;
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
