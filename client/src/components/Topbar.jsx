import { useState } from 'react';
import Logo from './Logo';

function NavGroup({ label, active, onGo, defaultOpen = false, empty, children }) {
  const [open, setOpen] = useState(defaultOpen);
  const items = Array.isArray(children) ? children : [children];
  return (
    <div className="nav-group">
      <div className="nav-row">
        <button aria-current={active ? 'page' : undefined} className={active ? 'nav-btn active' : 'nav-btn'} onClick={onGo}>{label}</button>
        <button className="nav-toggle" aria-expanded={open} aria-label={`${open ? 'Collapse' : 'Expand'} ${label}`} onClick={() => setOpen(!open)}><span aria-hidden="true">▾</span></button>
      </div>
      {open && <ul className="nav-sub">{items.length && items[0] ? items : <li className="nav-empty">{empty}</li>}</ul>}
    </div>
  );
}

export default function Topbar({ view, onNavigate, problems = [], attempts = [], onOpenProblem, onOpenAttempt }) {
  return (
    <header className="topbar">
      <Logo />
      <nav className="topnav" aria-label="Primary">
        <NavGroup label="Problems" active={view === 'dashboard'} onGo={() => onNavigate('dashboard')} defaultOpen empty="No challenges yet">
          {problems.map((p) => (
            <li key={p.id}><button className="nav-sub-btn" onClick={() => onOpenProblem(p)}><span className="sub-title">{p.title}</span></button></li>
          ))}
        </NavGroup>
        <NavGroup label="My attempts" active={view === 'history'} onGo={() => onNavigate('history')} empty="No attempts yet">
          {attempts.slice(0, 5).map((a) => (
            <li key={a.id}><button className="nav-sub-btn" onClick={() => onOpenAttempt(a)}><span className={`sub-dot ${a.status}`} aria-hidden="true" /><span className="sub-title">{a.title}</span><small>{a.status}</small></button></li>
          ))}
        </NavGroup>
      </nav>
      <div className="topbar-note"><span className="pulse" /> Local workspace</div>
    </header>
  );
}
