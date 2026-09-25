# LLD Practice Lab

A small, end-to-end LLD practice product built for the CipherSchools hiring assignment.

The product loop is:

**Choose problem → Start attempt → Explain + draw → Submit → deterministic precheck → Gemini evaluation → feedback → retry**

## Stack

- React + Vite
- React Flow (`@xyflow/react`) for the class diagram editor
- Node.js + Express
- PostgreSQL + `pg`
- Hand-written SQL migrations
- Gemini REST API via Node's built-in `fetch`

React Flow's current package is `@xyflow/react`; the project follows the current v12 package/import style.

## What is implemented

- Three seeded LLD challenges: Parking Lot, Elevator, Vending Machine
- Anonymous browser identity via `localStorage`
- Draft attempts with server-side autosave
- One submission per attempt
- Retry creates a fresh attempt
- Text explanation with lightweight code detection
- Drag-and-drop class diagram with React Flow
- Diagram serialization into a plain-text relationship map for evaluation
- Deterministic common-mistake precheck
- Hard precheck failures stop the LLM call
- Non-fatal precheck findings become Gemini hints
- Replaceable evaluator abstraction
- Gemini structured JSON evaluation with qualitative ratings
- Evaluation statuses: Draft → Submitted → Evaluating → Completed / Failed
- In-process background evaluation and polling
- Startup recovery for stale Evaluating jobs **and** orphaned Pending jobs (e.g. left behind by a restart)
- Re-run path for a failed evaluation that keeps the original submission (no new attempt needed)
- Small domain layer (`Attempt` lifecycle transitions, `SubmissionContent` normalization/serialization) shared by the submit and draft-save paths
- Attempt history
- Structured evidence / concern / suggestion / confidence feedback
- Tests for precheck (including diagram-aware prechecking), result validation, code detection, the evaluation-claim race, evaluator failure handling, startup recovery, and the failed-evaluation rerun path

## Run locally

### 1. Prerequisites

- Node.js 20+
- PostgreSQL 14+

### 2. Database

Create a database, for example:

```sql
CREATE DATABASE cipherschools_lld;
```

Copy `server/.env.example` to `server/.env` and set `DATABASE_URL` and `GEMINI_API_KEY`.

### 3. Install dependencies

```bash
cd server
npm install
npm run migrate
npm run seed

cd ../client
npm install
```

### 4. Start the API

```bash
cd server
npm run dev
```

API: `http://localhost:4000`

### 5. Start the React app

```bash
cd client
npm run dev
```

App: `http://localhost:5173`

## Gemini configuration

Gemini is called by the **server only**, so the API key never reaches the browser.

The integration sends a `generateContent` request with structured JSON output configuration.

Environment variables:

```text
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-3.8-flash
```

The model can be changed without changing application code.

## API surface

```text
GET    /api/health
GET    /api/problems
GET    /api/problems/:id
GET    /api/attempts?learnerId=...
POST   /api/attempts
GET    /api/attempts/:id
PATCH  /api/attempts/:id/draft
POST   /api/submissions/:attemptId/submit
POST   /api/submissions/:attemptId/rerun
```

## Design decisions

These are the calls I made and why — the fuller trade-off discussion is in `design-note.md`, and the specific points where AI input factored into a decision are in `AI_USAGE.md`.

