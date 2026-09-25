// Attempt lifecycle: draft -> submitted -> evaluating -> completed
//                                   \-> failed          \-> failed -> submitted (rerun)
//                                                        \-> submitted (stale-job recovery)
const TRANSITIONS = {
  draft: ['submitted', 'failed'],
  submitted: ['evaluating'],
  evaluating: ['completed', 'failed', 'submitted'],
  completed: [],
  failed: ['submitted'],
};

export class Attempt {
  constructor(status) {
    this.status = status;
  }

  canTransitionTo(next) {
    return (TRANSITIONS[this.status] || []).includes(next);
  }

  // Throws a 409 if `next` is not a legal move from the current status; returns `next` otherwise.
  assertTransition(next) {
    if (!this.canTransitionTo(next)) {
      throw Object.assign(
        new Error(`Cannot move attempt from "${this.status}" to "${next}".`),
        { statusCode: 409 },
      );
    }
    return next;
  }
}
