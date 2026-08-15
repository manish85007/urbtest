/** Material recovery profiles — ported from prototype RECOVERY_PROFILE. */

export type MaterialGroupCode =
  | 'ITEW'
  | 'CEEW'
  | 'LSEEW'
  | 'EETW'
  | 'TLSEW'
  | 'MDW'
  | 'LIW';

export interface MaterialRecovery {
  fe: number;
  nfe: number;
  pl: number;
  pcb: number;
}

export interface RecoveryProfile {
  fe: number;
  nfe: number;
  pl: number;
  pcb: number;
}

export const RECOVERY_PROFILE: Record<MaterialGroupCode, RecoveryProfile> = {
  ITEW: { fe: 0.42, nfe: 0.27, pl: 0.22, pcb: 0.09 },
  CEEW: { fe: 0.46, nfe: 0.2, pl: 0.28, pcb: 0.06 },
  LSEEW: { fe: 0.58, nfe: 0.16, pl: 0.23, pcb: 0.03 },
  EETW: { fe: 0.55, nfe: 0.22, pl: 0.2, pcb: 0.03 },
  TLSEW: { fe: 0.24, nfe: 0.14, pl: 0.58, pcb: 0.04 },
  MDW: { fe: 0.38, nfe: 0.22, pl: 0.32, pcb: 0.08 },
  LIW: { fe: 0.3, nfe: 0.26, pl: 0.36, pcb: 0.08 },
};

export function recoveryFor(groupCode: MaterialGroupCode, kg: number): MaterialRecovery {
  const p = RECOVERY_PROFILE[groupCode] ?? RECOVERY_PROFILE.ITEW;
  const fe = round2(kg * p.fe);
  const nfe = round2(kg * p.nfe);
  const pl = round2(kg * p.pl);
  return { fe, nfe, pl, pcb: round2(kg - fe - nfe - pl) };
}

export function matTotal(m: MaterialRecovery | null | undefined): number {
  if (!m) return 0;
  return m.fe + m.nfe + m.pl + m.pcb;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function weightsBalance(
  targetKg: number,
  splitKg: number,
  tolerance = 0.01,
): boolean {
  return Math.abs(round2(splitKg) - round2(targetKg)) < tolerance;
}
