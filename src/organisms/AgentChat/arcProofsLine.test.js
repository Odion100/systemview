import { lightLine } from "./arcProofsLine";

// THE DRAWER'S LIGHT PROGRESS. The claim that matters most is the quiet one: the bus holds ONE run,
// so a row must not print another arc's numbers.

const ran = (o) => ({ scope: { arc: "ARC-4" }, running: false, ran: o });

describe("a row speaks about its own arc, or says nothing", () => {
  it("SAYS NOTHING when the run was a different arc — the bus holds one run for everybody", () => {
    expect(lightLine({ scope: { arc: "ARC-9" }, ran: { passed: 3, failed: 0, tests: [{}] } }, "ARC-4")).toBe(null);
  });

  it("says nothing for an objective- or document-scoped run, which is not this row's", () => {
    expect(lightLine({ scope: { objective: "ARC-4-O1" }, ran: { passed: 1, tests: [{}] } }, "ARC-4")).toBe(null);
    expect(lightLine({ scope: { document: "RFC-900" }, ran: { passed: 1, tests: [{}] } }, "ARC-4")).toBe(null);
    expect(lightLine({ scope: { project: "sv" }, ran: { passed: 1, tests: [{}] } }, "ARC-4")).toBe(null);
  });

  it("says nothing with no state, no arc, or nothing run yet", () => {
    expect(lightLine(null, "ARC-4")).toBe(null);
    expect(lightLine({ scope: { arc: "ARC-4" } }, "ARC-4")).toBe(null);
    expect(lightLine({ scope: { arc: "ARC-4" }, ran: { passed: 1 } }, "")).toBe(null);
  });
});

describe("what it says when the run is its own", () => {
  it("running beats any previous count", () => {
    expect(lightLine({ scope: { arc: "ARC-4" }, running: true, ran: { passed: 9 } }, "ARC-4")).toEqual({
      text: "running",
      tone: "running",
    });
  });

  it("a clean run says how many passed", () => {
    expect(lightLine(ran({ passed: 7, failed: 0, tests: [{}] }), "ARC-4")).toEqual({ text: "7 passed", tone: "pass" });
  });

  // FAILURES LEAD. The count he needs at a glance is the bad one; "6 passed" beside a failure would
  // read as a clean run.
  it("a failing run leads with the failures, not the passes", () => {
    expect(lightLine(ran({ passed: 6, failed: 1, tests: [{}] }), "ARC-4")).toEqual({ text: "1 failed", tone: "fail" });
  });

  // A RUN OF FOUR WITH A FIFTH UNBUILT IS NOT A CLEAN FOUR, and this row may be the only thing he
  // looks at — so the unbuilt count rides along even here.
  it("carries the unbuilt count, because a thinner run must not read as a pass", () => {
    expect(lightLine(ran({ passed: 4, failed: 0, tests: [{}], problems: [{}, {}] }), "ARC-4")).toEqual({
      text: "4 passed · 2 unbuilt",
      tone: "pass",
    });
    expect(lightLine(ran({ passed: 0, failed: 2, tests: [{}], problems: [{}] }), "ARC-4")).toEqual({
      text: "2 failed · 1 unbuilt",
      tone: "fail",
    });
  });

  it("an error with nothing run is said short, not spun on", () => {
    expect(lightLine(ran({ error: "no connected services for sv", tests: [] }), "ARC-4")).toEqual({
      text: "no specs",
      tone: "none",
    });
  });

  it("a run with zero of each says so rather than claiming a pass", () => {
    expect(lightLine(ran({ passed: 0, failed: 0, tests: [] }), "ARC-4")).toEqual({ text: "no specs", tone: "none" });
  });
});
