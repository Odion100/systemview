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
    expect(facilitate("report", "retired", "filed", DOC)).toBeNull(); // existence is not pressable
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

// ─── THE ARC'S COLUMN — claims c19 and c22 of RFC-076 ──────────────────────────────────────────
const ARC = `# an arc
::arc{id=ARC-900}

:::approval{ask="approve it?" verdict=approved by=you}
body
:::

:::objective{id=O1 title="the first half"}
prose
:::

:::objective{id=O2 title="the second half"}
prose
:::
`;

const ROWS = [
  { id: "RFC-901", kind: "rfc", arc: "ARC-900-O1", state: { settled: true, verdict: "approved" } },
  { id: "RFC-902", kind: "rfc", arc: "ARC-900-O1", state: { verdict: "approved", built: true } },
];

describe("facilitation — the arc's column", () => {
  it("c19 · names the unplanned objective rather than showing a count", () => {
    const p = facilitate("arc", "inProgress", "approved", ARC, 0, {}, "", { rows: ROWS, id: "ARC-900" });
    const planned = p.steps.find((s) => /plan ARC-900/.test(s.label));
    expect(planned.label).toMatch(/ARC-900-O2 \(the second half\)/);
    expect(planned.label).not.toMatch(/O1/); // O1 is served, so it is not asked for
    expect(planned.done).toBe(false);
    expect(planned.writes).toBeUndefined(); // a plan is a document somebody writes
  });

  it("every objective planned → that step wears its check", () => {
    const rows = [...ROWS, { id: "RFC-903", kind: "rfc", arc: "ARC-900-O2", state: {} }];
    const p = facilitate("arc", "inProgress", "approved", ARC, 0, {}, "", { rows, id: "ARC-900" });
    expect(p).toBeNull(); // nothing left between approved and inProgress
  });

  it("c22 · settled has NO button, and the step says an arc settles when its plans do", () => {
    const p = facilitate("arc", "settled", "inProgress", ARC, 0, {}, "", { rows: ROWS, id: "ARC-900" });
    const waiting = p.steps.find((s) => /waiting on/.test(s.label));
    expect(waiting.label).toMatch(/RFC-902 \(built\)/); // named with the state it is actually in
    expect(waiting.note).toMatch(/an arc settles when its plans do/);
    expect(p.steps.every((s) => !s.writes && !s.appendStatus && !s.leafPairs)).toBe(true);
  });

  it("an arc with no objectives says so — an empty arc satisfies every universal for free", () => {
    const bare = ARC.replace(/:::objective[\s\S]*/, "");
    const p = facilitate("arc", "inProgress", "approved", bare, 0, {}, "", { rows: [], id: "ARC-900" });
    expect(p.steps[0].label).toMatch(/no objectives/);
  });
});

// ─── THE GAP'S COLUMN ──────────────────────────────────────────────────────────────────────────
const GAP = `# a gap
::gap{id=G-900}

prose about what is broken
`;

describe("facilitation — the gap's column", () => {
  it("resolved with no proof OFFERS one, and names the repo it has to be written into", () => {
    const p = facilitate("gap", "resolved", "open", GAP, 0, {}, "", { project: "buapi", attrs: {} });
    expect(p.steps[0].appendText).toMatch(/:::cmd/);
    expect(p.steps[0].done).toBe(false);
    expect(p.steps[1].label).toMatch(/into buapi's copy/);
  });

  it("a gap that already carries a proof crosses that step off", () => {
    const p = facilitate("gap", "resolved", "open", GAP, 0, { hasProof: true }, "", { project: "buapi", attrs: {} });
    expect(p.steps[0].done).toBe(true);
  });

  it("reopening names who closed it and when — it undoes somebody else's work", () => {
    const p = facilitate("gap", "open", "resolved", GAP, 0, {}, "", {
      attrs: { resolved: "2026-10-20", by: "buapi" },
    });
    expect(p.steps[0].leafPairs).toEqual({ resolved: null });
    expect(p.steps[0].note).toMatch(/resolved 2026-10-20 by buapi/);
    expect(p.steps[0].note).toMatch(/undoes that fix/);
  });

  it("reopening a REJECTED gap takes its reason with it, and says it reverses a decision", () => {
    const p = facilitate("gap", "open", "rejected", GAP, 0, {}, "", {
      attrs: { rejected: "2026-10-21", why: "wontfix" },
    });
    expect(p.steps[0].leafPairs).toEqual({ rejected: null, why: null });
    expect(p.steps[0].note).toMatch(/reverses that decision/);
  });
});
