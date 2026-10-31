import { keysOfDocument, marksFrom, problemMarks, rollupOf, specKeyOf, tallyOf } from "./specRun";

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
    const ran = { tests: [{ at: "RFCs/proofs/mock-rfc.md#L106", passed: true }] };
    const marks = marksFrom(ran);
    expect(marks["RFCs/proofs/mock-rfc.md#L106"]).toBe("pass");
    // and a spec the answer never mentioned carries NO mark — not run is an absence, never a pass
    expect(marks["RFCs/proofs/mock-rfc-2.md#L36"]).toBeUndefined();
  });
});

describe("the tally — the number that moves while a run is in flight", () => {
  it("counts each state and says whether anything is still going", () => {
    const t = tallyOf({ a: "pass", b: "pass", c: "fail", d: "running", e: "running" });
    expect(t).toEqual({ total: 5, pass: 2, fail: 1, running: 2, settled: 3, moving: true });
  });

  it("a finished run is not moving, and an empty one is neither", () => {
    expect(tallyOf({ a: "pass", b: "fail" }).moving).toBe(false);
    expect(tallyOf({})).toEqual({ total: 0, pass: 0, fail: 0, running: 0, settled: 0, moving: false });
    expect(tallyOf(null).total).toBe(0);
  });
});

describe("one dot for many — and it errs toward red, never toward green", () => {
  const M = { a: "pass", b: "fail", c: "running", d: "running" };

  it("red the moment one of them is", () => {
    expect(rollupOf(["a", "b"], M)).toBe("fail");
    expect(rollupOf(["b", "c"], M)).toBe("fail");
  });

  it("moving while any is, with running outranking queued", () => {
    expect(rollupOf(["a", "c"], M)).toBe("running");
    expect(rollupOf(["a", "d"], M)).toBe("running");
  });

  it("GREEN ONLY WHEN EVERY ONE IS GREEN — a half-run group reading pass is the costly lie", () => {
    expect(rollupOf(["a"], M)).toBe("pass");
    // one of the two has no mark at all: that is not a pass — AND it is not "running" either,
    // which is what it used to claim. A group part-answered with nothing executing says neither,
    // or a single spec run inside a seven-spec arc pulses that arc for the rest of the session.
    expect(rollupOf(["a", "never-run"], M)).toBe("");
  });

  it("nothing marked under it says nothing — an unrun group is not a state", () => {
    expect(rollupOf(["x", "y"], M)).toBe("");
    expect(rollupOf([], M)).toBe("");
  });
});
