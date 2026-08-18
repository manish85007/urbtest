import { VIEW_PHASES, viewPhaseForStage, viewPhaseOf } from '@urb-tectrack/shared';

interface StageProgressProps {
  current: number;
}

export function StageProgress({ current }: StageProgressProps) {
  const now = viewPhaseForStage(current);
  return (
    <div className="prog">
      {VIEW_PHASES.map((s) => {
        let cls = 'pstep';
        if (s.n < now || (now === 5 && current >= 9 && s.n === 5)) cls += ' done';
        if (s.n === now) cls += ' now';
        return (
          <div key={s.n} className={cls} title={`${s.d} · ${s.by}`}>
            {s.ic} {s.l}
            <span className="pstep-n">{s.n} of 5</span>
          </div>
        );
      })}
    </div>
  );
}

export function StageBadge({ stage }: { stage: number }) {
  const phase = viewPhaseOf(stage);
  const cls = phase.n >= 5 ? 'bg-g' : phase.n >= 3 ? 'bg-bl' : phase.n >= 2 ? 'bg-am' : 'bg-gy';
  return (
    <span className={`badge ${cls}`}>
      {phase.ic} {phase.n}. {phase.l}
    </span>
  );
}
