/** Financial year helpers — April to March (India). Ported from prototype getFY(). */

export const FY_START_MONTH = 4;

export interface FiscalYear {
  start: number;
  end: number;
  label: string;
  short: string;
}

export function getFY(dateStr: string | Date): FiscalYear | null {
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  if (Number.isNaN(d.getTime())) return null;

  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const start = m >= FY_START_MONTH ? y : y - 1;

  return {
    start,
    end: start + 1,
    label: `FY ${start}-${String((start + 1) % 100).padStart(2, '0')}`,
    short: `${String(start % 100).padStart(2, '0')}${String((start + 1) % 100).padStart(2, '0')}`,
  };
}

export function currentFY(): FiscalYear | null {
  return getFY(new Date());
}

/** FY labels from a start year through the current year, newest first. */
export function listFiscalYears(fromStartYear = 2024): FiscalYear[] {
  const cur = currentFY();
  const end = cur?.start ?? new Date().getFullYear();
  const out: FiscalYear[] = [];
  for (let y = fromStartYear; y <= end; y++) {
    const fy = getFY(`${y}-06-15`);
    if (fy) out.push(fy);
  }
  return out.reverse();
}

/** Whether a date falls in the given FY label (e.g. "FY 2025-26"). */
export function inFiscalYear(date: Date, fyLabel: string): boolean {
  const fy = getFY(date);
  return !!fy && fy.label === fyLabel;
}

export function formatMrnNumber(
  factoryCode: string,
  fyShort: string,
  sequence: number,
): string {
  return `MRN/${factoryCode}/${fyShort}/${String(sequence).padStart(4, '0')}`;
}

/** Form 6 manifest number — FY (Apr–Mar) + 4-digit sequence resetting each April. */
export function formatForm6Number(fyShort: string, sequence: number): string {
  return `F6/${fyShort}/${String(sequence).padStart(4, '0')}`;
}
