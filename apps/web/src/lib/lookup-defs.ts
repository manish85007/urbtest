export interface LookupCol {
  k: 'label' | 'phone' | 'gstin' | 'transporterId' | 'address' | 'days' | 'rate' | 'description' | 'code' | 'gst';
  h: string;
  required?: boolean;
  kind?: 'text' | 'number';
}

export interface LookupDef {
  key: string;
  name: string;
  cols: LookupCol[];
  note?: string;
}

export const LOOKUP_DEFS: LookupDef[] = [
  {
    key: 'logistics',
    name: 'Logistics Partners',
    cols: [
      { k: 'label', h: 'Name', required: true },
      { k: 'phone', h: 'Phone' },
      { k: 'gstin', h: 'GSTIN' },
      { k: 'transporterId', h: 'Transporter ID' },
      { k: 'address', h: 'Address' },
    ],
    note: 'GSTIN and Transporter ID are carried onto the e-way bill for every consignment this partner moves.',
  },
  { key: 'vehicleType', name: 'Vehicle Types', cols: [{ k: 'label', h: 'Type', required: true }] },
  { key: 'teamRole', name: 'Team Roles', cols: [{ k: 'label', h: 'Role', required: true }] },
  { key: 'paymentMode', name: 'Payment Modes', cols: [{ k: 'label', h: 'Mode', required: true }] },
  {
    key: 'payTerms',
    name: 'Payment Terms',
    cols: [
      { k: 'label', h: 'Term', required: true },
      { k: 'days', h: 'Days', kind: 'number' },
    ],
    note: 'Assigned to each client on their profile. Once the term elapses on an unpaid invoice, Urb TecTrack emails a reminder daily until it is settled.',
  },
  {
    key: 'taxRate',
    name: 'Tax Rates',
    cols: [
      { k: 'label', h: 'Label', required: true },
      { k: 'rate', h: 'Rate %', kind: 'number' },
      { k: 'description', h: 'When it applies' },
    ],
    note: 'Selected on every invoice. The tax value and total invoice value are calculated from the taxable value and the rate chosen here — neither is typed by hand.',
  },
  {
    key: 'hsn',
    name: 'HSN Codes',
    cols: [
      { k: 'code', h: 'Code', required: true },
      { k: 'description', h: 'Description' },
      { k: 'gst', h: 'GST %', kind: 'number' },
    ],
  },
  {
    key: 'destructStd',
    name: 'Sanitization Standards',
    cols: [
      { k: 'code', h: 'Code' },
      { k: 'label', h: 'Standard', required: true },
      { k: 'description', h: 'Description' },
    ],
  },
];

export const LOOKUP_CATEGORY_ALIAS: Record<string, string> = {
  vehTypes: 'vehicleType',
  teamRoles: 'teamRole',
  payModes: 'paymentMode',
  taxRates: 'taxRate',
};

export function canonicalLookupCategory(category: string): string {
  return LOOKUP_CATEGORY_ALIAS[category] ?? category;
}

export function validClientCode(code: string, takenIds: string[]): string | null {
  const c = String(code || '').trim().toUpperCase();
  if (!c) return null;
  if (!/^[A-Z0-9]{4}$/.test(c)) return 'Client ID must be exactly 4 uppercase letters or digits.';
  if (/^(URB|ADM|SYS|TEST)/.test(c)) return 'That prefix is reserved for Urbeno internal use.';
  if (takenIds.includes(c)) return `Client ID ${c} is already taken.`;
  return null;
}
