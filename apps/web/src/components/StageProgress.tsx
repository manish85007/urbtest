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
  return <span className="badge">{stageLabel(stage)}</span>;
}