- **No overall numeric score.** LLD problems have more than one valid solution, so a single number would look more precise than the evidence supports. Each rubric criterion instead returns one of Strong / Adequate / Needs work / Not addressed, plus evidence, a concern, a suggestion, and a confidence level.
- **React Flow, not a text-only diagram format.** The point of the diagram is for the learner to actually build class relationships, not just describe them. Nodes and edges are serialized into a plain-text relationship map before evaluation, so the diagram still feeds the same precheck and evaluator pipeline as the written explanation.
- **Deterministic precheck before any Gemini call.** Obvious mechanical issues (an empty submission, a diagram-only submission with no prose, missing problem-specific signals) are caught first. Hard failures stop before an LLM request is made; softer findings are passed to Gemini as hints rather than treated as failures — this is because the precheck is heuristic and can miss valid but unconventional designs.
- **Evaluator behind an interface.** `EvaluationService` talks to an `Evaluator` contract, not directly to Gemini. `GeminiEvaluator` is the only implementation today, but a rule-based or human-review evaluator could be added without touching the submission flow.
- **Submission preserved on evaluator failure.** The submission is stored and the request returns before evaluation runs. If Gemini itself fails, a rerun path resets only the evaluation record and re-queues it — the learner doesn't need to redo the work just because the model call failed.
- **Row-locking over a job queue.** Evaluation claiming uses PostgreSQL's `FOR UPDATE ... SKIP LOCKED`, scoped to the evaluation row. This is enough correctness for a single-instance prototype without introducing a queue and worker process; it wouldn't scale past what one Postgres instance's lock manager can do, which is a documented limitation rather than a hidden one.

## Evaluation design

The evaluator is behind an application-level abstraction. The first implementation is `GeminiEvaluator`, but a future `RuleBasedEvaluator` or `HumanEvaluator` can implement the same contract without changing attempt submission or feedback persistence.

The deterministic precheck runs first:

```text
submission
   ↓
common-mistake check
   ├── hard failure → Failed, no Gemini request
   └── hints → Gemini with hints
```

The qualitative rubric deliberately avoids an overall 0–100 score. Every criterion returns one of:

- Strong
- Adequate
- Needs work
- Not addressed

plus evidence, concern, suggestion, and confidence.

## Testing

Server:

```bash
cd server
npm test
```

Client:

```bash
cd client
npm test
npm run build
```

## Limitations

- **Anonymous identity only.** Learners are identified by a `localStorage`-generated id with no login; clearing browser storage or switching devices loses attempt history. There's no accounts/auth system.
- **In-process background evaluation, not a durable queue.** Evaluation is driven by `queueMicrotask` inside the same Node process that received the HTTP request. Startup recovery requeues anything left `pending` or stuck `evaluating`, but there's no multi-instance coordination — running more than one server process against the same database would need a real job queue instead.
- **Single evaluator, one call per submission.** There's no retry/backoff around the Gemini call itself (a `rerunFailedEvaluation` path lets the _learner_ retry manually), no streaming of partial results, and no evaluator-side rate limiting.
- **Deterministic precheck is heuristic.** It's regex/keyword-based (see `server/src/evaluation/commonMistakes.js`), so it can miss unconventional naming or synonyms. This is why only unambiguous cases (e.g. a genuinely empty submission) are hard failures; everything else becomes a hint passed to Gemini rather than a blocking failure.
- **Three seeded problems.** Adding a new LLD problem currently means a seed-data change plus new problem-specific precheck signals in `commonMistakes.js`; there's no admin UI for authoring problems.
- **No side-by-side attempt comparison.** Attempt history lists past attempts, but there's no diff/comparison view between two attempts at the same problem yet.
- **Test environment caveat:** the automated tests in this repository run against an in-memory fake database (`server/tests/support/fakeDb.js`), not a live PostgreSQL instance. Run `npm test` with a real `DATABASE_URL` configured to exercise the real driver end to end before relying on this in a non-prototype setting.

## How AI was used

I used AI as a second opinion during the harder design decisions, debugging, and code review — not as the source of the product direction. The research direction, the MVP scope, and the final call on every design decision below were mine; where a suggestion changed my approach, or where I rejected one, that's recorded in `AI_USAGE.md` with the reasoning. A few examples: I turned down a suggestion for a numeric overall score in favor of the qualitative rubric described above, and turned down a general-purpose in-memory SQL engine for testing the concurrency fix in favor of a small fake driver scoped to the queries this service actually issues.

The research/design notes are intentionally written to explain the engineering trade-offs that the prototype demonstrates rather than pretending the MVP is a production LMS.
