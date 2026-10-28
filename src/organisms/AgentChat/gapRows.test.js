import gapRows, { gapLine, gapIdFromPath } from "./gapRows";

// THE BAND'S GAP ROWS. A gap had no surface anywhere — arcs, RFCs and reports each got a tab and
// the one kind written INTO SOMEBODY ELSE'S repo, the kind that most needs finding by a person who
// did not file it, was invisible. What these pin is the distinction the row exists to show: an open
// gap with its proof already in the file is one press from closed, and that is not the same
// situation as an open gap nobody has touched.

const doc = (id, { state, text = "" } = {}) => ({
  path: `gaps/${id}-something.md`,
  text,
  row: state === undefined ? undefined : { id, kind: "gap", path: `gaps/${id}-something.md`, state },
});

describe("the id is the row's, and the path is only a fallback", () => {
  it("takes the id off the registry row whatever the file is called", () => {
    const [r] = gapRows([{ path: "RFCs/proofs/mock-gap.md", text: "", row: { id: "MOCK-GAP", kind: "gap", state: {} } }]);
    expect(r.id).toBe("MOCK-GAP");
  });
  it("falls back to the filename for a document the shell has not parsed", () => {
    expect(gapIdFromPath("gaps/G-12-karaoke.md")).toBe("G-12");
    expect(gapIdFromPath("gaps/notes.md")).toBe("");
  });
  it("a file with no id anywhere is not a row", () => {
    expect(gapRows([{ path: "gaps/notes.md", text: "" }])).toHaveLength(0);
  });
});

describe("what the row says it is waiting for", () => {
  // THE ROW THIS SURFACE EXISTS FOR. Somebody fixed the thing and left the evidence; all that is
  // missing is the press, and nothing anywhere else shows that.
  it("open with a proof already in the file reads as ready, and flags", () => {
    const [r] = gapRows([doc("G-1", { state: { hasProof: true } })]);
    expect(r.state).toBe("open");
    expect(r.hasProof).toBe(true);
    expect(gapLine(r)).toBe("open · proof ready");
  });
  it("open with nothing in it is just open", () => {
    expect(gapLine(gapRows([doc("G-2", { state: {} })])[0])).toBe("open");
  });
  // The row must not read "resolved" where the derivation refuses to — that would be the surface
  // disagreeing with the state, which is the whole defect this RFC exists to remove.
  it("a resolved= written with no proof behind it says what is missing, not resolved", () => {
    const [r] = gapRows([doc("G-3", { state: { resolvedDeclared: true } })]);
    expect(r.state).toBe("open");
    expect(gapLine(r)).toBe("open · says resolved, no proof in it");
  });
  it("both halves present is resolved", () => {
    const [r] = gapRows([doc("G-4", { state: { resolvedDeclared: true, hasProof: true } })]);
    expect(r.state).toBe("resolved");
    expect(gapLine(r)).toBe("resolved");
  });
  it("a declined gap carries its reason, because without it it reads as neglect", () => {
    const [r] = gapRows([doc("G-5", { state: { rejected: true, rejectedWhy: "wontfix" } })]);
    expect(r.state).toBe("rejected");
    expect(gapLine(r)).toBe("declined — wontfix");
  });
  it("and a declined gap with no reason says only that it was declined", () => {
    expect(gapLine(gapRows([doc("G-6", { state: { rejected: true } })])[0])).toBe("declined");
  });
  it("a document the shell has not parsed says nothing at all", () => {
    const [r] = gapRows([doc("G-7")]);
    expect(r.state).toBe("");
    expect(gapLine(r)).toBe("");
  });
});

describe("retirement — endings leave, pauses stay", () => {
  const retired = (id, as) => doc(id, { state: { resolvedDeclared: true, hasProof: true, retired: true, retiredAs: as } });
  it("an ending leaves the list", () => {
    expect(gapRows([retired("G-10", "out-of-service")])).toHaveLength(0);
    expect(gapRows([retired("G-11", "cancelled")])).toHaveLength(0);
  });
  it("a pause stays, showing its reason", () => {
    const [r] = gapRows([retired("G-12", "shelf")]);
    expect(gapLine(r)).toBe("retired — shelf");
  });
  it("one rule for every kind — the ending goes and the pause stays, in one list", () => {
    const rows = gapRows([retired("G-20", "cancelled"), retired("G-21", "sideline")]);
    expect(rows.map((r) => r.id)).toEqual(["G-21"]);
  });
});

describe("the order he reads it in", () => {
  // Open leads, because the band is a place to ACT and an open gap is the only row here asking
  // for anything. Then resolved, then the declined ones.
  it("open first, then resolved, then declined", () => {
    const rows = gapRows([
      doc("G-30", { state: { rejected: true, rejectedWhy: "no" } }),
      doc("G-31", { state: { resolvedDeclared: true, hasProof: true } }),
      doc("G-32", { state: {} }),
    ]);
    expect(rows.map((r) => r.state)).toEqual(["open", "resolved", "rejected"]);
  });
  it("within a state, numerically by id — G-9 before G-10", () => {
    const rows = gapRows([doc("G-10", { state: {} }), doc("G-9", { state: {} })]);
    expect(rows.map((r) => r.id)).toEqual(["G-9", "G-10"]);
  });
});
