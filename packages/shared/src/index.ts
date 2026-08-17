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

export const CATEGORY_GROUPS = {
  ITEW: { name: 'IT & Telecom Equipment', ord: 1 },
  CEEW: { name: 'Consumer Electronics & Electrical Equipment', ord: 2 },
  LSEEW: { name: 'Large & Small Household Electric Equipment', ord: 3 },
  EETW: { name: 'Electrical & Electronic Tools', ord: 4 },
  TLSEW: { name: 'Toys, Leisure & Sports Equipment', ord: 5 },
  MDW: { name: 'Medical Devices', ord: 6 },
  LIW: { name: 'Lighting / Other Equipment', ord: 7 },
} as const;
