import { STAGES, stageLabel } from '@urb-tectrack/shared';

interface StageProgressProps {
  current: number;
}

export function StageProgress({ current }: StageProgressProps) {
  return (
    <div className="prog">
      {STAGES.map((s) => {
        let cls = 'pstep';
        if (s.n < current) cls += ' done';
        else if (s.n === current) cls += ' now';
        return (
          <div key={s.n} className={cls} title={s.by}>
            <span className="pstep-n">{s.n}</span>
            {s.l}
          </div>
        );
      })}
    </div>
  );
}

export function StageBadge({ stage }: { stage: number }) {
  const cls = stage >= 9 ? 'bg-g' : stage >= 6 ? 'bg-bl' : stage >= 3 ? 'bg-am' : 'bg-gy';
  return (
    <span className={`badge ${cls}`}>
      {stage}. {stageLabel(stage)}
    </span>
  );
}
