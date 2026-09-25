# AI_USAGE.md

## Role of AI in the product

Gemini is used only for the **deep evaluation** portion of a learner's LLD submission. The application deliberately performs deterministic checks before making an LLM call.

## AI-assisted engineering decisions

### 1. Qualitative rubric instead of a single score

**Suggested approach:** represent each criterion as Strong / Adequate / Needs work / Not addressed, with evidence, concern, suggestion, and confidence.

**Accepted:** yes.

**Why:** several LLD solutions can be valid, so a numeric total can imply more precision than the evidence supports. Qualitative levels also make the feedback easier to read and act upon.

### 2. Deterministic precheck before Gemini

**Suggested approach:** catch obvious common mistakes without using an LLM, then provide non-fatal findings to Gemini as hints.

**Accepted:** yes.

**Why:** this reduces avoidable token use and makes a few easy-to-test checks deterministic while leaving broader judgement to the evaluator.

### 3. Swappable evaluator abstraction

**Suggested approach:** isolate evaluation behind an evaluator contract instead of putting Gemini calls directly into route handlers.

**Accepted:** yes.

**Why:** it supports future rule-based evaluation and human evaluation, and makes tests independent of an external AI service.

### 4. React Flow for learner diagrams

**Suggested approach:** use a real node editor and serialize its nodes/edges for the evaluator.

**Accepted:** yes.

**Why:** learners can create diagrams visually while the backend still receives a stable, text-friendly representation for evaluation.

### 5. Async evaluation with persisted status

**Suggested approach:** save the submission first, return immediately, run evaluation in-process, and let the UI poll the database state.

**Accepted:** yes.

**Why:** a slow model call should not make the HTTP request look broken, and persisted state makes retries/recovery visible.

## What AI does not decide

Gemini does not decide the application flow, schema ownership, identity model, or evaluator architecture at runtime. Those are application-level design decisions.

## Limitations

- LLM evaluation remains probabilistic.
- The rubric asks for evidence from the actual submission to reduce unsupported claims.
- The application stores the normalized evaluator output rather than relying on raw model text.
- Gemini availability/configuration is an external dependency; the UI exposes a Failed state when the evaluator cannot complete.
