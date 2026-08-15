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

export function formatMrnNumber(
  factoryCode: string,
  fyShort: string,
  sequence: number,
): string {
  return `MRN/${factoryCode}/${fyShort}/${String(sequence).padStart(4, '0')}`;
}
