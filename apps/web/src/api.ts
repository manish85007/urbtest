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
    const error = new Error(err.message ?? 'Request failed') as Error & { mfaRequired?: boolean; statusCode?: number };
    error.mfaRequired = !!err.mfaRequired;
    error.statusCode = err.statusCode ?? res.status;
    throw error;
  }
  return res.json() as Promise<T>;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'operations' | 'factory' | 'client';
  clientId: string | null;
  factoryIds?: string[];
  siteIds?: string[];
  featureAccess?: Record<string, boolean> | null;
}

export type RegisterType =
  | 'summary'
  | 'complete'
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
  factoryName?: string;
  fy: string;
  periodLabel?: string;
  stats: {
    authorized: number;
    processed: number;
    utilization: number;
    atRisk: number;
    over?: number;
    warn?: number;
  };
  entries: Array<{
    entryId: string;
    description: string;
    groupCode: string;
    activity: string;
    capacityTpa: string;
    usedKg: number;
    remKg?: number;
    capKg: number;
    pct: number;
    atRisk: boolean;
    exceeded: boolean;
  }>;
  alerts: CapacityReport['entries'];
}

export interface AuditLogPage {
  total: number;
  filtered: number;
  page: number;
  pages: number;
  limit: number;
  rows: Array<{
    id: string;
    ts: string;
    actorEmail: string;
    actorName: string | null;
    action: string;
    entity: string;
    entityId: string | null;
    details: unknown;
  }>;
  actors: Array<{ email: string; name: string }>;
  actions: string[];
  entities: string[];
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

export interface CompanyProfile {
  name: string;
  brand: string;
  address: string;
  gst: string;
  cin: string;
  phone: string;
  email: string;
  wa: string;
  cpcb: string;
  kspcb: string;
  r2: string;
  logoFileId: string | null;
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
  featureAccess?: Record<string, boolean> | null;
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
  returned?: boolean;
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
  changeRemark?: string | null;
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
  invoiceFileIds?: string[];
  ewayFileIds?: string[];
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
    gatePhotoIds?: string[];
    materialPhotoIds?: string[];
    factory?: { id: string; name: string };
  } | null;
  recycling: {
    form6No: string;
    processedAt?: string;
    factoryId?: string;
    devicesDestroyed?: number;
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
    vehicleIds?: string[];
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
    tdsPaise?: string;
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
  bomFileIds?: string[];
  rejectNote?: string | null;
  rejectAt?: string | null;
  createdBy: string;
  onBehalfOf?: string | null;
  createdAt?: string;
  acknowledgedAt: string | null;
  acknowledgedBy?: string | null;
  loadingCompletedAt?: string | null;
  loadingCompletedBy?: string | null;
  closedAt?: string | null;
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
  items?: Array<{
    id: string;
    name: string;
    qty: number;
    weightKg: string | number;
    hsn: string;
    categoryId?: string | null;
    invoiceId?: string | null;
  }>;
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
    totalRequests: number;
    openInvoices: number;
    pendingPayments: number;
    fyNetKg: number;
    fyLabel: string;
    capacity: { pct: number; capTpa: number };
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
  activeRequests: Array<{
    id: string;
    clientName: string;
    siteName: string;
    requestDate: string;
    stage: number;
    invoices: Array<{ invoiceNo: string; stage: number }>;
    netKg: number;
    approxWeight: number;
    ref: string | null;
  }>;
  overdue: Array<{
    submissionId: string;
    invoiceId?: string;
    invoiceNo: string;
    clientName: string;
    paymentTerms?: string;
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
  treesPlanted: number;
  treesEarnedAll: number;
  lifetimeTonnes: number;
  clientName: string;
  counts: { open: number; closed: number; total: number };
  sites: Array<{
    id: string;
    name: string;
    city: string | null;
    gstin: string | null;
    open: number;
    fyKg: number;
    total: number;
  }>;
  pendingPickups: Array<{
    submissionId: string;
    siteName: string;
    siteId: string;
    expectedAt: string;
    registration: string;
  }>;
  requests: Array<{
    id: string;
    siteId: string;
    siteName: string;
    stage: number;
    returned?: boolean;
    netKg: number;
    approxWeight: number;
    requestDate: string;
    ref: string | null;
  }>;
  pendingClose: Array<{
    submissionId: string;
    invoiceId: string;
    invoiceNo: string;
    certificates: string[];
    issuedAt: string | null;
  }>;
}

export type DashboardReport = StaffDashboardReport | ClientDashboardReport;

export const authApi = {
  login: (email: string, password: string, mfaCode?: string) =>
    api<{ user: SessionUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, mfaCode }),
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
  mfaStatus: () =>
    api<{
      required: boolean;
      enrolled: boolean;
      enrolledAt: string | null;
      passwordAgeDays: number | null;
      passwordExpired: boolean;
      policyText: string;
    }>('/auth/mfa'),
  mfaStart: () => api<{ secret: string; uri: string; required: boolean }>('/auth/mfa/start', { method: 'POST' }),
  mfaConfirm: (secret: string, code: string) =>
    api<{ ok: boolean; enrolled: boolean }>('/auth/mfa/confirm', {
      method: 'POST',
      body: JSON.stringify({ secret, code }),
    }),
  mfaDisable: (reason: string) =>
    api<{ ok: boolean; enrolled: boolean }>('/auth/mfa/disable', {
      method: 'POST',
      body: JSON.stringify({ reason }),
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
  portalUsers: (clientId: string, siteId: string) =>
    api<Array<{ id: string; email: string; name: string }>>(
      `/clients/${clientId}/portal-users?siteId=${encodeURIComponent(siteId)}`,
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
  auditLog: (filters?: {
    limit?: number;
    page?: number;
    q?: string;
    actor?: string;
    action?: string;
    entity?: string;
    from?: string;
    to?: string;
    sort?: string;
  }) => {
    const params = new URLSearchParams();
    const f = filters ?? {};
    if (f.limit) params.set('limit', String(f.limit));
    if (f.page) params.set('page', String(f.page));
    if (f.q) params.set('q', f.q);
    if (f.actor) params.set('actor', f.actor);
    if (f.action) params.set('action', f.action);
    if (f.entity) params.set('entity', f.entity);
    if (f.from) params.set('from', f.from);
    if (f.to) params.set('to', f.to);
    if (f.sort) params.set('sort', f.sort);
    const qs = params.toString();
    return api<AuditLogPage>(`/audit${qs ? `?${qs}` : ''}`);
  },
  capacity: (factoryId: string, period?: PeriodQuery) =>
    api<CapacityReport>(
      `/reports/capacity${qs({ factoryId, ...(period ?? {}) })}`,
    ),
  heroes: (period?: PeriodQuery, clientId?: string) =>
    api<HeroesReport>(`/reports/heroes${qs({ ...(period ?? {}), clientId })}`),
  register: (type: RegisterType, period?: PeriodQuery, scope?: { clientId?: string; siteId?: string }) =>
    api<RegisterReport>(
      `/reports/register/${type}${qs({ ...(period ?? {}), clientId: scope?.clientId, siteId: scope?.siteId })}`,
    ),
  shareImpact: (body: { clientId: string } & PeriodQuery) =>
    api<{ sent: number; recipients: string[]; clientName: string }>('/reports/impact/share', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
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
  company: () => api<CompanyProfile>('/settings/company'),
  saveCompany: (body: Partial<CompanyProfile>) =>
    api<CompanyProfile>('/settings/company', { method: 'PUT', body: JSON.stringify(body) }),
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
    role: 'admin' | 'operations' | 'factory' | 'client';
    password?: string;
    clientId?: string | null;
    factoryIds?: string[];
    siteIds?: string[];
    featureAccess?: Record<string, boolean> | null;
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
      role?: 'admin' | 'operations' | 'factory' | 'client';
      clientId?: string | null;
      factoryIds?: string[];
      siteIds?: string[];
      active?: boolean;
      featureAccess?: Record<string, boolean> | null;
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
  smtpSettings: () =>
    api<{
      enabled: boolean;
      host: string;
      port: number;
      secure: boolean;
      user: string;
      passwordSet: boolean;
      fromName: string;
      fromEmail: string;
    }>('/settings/email'),
  saveSmtpSettings: (body: {
    enabled?: boolean;
    host?: string;
    port?: number;
    secure?: boolean;
    user?: string;
    pass?: string;
    fromName?: string;
    fromEmail?: string;
  }) => api<unknown>('/settings/email', { method: 'PUT', body: JSON.stringify(body) }),
  testSmtp: (to: string) =>
    api<{ ok: boolean }>('/settings/email/test', { method: 'POST', body: JSON.stringify({ to }) }),
};

export const filesApi = {
  upload: async (file: File, kind: string) => {
    const form = new FormData();
    form.append('kind', kind);
    form.append('file', file);
    const res = await fetch(`${base}/files?kind=${encodeURIComponent(kind)}`, {
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
    bomFileIds?: string[];
    items?: Array<{ name: string; qty?: number; weightKg?: number; hsn?: string }>;
    onBehalfOf?: string;
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
      bomFileIds?: string[];
      items?: Array<{ name: string; qty?: number; weightKg?: number; hsn?: string }>;
      siteId?: string;
      requestDate?: string;
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
      changeRemark?: string;
      team: Array<{ name: string; role: string; phone: string }>;
    },
  ) =>
    api<{ submission: SubmissionDetail }>(`/submissions/${submissionId}/vehicles`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateVehicle: (
    vehicleId: string,
    body: {
      registration: string;
      vehicleType: string;
      driverName: string;
      driverPhone: string;
      logisticsPartner?: string;
      expectedAt?: string;
      changeRemark?: string;
      team: Array<{ name: string; role: string; phone: string }>;
    },
  ) =>
    api<{ submission: SubmissionDetail }>(`/vehicles/${vehicleId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  deleteVehicle: (vehicleId: string) =>
    api<{ submission: SubmissionDetail }>(`/vehicles/${vehicleId}`, { method: 'DELETE' }),

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

  completeLoading: (submissionId: string) =>
    api<SubmissionDetail>(`/submissions/${submissionId}/loading-complete`, { method: 'POST' }),

  createInvoice: (
    submissionId: string,
    body: {
      invoiceNo: string;
      invoiceDate: string;
      taxableAmount: number;
      ewayBillNo: string;
      ewayBillDate: string;
      vehicleIds?: string[];
      billingWeight: number;
      deviationNote?: string;
      taxRatePct: number;
      billingMode?: string;
      invoiceFileId?: string;
      ewayFileId?: string;
      invoiceFileIds?: string[];
      ewayFileIds?: string[];
    },
  ) =>
    api<SubmissionDetail>(`/submissions/${submissionId}/invoices`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateInvoice: (
    invoiceId: string,
    body: {
      invoiceNo: string;
      invoiceDate: string;
      taxableAmount: number;
      ewayBillNo: string;
      ewayBillDate: string;
      vehicleIds?: string[];
      billingWeight: number;
      deviationNote?: string;
      taxRatePct: number;
      billingMode?: string;
      invoiceFileId?: string;
      ewayFileId?: string;
      invoiceFileIds?: string[];
      ewayFileIds?: string[];
    },
  ) =>
    api<{ submission: SubmissionDetail }>(`/invoices/${invoiceId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  deleteInvoice: (invoiceId: string) =>
    api<{ submission: SubmissionDetail }>(`/invoices/${invoiceId}`, { method: 'DELETE' }),

  addPayment: (
    invoiceId: string,
    body: { utr: string; amount: number; tdsAmount?: number; paidAt: string; mode: string; note?: string },
  ) =>
    api<unknown>(`/invoices/${invoiceId}/payments`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updatePayment: (
    paymentId: string,
    body: { utr: string; amount: number; tdsAmount?: number; paidAt: string; mode: string; note?: string },
  ) =>
    api<unknown>(`/payments/${paymentId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  deletePayment: (paymentId: string) =>
    api<unknown>(`/payments/${paymentId}`, { method: 'DELETE' }),

  createMrn: (
    invoiceId: string,
    body: {
      factoryId: string;
      receivedAt: string;
      driverSign?: string;
      managerSign?: string;
      securitySign?: string;
      materials?: Array<{ name: string; qty: number; weight: number }>;
      condition?: string;
      note?: string;
      gatePhotoIds?: string[];
      materialPhotoIds?: string[];
    },
  ) =>
    api<{ mrnNo: string }>(`/invoices/${invoiceId}/mrn`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateMrn: (
    invoiceId: string,
    body: {
      factoryId: string;
      receivedAt: string;
      driverSign?: string;
      managerSign?: string;
      securitySign?: string;
      materials?: Array<{ name: string; qty: number; weight: number }>;
      condition?: string;
      note?: string;
      gatePhotoIds?: string[];
      materialPhotoIds?: string[];
    },
  ) =>
    api<{ mrnNo: string }>(`/invoices/${invoiceId}/mrn`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  createRecycling: (
    invoiceId: string,
    body: {
      processedAt: string;
      factoryId?: string;
      devicesDestroyed?: number;
      categories: Array<{
        entryId: string;
        groupCode: string;
        weightKg: number;
        recoveryFe?: number;
        recoveryNfe?: number;
        recoveryPl?: number;
        recoveryPcb?: number;
        overrideReason?: string;
      }>;
      photoIds?: string[];
      reportIds?: string[];
      vehicleIds?: string[];
    },
  ) =>
    api<{ form6No: string }>(`/invoices/${invoiceId}/recycling`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateRecycling: (
    invoiceId: string,
    body: {
      processedAt: string;
      factoryId?: string;
      devicesDestroyed?: number;
      categories: Array<{
        entryId: string;
        groupCode: string;
        weightKg: number;
        recoveryFe?: number;
        recoveryNfe?: number;
        recoveryPl?: number;
        recoveryPcb?: number;
        overrideReason?: string;
      }>;
      photoIds?: string[];
      reportIds?: string[];
      vehicleIds?: string[];
    },
  ) =>
    api<{ form6No: string }>(`/invoices/${invoiceId}/recycling`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  uploadCertificate: (
    invoiceId: string,
    body: { certNo: string; certDate: string; fileId: string; department?: string; note?: string },
  ) =>
    api<{ certNo: string }>(`/invoices/${invoiceId}/certificate`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  sendComplianceDocuments: (
    submissionId: string,
    body: { certificateIds?: string[]; form6InvoiceIds?: string[] },
  ) =>
    api<{ sent: number; recipients: string[]; documents: number }>(
      `/submissions/${submissionId}/compliance/email`,
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
    ),

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

export type ControlRow = {
  ref: string;
  nm: string;
  state: 'ok' | 'warn' | 'fail';
  detail: string;
  act: string | null;
};

export const complianceApi = {
  controls: () => api<{ controls: ControlRow[]; stats: Record<string, unknown> }>('/compliance/controls'),
  security: (q = '') =>
    api<{
      rows: Array<{ id: string; ts: string; kind: string; email: string; severity: string; detail: unknown }>;
      kinds: string[];
    }>(`/compliance/security${q}`),
  reviews: () =>
    api<{
      open: {
        id: string;
        ref: string;
        startedAt: string;
        lines: Array<{
          email: string;
          name: string;
          role: string;
          lastLoginAt: string | null;
          decision: string | null;
          note: string;
        }>;
      } | null;
      reviews: Array<{
        id: string;
        ref: string;
        status: string;
        startedAt: string;
        closedAt: string | null;
        lines: Array<{ decision: string | null }>;
      }>;
    }>('/compliance/reviews'),
  startReview: () => api<{ id: string; ref: string }>('/compliance/reviews', { method: 'POST' }),
  decideReview: (id: string, email: string, decision: 'keep' | 'revoke', note?: string) =>
    api<unknown>(`/compliance/reviews/${id}/decide`, {
      method: 'POST',
      body: JSON.stringify({ email, decision, note }),
    }),
  closeReview: (id: string) =>
    api<unknown>(`/compliance/reviews/${id}/close`, { method: 'POST' }),
  incidents: () =>
    api<{
      incidents: Array<{
        id: string;
        ref: string;
        title: string;
        severity: string;
        detectedAt: string;
        status: string;
        reportable: boolean;
        rootCause: string;
        action: string;
        description: string;
      }>;
    }>('/compliance/incidents'),
  raiseIncident: (body: Record<string, unknown>) =>
    api<unknown>('/compliance/incidents', { method: 'POST', body: JSON.stringify(body) }),
  updateIncident: (id: string, body: Record<string, unknown>) =>
    api<unknown>(`/compliance/incidents/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  privacy: () =>
    api<{
      version: string;
      accepted: number;
      notAccepted: number;
      openRequests: number;
      dsrs: Array<{
        id: string;
        ref: string;
        kind: string;
        subject: string;
        due: string;
        status: string;
        raisedAt: string;
      }>;
      retentionYears: Record<string, number>;
    }>('/compliance/privacy'),
  raiseDsr: (body: { kind: string; subject: string; note?: string; cid?: string }) =>
    api<unknown>('/compliance/dsr', { method: 'POST', body: JSON.stringify(body) }),
  closeDsr: (id: string, outcome: string) =>
    api<unknown>(`/compliance/dsr/${id}/close`, { method: 'POST', body: JSON.stringify({ outcome }) }),
  subject: (email: string) =>
    api<{ found: boolean; summary: Record<string, string | number>; email: string }>(
      `/compliance/subject?email=${encodeURIComponent(email)}`,
    ),
  retention: () =>
    api<{
      register: Array<{
        cls: string;
        kind: string;
        ref: string;
        held: string | null;
        keep: number;
        years: number;
        dueFrom: string | null;
        due: boolean;
        ctx: string;
      }>;
      disposals: Array<{ id: string; ref: string; kind: string; describes: string; method: string; at: string; by: string }>;
      years: Record<string, number>;
    }>('/compliance/retention'),
  dispose: (body: { kind: string; describes: string; method: string; approvedBy?: string; note?: string }) =>
    api<unknown>('/compliance/disposals', { method: 'POST', body: JSON.stringify(body) }),
  evidence: () => api<Record<string, unknown>>('/compliance/evidence'),
  auditChain: () =>
    api<{ ok: boolean; count?: number; head?: string; reason?: string; seq?: number; note?: string }>(
      '/compliance/audit-chain',
    ),
};

