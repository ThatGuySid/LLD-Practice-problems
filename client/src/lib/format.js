export function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function codeLooksPresent(text) {
  const signals = [
    /```[\s\S]+```/,
    /\b(const|let|var|function|class|interface|public|private|return|async|await)\b/,
    /=>/,
    /\b(import|export)\s+/, 
    /[{;}][\s\S]*[{;}]/,
  ];
  return signals.filter((signal) => signal.test(text)).length >= 2;
}
