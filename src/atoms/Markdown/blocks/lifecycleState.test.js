import { TRAILS, stateOf, pressTo, wouldLand, declaredOn } from "./lifecycleState";

const rfc = (state) => ({ id: "RFC-075", kind: "rfc", state });
const TODAY = "2026-10-27";

describe("stateOf — the one reading of a registry row", () => {
  it("a verdict alone is approved; a STATUS heading makes it built", () => {
    expect(stateOf("rfc", rfc({ verdict: "approved" }))).toBe("approved");
    expect(stateOf("rfc", rfc({ verdict: "approved", built: true }))).toBe("built");
  });
  it("settled and retired each win over what came before", () => {
    expect(stateOf("rfc", rfc({ built: true, settled: true }))).toBe("settled");
    expect(stateOf("rfc", rfc({ built: true, settled: true, retired: true }))).toBe("retired");
  });
  it("no verdict at all is a draft, and a rejection is its own ending", () => {
    expect(stateOf("rfc", rfc({}))).toBe("draft");
    expect(stateOf("rfc", rfc({ verdict: "rejected" }))).toBe("rejected");
  });
  it("a gap's resolved= lands on done, which reads as resolved", () => {
    expect(stateOf("gap", { state: { done: true } })).toBe("resolved");
    expect(stateOf("gap", { state: { done: false } })).toBe("open");
  });
  // The absence case the drawer needs: no row, no state — never invent a station.
  it("an unregistered document has no state to read", () => {
    expect(stateOf("rfc", null)).toBe("draft");
    expect(stateOf("report", null)).toBe("filed");
  });
});

describe("pressTo — going forward writes the declaration", () => {
  it("built → settled writes settled= and clears the station past it", () => {
    expect(pressTo("rfc", "settled", rfc({ verdict: "approved", built: true }), TODAY)).toEqual({
      ok: true,
      attrs: { retired: null, settled: TODAY },
    });
  });
  it("settled → retired writes retired=", () => {
    const r = pressTo("rfc", "retired", rfc({ built: true, settled: true }), TODAY);
    expect(r.ok).toBe(true);
    expect(r.attrs.retired).toBe(TODAY);
  });
  it("a gap's resolved station writes resolved=", () => {
    const r = pressTo("gap", "resolved", { state: {} }, TODAY);
    expect(r.ok).toBe(true);
    expect(r.attrs.resolved).toBe(TODAY);
  });
  it("landing on settled clears a retired= sitting past it", () => {
    const r = pressTo("rfc", "settled", rfc({ built: true, retired: true }), TODAY);
    expect(r.ok).toBe(true);
    expect(r.attrs).toEqual({ retired: null, settled: TODAY });
  });
});

describe("pressTo — going back un-says the declaration", () => {
  it("settled → built clears settled=", () => {
    const r = pressTo("rfc", "built", rfc({ verdict: "approved", built: true, settled: true }), TODAY);
    expect(r.ok).toBe(true);
    expect(r.attrs).toEqual({ settled: null, retired: null });
    expect(r.appendStatus).toBeUndefined();
  });
  it("retired → settled clears retired= and keeps settled=", () => {
    const r = pressTo("rfc", "settled", rfc({ built: true, settled: true, retired: true }), TODAY);
    expect(r.ok).toBe(true);
    expect(r.attrs.retired).toBe(null);
  });
});

