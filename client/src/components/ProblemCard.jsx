import StatusPill from './StatusPill';

export default function ProblemCard({ problem, attempt, onOpen }) {
  return (
    <article className="problem-card">
      <div className="eyebrow">LLD challenge</div>
      <div className="problem-card-head">
        <div>
          <h3>{problem.title}</h3>
          <p>{problem.summary}</p>
        </div>
        <div className="problem-index">{String(problem.slug).slice(0, 2).toUpperCase()}</div>
      </div>
      <div className="tag-row">
        {problem.requirements.slice(0, 3).map((r) => <span className="soft-tag" key={r}>{r.split(' ').slice(0, 3).join(' ')}</span>)}
      </div>
      <div className="problem-card-foot">
        {attempt ? <StatusPill status={attempt.status} /> : <span className="first-attempt">Not started</span>}
        <button className="text-button" onClick={onOpen}>{attempt ? 'Continue →' : 'Start challenge →'}</button>
      </div>
    </article>
  );
}
