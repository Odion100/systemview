import rfcRows, { rfcIdFromPath, titleOf, rfcLine } from "./rfcRows";

// THE BAND'S RFC ROWS. These used to feed the derivation a document's TEXT and let it parse approval
// blocks for a state of its own — which is exactly the bug he found: the row said `1 to approve`
// about a document whose own trail said **built**. The state now comes off the registry row, from
// the same function that draws the trail, and the approval count is a separate flag.

const doc = (id, { state, text = "" } = {}) => ({
  path: `RFCs/${id}-something.md`,
  text,
  row: state === undefined ? undefined : { id, kind: "rfc", path: `RFCs/${id}-something.md`, state },
});

describe("rfcIdFromPath — the number is the identity", () => {
  it("takes the id off the path, whatever follows it", () => {
    expect(rfcIdFromPath("RFCs/RFC-072-arc-planning-and-execution.md")).toBe("RFC-072");
    expect(rfcIdFromPath("docs/designs/rfc-009-thing.md")).toBe("RFC-009");
  });
  it("a file that is not an RFC has no id", () => {
    expect(rfcIdFromPath(".systemview/report.x.md")).toBe("");
  });
});

describe("titleOf — the title the document gives itself", () => {
  it("takes the h1 and strips the number the row already shows", () => {
    expect(titleOf("# RFC-075 — A claim carries its proof\n\nbody")).toBe("A claim carries its proof");
  });
  it("falls back to the filename when there is no heading", () => {
    expect(titleOf("", "RFCs/RFC-074-karaoke.md")).toBe("karaoke");
  });
});

describe("the state is the LIFECYCLE state — one definition, the trail's own", () => {
  it("reads built, settled and retired, which the old reader could not say at all", () => {
    expect(rfcRows([doc("RFC-075", { state: { verdict: "approved", built: true } })])[0].state).toBe("built");
    expect(rfcRows([doc("RFC-075", { state: { verdict: "approved", built: true, settled: true  } })])[0].state).toBe("settled");
    expect(rfcRows([doc("RFC-073", { state: { verdict: "approved" } })])[0].state).toBe("approved");
    expect(rfcRows([doc("RFC-053", { state: {} })])[0].state).toBe("draft");
    expect(rfcRows([doc("RFC-040", { state: { verdict: "rejected" } })])[0].state).toBe("rejected");
  });
  // Absence stated beats a state invented — the same rule the trail follows when there is no row.
  it("says nothing about a document the shell has not parsed", () => {
    const [r] = rfcRows([doc("RFC-099")]);
    expect(r.state).toBe("");
    expect(rfcLine(r)).toBe("");
  });
});

describe("the approval count is a FLAG, not the state", () => {
  // THE BUG HE FOUND, pinned: built and still asking for an approval says both.
  it("a built RFC with an approval outstanding still reads built", () => {
    const [r] = rfcRows([doc("RFC-075", { state: { verdict: "approved", built: true, approvals: 1 } })]);
    expect(r.state).toBe("built");
    expect(r.waiting).toBe(1);
    expect(rfcLine(r)).toBe("built · 1 to approve");
  });
  it("nothing outstanding is just the state", () => {
    const [r] = rfcRows([doc("RFC-073", { state: { verdict: "approved", built: true, approvals: 0 } })]);
    expect(rfcLine(r)).toBe("built");
  });
  it("a rejected RFC stays in the list and says it is closed", () => {
    const [r] = rfcRows([doc("RFC-040", { state: { verdict: "rejected" } })]);
    expect(rfcLine(r)).toBe("rejected — closed");
  });
  it("a draft with two waiting says both halves", () => {
    const [r] = rfcRows([doc("RFC-060", { state: { approvals: 2 } })]);
    expect(rfcLine(r)).toBe("draft · 2 to approve");
  });
});

describe("the order he reads it in", () => {
  // WHAT IS WAITING ON HIM STILL LEADS — the tab exists for that — but it is the flag that decides
  // it now, so a settled document with an approval nobody will press no longer outranks a draft
  // asking to be decided... and equally, being built no longer buries a real ask.
  it("anything with an approval outstanding comes first, whatever state it is in", () => {
    const rows = rfcRows([
      doc("RFC-010", { state: { verdict: "approved", built: true } }),
      doc("RFC-020", { state: { verdict: "approved", built: true, settled: true, approvals: 1  } }),
      doc("RFC-030", { state: {} }),
    ]);
    expect(rows.map((r) => r.id)).toEqual(["RFC-020", "RFC-030", "RFC-010"]);
  });
  it("with nothing waiting, it runs down the lifecycle and then by number", () => {
    const rows = rfcRows([
      doc("RFC-010", { state: { verdict: "approved", built: true, settled: true  } }),
      doc("RFC-020", { state: {} }),
      doc("RFC-030", { state: { verdict: "approved" } }),
      doc("RFC-040", { state: { verdict: "approved" } }),
    ]);
    expect(rows.map((r) => r.id)).toEqual(["RFC-020", "RFC-040", "RFC-030", "RFC-010"]);
  });
  it("a file with no RFC number is not a row", () => {
    expect(rfcRows([{ path: "notes/thoughts.md", text: "# hi", row: { state: {} } }])).toEqual([]);
  });
});

