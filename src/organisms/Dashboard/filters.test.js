// THE POSITIONAL FILTER, HELD TO ITS ANSWERS — no mount, because `filters.js` is a data module on
// purpose: what a selection MEANS has to be provable without React, the way fold.js, floor.js and
// surface.js already are.
import { owedFrom, owedHead, docKey } from "../AgentChat/owed";
import { DIMENSIONS, mergeAbove, anyHeld, filterKey, narrowData } from "./filters";

const NOW = 1_700_000_000_000;

const doc = (row, text) => ({ row: { project: "alpha", at: NOW, ...row }, text });

// An RFC with an unsigned approval, PLANNED INTO the arc (its leaf carries the address).
const RFC = doc(
  { id: "RFC-001", kind: "rfc", path: "RFCs/RFC-001-a.md", arc: "ARC-9-O1", state: { verdict: "approved" } },
  '::rfc{id=RFC-001 arc=ARC-9-O1}\n\n:::approval{ask="ship it?"}\nx\n:::\n',
);
// The arc, with an objective of his and a blocked one.
const ARC = doc(
  { id: "ARC-9", kind: "arc", path: "RFCs/arcs/ARC-9.md", state: { verdict: "approved" } },
  [
    "::arc{id=ARC-9}",
    "",
    ":::objective{id=O1 owner=you state=open}",
    "mine",
    ":::",
    ':::objective{id=O2 state=blocked blocked="waiting on the rewrite"}',
    "stuck",
    ":::",
  ].join("\n"),
);
// A gap in ANOTHER project — the project dimension needs a second project to mean anything.
const GAP = doc({ id: "G-1", kind: "gap", path: "gaps/G-1.md", project: "beta", state: {} }, "::gap{id=G-1 state=open}\n");
// A report, for the reportWindow dimension.
const REPORT = doc(
  { id: "r-one", kind: "report", path: ".systemview/report.alpha.r-one.md", state: { retain: "14d" } },
  "::report{id=r-one retain=14d}\n",
);

const DOCS = [RFC, ARC, GAP, REPORT];

const value = () => {
  const owed = owedFrom({ docs: DOCS, now: NOW });
  const allOwed = { ...owed, head: owedHead(owed) };
  return {
    read: true,
    error: "",
    roots: { alpha: "/a", beta: "/b" },
    beat: 0,
    docs: DOCS,
    owed: { ...allOwed, head: undefined },
    allDocs: DOCS,
    allOwed,
    filtering: false,
  };
};

const ids = (docs) => docs.map((d) => d.row.id).sort();

// ─── THE MERGE IS POSITIONAL ───────────────────────────────────────────────────────────────────

describe("mergeAbove — a tile is filtered by what stands ABOVE it, and only that", () => {
  it("merges everything strictly above the index, and nothing below or at it", () => {
    const held = [{ kind: "approval" }, null, { project: "beta" }];
    expect(mergeAbove(held, 0)).toEqual({});
    expect(mergeAbove(held, 1)).toEqual({ kind: "approval" });
    expect(mergeAbove(held, 2)).toEqual({ kind: "approval" });
    expect(mergeAbove(held, 3)).toEqual({ kind: "approval", project: "beta" });
  });

  // A TILE ABOVE IS UNAFFECTED BY ONE BELOW — the whole ruling in one line.
  it("a selection held low in the stack never reaches a tile above it", () => {
    const held = [null, null, { project: "beta" }];
    expect(mergeAbove(held, 0)).toEqual({});
    expect(mergeAbove(held, 2)).toEqual({});
  });

  it("when two tiles above hold the same dimension, the nearer one wins", () => {
    const held = [{ project: "alpha" }, { project: "beta" }];
    expect(mergeAbove(held, 2)).toEqual({ project: "beta" });
  });

  it("anyHeld and filterKey agree about emptiness, and the key spells every dimension", () => {
    expect(anyHeld({})).toBe(false);
    expect(anyHeld({ project: "beta" })).toBe(true);
    expect(filterKey({})).toBe(filterKey({ project: "" }));
    expect(filterKey({ project: "beta" })).not.toBe(filterKey({}));
    DIMENSIONS.forEach((d) => expect(filterKey({})).toContain(`${d}=`));
  });
});

// ─── WHAT A SELECTION MEANS ────────────────────────────────────────────────────────────────────

describe("narrowData — what each dimension keeps", () => {
  it("nothing held hands back the very same object, so derivation caches stay warm", () => {
    const v = value();
    expect(narrowData(v, {})).toBe(v);
    expect(narrowData(null, { project: "beta" })).toBe(null);
  });

  // THE SEGMENT'S OWN KEYS ARE THE FILTER — *"of course I want to filter by obligations."*
  // Pressing "1 blocked" keeps the blocked objective and not the other things its arc owes.
  it("kind narrows to exactly the obligations the segment counted, and their documents", () => {
    const out = narrowData(value(), { kind: "blocked" });
    expect(out.owed.work.map((o) => o.why)).toEqual(["blocked"]);
    expect(out.owed.press).toEqual([]);
    expect(ids(out.docs)).toEqual(["ARC-9"]);
    expect(out.filtering).toBe(true);
  });

  it("project keeps one project's documents and obligations", () => {
    const out = narrowData(value(), { project: "beta" });
    expect(ids(out.docs)).toEqual(["G-1"]);
    [...out.owed.press, ...out.owed.work].forEach((o) => expect(o.project).toBe("beta"));
  });

  // *"you should be able to click on arcs and it should filter all the RFCs for that arc"* — the
  // arc itself stays, and so does everything whose own leaf addresses it.
  it("arc keeps the arc and the documents planned into it, and drops the rest", () => {
    const out = narrowData(value(), { arc: docKey({ project: "alpha", id: "ARC-9" }) });
    expect(ids(out.docs)).toEqual(["ARC-9", "RFC-001"]);
    // the obligations are cut to the surviving documents — the gap's are gone
    [...out.owed.press, ...out.owed.work].forEach((o) => expect(["ARC-9", "RFC-001"]).toContain(o.id));
  });

  // A REPORT IS NOT A DIMENSION — his ruling, 2026-11-07: *"What the fuck could a report filter?
  // What is a report sitting on top of?"* A selection has to have something under it, and a report
  // holds nothing. The dimension existed and narrowed the page to one document.
  it("a report is not a dimension — nothing hangs off one, so nothing can be filtered by one", () => {
    expect(DIMENSIONS).toEqual(["kind", "project", "arc"]);
    const out = narrowData(value(), { reportWindow: docKey({ project: "alpha", id: "r-one" }) });
    expect(ids(out.docs)).toEqual(ids(value().docs));
    expect(out.filtering).toBe(false);
  });

  it("dimensions AND together — a project held above an arc cuts both ways", () => {
    const out = narrowData(value(), { project: "beta", arc: docKey({ project: "alpha", id: "ARC-9" }) });
    expect(out.docs).toEqual([]);
  });

  // A HEAD COUNTS THE WORLD IT FILTERS FROM, wherever it stands.
  it("never touches allDocs or allOwed", () => {
    const v = value();
    const out = narrowData(v, { project: "beta" });
    expect(out.allDocs).toBe(v.allDocs);
    expect(out.allOwed).toBe(v.allOwed);
  });
});
