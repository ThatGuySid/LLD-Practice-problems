# Design Note — Blueprint LLD Practice Lab

## Architecture

```text
React client
   │
   │ HTTP + X-Learner-Id
   ▼
Express API
   ├── Problem routes
   ├── Attempt routes
   └── Submission route
          │
          ├── deterministic precheck
          └── EvaluationService
                 └── Evaluator interface
                       └── GeminiEvaluator
          │
          ▼
      PostgreSQL
```

## Domain model

### Problem
A seeded LLD challenge with a problem statement, summary, and explicit requirements.

### Attempt
A learner's try at one problem. An attempt begins as a draft and ends as submitted, evaluating, completed, or failed.

### Submission
The evidence associated with an attempt: explanation text plus the learner's diagram representation.

### Evaluation
The processing record for a submission, including status, precheck output, retry count, timestamps, and normalized evaluator result.

### Feedback
One criterion-level record for each rubric dimension. It stores a qualitative rating, evidence, concern, suggestion, and confidence.

## Evaluation strategy

The important boundary is:

```text
EvaluationService → Evaluator
```

`GeminiEvaluator` implements that contract. The service does not need to know how the evaluator works. A future rule-based evaluator or human-review adapter can implement the same interface.

## Rubric

The eight criteria are:

1. Requirements coverage
2. Responsibilities
3. Cohesion & coupling
4. Encapsulation & interfaces
5. Abstraction & patterns
6. Extensibility
7. Edge cases & testability
8. Explanation quality

Each criterion returns a qualitative rating, evidence, concern, suggestion, and confidence. There is no overall numeric score.

## Database

The schema keeps lifecycle state in `attempts` and evaluation state in `evaluations`, while `submissions` contains the learner's evidence. `feedback` is normalized at criterion level so the UI can display and query it without parsing free-form model prose.

The migration runner records applied SQL files in `schema_migrations` and runs each migration in a transaction.

## Asynchronous flow

```text
POST submission
   ↓
store submission + evaluation pending
   ↓
return 202
   ↓
background claim
   ↓
status = evaluating
   ↓
Gemini / evaluator
   ↓
store result + feedback
   ↓
status = completed
```

A hard deterministic precheck failure skips the Gemini call and marks the attempt failed.

## Duplicate/retry considerations

Each attempt has at most one submission and one evaluation. A submission endpoint can only mutate a draft attempt. Evaluation claiming uses `FOR UPDATE SKIP LOCKED` and a status transition from pending to evaluating, which prevents two workers in the same process from claiming the same evaluation simultaneously.

If the process dies while a job is evaluating, server startup resets stale evaluation locks and requeues those submissions.

## Extensibility

Potential future additions:

- Rule-based evaluator implementation
- Human-review evaluator
- Additional LLD problems
- Additional submission formats, such as uploaded code files
- Durable queue / worker service for production workloads
- Authenticated learners
- Richer side-by-side attempt comparison

None of those require the learner submission model to become coupled to Gemini.
