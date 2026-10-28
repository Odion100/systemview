import { TRAILS, stateOf, pressTo, wouldLand, declaredOn, GROUP_OF, reasonOf, reasonsFor, stepsFor, missingProof, STATE_WORDS, RETIRE_REASONS, RETIRE_ATTR, objectiveComplete } from "./lifecycleState";

const rfc = (state) => ({ id: "RFC-075", kind: "rfc", state });
const TODAY = "2026-10-27";

describe("stateOf — the one reading of a registry row", () => {
  it("a verdict alone is approved; a STATUS heading makes it built", () => {
    expect(stateOf("rfc", rfc({ verdict: "approved" }))).toBe("approved");
    expect(stateOf("rfc", rfc({ verdict: "approved", built: true }))).toBe("built");
  });
  it("settled and retired each win over what came before", () => {
    expect(stateOf("rfc", rfc({ verdict: "approved", built: true, settled: true  }))).toBe("settled");
    expect(stateOf("rfc", rfc({ verdict: "approved", built: true, settled: true, retired: true  }))).toBe("retired");
  });
  it("no verdict at all is a draft, and a rejection is its own ending", () => {
    expect(stateOf("rfc", rfc({}))).toBe("draft");
    expect(stateOf("rfc", rfc({ verdict: "rejected" }))).toBe("rejected");
  });
  // The row's `done` is the host's own fold of both halves (declared AND proved), so reading it
  // straight is still right — the renderer only has to do the folding when it is reading a LEAF.
  it("a gap's done on the row reads as resolved, because the host already folded both halves", () => {
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
  // RFC-076 §4.2 — CLEARING `retired=` NOW TAKES ITS REASON WITH IT. A document pulled back into
  // service still carrying `retiredAs=shelf` would be a live row stating the reason it was put down: a
  // fact about a state it is no longer in, which every surface would read as current.
  it("built → settled writes settled= and clears the station past it, reason and all", () => {
    expect(pressTo("rfc", "settled", rfc({ verdict: "approved", built: true }), TODAY)).toEqual({
      ok: true,
      attrs: { retired: null, retiredAs: null, supersededBy: null, settled: TODAY },
    });
  });
  // AND RETIRING TAKES A REASON (§4.2). The old press wrote `retired=` on its own; it cannot any
  // more, because the reason is what replaced the gate — see the refusals block below.
  it("settled → retired writes retired= and the reason it was given", () => {
    const r = pressTo("rfc", "retired", rfc({ verdict: "approved", built: true, settled: true  }), TODAY, null, "out-of-service");
    expect(r.ok).toBe(true);
    expect(r.attrs.retired).toBe(TODAY);
    expect(r.attrs.retiredAs).toBe("out-of-service");
  });
  // A gap is resolved by declaration AND evidence (RFC-076 §4.5), so the row has to carry
  // `hasProof` before the press can land — a leaf saying `resolved=` with nothing behind it is
  // the one state in the system that should be hardest to claim being the easiest.
  it("a gap's resolved station writes resolved=, once there is a proof to stand on", () => {
    const r = pressTo("gap", "resolved", { state: { hasProof: true } }, TODAY);
    expect(r.ok).toBe(true);
    expect(r.attrs.resolved).toBe(TODAY);
  });
  it("landing on settled clears a retired= sitting past it", () => {
    const r = pressTo("rfc", "settled", rfc({ verdict: "approved", built: true, retired: true  }), TODAY);
    expect(r.ok).toBe(true);
    expect(r.attrs).toEqual({ retired: null, retiredAs: null, supersededBy: null, settled: TODAY });
  });
});

describe("pressTo — going back un-says the declaration", () => {
  it("settled → built clears settled=", () => {
    const r = pressTo("rfc", "built", rfc({ verdict: "approved", built: true, settled: true }), TODAY);
    expect(r.ok).toBe(true);
    expect(r.attrs).toEqual({ settled: null, retired: null, retiredAs: null, supersededBy: null });
    expect(r.appendStatus).toBeUndefined();
  });
  it("retired → settled clears retired= and keeps settled=", () => {
    const r = pressTo("rfc", "settled", rfc({ verdict: "approved", built: true, settled: true, retired: true  }), TODAY);
    expect(r.ok).toBe(true);
    expect(r.attrs.retired).toBe(null);
  });
});

describe("pressTo — what it REFUSES, and it says why", () => {
  // The one that matters: setAttr cannot remove a ## STATUS heading, so clearing settled= and
  // retired= would leave the document still built. A dead button here would read as "I clicked it
  // and nothing happened" — the exact complaint this whole control exists to answer.
  // THIS TEST'S NAME WAS RIGHT AND ITS ASSERTION WAS WRONG, which is how c21 shipped mismatched:
  // the name says the STATUS heading, the assertion checked for the verdict, and the message the
  // code actually produced was the verdict one. A blind review read c21's words against c21's
  // quoted message and caught it. The message now says what both the name and the claim ask.
  it("built → approved is refused, because a press cannot unwrite the STATUS heading", () => {
    const r = pressTo("rfc", "approved", rfc({ verdict: "approved", built: true }), TODAY);
    expect(r.ok).toBe(false);
    expect(r.why).toMatch(/cannot unwrite the ## STATUS heading/);
  });
  it("draft → approved is refused — the verdict lives on the approval block", () => {
    const r = pressTo("rfc", "approved", rfc({}), TODAY);
    expect(r.ok).toBe(false);
    expect(r.why).toMatch(/cannot fake it/);
  });
  // An arc's forward states all derive upward — approved from the verdicts, inProgress and settled
  // from the fold over the plans attached to its objectives — so each is refused by name.
  it("an arc's settled is refused — it folds up from the plans, in their own documents", () => {
    const r = pressTo("arc", "settled", { state: { verdict: "approved", objectives: { total: 2, planned: 1, complete: 0 } } }, TODAY);
    expect(r.ok).toBe(false);
    expect(r.why).toMatch(/plans being settled/);
  });
  it("and inProgress is refused the same way — attaching plans is what moves it", () => {
    const r = pressTo("arc", "inProgress", { state: { verdict: "approved", objectives: { total: 2, planned: 1, complete: 0 } } }, TODAY);
    expect(r.ok).toBe(false);
    expect(r.why).toMatch(/plan attached/);
  });
  it("pressing the station it is already on does nothing and says so", () => {
    expect(pressTo("rfc", "settled", rfc({ verdict: "approved", settled: true  }), TODAY)).toEqual({
      ok: false,
      why: "already settled",
    });
  });
  it("a station that is not on the kind's trail is refused by name", () => {
    expect(pressTo("report", "settled", { state: {} }, TODAY).why).toMatch(/not a station on a report/);
  });
});

describe("the empty-set floor — an arc with no objectives never settles", () => {
  // `[].every(…)` is true, so without the total floor an empty arc would take the whole trail for
  // free. It reads approved — the decision was made — and nothing above, because there is nothing
  // to have finished.
  it("no objectives reads approved, never inProgress or settled", () => {
    const st = { verdict: "approved", objectives: { total: 0, planned: 0, complete: 0 } };
    expect(stateOf("arc", { state: st })).toBe("approved");
  });
  it("and objectiveComplete says the empty set is not complete", () => {
    expect(objectiveComplete([])).toEqual({ total: 0, settled: 0, planned: false, complete: false });
    expect(objectiveComplete([{ settled: true }])).toMatchObject({ complete: true });
    expect(objectiveComplete([{ settled: true }, { settled: false }])).toMatchObject({ complete: false });
  });
});

describe("pressTo — built is the one derived station a press CAN reach", () => {
  it("approved → built writes the STATUS heading instead of an attribute", () => {
    const r = pressTo("rfc", "built", rfc({ verdict: "approved" }), TODAY);
    expect(r.ok).toBe(true);
    expect(r.appendStatus).toBe(true);
    expect(r.attrs).toEqual({ settled: null, retired: null, retiredAs: null, supersededBy: null });
  });
});

describe("wouldLand — the press is simulated by the SAME reader that draws the trail", () => {
  it("agrees with stateOf about where the attributes put it", () => {
    expect(wouldLand("rfc", rfc({ verdict: "approved", built: true }), { settled: TODAY })).toBe("settled");
    expect(wouldLand("rfc", rfc({ verdict: "approved", built: true, settled: true  }), { settled: null })).toBe("built");
    // §4.5 — simulating the press has to agree with the state, including about the proof: with no
    // evidence in the document the press does NOT land on resolved, which is how `pressTo` knows
    // to refuse it. Same function, both answers.
    expect(wouldLand("gap", { state: {} }, { resolved: TODAY })).toBe("open");
    expect(wouldLand("gap", { state: { hasProof: true } }, { resolved: TODAY })).toBe("resolved");
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
  // `resolved=` declares its OWN flag rather than landing on `done`, because done needs a second
  // fact the leaf cannot carry: a proof somewhere in the document.
  it("a gap's resolved= declares its own half, and done is no longer the leaf's to give", () => {
    expect(declaredOn("gap", { resolved: "2026-10-27" })).toEqual({
      resolvedDeclared: true,
      rejected: false,
      retired: false,
    });
    // And the half it cannot give: with nothing in the row to say a proof exists, the declaration
    // on its own does not reach `resolved` — which is the state §4.5 made unfakeable.
    expect(stateOf("gap", { state: {} }, declaredOn("gap", { resolved: "2026-10-27" }))).toBe("open");
    expect(stateOf("gap", { state: { hasProof: true } }, declaredOn("gap", { resolved: "2026-10-27" }))).toBe(
      "resolved"
    );
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
  // An arc's completion comes from the fold over its plans, never its leaf, so the leaf declares
  // only its retirement — and the hand-ticked `done` flag decides nothing about the state.
  it("leaves the stations the leaf does not own alone — an arc declares only retired", () => {
    expect(declaredOn("arc", {})).toEqual({ retired: false });
    expect(
      stateOf(
        "arc",
        { state: { verdict: "approved", objectives: { total: 1, planned: 1, complete: 1 } } },
        declaredOn("arc", {})
      )
    ).toBe("settled");
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
    const r = pressTo("rfc", "settled", rfc({ verdict: "approved", built: true  }), TODAY, declaredOn("rfc", { settled: TODAY }));
    expect(r).toEqual({ ok: false, why: "already settled" });
  });
});

// ─── RFC-076 §4.2/§4.3 — RETIREMENT CARRIES A REASON, AND THE REASON REPLACED THE GATE ─────────
//
// The gate used to be *"you can only retire something finished"* — except it never actually was:
// measured 2026-10-28, `pressTo` already returned ok for `retired` from every state on every kind,
// so §4.3's premise that it "refuses a retire that is not reachable" was false on disk. What was
// genuinely missing is the thing the gate was standing in for: the REASON. These hold that the
// reason is required, narrowed by where you stand, grouped, and cleared when the retirement is.

describe("the retirement reasons — a closed list, because conditions branch on it", () => {
  it("groups each reason as an ending or a pause, and endings leave the lists", () => {
    expect(GROUP_OF("cancelled")).toBe("ending");
    expect(GROUP_OF("superseded")).toBe("ending");
    expect(GROUP_OF("out-of-service")).toBe("ending");
    expect(GROUP_OF("shelf")).toBe("pause");
    expect(GROUP_OF("sideline")).toBe("pause");
  });
  // c6's half: a reason nobody put on the list is NEITHER, and nothing may guess it into a group.
  // Defaulting it either way would be inventing a decision — and this is the exact shape the
  // report collision produces, since a retired `as=planning` report arrives here as "planning".
  it("a reason nobody put on the list is neither an ending nor a pause", () => {
    expect(GROUP_OF("planning")).toBe("");
    expect(GROUP_OF("binned")).toBe("");
    expect(GROUP_OF("")).toBe("");
    expect(GROUP_OF(undefined)).toBe("");
    expect(reasonOf("planning")).toBe(null);
  });
  // c16, both halves in one test, which is how the claim is written.
  it("narrows the WORDS by where you stand — cancelled from draft, out of service from settled", () => {
    const fromDraft = reasonsFor("draft").map((r) => r.id);
    expect(fromDraft).toContain("cancelled");
    expect(fromDraft).not.toContain("out-of-service");

    const fromSettled = reasonsFor("settled").map((r) => r.id);
    expect(fromSettled).toContain("out-of-service");
    expect(fromSettled).not.toContain("cancelled");
  });
  it("a pause is offered from everywhere, because putting something down is always available", () => {
    ["draft", "approved", "built", "settled", "open", "resolved", "filed"].forEach((s) => {
      const ids = reasonsFor(s).map((r) => r.id);
      expect(ids).toContain("shelf");
      expect(ids).toContain("sideline");
      expect(ids).toContain("superseded");
    });
  });
  // The one judgement call, stated rather than inferred: a report is never "done", so `filed` is
  // neither finished nor unfinished — a planning report that went nowhere was cancelled, a spec
  // report whose subject is gone is out of service, and both are honest.
  it("a report's filed offers every reason, because it is neither finished nor unfinished", () => {
    expect(reasonsFor("filed")).toHaveLength(5);
  });
});

describe("pressTo — the reason is what the gate became", () => {
  // THE CASE THE OLD GATE WAS SUPPOSED TO BLOCK, now going through with the right word on it.
  it("cancelled from draft goes through — the press was never the thing to refuse", () => {
    const r = pressTo("rfc", "retired", rfc({}), TODAY, null, "cancelled");
    expect(r.ok).toBe(true);
    expect(r.attrs).toEqual({ retired: TODAY, retiredAs: "cancelled" });
  });
  it("retiring with no reason at all is refused, and the refusal lists what you CAN say", () => {
    const r = pressTo("rfc", "retired", rfc({}), TODAY);
    expect(r.ok).toBe(false);
    expect(r.why).toMatch(/needs a reason/);
    expect(r.why).toMatch(/cancelled/);
  });
  it("a word that is not on the list is refused by name, not written anyway", () => {
    const r = pressTo("rfc", "retired", rfc({}), TODAY, null, "binned");
    expect(r.ok).toBe(false);
    expect(r.why).toMatch(/binned is not a retirement reason/);
  });
  // The narrowing lives in the pure module, not only in the control — so the rule cannot be
  // bypassed by anything that calls pressTo directly.
  it("a reason that does not belong where you stand is refused in both directions", () => {
    expect(pressTo("rfc", "retired", rfc({}), TODAY, null, "out-of-service").why).toMatch(
      /not something you can say from draft/
    );
    expect(
      pressTo("rfc", "retired", rfc({ verdict: "approved", built: true, settled: true }), TODAY, null, "cancelled").why
    ).toMatch(/not something you can say from settled/);
  });
  // c7 — superseded cannot be completed without naming what replaced it, and the pointer lands on
  // the leaf beside the reason.
  it("superseded with nothing named is refused; with a document named it writes the pointer", () => {
    expect(pressTo("rfc", "retired", rfc({}), TODAY, null, "superseded").why).toMatch(/superseded by what/);
    const r = pressTo("rfc", "retired", rfc({}), TODAY, null, "superseded", "RFC-081");
    expect(r.ok).toBe(true);
    expect(r.attrs).toEqual({ retired: TODAY, retiredAs: "superseded", supersededBy: "RFC-081" });
  });
  it("every kind can be retired, with the word that fits where it is", () => {
    expect(pressTo("arc", "retired", { state: {} }, TODAY, null, "shelf").attrs.retiredAs).toBe("shelf");
    expect(pressTo("gap", "retired", { state: {} }, TODAY, null, "cancelled").attrs.retiredAs).toBe("cancelled");
    expect(pressTo("report", "retired", { state: {} }, TODAY, null, "sideline").attrs.retiredAs).toBe("sideline");
    expect(pressTo("gap", "retired", { state: { done: true } }, TODAY, null, "out-of-service").attrs.retiredAs).toBe(
      "out-of-service"
    );
  });
  // Un-retiring: the reason has to go, or the document carries why it was put down while standing.
  it("coming back off retired clears the reason and the pointer with it", () => {
    const r = pressTo("rfc", "settled", rfc({ verdict: "approved", built: true, settled: true, retired: true  }), TODAY);
    expect(r.ok).toBe(true);
    expect(r.attrs.retired).toBe(null);
    expect(r.attrs.retiredAs).toBe(null);
    expect(r.attrs.supersededBy).toBe(null);
  });
});

// ─── RFC-076 §4.5 — A GAP FORKS, AND ONE SIDE NEEDS EVIDENCE ────────────────────────────────────
//
// `resolved=` was a declaration with nothing behind it, which made the one state in the system that
// should be hardest to claim the easiest. It now needs a PROOF in the document; and the trail gained
// a second ending that shares no term with the first, which is what makes it a fork and not a line.

describe("a gap's resolved needs a proof, which is the state a press cannot outrun", () => {
  // c8 — the claim, exactly as written.
  it("c8 · saying resolved with nothing runnable in the document does not reach resolved", () => {
    expect(stateOf("gap", { state: { resolvedDeclared: true } })).toBe("open");
    const r = pressTo("gap", "resolved", { state: {} }, TODAY);
    expect(r.ok).toBe(false);
    expect(r.why).toMatch(/evidence, not by saying so/);
  });
  // c18 — and the refusal is an INSTRUCTION, not a wall: `needs` is what lets the control offer
  // to write the block instead of only reporting that one is missing.
  it("c18 · the refusal names what to add, and flags that the control can add it", () => {
    const r = pressTo("gap", "resolved", { state: {} }, TODAY);
    expect(r.needs).toBe("proof");
    expect(r.why).toMatch(/run, a cmd or a test/);
  });
  // c9 — add the proof, change nothing else.
  it("c9 · with a proof in the document and nothing else changed, it reads resolved", () => {
    expect(stateOf("gap", { state: { resolvedDeclared: true, hasProof: true } })).toBe("resolved");
    expect(missingProof("gap", { state: { hasProof: true } })).toBe("");
  });
  it("a proof with no declaration is not resolved either — both halves, or neither", () => {
    expect(stateOf("gap", { state: { hasProof: true } })).toBe("open");
  });
  // Only a gap owes this. Nothing else in the system has a proof condition on its state.
  it("missingProof is a gap's question and nobody else's", () => {
    expect(missingProof("rfc", { state: {} })).toBe("");
    expect(missingProof("arc", { state: {} })).toBe("");
    expect(missingProof("report", { state: {} })).toBe("");
  });
});

describe("a gap's second ending — rejected, with a reason", () => {
  // c11, both halves: it reads rejected, and it does NOT read resolved.
  it("c11 · a rejection with a reason reads rejected, and never resolved", () => {
    const r = pressTo("gap", "rejected", { state: {} }, TODAY, declaredOn("gap", {}), "wontfix");
    expect(r.ok).toBe(true);
    expect(r.attrs.rejected).toBe(TODAY);
    expect(r.attrs.why).toBe("wontfix");
    expect(stateOf("gap", { state: { rejected: true } })).toBe("rejected");
    expect(stateOf("gap", { state: { rejected: true } })).not.toBe("resolved");
  });
  it("a rejection with no reason is refused — declined on purpose must not read as neglect", () => {
    const r = pressTo("gap", "rejected", { state: {} }, TODAY, declaredOn("gap", {}));
    expect(r.ok).toBe(false);
    expect(r.why).toMatch(/say why this is declined/);
  });
  // THE FORK IS MUTUALLY EXCLUSIVE IN BOTH DIRECTIONS. The trail's ordering handles one; `EXCLUDES`
  // handles the other. A document saying both would be a contradiction no press should create.
  it("rejecting a resolved gap un-resolves it, and resolving a rejected one un-rejects it", () => {
    const no = pressTo("gap", "rejected", { state: { hasProof: true } }, TODAY, declaredOn("gap", { resolved: TODAY }), "wontfix");
    expect(no.attrs.resolved).toBe(null);
    const yes = pressTo("gap", "resolved", { state: { hasProof: true } }, TODAY, declaredOn("gap", { rejected: TODAY }));
    expect(yes.attrs.rejected).toBe(null);
  });
  // A document that somehow carries both: the surface must make the WEAKER claim. Reading it as
  // resolved would assert that a proof exists and the thing is closed; rejected asserts less.
  it("a document carrying both endings reads as the one that claims less", () => {
    expect(stateOf("gap", { state: { rejected: true, resolvedDeclared: true, hasProof: true } })).toBe("rejected");
  });
});

describe("stepsFor — a trail never draws a station the document cannot reach", () => {
  it("from open, both of a gap's endings are drawn, and rejected is marked an alternative", () => {
    const { steps, alt } = stepsFor("gap", "open");
    expect(steps).toEqual(["open", "resolved", "rejected", "retired"]);
    expect(alt).toEqual(["rejected"]);
  });
  it("once it took one side, the other is gone — no fork drawn as history", () => {
    expect(stepsFor("gap", "resolved").steps).toEqual(["open", "resolved", "retired"]);
    expect(stepsFor("gap", "rejected").steps).toEqual(["open", "rejected", "retired"]);
  });
  // THE ONE THAT WOULD HAVE BEEN A LIE. A retired gap drawn with both endings marks BOTH as past —
  // the trail claiming the document walked through two mutually exclusive states.
  it("a retired gap draws the ending it actually took, and none if it took neither", () => {
    expect(stepsFor("gap", "retired", { state: { rejected: true } }).steps).toEqual(["open", "rejected", "retired"]);
    expect(stepsFor("gap", "retired", { state: { resolvedDeclared: true } }).steps).toEqual([
      "open",
      "resolved",
      "retired",
    ]);
    // Cancelled straight from open: there is no middle, and drawing one would invent a step.
    expect(stepsFor("gap", "retired", { state: {} }).steps).toEqual(["open", "retired"]);
  });
  it("a rejected RFC still shows its real ending and nothing after it", () => {
    expect(stepsFor("rfc", "rejected").steps).toEqual(["draft", "rejected"]);
    expect(stepsFor("rfc", "built").steps).toEqual(TRAILS.rfc);
  });
  // Every station a trail can draw must be one `stateOf` can actually return, or the lit station
  // would never match and the trail would read as un-started forever.
  it("every drawn station is one stateOf can return", () => {
    const sayable = { rfc: ["draft", "approved", "built", "settled", "rejected", "retired"], gap: ["open", "resolved", "rejected", "retired"] };
    Object.entries(sayable).forEach(([kind, words]) => {
      ["open", "draft", "resolved", "rejected", "retired", "built", "settled"].forEach((from) => {
        stepsFor(kind, from).steps.forEach((s) => expect(words).toContain(s));
      });
    });
  });
});

// ─── c23 — A PRESS WRITES THE FACT, NEVER THE STATE, ASSERTED AGAINST `pressTo` ITSELF ──────────
//
// The first version of this check was a hand-typed list of eight attribute bags, and a blind review
// of this RFC's claims caught what that buys: if `pressTo` started writing a state word tomorrow,
// a transcription of what it USED to write would still pass. So this enumerates every kind, every
// station and every retirement reason, calls the real function, and inspects what comes back.

describe("c23 — nothing a press writes is a state word", () => {
  const ROWS = {
    rfc: [{}, { verdict: "approved" }, { verdict: "approved", built: true, claims: { total: 1, met: 1 } }, { verdict: "approved", built: true, settled: true, claims: { total: 1, met: 1 } }],
    arc: [{}, { done: true, objectives: { done: 1, total: 1, planned: 1 } }],
    gap: [{}, { hasProof: true }, { hasProof: true, done: true }, { rejected: true }],
    report: [{}],
  };

  it("every ok press, on every kind from every state, writes only dates, reasons and pointers", () => {
    let presses = 0;
    Object.entries(ROWS).forEach(([kind, states]) => {
      (TRAILS[kind] || []).forEach((station) => {
        states.forEach((state) => {
          // Try every reason too, since retirement is the station that takes a word.
          const words = station === "retired" ? RETIRE_REASONS.map((r) => r.id) : station === "rejected" ? ["wontfix"] : [""];
          words.forEach((word) => {
            const r = pressTo(kind, station, { id: "X", kind, state }, TODAY, null, word, "RFC-081");
            if (!r.ok) return;
            presses += 1;
            Object.entries(r.attrs).forEach(([k, v]) => {
              if (v == null) return; // a cleared declaration is an absence, not a value
              const val = String(v).toLowerCase();
              // THE WHOLE CLAIM, in one assertion: no value a press writes is a state word.
              expect(STATE_WORDS.has(val)).toBe(false);
              // And what it IS: a date, a reason from the closed list, a free reason, or a pointer.
              const isDate = /^\d{4}-\d{2}-\d{2}$/.test(String(v));
              expect(isDate || [RETIRE_ATTR, "why", "supersededBy"].includes(k)).toBe(true);
            });
          });
        });
      });
    });
    // A guard on the guard: if the enumeration stopped producing presses, everything above passes
    // vacuously and the claim would read as held by a loop that ran zero times.
    expect(presses).toBeGreaterThan(20);
  });

  it("and the one free-text reason in the system cannot smuggle a state word in", () => {
    // `why=` on a gap's rejection is free text by design — §3 describes a closed list but never
    // names its members — so this was the hole c23's wording covers and nothing checked.
    const r = pressTo("gap", "rejected", { state: {} }, TODAY, declaredOn("gap", {}), "resolved");
    expect(r.ok).toBe(false);
    expect(r.why).toMatch(/is a state, not a reason/);
    expect(pressTo("gap", "rejected", { state: {} }, TODAY, declaredOn("gap", {}), "wontfix").ok).toBe(true);
  });

  // c21's refusal, which a blind review found said the wrong thing: it named the verdict (true of
  // going forward, beside the point going back) where the claim asks it to name the heading.
  it("c21 · going back to approved from built names the HEADING, not the verdict", () => {
    const r = pressTo("rfc", "approved", rfc({ verdict: "approved", built: true }), TODAY);
    expect(r.ok).toBe(false);
    expect(r.why).toMatch(/cannot unwrite the ## STATUS heading/);
  });

  // §2's ordering: every state above draft contains "verdicts approved = true". A STATUS heading
  // over no verdict used to read `built` — caught by trying to write this RFC's own STATUS line.
  it("no verdict is draft, whatever else the row carries", () => {
    expect(stateOf("rfc", rfc({ built: true, claims: { total: 1, met: 1 } }))).toBe("draft");
    expect(stateOf("rfc", rfc({ built: true, settled: true }))).toBe("draft");
    expect(stateOf("rfc", rfc({ verdict: "approved", built: true }))).toBe("built");
  });
});
