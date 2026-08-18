import { viewPhaseForStage } from './stage.js';

export * from './fiscal-year.js';
export * from './report-period.js';
export * from './stage.js';
export * from './money.js';
export * from './recovery.js';
export * from './payments.js';
export * from './email-merge.js';
export * from './invoice-due.js';
export * from './recycling-sla.js';
export * from './sustainability.js';
export * from './category-capacity.js';
export * from './phone.js';
export * from './password-policy.js';
export * from './classification.js';

export const STAGES = [
  { n: 1, k: 'req', l: 'Request', ic: '📝', by: 'Client', d: 'Pickup request raised' },
  { n: 2, k: 'ack', l: 'Acknowledge', ic: '✅', by: 'Admin', d: 'Urbeno accepts the request' },
  { n: 3, k: 'veh', l: 'Assign Vehicle', ic: '🚚', by: 'Admin', d: 'Vehicles + teams assigned' },
  { n: 4, k: 'load', l: 'Load & Weigh', ic: '⚖️', by: 'Admin', d: 'Per-vehicle weighment + photos' },
  { n: 5, k: 'bill', l: 'Billing', ic: '🧾', by: 'Admin', d: 'Invoices + e-way bills raised' },
  { n: 6, k: 'mrn', l: 'MRN', ic: '📋', by: 'Factory', d: 'Goods received at factory' },
  { n: 7, k: 'recy', l: 'Recycling', ic: '♻️', by: 'Factory', d: 'Processed + Form 6 issued' },
  { n: 8, k: 'cod', l: 'CoD Upload', ic: '🏅', by: 'Admin', d: 'Certificate uploaded + emailed' },
  { n: 9, k: 'done', l: 'Closed', ic: '🎉', by: 'Client', d: 'Requestor acknowledged closure' },
] as const;

export const VIEW_PHASES = [
  {
    n: 1,
    stages: [1, 2],
    l: 'Request Details',
    ic: '📝',
    by: 'Client / Admin',
    d: 'Raise and acknowledge the pickup request',
  },
  {
    n: 2,
    stages: [3, 4],
    l: 'Vehicles & Weighment',
    ic: '🚚',
    by: 'Admin',
    d: 'Assign vehicles and record weighment',
  },
  {
    n: 3,
    stages: [5, 6],
    l: 'Invoicing & Material Receiving',
    ic: '🧾',
    by: 'Admin / Factory',
    d: 'Raise invoices and record goods receipt (MRN)',
  },
  {
    n: 4,
    stages: [7, 8],
    l: 'Recycling & Compliance',
    ic: '♻️',
    by: 'Factory / Admin',
    d: 'Issue Form 6, then upload the Certificate of Destruction',
  },
  {
    n: 5,
    stages: [9],
    l: 'Closed',
    ic: '🎉',
    by: 'Client',
    d: 'Requestor acknowledged closure',
  },
] as const;

export type ViewPhase = (typeof VIEW_PHASES)[number];

export function viewPhaseOf(stage: number): ViewPhase {
  return VIEW_PHASES[viewPhaseForStage(stage) - 1];
}

export const CATEGORY_GROUPS = {
  ITEW: { name: 'IT & Telecom Equipment', ord: 1 },
  CEEW: { name: 'Consumer Electronics & Electrical Equipment', ord: 2 },
  LSEEW: { name: 'Large & Small Household Electric Equipment', ord: 3 },
  EETW: { name: 'Electrical & Electronic Tools', ord: 4 },
  TLSEW: { name: 'Toys, Leisure & Sports Equipment', ord: 5 },
  MDW: { name: 'Medical Devices', ord: 6 },
  LIW: { name: 'Lighting / Other Equipment', ord: 7 },
} as const;