// ─── RFC-076 §4.2 — ENDINGS LEAVE THE LIST, PAUSES STAY IN IT ──────────────────────────────────
//
// c17, and it is the whole point of the reason being a closed vocabulary: the lists BRANCH on the
// group. An ending is a decision that this document is finished with, so leaving it here costs
// every future reader a re-read to reject it. A pause is the opposite — the reason you shelved
// something is that you meant to come back, and a shelved document that vanished from the list
// would be a deletion wearing a softer word.

const retired = (id, as) => doc(id, { state: { verdict: "approved", built: true, retired: true, retiredAs: as } });

describe("the retirement reason decides whether the row is still here", () => {
  it("c17 · an ending leaves the active list", () => {
    expect(rfcRows([retired("RFC-020", "cancelled")])).toHaveLength(0);
    expect(rfcRows([retired("RFC-021", "superseded")])).toHaveLength(0);
    expect(rfcRows([retired("RFC-022", "out-of-service")])).toHaveLength(0);
  });

  it("c17 · a pause stays in the list, showing its reason", () => {
    const [shelved] = rfcRows([retired("RFC-023", "shelf")]);
    expect(shelved).toBeTruthy();
    expect(shelved.state).toBe("retired");
    expect(rfcLine(shelved)).toBe("retired — shelf");

    const [parked] = rfcRows([retired("RFC-024", "sideline")]);
    expect(rfcLine(parked)).toBe("retired — sideline");
  });

  it("the ending leaves and the pause stays, in one list — which is the claim as written", () => {
    const rows = rfcRows([retired("RFC-030", "cancelled"), retired("RFC-031", "shelf")]);
    expect(rows.map((r) => r.id)).toEqual(["RFC-031"]);
  });

  // c6's other half. A reason the system cannot read must NOT be filed as either — and the row
  // STAYS, because a document disappearing from the list on the strength of a word nothing
  // understood is strictly worse than one that is still there admitting the problem. This is also
  // the exact shape the `as=` collision produces: a retired `as=planning` report arrives here.
  it("c6 · a reason nobody put on the list keeps the row, and the line says it cannot be read", () => {
    const [r] = rfcRows([retired("RFC-040", "planning")]);
    expect(r).toBeTruthy();
    expect(r.retireGroup).toBe("");
    expect(rfcLine(r)).toMatch(/not a reason anything can read/);
  });

  // A retirement with no reason at all is the pre-RFC-076 document — every one already on disk.
  // It stays listed, and says only what it knows.
  it("a retirement written before any of this stays listed and says just retired", () => {
    const [r] = rfcRows([doc("RFC-050", { state: { verdict: "approved", built: true, retired: true  } })]);
    expect(r).toBeTruthy();
    expect(rfcLine(r)).toBe("retired");
  });

  // The flag still rides on top: a shelved document with an unpressed approval still asks.
  it("a paused row still says what it is waiting on", () => {
    const [r] = rfcRows([
      doc("RFC-060", { state: { verdict: "approved", built: true, retired: true, retiredAs: "shelf", approvals: 2 } }),
    ]);
    expect(rfcLine(r)).toBe("retired — shelf · 2 to approve");
  });
});

// THE ID IS THE IDENTITY (RFC-073) — the row's, not the filename's. Reading the number out of the
// path meant a registered RFC whose file is not named `RFC-nnn-*.md` was invisible in the drawer
// while its trail rendered perfectly in the document: registered, derived, listed nowhere.

describe("the id comes off the registry row, not the filename", () => {
  it("a registered RFC with a non-numbered filename is still a row", () => {
    const [r] = rfcRows([
      { path: "RFCs/proofs/mock-rfc.md", text: "# MOCK — an RFC you can push around", row: { id: "MOCK-RFC", kind: "rfc", state: {} } },
    ]);
    expect(r).toBeTruthy();
    expect(r.id).toBe("MOCK-RFC");
  });
  it("the path is the fallback for a document the shell has not parsed yet", () => {
    const [r] = rfcRows([{ path: "RFCs/RFC-072-arc-planning.md", text: "" }]);
    expect(r.id).toBe("RFC-072");
  });
  it("no id on the row and none in the path is not a row", () => {
    expect(rfcRows([{ path: "meetings/some-notes.md", text: "" }])).toHaveLength(0);
  });
  // An id with no number sorts to the bottom of its group rather than throwing or jumping the
  // queue — it is not in play, it is furniture.
  it("an id with no number in it sorts last among its peers", () => {
    const rows = rfcRows([
      { path: "RFCs/proofs/mock-rfc.md", text: "", row: { id: "MOCK-RFC", kind: "rfc", state: {} } },
      { path: "RFCs/RFC-001-a.md", text: "", row: { id: "RFC-001", kind: "rfc", state: {} } },
    ]);
    expect(rows.map((r) => r.id)).toEqual(["RFC-001", "MOCK-RFC"]);
  });
});
