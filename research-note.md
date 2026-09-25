# Research Note — Designing Useful LLD Practice Feedback

## 1. What does a learner need to provide for an attempt to be meaningful?

A meaningful LLD attempt needs enough evidence to evaluate both **what** the learner designed and **why**. A class list without responsibilities is weak evidence; a diagram without relationships is also incomplete. The MVP therefore accepts a written explanation plus an optional class diagram. Code is allowed because some learners express interfaces and responsibilities more clearly through code-like sketches.

The required evidence is problem-specific requirements coverage, class/component responsibilities, relationships, relevant state/behavior, trade-offs, and important edge cases. The product does not require a single canonical notation because the assignment explicitly allows a submission format choice.

## 2. What makes feedback useful when several valid designs exist?

Feedback should point to observable evidence instead of declaring one architecture “correct.” The evaluator therefore works criterion by criterion and reports evidence, a concern, a concrete suggestion, and confidence. This creates a useful distinction between “the design is wrong” and “the design can work, but its trade-off has not been explained.”

The retry loop matters: feedback should be actionable enough that a learner can make a new attempt and observe whether the design improved. For this reason the prototype keeps attempts separate instead of overwriting previous work.

## 3. Which parts of evaluation should be deterministic, and which should use an LLM?

Deterministic checks are suitable for obvious mechanical conditions: empty submissions, suspiciously thin submissions, and problem-specific missing signals. These checks are easy to test and do not justify an LLM request.

Broader design judgement is less deterministic. Whether a boundary is cohesive, whether a pattern is justified, or whether a trade-off is reasonable depends on context and evidence. Gemini is therefore used for the deeper review, with deterministic non-fatal findings passed in as hints rather than treated as truth.

## 4. How should the design accommodate another evaluator or submission format?

The evaluation system is isolated behind an evaluator abstraction. A Gemini evaluator can be replaced with a rule-based or human evaluator without changing the submission API. Submission data is also stored in a structured form: explanation text, diagram JSON, serialized diagram, and a detected-code flag. That makes later input formats possible without making evaluation depend on one editor.

## 5. What happens if evaluation is slow or fails?

The application stores the submission before evaluation and returns immediately. The attempt then transitions through Submitted and Evaluating to Completed or Failed. The UI polls persisted status instead of holding an HTTP request open. On server startup, stale Evaluating jobs are reset and reprocessed.

This is intentionally small-scale: a production system could move the work to a durable queue, but the MVP demonstrates the important product behavior without introducing a full job-processing platform.

## Conclusion

The design treats feedback as a learning instrument rather than a leaderboard score. The combination of deterministic checks, structured LLM review, persistent attempt history, and retryable work gives the learner a clear loop: design → submit → understand the evidence → iterate.
