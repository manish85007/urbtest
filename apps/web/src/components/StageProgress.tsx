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
          <div key={s.n} className={cls} title={`${s.by}`}>
            {s.ic} {s.l}
            <span className="pstep-n">{s.n}</span>
          </div>
        );
      })}
    </div>
  );
}

export function StageBadge({ stage }: { stage: number }) {
  const cls = stage >= 9 ? 'bg-g' : stage >= 6 ? 'bg-bl' : stage >= 3 ? 'bg-am' : 'bg-gy';
  const st = STAGES.find((s) => s.n === stage);
  return (
    <span className={`badge ${cls}`}>
      {st?.ic} {stage}. {stageLabel(stage)}
    </span>
  );
}
