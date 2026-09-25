import StatusPill from '../components/StatusPill';
import EmptyState from '../components/EmptyState';
import { formatDate } from '../lib/format';

export default function History({ attempts, onOpenAttempt, onBrowse }) {
  return (
    <main className="shell narrow-shell page-pad">
      <div className="page-heading"><div className="eyebrow">Your workspace</div><h1>Attempt history</h1><p>Every retry is a fresh attempt. Completed feedback stays attached to the work you submitted.</p></div>
      {attempts.length === 0 ? (
        <EmptyState title="No attempts yet" text="Start a challenge and your work will appear here." action={<button className="button primary" onClick={onBrowse}>Browse challenges →</button>} />
      ) : (
        <div className="history-table">
          <div className="history-head"><span>Challenge</span><span>Status</span><span>Updated</span><span /></div>
          {attempts.map((attempt, index) => (
            <button className="history-row" key={attempt.id} onClick={() => onOpenAttempt(attempt)}>
              <div><strong>{attempt.title}</strong><span>Attempt #{attempts.length - index}</span></div>
              <StatusPill status={attempt.status} />
              <span className="history-date">{formatDate(attempt.updated_at)}</span>
              <span className="history-arrow">→</span>
            </button>
          ))}
        </div>
      )}
    </main>
  );
}
