function daysBetween(a: Date, b: Date): number {
  const start = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const end = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.floor((end - start) / 86_400_000);
}

export type SlaState = 'met' | 'late' | 'breached' | 'warn' | 'ok';

export interface RecyclingSlaInput {
  mrnReceivedAt: Date;
  certificateAt?: Date | null;
  slaDays?: number;
  warnAtPct?: number;
  now?: Date;
}

export interface RecyclingSlaInfo {
  start: Date;
  endAt: Date | null;
  targetDate: string;
  slaDays: number;
  daysUsed: number;
  remaining: number;
  pct: number;
  done: boolean;
  breached: boolean;
  state: SlaState;
}

export const SLA_LABEL: Record<SlaState, string> = {
  met: 'Met',
  late: 'Closed late',
  breached: 'Breached',
  warn: 'Due soon',
  ok: 'On track',
};

export const SLA_CLASS: Record<SlaState, string> = {
  met: 'bg-g',
  late: 'bg-rd',
  breached: 'bg-rd',
  warn: 'bg-am',
  ok: 'bg-bl',
};

/** SLA clock: MRN receipt → first certificate — ported from prototype slaFor(). */
export function recyclingSla(input: RecyclingSlaInput): RecyclingSlaInfo | null {
  const slaDays = input.slaDays ?? 30;
  const warnAtPct = input.warnAtPct ?? 0.8;
  const now = input.now ?? new Date();
  const start = input.mrnReceivedAt;
  const endAt = input.certificateAt ?? null;

  const target = new Date(start);
  target.setDate(target.getDate() + slaDays);
  const daysUsed = daysBetween(start, endAt ?? now);
  const pct = slaDays ? daysUsed / slaDays : 0;
  const done = !!endAt;

  let state: SlaState;
  if (done) {
    state = daysUsed > slaDays ? 'late' : 'met';
  } else if (daysUsed > slaDays) {
    state = 'breached';
  } else if (pct >= warnAtPct) {
    state = 'warn';
  } else {
    state = 'ok';
  }

  return {
    start,
    endAt,
    targetDate: target.toISOString().slice(0, 10),
    slaDays,
    daysUsed,
    remaining: slaDays - daysUsed,
    pct,
    done,
    breached: daysUsed > slaDays,
    state,
  };
}
