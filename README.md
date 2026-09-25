# Blueprint — CipherSchools LLD Practice Lab

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
- Startup recovery for stale Evaluating jobs
- Attempt history
- Structured evidence / concern / suggestion / confidence feedback
- Tests for precheck, result validation, and code detection

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
```

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

## Assignment documents

- `research-note.md`
- `design-note.md`
- `AI_USAGE.md`
- `CLAUDE.md`

The research/design notes are intentionally written to explain the engineering trade-offs that the prototype demonstrates rather than pretending the MVP is a production LMS.
