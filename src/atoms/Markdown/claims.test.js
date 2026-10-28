import { parseClaims, claimsOf, ordinalOf, normalizeState, normalizeKind, growProof } from "./claims";

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
  // MET IS MARKED AND PROVED — the registry row's own conjunction, mirrored, because the window
  // once said 4/7 met over a row that honestly said 2. DOC's marked claim is a bare leaf: no body,
  // nowhere for evidence to live, so it is UNPROVED and the bar says so instead of folding it in.
  it("counts met, not met, unproved and unchecked separately — a bare mark is never met", () => {
    expect(claimsOf(DOC)).toMatchObject({ total: 4, met: 0, unproved: 1, unmet: 1, unchecked: 2 });
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
    // c2's body is prose, not a proof block — marked by the human, and still unproved until
    // something pressable sits in the fold. The mark is his word; met is his word plus evidence.
    expect(claimsOf(PROOFED)).toMatchObject({ total: 3, met: 0, unproved: 1 });
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
    // None of the four carries evidence, so none is MET — and c1 is an agent's mark with no note,
    // which never counted as a mark at all (RFC-075): it is UNCHECKED, not unproved. Reviewed stays
    // its own axis: a signature says who looked, a proof says what they looked at.
    expect(c.met).toBe(0);
    expect(c.unproved).toBe(3);
    expect(c.unchecked).toBe(2);
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

// A CLAIM DECLARES ITS KIND, AND SILENCE IS THE STRICT SIDE. A behavioural claim owes a living
// spec — a defence the change loop runs without anybody remembering to; an experiential one is
// concluded by the human's eye and must SAY so. Absence reads behavioural, exactly as an unmarked
// claim reads unchecked: silence never buys a pass.
describe("kind, and the spec a behavioural claim owes", () => {
  const DOC = [
    "# RFC-9",
    "",
    "::claim[a leaf, no body]{id=c1 state=met by=sv at=1}",
    "",
    ":::claim[a fold with a saved test]{id=c2 state=met by=sv at=1}",
    "::test[Math.chainUse]",
    ":::",
    "",
    ":::claim[a fold with an in-document walk]{id=c3 state=met by=sv at=1}",
    ":::run{title=\"the walk\"}",
    "- Math.add(1, 2)",
    ":::",
    "",
    ":::claim[a fold with only a command]{id=c4 state=met by=sv at=1}",
    ":::cmd",
    "grep -n thing file.js",
    ":::",
    "",
    ":::claim[his eye is the instrument]{id=c5 kind=experiential state=met by=you at=1}",
    "::file[RFCs/proofs/the-badge.png]",
    ":::",
  ].join("\n");

  it("defaults to behavioural, and reads the written exemption", () => {
    const c = parseClaims(DOC);
    expect(c.map((x) => x.kind)).toEqual(["behavioral", "behavioral", "behavioral", "behavioral", "experiential"]);
  });

  it("counts a spec from ::test or :::run in the fold — and never from a cmd", () => {
    const c = parseClaims(DOC);
    expect(c.map((x) => x.hasSpec)).toEqual([false, true, true, false, false]);
  });

  it("a leaf carries no spec by construction — it has no body to hold one", () => {
    expect(parseClaims(DOC)[0].hasSpec).toBe(false);
  });

  it("OWED is the honest gap: marked behavioural with no spec behind it", () => {
    const c = parseClaims(DOC);
    // c1 (leaf, met), c4 (cmd only, met) are owed; the two spec'd ones are not; c5 is exempt
    expect(c.map((x) => x.owed)).toEqual([true, false, false, true, false]);
  });

  it("an UNMARKED behavioural claim is not owed yet — nobody has concluded anything", () => {
    const c = parseClaims(["::claim[nobody looked]{id=c9}"].join("\n"));
    expect(c[0].kind).toBe("behavioral");
    expect(c[0].owed).toBe(false);
  });

  it("claimsOf carries the third axis beside met and reviewed", () => {
    const c = claimsOf(DOC);
    expect(c.total).toBe(5);
    expect(c.behavioral).toBe(4);
    expect(c.experiential).toBe(1);
    expect(c.specd).toBe(2);
    expect(c.owed).toBe(2);
  });

  it("a nested container does not confuse the body walk — the outer fence is longer", () => {
    const nested = [
      "::::claim[a fold holding a cmd]{id=c1 state=met by=sv at=1}",
      ":::cmd",
      "echo hi",
      ":::",
      "::::",
      "",
      ":::claim[the next one is clean]{id=c2}",
      "::test[Math.add]",
      ":::",
    ].join("\n");
    const c = parseClaims(nested);
    expect(c.map((x) => x.hasSpec)).toEqual([false, true]);
  });

  it("a fenced EXAMPLE of a spec block never counts as one", () => {
    const doc = [
      ":::claim[documentation, not a proof]{id=c1 state=met by=sv at=1}",
      "```markdown",
      "::test[Math.add]",
      "```",
      ":::",
    ].join("\n");
    expect(parseClaims(doc)[0].hasSpec).toBe(false);
  });
});

describe("normalizeKind", () => {
  it("reads the exemption's spellings and defaults everything else to behavioural", () => {
    expect(normalizeKind("experiential")).toBe("experiential");
    expect(normalizeKind("Experience")).toBe("experiential");
    expect(normalizeKind("judgment")).toBe("experiential");
    expect(normalizeKind("")).toBe("behavioral");
    expect(normalizeKind("nonsense")).toBe("behavioral");
  });
});
