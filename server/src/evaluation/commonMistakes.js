const genericSignals = {
  emptySubmission: ({ text, diagram }) => text.trim().length === 0 && (diagram?.nodes?.length ?? 0) === 0,
  tooShort: ({ text, diagram }) => text.trim().length < 120 && (diagram?.nodes?.length ?? 0) < 2,
  missingWhy: ({ text }) => !/(why|reason|because|trade[- ]?off|decision)/i.test(text),
};

const problemSignals = {
  'parking-lot': [
    ['vehicle', /\bvehicle|car|bike|truck|motorcycle\b/i, 'The submission does not clearly mention a vehicle concept.'],
    ['parking-spot', /\bparking\s*spot|spot\s*type|space\b/i, 'The submission does not clearly model parking spots.'],
    ['ticket', /\bticket|entry|exit\b/i, 'The submission does not clearly address parking entry/exit or tickets.'],
    ['pricing', /\bfee|price|pricing|rate|charge\b/i, 'The submission does not clearly explain fee or pricing behavior.'],
  ],
  'elevator': [
    ['elevator', /\belevator|lift\b/i, 'The submission does not clearly model an elevator/car.'],
    ['request', /\brequest|hall\s*call|floor\s*button\b/i, 'The submission does not clearly model elevator requests.'],
    ['movement', /\bmove|moving|direction|up|down|dispatch|schedule\b/i, 'The submission does not clearly explain movement or scheduling.'],
    ['door', /\bdoor|open|close\b/i, 'The submission does not clearly address door state/behavior.'],
  ],
  'vending-machine': [
    ['inventory', /\binventory|stock|quantity|product\b/i, 'The submission does not clearly model product inventory.'],
    ['payment', /\bpayment|cash|card|money|coin|credit\b/i, 'The submission does not clearly address payment.'],
    ['selection', /\bselect|selection|button|choice\b/i, 'The submission does not clearly address product selection.'],
    ['dispense', /\bdispens|change|refund\b/i, 'The submission does not clearly address dispensing or change/refund behavior.'],
  ],
};

export function detectCode(text) {
  const signals = [
    /```[\s\S]+```/,
    /\b(const|let|var|function|class|interface|public|private|return|async|await)\b/,
    /=>/,
    /[{};][\s\S]*[{};]/,
    /\b(import|export)\s+(?:default\s+)?[\w{]/,
  ];
  return signals.filter((signal) => signal.test(text)).length >= 2;
}

export function runCommonMistakeCheck({
  problemSlug,
  text = '',
  diagram = { nodes: [], edges: [] },
  diagramText = '',
}) {
  const input = { text, diagram };
  const hardFailures = [];
  const hints = [];

  if (genericSignals.emptySubmission(input)) {
    hardFailures.push({ code: 'EMPTY_SUBMISSION', message: 'Add an explanation, code, or a diagram before submitting.' });
    return { hardFailures, hints, detectedCode: false };
  }

  if (genericSignals.tooShort(input)) {
    hints.push({ code: 'THIN_SUBMISSION', message: 'The submission is very small; the evaluator should check whether enough design evidence is present.' });
  }

  if (genericSignals.missingWhy(input)) {
    hints.push({ code: 'NO_DECISION_RATIONALE', message: 'The submission does not visibly explain why key design decisions were made.' });
  }

  // Class/relationship signals (vehicle, ticket, inventory, ...) can live in the
  // diagram alone. Search text + serialized diagram together so a diagram-only
  // submission does not get penalized with false MISSING_* findings.
  const searchableText = diagramText ? `${text}\n${diagramText}` : text;
  for (const [code, signal, message] of problemSignals[problemSlug] || []) {
    if (!signal.test(searchableText)) hints.push({ code: `MISSING_${code.toUpperCase()}`, message });
  }

  if ((diagram?.nodes?.length ?? 0) > 0 && (diagram?.edges?.length ?? 0) === 0) {
    hints.push({ code: 'UNCONNECTED_DIAGRAM', message: 'The diagram contains nodes but no relationships; evaluate whether that weakens the design evidence.' });
  }

  return { hardFailures, hints, detectedCode: detectCode(text) };
}
