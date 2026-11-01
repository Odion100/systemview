// TWO PROJECTS, ONE DOCUMENT ID — the collision every dashboard joined its way into.
//
// `owedFrom` returns a flat list of obligations and each page turns it round into "what does THIS
// document owe", which is a join. All three pages keyed that join on the bare document id, and an
// id is unique inside a project and nowhere else: alpha's RFC-001 and beta's RFC-001 are two
// different files, so each page showed one document wearing the other's work.
//
// It is wrong BY CONSTRUCTION rather than by accident, which is why it earns claims instead of a
// bug report: these pages exist to span every project at once, so the colliding case is the normal
// case, and the symptom — a card marked with work that belongs to another repo — looks like data.
import { owedFrom, owedHead, docKey } from "../AgentChat/owed";
import dashboardA from "../DashboardA/dashboardA.data";
import { beadFor } from "../DashboardB/dashboardB.data";
import { owedIndex } from "../DashboardC/dashboardC.data";

const NOW = 1_700_000_000_000;

// THE SAME ID IN TWO PROJECTS, each owing something DIFFERENT — alpha has an approval nobody has
// pressed and a claim with no proof; beta is approved and built, so it owes only the claim. Merged,
// beta would wear an approval it does not have, which is the symptom in one number.
const text = ({ approval }) =>
  [
    `# RFC-001 — a design`,
    ``,
    `::rfc{id=RFC-001 title="a design"}`,
    ``,
    approval ? `:::approval{ask="ship it?"}\nsign it\n:::` : ``,
    ``,
    `## Claims`,
    ``,
    `::claims`,
    ``,
    `::claim[it works]{id=c1 state=met by=you note="seen"}`,
  ].join("\n");

const ALPHA = { at: NOW, project: "alpha", id: "RFC-001", kind: "rfc", path: "RFCs/RFC-001-a-design.md", state: { parsed: NOW } };
const BETA = { ...ALPHA, project: "beta", state: { verdict: "approved", built: true, parsed: NOW } };
const DOCS = () => [
  { row: { ...ALPHA }, text: text({ approval: true }) },
  { row: { ...BETA }, text: text({ approval: false }) },
];

describe("docKey — one spelling of which document", () => {
  it("tells two projects' same-id documents apart", () => {
    expect(docKey({ project: "alpha", id: "RFC-001" })).not.toBe(docKey({ project: "beta", id: "RFC-001" }));
  });

  // A MISSING PROJECT IS A PROJECT: rows arrive with `project: ""` from the machine-local scope and
  // must still be told apart from a named one rather than collapsing together.
  it("is stable with no project, and never equal to a named one", () => {
    expect(docKey({ id: "RFC-001" })).toBe(docKey({ project: "", id: "RFC-001" }));
    expect(docKey({ id: "RFC-001" })).not.toBe(docKey({ project: "alpha", id: "RFC-001" }));
    expect(docKey()).toBe(docKey({}));
  });
});

describe("a cross-project pair", () => {
  const owed = owedFrom({ docs: DOCS(), now: NOW });
  const every = [...(owed.press || []), ...(owed.work || [])];

  it("is the colliding case, and both documents really owe", () => {
    expect(new Set(DOCS().map((d) => d.row.id)).size).toBe(1);
    expect(new Set(every.map((o) => o.project))).toEqual(new Set(["alpha", "beta"]));
  });

  // THE OBLIGATION'S OWN KEY is what the head's segments carry and what the surface filter matches
  // on, so a shared key is not cosmetic: pressing "1 to press" would narrow to both projects' rows.
  it("gives every obligation a key of its own", () => {
    const keys = every.map((o) => o.key);
    expect(new Set(keys).size).toBe(keys.length);
    every.forEach((o) => expect(o.key.startsWith(docKey(o))).toBe(true));
  });

  // The head counts obligations and hands each segment the exact keys it counted. A segment that
  // counted one project's approval must not carry the other's.
  it("the head's segments name only the obligations they counted", () => {
    const segs = owedHead(owed).segs || [];
    const approval = segs.find((s) => s.key === "approval");
    expect(approval).toBeTruthy();
    expect(approval.keys).toHaveLength(1);
    expect(approval.keys[0].startsWith(docKey(ALPHA))).toBe(true);
  });

  it("C's index keys one entry per DOCUMENT, not per id", () => {
    expect(Object.keys(owedIndex(owed)).sort()).toEqual([docKey(ALPHA), docKey(BETA)].sort());
  });

  it("B's bead counts each document's own obligations and no others", () => {
    const byDoc = {};
    every.forEach((o) => ((byDoc[docKey(o)] = byDoc[docKey(o)] || []).push(o)));
    const [a, b] = DOCS();
    // alpha: the unpressed approval + the unproved claim. beta: the claim alone.
    expect([beadFor(a, byDoc, NOW).press, beadFor(a, byDoc, NOW).work]).toEqual([1, 1]);
    expect([beadFor(b, byDoc, NOW).press, beadFor(b, byDoc, NOW).work]).toEqual([0, 1]);
  });

  it("A's fold hands each document only its own project's obligations", () => {
    const out = dashboardA({ docs: DOCS(), roots: { alpha: "/a", beta: "/b" }, now: NOW });
    const marks = [];
    const walk = (v) => {
      if (Array.isArray(v)) return v.forEach(walk);
      if (v && typeof v === "object") {
        if (v.id === "RFC-001" && Array.isArray(v.owes)) marks.push(v);
        Object.values(v).forEach(walk);
      }
    };
    walk(out);
    // A names each mark twice — once under its project and once in the flat list — so the claim is
    // about the PROJECTS present, not the count.
    expect(new Set(marks.map((m) => m.project))).toEqual(new Set(["alpha", "beta"]));
    marks.forEach((m) => {
      expect(m.owes.length).toBeGreaterThan(0);
      m.owes.forEach((o) => expect(o.project).toBe(m.project));
    });
  });
});
