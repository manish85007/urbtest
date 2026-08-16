export * from './fiscal-year.js';
export * from './stage.js';
export * from './money.js';
export * from './recovery.js';
export * from './payments.js';
export * from './email-merge.js';
export * from './invoice-due.js';
export * from './recycling-sla.js';
export * from './sustainability.js';
export * from './category-capacity.js';

export const STAGES = [
  { n: 1, k: 'req', l: 'Request', by: 'Client' },
  { n: 2, k: 'ack', l: 'Acknowledge', by: 'Admin' },
  { n: 3, k: 'veh', l: 'Assign Vehicle', by: 'Admin' },
  { n: 4, k: 'load', l: 'Load & Weigh', by: 'Admin' },
  { n: 5, k: 'bill', l: 'Billing', by: 'Admin' },
  { n: 6, k: 'mrn', l: 'MRN', by: 'Factory' },
  { n: 7, k: 'recy', l: 'Recycling', by: 'Factory' },
  { n: 8, k: 'cod', l: 'CoD Upload', by: 'Admin' },
  { n: 9, k: 'done', l: 'Closed', by: 'Client' },
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
