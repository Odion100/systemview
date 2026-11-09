import { nowLine } from "./nowLine";

const step = (text, state) => ({ id: text, text, state });

describe("the sentence a run's row leads with", () => {
  it("names the active step, because that is what the reader came for", () => {
    expect(nowLine([step("a", "done"), step("walk the claims", "active"), step("c", "pending")]))
      .toBe("walk the claims");
  });

  it("says complete only when every step is done", () => {
    expect(nowLine([step("a", "done"), step("b", "done")])).toBe("plan complete");
    expect(nowLine([step("a", "done"), step("b", "pending")])).toBe("planning");
  });

  // THE STATE THE NUDGE EXISTS FOR. Nothing active and not finished is its own problem, and a row
  // that read "working" there would hide exactly the thing being chased.
  it("never reads as progress when nothing is active and the work is not done", () => {
    expect(nowLine([step("a", "pending"), step("b", "pending")])).toBe("planning");
  });

  // AN EMPTY LIST IS NOT A FINISHED ONE — `done === length` is true of zero, which is the most
  // confident possible lie about a run nobody has written yet.
  it("does not call an empty list complete", () => {
    expect(nowLine([])).toBe("planning");
    expect(nowLine(null)).toBe("planning");
    expect(nowLine(undefined)).toBe("planning");
  });

  // THE WORDS ARE THE CALLER'S: a session's list is a PLAN, a job's is a RUN, and he wrote both.
  it("takes the caller's nouns, so one grammar can serve two kinds of row", () => {
    const asJob = { complete: "run complete", idle: "nothing active" };
    expect(nowLine([step("a", "done")], asJob)).toBe("run complete");
    expect(nowLine([step("a", "pending")], asJob)).toBe("nothing active");
    expect(nowLine([step("x", "active")], asJob)).toBe("x");
  });

  it("ignores an active step with no words rather than drawing a blank line", () => {
    expect(nowLine([step("", "active"), step("b", "pending")])).toBe("planning");
    expect(nowLine([{ state: "active" }, step("b", "done")])).toBe("planning");
  });
});
