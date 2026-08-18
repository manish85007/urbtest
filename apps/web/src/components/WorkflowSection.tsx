import type { ReactNode } from 'react';
import type { ViewPhase } from '@urb-tectrack/shared';

export function WorkflowSection({
  phase,
  current,
  done,
  locked,
  lockReason,
  actions,
  children,
}: {
  phase: ViewPhase;
  current: boolean;
  done: boolean;
  locked?: boolean;
  lockReason?: string;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section
      className={`wf-sec${current ? ' now' : ''}${done ? ' done' : ''}${locked ? ' locked' : ''}`}
    >
      <div className="wf-hd">
        <span className="wf-n">{phase.n}</span>
        <div className="wf-ttl">
          {phase.ic} {phase.l}
          <div className="wf-sub">{phase.d}</div>
        </div>
        {current ? <span className="badge bg-g">Current</span> : null}
        {done && !current ? <span className="badge bg-g">Done</span> : null}
        {locked ? <span className="badge bg-gy">Locked</span> : null}
        <div className="spacer" />
        {!locked ? actions : null}
      </div>
      {locked ? (
        <div className="card">
          <p className="dim" style={{ margin: 0, fontSize: '.85rem' }}>
            {lockReason}
          </p>
        </div>
      ) : (
        children
      )}
    </section>
  );
}
