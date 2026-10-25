import { parseClaims, claimsOf, ordinalOf, normalizeState } from "./claims";

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

describe("normalizeState", () => {
  it("accepts met, unmet and the hyphenated spelling; anything else is unchecked", () => {
    expect(normalizeState("met")).toBe("met");
    expect(normalizeState("unmet")).toBe("unmet");
    expect(normalizeState("not-met")).toBe("unmet");
    expect(normalizeState("maybe")).toBe("");
  });
});