describe("pressTo — what it REFUSES, and it says why", () => {
  // The one that matters: setAttr cannot remove a ## STATUS heading, so clearing settled= and
  // retired= would leave the document still built. A dead button here would read as "I clicked it
  // and nothing happened" — the exact complaint this whole control exists to answer.
  it("built → approved is refused, because a press cannot unwrite the STATUS heading", () => {
    const r = pressTo("rfc", "approved", rfc({ verdict: "approved", built: true }), TODAY);
    expect(r.ok).toBe(false);
    expect(r.why).toMatch(/approval block's verdict/);
  });
  it("draft → approved is refused — the verdict lives on the approval block", () => {
    const r = pressTo("rfc", "approved", rfc({}), TODAY);
    expect(r.ok).toBe(false);
    expect(r.why).toMatch(/cannot fake it/);
  });
  it("an arc's done is refused — it comes from the objectives", () => {
    const r = pressTo("arc", "done", { state: { done: false } }, TODAY);
    expect(r.ok).toBe(false);
    expect(r.why).toMatch(/objective/);
  });
  it("pressing the station it is already on does nothing and says so", () => {
    expect(pressTo("rfc", "settled", rfc({ settled: true }), TODAY)).toEqual({
      ok: false,
      why: "already settled",
    });
  });
  it("a station that is not on the kind's trail is refused by name", () => {
    expect(pressTo("report", "settled", { state: {} }, TODAY).why).toMatch(/not a station on a report/);
  });
});

describe("pressTo — built is the one derived station a press CAN reach", () => {
  it("approved → built writes the STATUS heading instead of an attribute", () => {
    const r = pressTo("rfc", "built", rfc({ verdict: "approved" }), TODAY);
    expect(r.ok).toBe(true);
    expect(r.appendStatus).toBe(true);
    expect(r.attrs).toEqual({ settled: null, retired: null });
  });
});

describe("wouldLand — the press is simulated by the SAME reader that draws the trail", () => {
  it("agrees with stateOf about where the attributes put it", () => {
    expect(wouldLand("rfc", rfc({ verdict: "approved", built: true }), { settled: TODAY })).toBe("settled");
    expect(wouldLand("rfc", rfc({ built: true, settled: true }), { settled: null })).toBe("built");
    expect(wouldLand("gap", { state: {} }, { resolved: TODAY })).toBe("resolved");
  });
  it("every kind's trail is a list of stations stateOf can actually return", () => {
    Object.keys(TRAILS).forEach((kind) => {
      expect(TRAILS[kind].length).toBeGreaterThan(1);
      expect(TRAILS[kind]).toContain(stateOf(kind, { state: {} }));
    });
  });
});

// THE LEAF WINS OVER THE ROW, and this is the bug it fixes: the registry row is a cache of the last
// parse, so a `settled=` that changed in the file left the trail showing the old station — and the
// press then argued with the cache. He hit it exactly: *"didn't update automatically when you
// changed it"*, and then `settled` would have answered "already settled" about a document whose
// leaf no longer said so, which looks identical to a button that does not work.
describe("declaredOn — the leaf's own attributes, read as state", () => {
  it("reads settled= and retired= off an rfc leaf", () => {
    expect(declaredOn("rfc", { id: "RFC-075", settled: "2026-10-27" })).toEqual({
      settled: true,
      retired: false,
    });
    expect(declaredOn("rfc", { retired: "2026-10-27" })).toEqual({ settled: false, retired: true });
  });
  it("a gap's resolved= lands on done, the shell's own mapping", () => {
    expect(declaredOn("gap", { resolved: "2026-10-27" })).toEqual({ done: true, retired: false });
  });
  // EVERY FLAG, INCLUDING FALSE — this is the whole point. `{}` spread over a row that still said
  // settled would leave the stale value standing, which is the bug it was written to fix.
  it("an absent or empty attribute declares FALSE, not nothing", () => {
    expect(declaredOn("rfc", {})).toEqual({ settled: false, retired: false });
    expect(declaredOn("rfc", { settled: "" })).toEqual({ settled: false, retired: false });
    expect(declaredOn("rfc", { settled: "  " })).toEqual({ settled: false, retired: false });
  });
  it("only the stations a kind declares — an rfc leaf cannot say resolved", () => {
    expect(declaredOn("rfc", { resolved: "2026-10-27" })).toEqual({ settled: false, retired: false });
  });
  // An arc's `done` comes from its objectives, never its leaf, so it must NOT be overridden here.
  it("leaves a station the leaf does not own alone — an arc's done is the objectives'", () => {
    expect(declaredOn("arc", {})).toEqual({ retired: false });
    expect(stateOf("arc", { state: { done: true } }, declaredOn("arc", {}))).toBe("done");
  });
});

describe("stateOf and pressTo read the leaf over a stale row", () => {
  it("a row that still says settled loses to a leaf that no longer does", () => {
    const stale = rfc({ verdict: "approved", built: true, settled: true });
    expect(stateOf("rfc", stale)).toBe("settled");
    expect(stateOf("rfc", stale, declaredOn("rfc", { id: "x" }))).toBe("built");
  });
  // THE PRESS HE COULD NOT MAKE. Row says settled, leaf says it is not — pressing settled has to
  // WRITE, not answer "already settled".
  it("pressing settled against a stale row still writes, because the leaf says it is not settled", () => {
    const stale = rfc({ verdict: "approved", built: true, settled: true });
    expect(pressTo("rfc", "settled", stale, TODAY).ok).toBe(false); // what he hit
    const r = pressTo("rfc", "settled", stale, TODAY, declaredOn("rfc", { id: "x" }));
    expect(r.ok).toBe(true);
    expect(r.attrs.settled).toBe(TODAY);
  });
  it("and a leaf that DOES say settled still refuses a second press", () => {
    const r = pressTo("rfc", "settled", rfc({ built: true }), TODAY, declaredOn("rfc", { settled: TODAY }));
    expect(r).toEqual({ ok: false, why: "already settled" });
  });
});
