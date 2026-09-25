export default function Logo({ compact = false }) {
  return (
    <div className="brand">
      <div className="brand-mark" aria-hidden="true">B</div>
      {!compact && <div><div className="brand-name">Blueprint</div><div className="brand-sub">LLD practice lab</div></div>}
    </div>
  );
}
