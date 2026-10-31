import { owesOf, rowsOf, toneOf, wordOf } from "./claimRows";

const claim = (over = {}) => ({
  n: 1,
  line: 10,
  statement: "do this → this happens",
  id: "c1",
  state: "met",
  kind: "behavioral",
  hasSpec: true,
  proved: true,
  owed: false,
  by: "you",
  at: 1,
  note: "",
  reviewers: [],
  reviewed: true,
  ...over,
});

describe("a claim's word — marked is not met, and the surface must say which", () => {
  it("nobody looked → unchecked, never the same as met", () => {
    expect(wordOf(claim({ state: "" }))).toBe("unchecked");
    expect(toneOf(claim({ state: "" }))).toBe("open");
  });

  it("MARKED MET WITH NOTHING BEHIND IT reads UNPROVED — the gap nobody could see", () => {
    expect(wordOf(claim({ proved: false }))).toBe("unproved");
    expect(toneOf(claim({ proved: false }))).toBe("blocked");
  });

  it("proved and signed is a different thing from proved — a mark is the builder's own word", () => {
    expect(wordOf(claim())).toBe("met · signed");
    expect(wordOf(claim({ reviewed: false }))).toBe("met");
  });

  it("not met is the valuable outcome, and it reads as its own thing", () => {
    expect(wordOf(claim({ state: "unmet" }))).toBe("not met");
    expect(toneOf(claim({ state: "unmet" }))).toBe("cycle");
  });
});

describe("what a claim owes, in the sentence somebody acts on", () => {
  it("a mark resting on nothing says so, and says WHY it costs", () => {
    const [o] = owesOf(claim({ proved: false }));
    expect(o.text).toContain("one agent's word");
  });

  it("an EXPERIENTIAL claim owes evidence, never a spec — and the sentence says which", () => {
    const [o] = owesOf(claim({ kind: "experiential", proved: false }));
    expect(o.text).toContain("owes no spec");
  });

  it("NO SPEC YELLS A LITTLE — amber, not a grey remark: this claim is defended by nobody tomorrow", () => {
    const [o] = owesOf(claim({ owed: true }));
    expect(o.text).toContain("no spec");
    // the LIVING SPEC is the claim carrying its proof, not the test inside it — so it is not named here
    expect(o.text).not.toContain("living spec");
    expect(o.kind).toBe("blocked");
  });

  it("proved and unsigned is owed from a PERSON, not from the builder", () => {
    const texts = owesOf(claim({ reviewed: false })).map((x) => x.text);
    expect(texts.some((t) => t.includes("nobody has signed"))).toBe(true);
  });

  it("an unmet claim carries its account — and says so when an AGENT left none", () => {
    expect(owesOf(claim({ state: "unmet", note: "it throws" }))[0].text).toContain("it throws");
    expect(owesOf(claim({ state: "unmet", by: "systemview-test" }))[0].text).toContain("no account");
  });

  it("HIS press is its own evidence — it is never asked for an essay", () => {
    // RFC-075: an agent's mark needs a statement behind it; the human's does not, and nagging him
    // the instant he presses "not met" is a surface nagging the one party it cannot nag.
    expect(owesOf(claim({ state: "unmet", by: "you" }))).toEqual([]);
  });

  it("nothing owed is an empty list — a row saying 'nothing wrong' is furniture", () => {
    expect(owesOf(claim())).toEqual([]);
  });
});

describe("the summary is one derivation, so the bar and the rows cannot disagree", () => {
  it("PERCENT IS MET OVER TOTAL — met being marked AND proved, the registry's own conjunction", () => {
    const out = rowsOf({ met: 2, total: 6, claims: [claim(), claim(), claim(), claim(), claim(), claim()] });
    expect(out.pct).toBe(33);
    expect(out.total).toBe(6);
  });

  it("every claim arrives as a row carrying its own word, tone and what it owes", () => {
    const out = rowsOf({ met: 0, claims: [claim({ proved: false })] });
    expect(out.rows[0].word).toBe("unproved");
    expect(out.rows[0].tone).toBe("blocked");
    expect(out.rows[0].owes.length).toBeGreaterThan(0);
  });

  it("no claims is zero, not a throw", () => {
    expect(rowsOf({}).total).toBe(0);
    expect(rowsOf({}).pct).toBe(0);
    expect(rowsOf(null).rows).toEqual([]);
  });
});
