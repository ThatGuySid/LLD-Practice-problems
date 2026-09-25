let counter = 0;
function id(prefix) {
  counter += 1;
  return `${prefix}_${counter}`;
}

// Builds a `createFakeDb` seed with one problem and, for each entry in
// `attempts`, an attempt + submission + pending evaluation ready to be
// claimed — i.e. the state right after a successful submitAttempt() call.
export function buildSeed({ problemSlug = 'parking-lot', attempts = [{}] } = {}) {
  const problem = {
    id: id('problem'),
    slug: problemSlug,
    title: 'Parking Lot',
    summary: 'summary',
    prompt: 'prompt',
    requirements: ['req'],
  };

  const seed = { problems: [problem], attempts: [], submissions: [], evaluations: [] };
  const ids = [];

  for (const overrides of attempts) {
    const attemptId = id('attempt');
    const submissionId = id('submission');
    const evaluationId = id('evaluation');
    seed.attempts.push({
      id: attemptId,
      learner_id: 'learner',
      problem_id: problem.id,
      status: overrides.attemptStatus || 'submitted',
    });
    seed.submissions.push({
      id: submissionId,
      attempt_id: attemptId,
      text_content: overrides.textContent ?? 'Vehicle enters, gets a ticket, pays a fee at the spot.',
      diagram_json: { nodes: [], edges: [] },
      serialized_diagram: overrides.serializedDiagram ?? '',
      detected_code: false,
    });
    seed.evaluations.push({
      id: evaluationId,
      submission_id: submissionId,
      status: overrides.evaluationStatus || 'pending',
      precheck_json: { hardFailures: [], hints: [] },
      result_json: null,
      error_message: overrides.errorMessage ?? null,
      attempt_count: overrides.attemptCount || 0,
      locked_at: overrides.lockedAt || null,
    });
    ids.push({ attemptId, submissionId, evaluationId });
  }

  return { seed, problem, ids };
}

export function fakeEvaluationResult(summary = 'Reviewed.') {
  return {
    summary,
    criteria: [
      { criterion_key: 'requirements', rating: 'Adequate', evidence: 'e', concern: 'c', suggestion: 's', confidence: 'High' },
      { criterion_key: 'responsibilities', rating: 'Adequate', evidence: 'e', concern: 'c', suggestion: 's', confidence: 'High' },
      { criterion_key: 'coupling', rating: 'Adequate', evidence: 'e', concern: 'c', suggestion: 's', confidence: 'High' },
      { criterion_key: 'encapsulation', rating: 'Adequate', evidence: 'e', concern: 'c', suggestion: 's', confidence: 'High' },
      { criterion_key: 'abstraction', rating: 'Adequate', evidence: 'e', concern: 'c', suggestion: 's', confidence: 'High' },
      { criterion_key: 'extensibility', rating: 'Adequate', evidence: 'e', concern: 'c', suggestion: 's', confidence: 'High' },
      { criterion_key: 'edge_cases', rating: 'Adequate', evidence: 'e', concern: 'c', suggestion: 's', confidence: 'High' },
      { criterion_key: 'explanation', rating: 'Adequate', evidence: 'e', concern: 'c', suggestion: 's', confidence: 'High' },
    ],
  };
}
