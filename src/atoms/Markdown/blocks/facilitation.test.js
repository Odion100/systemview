// RFC-076 §3, column four — the RFC facilitation LADDER, each shape provable without a renderer.
import { facilitate, parseApprovals, rfcCurrent } from "./facilitation";

const DOC = `# a design
::rfc{id=RFC-900}

:::approval{ask="first half?"}
body
:::

:::approval{ask="second half?"}
body
:::

::claim[a thing works]{id=c1}
::claim[another thing works]{id=c2 reviewers=buapi}
::claim[a third, already marked]{id=c3 state=met by=agent note="seen"}
`;

const APPROVED = DOC.replace(/ask="first half\?"/, 'ask="first half?" verdict=approved by=you').replace(
  /ask="second half\?"/,
  'ask="second half?" verdict=approved by=you',
);

describe("rfcCurrent — where the document stands, off the source", () => {
  it("reads draft, approved, built, settled and rejected from the text and the leaf", () => {
    expect(rfcCurrent(DOC)).toBe("draft");
    expect(rfcCurrent(APPROVED)).toBe("approved");
    expect(rfcCurrent(`${APPROVED}\n## STATUS — built 2026-10-29\n`)).toBe("built");
    expect(rfcCurrent(APPROVED, { settled: true })).toBe("settled");
    expect(rfcCurrent(APPROVED.replace("verdict=approved by=you", "verdict=rejected by=you"))).toBe("rejected");
    expect(rfcCurrent(APPROVED, { retired: true })).toBe("retired");
  });
});

describe("facilitation — the ladder", () => {
  it("parses approvals with their lines and verdicts", () => {
    const a = parseApprovals(APPROVED);
    expect(a).toHaveLength(2);
    expect(a.every((x) => x.verdict === "approved")).toBe(true);
  });

  it("approved from draft: one step — signing the awaiting blocks IS the button", () => {
    const p = facilitate("rfc", "approved", "draft", DOC, 7);
    expect(p.steps).toHaveLength(1);
    expect(p.steps[0].label).toMatch(/sign the 2 approvals/);
    expect(p.steps[0].writes).toEqual([
      { line: 4, pairs: { verdict: "approved", by: "you", at: 7 } },
      { line: 8, pairs: { verdict: "approved", by: "you", at: 7 } },
    ]);
  });

  it("built from draft: the WHOLE distance — sign, mark yours (others named), write the STATUS", () => {
    const p = facilitate("rfc", "built", "draft", DOC, 7);
    expect(p.steps.map((s) => s.done)).toEqual([false, false, false]);
    expect(p.steps[0].label).toMatch(/sign the 2 approvals/);
    expect(p.steps[1].label).toMatch(/mark the 1 claim/);
    expect(p.steps[1].note).toMatch(/1 belong to buapi/);
    expect(p.steps[2].appendStatus).toBe(true);
  });

  it("built from approved: the signing is behind you — marking is live, the STATUS waits", () => {
    const p = facilitate("rfc", "built", "approved", APPROVED, 7);
    expect(p.steps).toHaveLength(2);
    expect(p.steps[0].done).toBe(false);
    expect(p.steps[0].writes).toEqual([{ line: 12, pairs: { state: "met", by: "you", at: 7 } }]);
    expect(p.steps[1].appendStatus).toBe(true);
  });

  it("settled from built: your reviews are a button, the declaration carries the waiting list", () => {
    const marked = APPROVED.replace("{id=c1}", '{id=c1 state=met by=agent note="n"}').replace(
      "{id=c2 reviewers=buapi}",
      '{id=c2 reviewers=buapi state=met by=agent note="n"}',
    );
    const built = `${marked}\n## STATUS — built 2026-10-29\n`;
    const p = facilitate("rfc", "settled", "built", built, 7, {}, "2026-10-29");
    const reviews = p.steps.find((s) => /review/.test(s.label));
    expect(reviews.writes.every((w) => w.pairs.by.split("|").includes("you"))).toBe(true);
    expect(reviews.note).toMatch(/waiting on: buapi/);
  });

  it("settled with your half signed: the declaration names who it would be declaring over", () => {
    const signed = `${APPROVED.replace("{id=c1}", '{id=c1 state=met by=you note="n"}')
      .replace("{id=c2 reviewers=buapi}", '{id=c2 reviewers=buapi state=met by=you note="n"}')
      .replace('state=met by=agent note="seen"', 'state=met by=agent|you note="seen"')}\n## STATUS — built 2026-10-29\n`;
    const p = facilitate("rfc", "settled", "built", signed, 7, {}, "2026-10-29");
    const declare = p.steps.find((s) => s.leafPairs);
    expect(declare.label).toMatch(/waiting on: buapi/);
    expect(declare.leafPairs).toEqual({ settled: "2026-10-29" });
  });

  it("draft backward: one button clears every verdict and the marks stay", () => {
    const p = facilitate("rfc", "draft", "approved", APPROVED);
    expect(p.steps[0].label).toMatch(/clear the 2 verdicts/);
    expect(p.steps[0].writes[0].pairs).toEqual({ verdict: null, by: null, at: null });
    expect(p.steps[0].note).toMatch(/claim marks stay/);
  });

  it("built backward from settled: removes your co-signatures and takes settled= with them", () => {
    const signed = APPROVED.replace("{id=c1}", '{id=c1 state=met by=you}');
    const p = facilitate("rfc", "built", "settled", signed);
    expect(p.steps[0].writes).toEqual([{ line: 12, pairs: { by: null } }]);
    expect(p.steps[0].leafPairs).toEqual({ settled: null });
  });

  it("answers null when nothing stands between — the write or its refusal speaks", () => {
    expect(facilitate("rfc", "approved", "approved", APPROVED)).toBeNull(); // already there
    expect(facilitate("gap", "resolved", "open", DOC)).toBeNull(); // other kinds: their column's turn
    // everything crossed: approvals signed, claims marked, nothing between approved and built but
    // the press itself (the STATUS step IS still open — so this stays a plan)
    const all = APPROVED.replace("{id=c1}", '{id=c1 state=met by=you}').replace(
      "{id=c2 reviewers=buapi}",
      '{id=c2 reviewers=buapi state=met by=you}',
    );
    const p = facilitate("rfc", "built", "approved", all, 7);
    expect(p.steps.filter((s) => !s.done).map((s) => !!s.appendStatus)).toEqual([true]);
  });
});
