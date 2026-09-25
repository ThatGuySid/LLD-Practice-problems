import ProblemCard from '../components/ProblemCard';
import Logo from '../components/Logo';

export default function Dashboard({ problems, attempts, onOpenProblem, onOpenHistory }) {
  const recent = attempts.slice(0, 3);
  const completed = attempts.filter((a) => a.status === 'completed').length;

  return (
    <main className="shell dashboard-shell">
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">LLD practice · learn by iterating</div>
          <h1>Design systems.<br /><span>Get useful feedback.</span></h1>
          <p>Pick a problem, sketch your model, explain your decisions, and submit. Blueprint checks obvious mistakes first, then uses Gemini for deeper design feedback.</p>
          <div className="hero-actions">
            <button className="button primary" onClick={() => onOpenProblem(problems[0])}>Start a challenge <span>→</span></button>
            <button className="button secondary" onClick={onOpenHistory}>View my attempts</button>
          </div>
        </div>
        <div className="hero-card">
          <div className="hero-card-top"><Logo compact /><span>YOUR WORKSPACE</span></div>
          <div className="orbit">
            <div className="orbit-ring ring-one" /><div className="orbit-ring ring-two" />
            <div className="orbit-center">LLD</div>
            <div className="orbit-node n1">Model</div><div className="orbit-node n2">Reason</div><div className="orbit-node n3">Iterate</div>
          </div>
          <div className="hero-card-foot"><strong>Feedback is evidence, not a score.</strong><span>4 quality levels · 8 criteria</span></div>
        </div>
      </section>

      <section className="metrics-row">
        <div className="metric"><span>Challenges</span><strong>{problems.length}</strong><small>seeded in this MVP</small></div>
        <div className="metric"><span>Your attempts</span><strong>{attempts.length}</strong><small>saved to this browser</small></div>
        <div className="metric"><span>Reviewed</span><strong>{completed}</strong><small>completed evaluations</small></div>
      </section>

      <section className="section-block">
        <div className="section-head"><div><div className="eyebrow">Choose a challenge</div><h2>Practice the design, not the memorization.</h2></div><span className="muted">3 compact LLD scenarios</span></div>
        <div className="problem-grid">
          {problems.map((problem) => <ProblemCard key={problem.id} problem={problem} attempt={attempts.find((a) => a.problem_id === problem.id)} onOpen={() => onOpenProblem(problem)} />)}
        </div>
      </section>

      {recent.length > 0 && (
        <section className="section-block recent-block">
          <div className="section-head"><div><div className="eyebrow">Recent work</div><h2>Pick up where you left off.</h2></div><button className="text-button" onClick={onOpenHistory}>See all →</button></div>
          <div className="recent-list">{recent.map((attempt) => <button key={attempt.id} className="recent-item" onClick={() => onOpenHistory()}><div><strong>{attempt.title}</strong><span>Attempt {attempt.id.slice(0, 6)} · {new Date(attempt.updated_at).toLocaleDateString('en-IN')}</span></div><span className="recent-status">{attempt.status}</span></button>)}</div>
        </section>
      )}
    </main>
  );
}
