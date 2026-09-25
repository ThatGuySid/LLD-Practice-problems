How AI was used

I used AI mainly as a second opinion during the harder design decisions, debugging, and code review. I made the final choices based on the assignment requirements and what made sense for a small 2-day prototype.

1. Qualitative rubric instead of a numeric score

One suggestion was to give each rubric criterion a numeric score and calculate progress from it.

I rejected the idea of an overall score and used:

Strong

Adequate

Needs work

Not addressed

Each criterion also includes evidence, concern, suggestion, and confidence.

The reason was that LLD problems can have more than one valid design. A single number would make the feedback look more objective and precise than it really is.

2. React Flow instead of a text-based diagram format

I considered using Mermaid text for the class diagram because it would have been simpler to store and evaluate.

I chose React Flow instead because the main point of the diagram is to let the learner actually build relationships between classes on the page. The resulting nodes and edges are then serialized into plain text before evaluation.

This added some implementation work, but it made the submission format more useful for an LLD practice product.

3. Deterministic precheck, but keep it separate from the submission model

The initial idea was to check a few common mistakes before calling Gemini. Non-fatal findings are sent to Gemini as hints, while hard failures stop the evaluation.

During implementation, I found a problem with making the precheck directly depend on the submission model: the submission model also uses code-detection logic from the precheck, which would create a circular dependency.

The first fix suggested was to make the checker import the submission model anyway. I rejected that approach.

Instead, the caller serializes the diagram using SubmissionContent and passes the resulting text into the precheck. This kept the precheck as a small, testable function without introducing a circular dependency.

4. Fixing the evaluation race instead of adding more infrastructure

During review, a concurrency bug was found in the evaluation claim query. A broad FOR UPDATE SKIP LOCKED on the joined query could cause an evaluation to be skipped because another submission was holding a related row lock.

The fix was to scope the lock to the evaluation row:

FOR UPDATE OF e SKIP LOCKED

For tests, a suggestion was to introduce a general in-memory SQL engine capable of parsing arbitrary joins and locking clauses. I rejected that because it was far too much infrastructure for this project.

I used a small fake database driver that models the specific transaction and row-locking behaviour needed by the evaluation service. The application itself still uses real PostgreSQL.

5. Preserve submissions when Gemini fails

The original flow already saved the submission before starting background evaluation. During testing, it became clear that a failed Gemini call should not force the learner to recreate the same work.

I added a rerun path:

Failed → Pending → Evaluating → Completed / Failed

The existing submission is kept and only the evaluation is reset. This also fits the assignment's requirement to handle slow or failed evaluation without turning the prototype into a distributed system.

What AI does not decide

The product scope, final technology choices, learner identity model, database ownership, and overall application structure are application decisions. Gemini is used at runtime to provide structured feedback on learner submissions; it does not decide how the platform itself is designed.

Limitations

LLM feedback is probabilistic, so the rubric is based on evidence rather than a single absolute score.

The deterministic checks intentionally cover only a small set of common mistakes.

Gemini availability and response time are external dependencies.
