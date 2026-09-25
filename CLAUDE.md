# CLAUDE.md — CipherSchools LLD Assignment Handoff

This file is the continuity source of truth for future Claude sessions.

## Project

Blueprint: a small LLD practice / evaluation platform.

Core loop:

Choose problem → start attempt → explain/draw → submit → precheck → Gemini evaluation → feedback → retry.

## Locked stack

- React.js + Vite
- JavaScript
- React Flow via `@xyflow/react`
- Node.js
- Express.js
- PostgreSQL
- `pg`
- Hand-written SQL migrations
- Gemini REST API via plain `fetch`
- No Prisma, Sequelize, Knex, or Gemini SDK

## Locked product decisions

- Seed exactly: Parking Lot, Elevator, Vending Machine.
- No login/authentication.
- Client generates a UUID and stores it in localStorage.
- Client sends it as `X-Learner-Id`.
- Learner ID is stored directly on attempts; no learners table.
- Attempt model: draft on start, one submission per attempt, retry creates a fresh attempt.
- Drafts are autosaved to the server while the attempt remains editable.
- React Flow is the graph editor. Diagram nodes/edges are serialized to text before evaluation.
- Common-mistake precheck runs before Gemini.
- Hard precheck failures stop evaluation.
- Non-fatal findings are passed to Gemini as hints.
- Evaluation is asynchronous in-process.
- UI polls persisted status.
- Stale Evaluating jobs are reset/retried on server startup.
- Evaluation result is qualitative, not numeric.
- Ratings: Strong / Adequate / Needs work / Not addressed.
- Every rubric criterion has evidence, concern, suggestion, confidence.
- No overall score.
- Gemini is a replaceable evaluator implementation.
- Final delivery: one ZIP of the complete repo.

## Evaluation rubric

1. Requirements coverage
2. Responsibilities
3. Cohesion & coupling
4. Encapsulation & interfaces
5. Abstraction & patterns
6. Extensibility
7. Edge cases & testability
8. Explanation quality

## Current implementation

### Server

- `src/index.js` — Express application + startup recovery
- `src/db/pool.js` — pg pool/transactions
- `src/db/migrate.js` — repeatable SQL migration runner
- `src/db/seed.js` — seeded problem data
- `src/evaluation/commonMistakes.js` — deterministic precheck + code detection
- `src/evaluation/evaluator.js` — evaluator contract
- `src/evaluation/geminiEvaluator.js` — Gemini REST implementation
- `src/evaluation/schema.js` — evaluator output schema + validation
- `src/evaluation/service.js` — submit/claim/process/recover orchestration
- `src/routes/problems.js`
- `src/routes/attempts.js`
- `src/routes/submissions.js`

### Client

- `src/App.jsx` — route/view orchestration
- `src/views/Dashboard.jsx`
- `src/views/History.jsx`
- `src/views/Editor.jsx`
- `src/views/Result.jsx`
- `src/components/GraphEditor.jsx` — React Flow editor
- `src/components/StatusPill.jsx`
- `src/components/RatingPill.jsx`
- `src/styles.css` — product UI styling

### Documentation

- `README.md`
- `AI_USAGE.md`
- `research-note.md`
- `design-note.md`

## Tests

- Server: `server/tests/commonMistakes.test.js`
- Client: `client/src/lib/format.test.js`

## Important implementation notes

- The Gemini key must stay server-side.
- Never expose GEMINI_API_KEY in React/Vite environment variables.
- Use parameterized PostgreSQL queries.
- Do not silently add an ORM.
- Keep evaluator-specific logic out of route handlers.
- Do not change qualitative evaluation back to numeric scoring without an explicit product decision.
- If adding a new evaluator, implement the evaluator contract and wire it through the EvaluationService.
- If adding a new submission format, preserve the submission/evaluation boundary.

## UI direction

The frontend uses a dark, editorial/product-lab style: high-contrast typography, restrained green accent, compact cards, visible state, roomy editor canvas, and practical information density. React Flow should remain an actual interactive design canvas, not a static image.

The previously requested `ui-ux-pro-max` tool/skill was not available in this environment's installed tool catalog, so the frontend was implemented directly using the intended UX principles rather than pretending that an unavailable tool had been used.

## Known environment limitation during this build

`psql` is not installed in the current container, so the PostgreSQL migration cannot be executed here. The SQL files and runner are included; run them against a local PostgreSQL instance with `npm run migrate`.

## Next Claude should do

1. Install dependencies in both `server` and `client`.
2. Run server tests and client tests/build.
3. Inspect/fix any npm/version/API compatibility issue.
4. With PostgreSQL available, run migrations + seed and manually exercise the API.
5. Put a real Gemini API key in `server/.env` and test one end-to-end evaluation.
6. Verify the UI flow in a browser.
7. Rebuild `project.zip` after any changes.

## Momentum decisions inferred from prior discussion

The previous Claude asked for a choice about attempt/submission relationships and migration execution, then the user explicitly instructed it to use earlier preferences and start. To keep momentum, this implementation used:

- Attempt/submission: draft attempt created when starting; one submission per attempt; retry creates a new attempt; draft autosave is enabled.
- Migrations: explicit `npm run migrate` custom runner with applied-file tracking; migrations are not run automatically as a startup side effect.

These are documented so a future Claude can change them deliberately rather than unknowingly.
