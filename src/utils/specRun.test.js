import { keysOfDocument, marksFrom, problemMarks, queueOf, rollupOf, specKeyOf, tallyOf } from "./specRun";

// WHAT EACH SPEC IS DOING. The claims go on the derivation, never on the dots — the address, the
// join and the rollup are where this can be wrong, and a dot is eyes-only on any day.

const LISTED = {
  documents: [
    { id: "MOCK-RFC", path: "RFCs/proofs/mock-rfc.md", specs: [{ kind: "run", line: 106 }] },
    {
      id: "MOCK-RFC-2",
      path: "RFCs/proofs/mock-rfc-2.md",
      specs: [
        { kind: "run", line: 36 },
        { kind: "test", line: 50 },
      ],
    },
  ],
};

describe("one address, so the listing and the run can finally be joined", () => {
  it("is the PATH and the line — what the hub stamps on every row it runs", () => {
    expect(specKeyOf("RFCs/proofs/mock-rfc.md", 106)).toBe("RFCs/proofs/mock-rfc.md#L106");
    expect(specKeyOf({ id: "MOCK-RFC", path: "RFCs/proofs/mock-rfc.md" }, 106)).toBe("RFCs/proofs/mock-rfc.md#L106");
  });

  it("refuses to invent one — no path or no line is an empty key, never a half address", () => {
    // A guessed address lights the WRONG spec green, which is worse than lighting none.
    expect(specKeyOf("", 3)).toBe("");
    expect(specKeyOf("a.md", 0)).toBe("");
    expect(specKeyOf(null, null)).toBe("");
  });

  it("THE JOIN THE WINDOW NEVER HAD: a hub result lands on the listed spec it came from", () => {
    const listed = queueOf(LISTED);
    const ran = { tests: [{ at: "RFCs/proofs/mock-rfc.md#L106", passed: true }] };
    const marks = { ...listed, ...marksFrom(ran) };
    expect(marks["RFCs/proofs/mock-rfc.md#L106"]).toBe("pass");
    // and the ones that have not run yet are still queued, not quietly passed
    expect(marks["RFCs/proofs/mock-rfc-2.md#L36"]).toBe("queued");
  });
});

describe("the shape of a run before and during", () => {
  it("every spec in scope starts queued — the state that makes a run look like one", () => {
    expect(queueOf(LISTED)).toEqual({
      "RFCs/proofs/mock-rfc.md#L106": "queued",
      "RFCs/proofs/mock-rfc-2.md#L36": "queued",
      "RFCs/proofs/mock-rfc-2.md#L50": "queued",
    });
  });

  it("nothing listed is an empty queue, not a throw", () => {
    expect(queueOf(null)).toEqual({});
    expect(queueOf({ documents: [{ id: "x" }] })).toEqual({});
  });

  it("names the specs of ONE document — what a per-document step is about to run", () => {
    expect(keysOfDocument(LISTED, "MOCK-RFC-2")).toEqual([
      "RFCs/proofs/mock-rfc-2.md#L36",
      "RFCs/proofs/mock-rfc-2.md#L50",
    ]);
    expect(keysOfDocument(LISTED, "NOT-HERE")).toEqual([]);
  });

  it("a row the hub sent with no address is SKIPPED rather than guessed at", () => {
    expect(marksFrom({ tests: [{ passed: true }, { at: "a.md#L1", passed: false }] })).toEqual({ "a.md#L1": "fail" });
    expect(marksFrom(null)).toEqual({});
  });

  it("a spec that could not be BUILT settles as failed — it is not still waiting its turn", () => {
    const ran = { problems: [{ document: "MOCK-RFC-2", line: 50, problem: "a ::test with no namespace names nothing" }] };
    expect(problemMarks(ran, LISTED)).toEqual({ "RFCs/proofs/mock-rfc-2.md#L50": "fail" });
  });

  it("a problem naming a document the listing never had cannot address anything, so it marks nothing", () => {
    expect(problemMarks({ problems: [{ document: "ELSEWHERE", line: 2 }] }, LISTED)).toEqual({});
    expect(problemMarks({ problems: [{ document: "MOCK-RFC" }] }, LISTED)).toEqual({});
  });
});

describe("the tally — the number that moves while a run is in flight", () => {
  it("counts each state and says whether anything is still going", () => {
    const t = tallyOf({ a: "pass", b: "pass", c: "fail", d: "running", e: "queued" });
    expect(t).toEqual({ total: 5, pass: 2, fail: 1, running: 1, queued: 1, settled: 3, moving: true });
  });

  it("a finished run is not moving, and an empty one is neither", () => {
    expect(tallyOf({ a: "pass", b: "fail" }).moving).toBe(false);
    expect(tallyOf({})).toEqual({ total: 0, pass: 0, fail: 0, running: 0, queued: 0, settled: 0, moving: false });
    expect(tallyOf(null).total).toBe(0);
  });
});

describe("one dot for many — and it errs toward red, never toward green", () => {
  const M = { a: "pass", b: "fail", c: "running", d: "queued" };

  it("red the moment one of them is", () => {
    expect(rollupOf(["a", "b"], M)).toBe("fail");
    expect(rollupOf(["b", "c"], M)).toBe("fail");
  });

  it("moving while any is, with running outranking queued", () => {
    expect(rollupOf(["a", "c"], M)).toBe("running");
    expect(rollupOf(["a", "d"], M)).toBe("queued");
  });

  it("GREEN ONLY WHEN EVERY ONE IS GREEN — a half-run group reading pass is the costly lie", () => {
    expect(rollupOf(["a"], M)).toBe("pass");
    // one of the two has no mark at all: that is not a pass, it is a run still short of it
    expect(rollupOf(["a", "never-run"], M)).toBe("running");
  });

  it("nothing marked under it says nothing — an unrun group is not a state", () => {
    expect(rollupOf(["x", "y"], M)).toBe("");
    expect(rollupOf([], M)).toBe("");
  });
});
