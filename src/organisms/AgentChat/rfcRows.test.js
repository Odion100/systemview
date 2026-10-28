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
    expect(rfcRows([doc("RFC-075", { state: { built: true, settled: true } })])[0].state).toBe("settled");
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
      doc("RFC-020", { state: { built: true, settled: true, approvals: 1 } }),
      doc("RFC-030", { state: {} }),
    ]);
    expect(rows.map((r) => r.id)).toEqual(["RFC-020", "RFC-030", "RFC-010"]);
  });
  it("with nothing waiting, it runs down the lifecycle and then by number", () => {
    const rows = rfcRows([
      doc("RFC-010", { state: { built: true, settled: true } }),
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
