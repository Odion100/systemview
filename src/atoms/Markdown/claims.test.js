import { parseClaims, claimsOf, ordinalOf, normalizeState, growProof } from "./claims";

// A claim is a statement somebody can check, and its mark is written INTO its line. These guard the
// read side: the number is its place in the document, the mark is what the attributes say, and the
// count is derived — never typed.

const DOC = [
  "# RFC-9",
  "",
  "::claims",
  "",
  "**In the window**",
  "",
  "::claim[Open the list → every row shows when it was parsed]{id=c1}",
  "",
  '::claim[Approve it → the count drops]{id=c2 state=met by=you at=1792956000000 note="pressed approve; the drawer went 4 to 3"}',
  "",
  '::claim[Reopen the window → the same number]{id=c3 state=unmet by=systemview-test at=1792956100000 note="reads 4 again after reopen; the count is painted from a folder scan"}',
  "",
  "```markdown",
  "::claim[an example in a fence, never counted]{id=x}",
  "```",
  "",
  "::claim[A claim with no attributes at all]",
].join("\n");

describe("parseClaims — the number is the place in the document", () => {
  it("numbers claims in order, skipping a fenced example, and keeps the line for the write-back", () => {
    const c = parseClaims(DOC);
    expect(c.map((x) => [x.n, x.line, x.id])).toEqual([
      [1, 7, "c1"],
      [2, 9, "c2"],
      [3, 11, "c3"],
      [4, 17, ""],
    ]);
  });

  it("reads the mark off the attributes — state, by, at, note", () => {
    const [c1, c2, c3] = parseClaims(DOC);
    expect(c1.state).toBe("");
    expect(c2).toMatchObject({ state: "met", by: "you", at: 1792956000000, note: "pressed approve; the drawer went 4 to 3" });
    expect(c3.state).toBe("unmet");
    expect(c3.by).toBe("systemview-test");
  });

  it("ordinalOf answers by line, and 0 for a line that holds no claim", () => {
    expect(ordinalOf(DOC, 9)).toBe(2);
    expect(ordinalOf(DOC, 5)).toBe(0);
  });
});

describe("claimsOf — the count is derived", () => {
  it("counts met, not met, and unchecked separately — unchecked is never folded into either", () => {
    expect(claimsOf(DOC)).toMatchObject({ total: 4, met: 1, unmet: 1, unchecked: 2 });
  });
  it("an empty document has no claims, not a 100%", () => {
    expect(claimsOf("")).toMatchObject({ total: 0, met: 0, unmet: 0, unchecked: 0 });
  });
});

// RFC-075 — a claim that carries a proof is the SAME claim grown a container. The scan counts it,
// its mark reads off the opening line, and nothing inside the fold is ever a claim of its own.
describe("the container form — one claim, two or more colons", () => {
  const PROOFED = [
    "::claim[a plain leaf]{id=c1}",
    "",
    ':::claim[a proofed claim]{id=c2 state=met by=you at=5 note="saw it"}',
    "echo proof body — not a claim",
    ":::",
    "",
    "::::claim[a proof holding a cmd grows its fence]{id=c3}",
    ":::cmd",
    "true",
    ":::",
    "::::",
  ].join("\n");

  it("counts leaf and container claims alike, mark read off the opening line", () => {
    const c = parseClaims(PROOFED);
    expect(c.map((x) => x.id)).toEqual(["c1", "c2", "c3"]);
    expect(c[1]).toMatchObject({ state: "met", by: "you", note: "saw it" });
    expect(claimsOf(PROOFED)).toMatchObject({ total: 3, met: 1 });
  });

  it("a quoted note naming an attribute is prose, never the attribute — the bag is tokenized", () => {
    const c = parseClaims('::claim[x]{id=c9 note="state= stays prose" by=you}');
    expect(c[0].state).toBe("");
    expect(c[0].note).toBe("state= stays prose");
    expect(c[0].by).toBe("you");
  });

  it("growProof rewrites a leaf in place — statement and mark survive, fence lands under an empty body", () => {
    const next = growProof("intro\n::claim[the statement]{id=c1 state=met by=you at=5}\nafter", 2);
    expect(next.split("\n")).toEqual([
      "intro",
      ":::claim[the statement]{id=c1 state=met by=you at=5}",
      "",
      ":::",
      "after",
    ]);
  });

  it("growProof refuses a container, a non-claim line, and a line past the end — a no-op is not a change", () => {
    expect(growProof(":::claim[already grown]{id=c1}\n\n:::", 1)).toBe(null);
    expect(growProof("just prose", 1)).toBe(null);
    expect(growProof("::claim[x]{id=c1}", 9)).toBe(null);
  });
});

// RFC-075 round two — REVIEWED is the second axis: marked is the builder's word; reviewed means
// the human signed and every declared reviewer did. His: "green is all met, but I didn't check
// off everything."
describe("the reviewed count — a mark alone never reads as done", () => {
  it("counts reviewed only where you signed and every declared reviewer signed", () => {
    const DOC2 = [
      "::claim[a]{id=c1 state=met by=sv at=1}",                                  // marked, unreviewed
      "::claim[b]{id=c2 state=met by=sv|you at=1}",                              // you signed — reviewed
      "::claim[c]{id=c3 state=met by=sv|you at=1 reviewers=buapi}",              // buapi still owes it
      "::claim[d]{id=c4 state=met by=sv|you|buapi at=1 reviewers=buapi}",        // everyone — reviewed
      "::claim[e]{id=c5}",                                                       // unchecked is never reviewed
    ].join("\n");
    const c = claimsOf(DOC2);
    expect(c.met).toBe(4);
    expect(c.reviewed).toBe(2);
    expect(c.claims.map((x) => x.reviewed)).toEqual([false, true, false, true, false]);
  });
});

describe("normalizeState", () => {
  it("accepts met, unmet and the hyphenated spelling; anything else is unchecked", () => {
    expect(normalizeState("met")).toBe("met");
    expect(normalizeState("unmet")).toBe("unmet");
    expect(normalizeState("not-met")).toBe("unmet");
    expect(normalizeState("maybe")).toBe("");
  });
});
