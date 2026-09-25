import { useEffect, useMemo, useState } from 'react';
import GraphEditor from '../components/GraphEditor';
import StatusPill from '../components/StatusPill';
import { api } from '../lib/api';
import { codeLooksPresent } from '../lib/format';

const emptyDiagram = { nodes: [], edges: [] };

export default function Editor({ problem, initialAttempt, onBack, onSubmitted }) {
  const [attempt, setAttempt] = useState(initialAttempt);
  const [text, setText] = useState(initialAttempt?.text_content || '');
  const [diagram, setDiagram] = useState(initialAttempt?.diagram_json || emptyDiagram);
  const [activeTab, setActiveTab] = useState('explain');
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [savedAt, setSavedAt] = useState(null);

  const detectedCode = useMemo(() => codeLooksPresent(text), [text]);
  const isDraft = attempt?.status === 'draft';

  useEffect(() => {
    if (!attempt?.id || !isDraft) return undefined;
    const timer = setTimeout(async () => {
      try {
        setSaving(true);
        await api.saveDraft(attempt.id, { textContent: text, diagram });
        setSavedAt(new Date());
      } catch (e) {
        setError(e.message);
      } finally {
        setSaving(false);
      }
    }, 900);
    return () => clearTimeout(timer);
  }, [text, diagram, attempt?.id, isDraft]);

  useEffect(() => {
    if (!attempt?.id || isDraft) return undefined;
    let cancelled = false;
    const poll = async () => {
      try {
        const { attempt: latest } = await api.getAttempt(attempt.id);
        if (!cancelled) setAttempt(latest);
      } catch (e) {
        if (!cancelled) setError(e.message);
      }
    };
    if (['submitted', 'evaluating'].includes(attempt.status)) {
      const id = setInterval(poll, 1800);
      poll();
      return () => { cancelled = true; clearInterval(id); };
    }
    return undefined;
  }, [attempt?.id, attempt?.status, isDraft]);

  const handleSubmit = async () => {
    setError('');
    setSubmitting(true);
    try {
      if (!text.trim() && !diagram.nodes.length) throw new Error('Add an explanation or a diagram before submitting.');
      const result = await api.submitAttempt(attempt.id, { textContent: text, diagram });
      const refreshed = await api.getAttempt(attempt.id);
      setAttempt(refreshed.attempt);
      if (result.status === 'failed') {
        setError(result.precheck.hardFailures.map((x) => x.message).join(' '));
      }
      onSubmitted(refreshed.attempt);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const evaluationComplete = attempt?.status === 'completed';
  const evaluationFailed = attempt?.status === 'failed';

  useEffect(() => {
    if (attempt?.status === 'completed') onSubmitted(attempt);
  }, [attempt?.status]);

  return (
    <main className="editor-shell">
      <div className="editor-topbar">
        <button className="back-button" onClick={onBack}>← Back to challenges</button>
        <div className="editor-status" aria-live="polite"><StatusPill status={attempt?.status || 'draft'} />{saving ? <span className="autosave">Saving…</span> : savedAt ? <span className="autosave">Saved just now</span> : null}</div>
      </div>
      <div className="editor-layout">
        <aside className="problem-pane">
          <div className="eyebrow">Challenge brief</div>
          <h1>{problem.title}</h1>
          <p className="problem-summary">{problem.summary}</p>
          <div className="brief-section"><h3>What to cover</h3><ul>{problem.requirements.map((item) => <li key={item}>{item}</li>)}</ul></div>
          <div className="brief-section evaluator-note"><span className="mini-icon" aria-hidden="true">◎</span><div><strong>How feedback works</strong><p>First a deterministic precheck catches obvious issues. Non-fatal findings become hints for Gemini's deeper review.</p></div></div>
        </aside>

        <section className="workspace-pane">
          {evaluationComplete || evaluationFailed ? (
            <div className="evaluation-banner"><div><div className="eyebrow">Submission result</div><strong>{evaluationComplete ? 'Your design has been reviewed.' : 'This submission could not be evaluated.'}</strong><p>{evaluationComplete ? 'Open the feedback view to inspect evidence and concrete next steps.' : (attempt.error_message || 'Check the submission and retry.')}</p></div>{evaluationComplete ? <button className="button primary" onClick={() => onSubmitted(attempt)}>Open feedback →</button> : <button className="button secondary" onClick={() => setError('Edit is no longer available for a failed attempt. Start a new retry from history.')}>Why?</button>}</div>
          ) : null}

          <div className="workspace-tabs">
            <button aria-pressed={activeTab === 'explain'} className={activeTab === 'explain' ? 'workspace-tab active' : 'workspace-tab'} onClick={() => setActiveTab('explain')}>1. Explain</button>
            <button aria-pressed={activeTab === 'graph'} className={activeTab === 'graph' ? 'workspace-tab active' : 'workspace-tab'} onClick={() => setActiveTab('graph')}>2. Draw diagram</button>
          </div>

          {activeTab === 'explain' ? (
            <div className="writing-panel">
              <div className="writing-panel-head"><div><div className="eyebrow">Your reasoning</div><h2>Explain the design in your own words.</h2><p>Write your classes, responsibilities, relationships, trade-offs, and important edge cases. Code is welcome.</p></div>{detectedCode ? <span className="code-detected">Code detected</span> : null}</div>
              <textarea aria-label="Design explanation" className="submission-editor" value={text} onChange={(e) => setText(e.target.value)} placeholder="Example: ParkingLot owns the lifecycle of tickets but delegates spot selection to a strategy…" disabled={!isDraft} />
              <div className="editor-footer"><span>{text.length.toLocaleString()} characters</span><span>Use ``` blocks for clear code snippets.</span></div>
            </div>
          ) : (
            <GraphEditor value={diagram} onChange={setDiagram} />
          )}

          <div className="submit-bar">
            <div><strong>Ready to submit?</strong><span>Your attempt is saved automatically while you work.</span></div>
            <button className="button primary" disabled={!isDraft || submitting} onClick={handleSubmit}>{submitting ? 'Submitting…' : 'Submit for evaluation →'}</button>
          </div>
          {error ? <div className="inline-error" role="alert">{error}</div> : null}
        </section>
      </div>
    </main>
  );
}
