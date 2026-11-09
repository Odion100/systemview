import { runDelete } from "./runDelete";

// WHAT THE 🗑 DOES, AND WHETHER IT ASKS FIRST. His ask: *"I need to be able to delete anything… if
// it's not done, then it just gives me a warning"*, and the motive in his words: *"they're nudging
// you — I want to stop myself."*
//
// THE DECISION IS TESTED HERE AND NOWHERE ELSE, which is the whole reason it is a module: the row's
// control and its confirm must never answer differently about the same run. A component deciding
// `plain` in its markup and a confirm deciding `warn` in its own branch is exactly how a press gets
// a warning for a finished run, or none for a live one.

const DONE = { done: 3, total: 3 };
const LIVE = { done: 1, total: 4 };

describe("a run that has ENDED deletes plain", () => {
  // ITS ENDING IS ALREADY ON THE RECORD, so there is nothing left to warn about — and these are the
  // same two endings the × and the nudge chaser already recognise, deliberately: a third opinion
  // about what "finished" means is how the strip starts disagreeing with itself.
  it("every item done", () => {
    expect(runDelete(DONE)).toEqual({ plain: true, warn: false, text: "" });
  });

  it("abandoned WITH its account attached", () => {
    expect(runDelete({ done: 1, total: 4, abandoned: true, accounted: true }).plain).toBe(true);
  });
});

describe("a run that has NOT ended asks first", () => {
  it("warns and says how much is still open", () => {
    const d = runDelete(LIVE);
    expect(d.plain).toBe(false);
    expect(d.warn).toBe(true);
    expect(d.text).toMatch(/3 of 4 still open/);
  });

  // THE WARNING NAMES WHAT DIES, because the record IS the nudging — a run file that is gone is a
  // run nobody chases, and that is the point of the press as much as a risk of it.
  it("says the record and its nudging die with it", () => {
    expect(runDelete(LIVE).text).toMatch(/nudging/);
  });

  // ABANDONED WITHOUT AN ACCOUNT IS THE SHARPEST CASE and gets its own sentence: the chaser does not
  // consider it closed either (c13), so the row and the nudge agree about the same run.
  it("abandoned with nothing attached gets its own warning, not the generic one", () => {
    const d = runDelete({ done: 1, total: 4, abandoned: true, accounted: false });
    expect(d.plain).toBe(false);
    expect(d.text).toMatch(/no account is attached/);
    expect(d.text).not.toMatch(/still open/);
  });
});

describe("the edges a strip actually produces", () => {
  // AN EMPTY LIST IS NOT A FINISHED ONE. `done === total` is true at 0 of 0, and a run whose steps
  // have not been written yet would have deleted silently — the one case where the arithmetic and
  // the meaning come apart.
  it("0 of 0 is not treated as done", () => {
    expect(runDelete({ done: 0, total: 0 }).plain).toBe(false);
  });

  it("no arguments at all still answers, and answers cautiously", () => {
    expect(runDelete().plain).toBe(false);
    expect(runDelete(undefined).warn).toBe(true);
  });

  it("more done than total cannot flip it to plain by accident", () => {
    expect(runDelete({ done: 9, total: 4 }).plain).toBe(false);
  });
});
