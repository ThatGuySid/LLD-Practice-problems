import { useEffect, useState } from 'react';
import Topbar from './components/Topbar';
import Dashboard from './views/Dashboard';
import History from './views/History';
import Editor from './views/Editor';
import Result from './views/Result';
import { api } from './lib/api';
import './styles.css';

function readRoute() {
  const hash = window.location.hash.replace('#', '') || 'dashboard';
  const [view, id] = hash.split('/');
  return { view, id };
}

export default function App() {
  const [route, setRoute] = useState(readRoute());
  const [problems, setProblems] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [attempt, setAttempt] = useState(null);
  const [problem, setProblem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const onPop = () => setRoute(readRoute());
    window.addEventListener('hashchange', onPop);
    return () => window.removeEventListener('hashchange', onPop);
  }, []);

  useEffect(() => {
    Promise.all([api.getProblems(), api.getAttempts()])
      .then(([p, a]) => { setProblems(p.problems); setAttempts(a.attempts); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const loadRoute = async () => {
      setError('');
      if (route.view === 'editor' && route.id) {
        try {
          const { attempt: latest } = await api.getAttempt(route.id);
          setAttempt(latest);
          setProblem({ id: latest.problem_id, slug: latest.slug, title: latest.title, summary: latest.summary, prompt: latest.prompt, requirements: latest.requirements });
        } catch (e) { setError(e.message); }
      }
      if (route.view === 'result' && route.id) {
        try {
          const { attempt: latest } = await api.getAttempt(route.id);
          setAttempt(latest);
          setProblem({ id: latest.problem_id, slug: latest.slug, title: latest.title, summary: latest.summary, prompt: latest.prompt, requirements: latest.requirements });
        } catch (e) { setError(e.message); }
      }
    };
    loadRoute();
  }, [route.view, route.id]);

  const navigate = (view, id = '') => { window.location.hash = id ? `${view}/${id}` : view; };

  const refreshAttempts = async () => {
    const { attempts: latest } = await api.getAttempts();
    setAttempts(latest);
    return latest;
  };

  const openProblem = async (selected) => {
    try {
      const existing = attempts.find((a) => a.problem_id === selected.id && ['draft', 'submitted', 'evaluating'].includes(a.status));
      if (existing) { navigate('editor', existing.id); return; }
      const { attempt: created } = await api.createAttempt(selected.id);
      setAttempt(created);
      setProblem(selected);
      await refreshAttempts();
      navigate('editor', created.id);
    } catch (e) { setError(e.message); }
  };

  const openAttempt = (selected) => {
    if (selected.status === 'completed' || selected.status === 'failed') navigate('result', selected.id);
    else navigate('editor', selected.id);
  };

  const retry = async () => {
    const { attempt: created } = await api.createAttempt(attempt.problem_id);
    setAttempt(created);
    setProblem({ id: attempt.problem_id, slug: attempt.slug, title: attempt.title, summary: attempt.summary, prompt: attempt.prompt, requirements: attempt.requirements });
    await refreshAttempts();
    navigate('editor', created.id);
  };

  if (loading) return <div className="loading-screen" role="status"><div className="loading-mark">B</div><p>Loading your workspace…</p></div>;

  const fullView = route.view === 'editor' || route.view === 'result';

  return (
    <div className="app">
      {!fullView && <Topbar view={route.view} onNavigate={navigate} problems={problems} attempts={attempts} onOpenProblem={openProblem} onOpenAttempt={openAttempt} />}
      {error ? <div className="global-error" role="alert">{error}<button aria-label="Dismiss error" onClick={() => setError('')}>×</button></div> : null}
      {route.view === 'dashboard' && <Dashboard problems={problems} attempts={attempts} onOpenProblem={openProblem} onOpenHistory={() => navigate('history')} />}
      {route.view === 'history' && <History attempts={attempts} onOpenAttempt={openAttempt} onBrowse={() => navigate('dashboard')} />}
      {route.view === 'editor' && problem && attempt && <Editor problem={problem} initialAttempt={attempt} onBack={() => navigate('dashboard')} onSubmitted={(latest) => { setAttempt(latest); refreshAttempts(); if (latest.status === 'completed') navigate('result', latest.id); }} />}
      {route.view === 'result' && attempt && <Result attempt={attempt} onBackToProblems={() => navigate('dashboard')} onHistory={() => navigate('history')} onRetry={retry} />}
    </div>
  );
}
