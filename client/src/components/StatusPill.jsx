const config = {
  draft: ['Draft', 'neutral'],
  submitted: ['Submitted', 'info'],
  evaluating: ['Evaluating', 'warn'],
  completed: ['Completed', 'success'],
  failed: ['Failed', 'danger'],
};

export default function StatusPill({ status = 'draft' }) {
  const [label, tone] = config[status] || [status, 'neutral'];
  return <span className={`status-pill ${tone}`}><span className="status-dot" />{label}</span>;
}
