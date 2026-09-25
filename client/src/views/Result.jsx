import RatingPill from '../components/RatingPill';
import StatusPill from '../components/StatusPill';
import { formatDate } from '../lib/format';

const criterionMeta = {
  requirements: 'Requirements coverage',
  responsibilities: 'Responsibilities',
  coupling: 'Cohesion & coupling',
  encapsulation: 'Encapsulation & interfaces',
  abstraction: 'Abstraction & patterns',
  extensibility: 'Extensibility',
  edge_cases: 'Edge cases & testability',
  explanation: 'Explanation quality',
};

export default function Result({ attempt, onBackToProblems, onHistory, onRetry, onRerun }) {
  const result = attempt?.result_json;
  if (!result) {
    // A failure with an error_message means the evaluator itself failed
    // (e.g. Gemini was unavailable) — the original submission is fine, so it
    // can be re-run in place. A failure with no error_message was stopped by
    // the deterministic precheck before evaluation ran, so the content
    // itself needs to change; only "start a new attempt" applies there.
    const canRerun = attempt?.status === 'failed' && Boolean(attempt.error_message) && Boolean(onRerun);
    return (
      <main className="shell narrow-shell page-pad"><div className="result-state"><StatusPill status={attempt?.status} /><h1>{attempt?.status === 'failed' ? 'Evaluation failed' : 'Evaluation in progress'}</h1><p>{attempt?.status === 'failed' ? (attempt.error_message || 'This submission did not pass the precheck. Start a new attempt to fix it.') : 'The evaluation worker is still running. This page will update automatically.'}</p><div className="result-state-actions">{canRerun ? <button className="button primary" onClick={onRerun}>Re-run evaluation →</button> : null}<button className="button secondary" onClick={onHistory}>Go to attempt history</button></div></div></main>
    );
  }

  return (
    <main className="shell narrow-shell page-pad result-page">
      <div className="result-header"><div><button className="back-button" onClick={onBackToProblems}>← Problems</button><div className="eyebrow">Evaluation · {formatDate(attempt.evaluation_completed_at || attempt.updated_at)}</div><h1>{attempt.title}</h1><p>Quality-based review across eight criteria. There is no overall numeric score.</p></div><StatusPill status="completed" /></div>
      <section className="summary-card"><div className="summary-icon" aria-hidden="true">✦</div><div><div className="eyebrow">Evaluator summary</div><p>{result.summary}</p></div></section>
      <section className="criteria-list">
        <div className="section-head compact"><div><div className="eyebrow">Criterion by criterion</div><h2>Evidence you can act on.</h2></div><span className="muted">Rating · evidence · concern · next step</span></div>
        {result.criteria.map((criterion) => (
          <article className="criterion-card" key={criterion.criterion_key}>
            <div className="criterion-title"><div><div className="criterion-index">{String(result.criteria.findIndex((x) => x.criterion_key === criterion.criterion_key) + 1).padStart(2, '0')}</div><h3>{criterionMeta[criterion.criterion_key] || criterion.criterion_key}</h3></div><RatingPill rating={criterion.rating} /></div>
            <div className="criterion-grid">
              <div><span className="field-label">Evidence</span><p>{criterion.evidence}</p></div>
              <div><span className="field-label">Concern</span><p>{criterion.concern}</p></div>
              <div><span className="field-label">Suggestion</span><p>{criterion.suggestion}</p></div>
              <div><span className="field-label">Confidence</span><p className="confidence">{criterion.confidence}</p></div>
            </div>
          </article>
        ))}
      </section>
      <section className="retry-card"><div><div className="eyebrow">Keep iterating</div><h2>Turn the feedback into a second design.</h2><p>A retry is a fresh attempt, so you can compare what changed without overwriting the original.</p></div><button className="button primary" onClick={onRetry}>Retry this challenge →</button></section>
    </main>
  );
}
