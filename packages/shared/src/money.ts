/** Money helpers — store as integer paise in DB; never use floating point. */

export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

export function paiseToRupees(paise: number): number {
  return paise / 100;
}

export function formatINR(paise: number): string {
  const rupees = paiseToRupees(paise);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(rupees);
}

export function deriveTax(taxablePaise: number, taxPct: number): number {
  return Math.round((taxablePaise * taxPct) / 100);
}

export function deriveTotal(taxablePaise: number, taxPct: number): number {
  return taxablePaise + deriveTax(taxablePaise, taxPct);
}
