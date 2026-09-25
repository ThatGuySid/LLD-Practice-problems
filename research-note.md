# Research Note — Designing Useful LLD Practice Feedback

## 0. Existing approaches and tools (what learners use today)

This is a small, targeted survey (roughly 2–3 hours), not an exhaustive market scan. Three clusters of existing tools cover how learners currently practice LLD/OOD:

**Curated problem + reference-solution content.**
[Educative's "Grokking the Low Level Design Interview Using OOD Principles"](https://www.educative.io/courses/grokking-the-low-level-design-interview-using-ood-principles) (also sold as "Grokking the Object Oriented Design Interview" on designgurus.io) walks through ~20 case studies — Parking Lot, Elevator, and others we also chose — each with a staged class diagram and a reference solution in several languages, ending in a scripted "mock interview" narrative. GitHub repos such as [`ashishps1/awesome-low-level-design`](https://github.com/ashishps1/awesome-low-level-design), [`tssovi/grokking-the-object-oriented-design-interview`](https://github.com/tssovi/grokking-the-object-oriented-design-interview), and [`armankhondker/best-low-level-design-resources`](https://github.com/armankhondker/best-low-level-design-resources) collect the same kind of problem list with one canonical solution per problem. The learner reads a problem, writes their own attempt separately (if at all), and then compares it by eye against someone else's answer. There is no submission model, no feedback on the learner's *own* design, and no attempt history.

**Human-matched mock interviews.** Pramp-style peer matching, [interviewing.io](https://interviewing.io) (anonymous sessions with FAANG engineers, ~$225+/session, written feedback and full replay), and Design Gurus' 1:1 coaching pair a learner with a person who asks about the design live and gives verbal/written feedback. This is high-quality, personalized feedback, but it is synchronous, scheduled, and either expensive or has real wait times — it doesn't scale to "practice repeatedly, on your own schedule," which is the problem statement here.

**Emerging AI mock-interview tools.** Newer voice/chat products — e.g. MockMe.ai (voice interview plus a drawing tool the AI can "see," with a feedback summary afterward) and Mockingly.ai (an adversarial AI interviewer that pushes back on scaling/failure-handling questions, then breaks feedback down by category) — are the closest existing analogue to what this assignment asks for: on-demand, AI-driven, structured feedback. They are built around live conversational system-design interviews (often HLD-leaning: throughput, fault tolerance, sharding) rather than a learner independently writing/drawing an LLD solution and submitting it for review, and none of the ones surveyed here persist a queryable attempt history the way a "did I improve since last time" product would need.

**Gaps this MVP targets.** None of the surveyed tools combine: (1) a small, fixed set of LLD-specific problems, (2) an asynchronous, self-serve "write/draw, submit, come back to feedback" loop instead of a live scheduled session, (3) a rubric that separates deterministic, easy-to-check signals from LLM judgment rather than one open-ended "grade this" prompt, and (4) a persisted attempt history so the same learner can compare a second attempt against the first. That combination — not any single piece of it — is the product direction this prototype pursues.

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

## Sources

- Educative, "Grokking the Low Level Design Interview Using OOD Principles" — https://www.educative.io/courses/grokking-the-low-level-design-interview-using-ood-principles
- `ashishps1/awesome-low-level-design` — https://github.com/ashishps1/awesome-low-level-design
- `tssovi/grokking-the-object-oriented-design-interview` — https://github.com/tssovi/grokking-the-object-oriented-design-interview
- `armankhondker/best-low-level-design-resources` — https://github.com/armankhondker/best-low-level-design-resources
- interviewing.io — https://interviewing.io
- MockMe.ai and Mockingly.ai, surveyed via a mock-interview-platform comparison — https://www.designgurus.io/answers/detail/platforms-offering-interactive-system-design-interview-practice

## Conclusion

The design treats feedback as a learning instrument rather than a leaderboard score. The combination of deterministic checks, structured LLM review, persistent attempt history, and retryable work gives the learner a clear loop: design → submit → understand the evidence → iterate.
