import {
  cardsFor,
  claimMeter,
  clockMeter,
  currentFrom,
  objectiveMeter,
  owedIndex,
  shelvesFrom,
} from "./dashboardC.data";
import { docKey } from "../AgentChat/owed";

// THE SHELVES, HELD TO THEIR ANSWERS. Every number on this page comes out of a module somebody
// else wrote and proved; what is tested here is the JOIN — that the page passes those modules the
// right thing, carries what they said without rounding it, and never omits a document in silence.

const doc = (lines) => lines.join("\n");
const row = (over = {}) => ({ id: "X-1", kind: "rfc", path: "RFCs/RFC-001-a.md", project: "alpha", at: 1, ...over });

const RFC = doc([
  "# RFC-001 — a thing",
  "::rfc{id=RFC-001}",
  "",
  ":::approval{ask=\"does the bar read right?\"}",
  "Is the debt segment obvious enough?",
  ":::",
  "",
  ":::claim[the bar counts]{id=c1 state=met by=you note=\"saw it\"}",
  "::run{}",
  ":::",
  "::claim[nobody looked at this one]{id=c2}",
  "::claim[this one is marked and shows nothing]{id=c3 state=met by=you note=\"trust me\"}",
  "::claim[this one failed]{id=c4 state=unmet by=you note=\"it did not\"}",
  "",
]);

const ARC = doc([
  "::arc{id=ARC-9 owner=alpha title=\"Arcs move\"}",
  "",
  ":::objective{id=O1 state=done owner=alpha}",
  "done one.",
  ":::",
  ":::objective{id=O2 state=blocked owner=alpha because=\"the hub cannot answer\"}",
  "stuck one.",
  ":::",
  ":::objective{id=O3 state=open owner=you}",
  "his one.",
  ":::",
  "",
]);

const GAP = doc(["# G-1 — the hub forgets", "::gap{id=G-1}", "", "::cmd{}", ""]);

describe("an RFC's bar keeps said and shown apart", () => {
  // THE DISTINCTION THE WHOLE CLAIMS DESIGN EXISTS FOR: met is marked met AND proved. A bar that
  // folded `unproved` into either neighbour would be the surface telling the one lie the registry
  // row, the document's own ::claims block and owed.js all refuse to tell.
  it("draws met, unproved, unmet and unchecked as four different widths", () => {
    const m = claimMeter(RFC);
    expect(m.total).toBe(4);
    expect(m.segs).toEqual([
      { k: "met", n: 1 },
      { k: "unproved", n: 1 },
      { k: "unmet", n: 1 },
      { k: "unchecked", n: 1 },
    ]);
    expect(m.say).toBe("1 of 4 proved · 1 said, not shown · 1 unmet");
    expect(m.debt).toBe(1);
  });

  it("has no bar at all for a document with no claims in it — an empty bar reads as zero done", () => {
    expect(claimMeter("# RFC-002\n::rfc{id=RFC-002}\n")).toBeNull();
    expect(claimMeter(undefined)).toBeNull();
  });
});

describe("an arc's bar is objectives, and blocked is its own segment", () => {
  it("carries arcRows' own two numbers and never lets the segments exceed the total", () => {
    const [r] = cardsFor("arc", [{ row: row({ id: "ARC-9", kind: "arc", path: "RFCs/arcs/ARC-9-a.md" }), text: ARC }]);
    expect(r.meter.total).toBe(3);
    expect(r.meter.segs).toEqual([
      { k: "done", n: 1 },
      { k: "blocked", n: 1 },
      { k: "open", n: 1 },
    ]);
    expect(r.line).toBe("1 of 3 · 1 blocked");
  });

  it("clamps a blocked count that would overrun what is left, rather than drawing a bar wider than its total", () => {
    const m = objectiveMeter({ total: 3, done: 2, blocked: 3 });
    expect(m.segs.reduce((n, s) => n + s.n, 0)).toBe(3);
    expect(m.segs).toEqual([
      { k: "done", n: 2 },
      { k: "blocked", n: 1 },
    ]);
  });

  it("gives an arc with no objectives no bar — 0 of 0 is empty, not complete", () => {
    expect(objectiveMeter({ total: 0, done: 0, blocked: 0 })).toBeNull();
  });
});

describe("a report's bar is a clock, and it does not start until he has opened it", () => {
  const now = 1_000_000_000;
  const rep = (over) => row({ id: "R-1", kind: "report", path: ".systemview/report.alpha.x.md", ...over });

  it("says when the clock WOULD start and draws nothing, for a report nobody has read", () => {
    const m = clockMeter(rep({ state: { retain: "14d" } }), now);
    expect(m.counting).toBe(false);
    expect(m.segs).toBeUndefined();
    expect(m.say).toMatch(/after first read/);
  });

  it("drains from first read, and carries retainLine's own urgency rather than a second threshold", () => {
    const day = 86400000;
    const m = clockMeter(rep({ state: { retain: "14d" }, openedAt: now - 13 * day }), now);
    expect(m.total).toBe(14 * day);
    expect(m.segs).toEqual([
      { k: "spent", n: 13 * day },
      { k: "left", n: day },
    ]);
    expect(m.say).toBe("retires in a day");
    expect(m.urgent).toBe(true);
  });

  it("says permanent without a bar, and says an undeclared leaf out loud instead of guessing a window", () => {
    expect(clockMeter(rep({ state: { retain: "permanent" } }), now)).toEqual({ say: "permanent", counting: false, urgent: false });
    expect(clockMeter(rep({ state: { invalid: true } }), now)).toEqual({ say: "no retention declared on the leaf", invalid: true });
    expect(clockMeter(rep({ state: {} }), now)).toBeNull();
  });

  it("orders reports by what is about to go, then the unread, then the permanent", () => {
    const day = 86400000;
    const mk = (id, state, openedAt, at) => ({
      row: row({ id, kind: "report", path: `.systemview/report.alpha.${id}.md`, state, openedAt, at }),
      text: "::report{}",
    });
    const cards = cardsFor(
      "report",
      [
        mk("keep", { retain: "permanent" }, 0, 5),
        mk("unread", { retain: "14d" }, 0, 4),
        mk("soon", { retain: "14d" }, now - 13 * day, 3),
        mk("later", { retain: "14d" }, now - 2 * day, 2),
      ],
      { now },
    );
    expect(cards.map((c) => c.id)).toEqual(["soon", "later", "unread", "keep"]);
  });
});

describe("a gap gets no bar, because it has no middle", () => {
  it("says the distance to the press in words instead of drawing a fake two-step bar", () => {
    const [r] = cardsFor("gap", [
      { row: row({ id: "G-1", kind: "gap", path: "gaps/G-1-a.md", state: { hasProof: true, resolvedDeclared: false } }), text: GAP },
    ]);
    expect(r.meter).toBeNull();
    expect(r.line).toBe("open · proof ready");
    expect(r.ready).toBe(true);
  });
});

describe("the join from an obligation back to its document", () => {
  it("is one entry per document however many obligations it carries, and keeps their own sentences", () => {
    const i = owedIndex({
      press: [{ id: "RFC-001", project: "alpha", why: "approval", says: "does this read right?", n: 2, line: 12 }],
      work: [
        { id: "RFC-001", project: "alpha", why: "claims", says: "1 claim unmet", line: 40 },
        { id: "ARC-9", project: "alpha", why: "blocked", says: "blocked — the hub cannot answer", line: 7 },
      ],
    });
    // ADDRESSED BY PROJECT AND ID: an id is unique inside a project and nowhere else, and this page
    // spans every project at once.
    expect(Object.keys(i).sort()).toEqual([docKey({ project: "alpha", id: "ARC-9" }), docKey({ project: "alpha", id: "RFC-001" })].sort());
    // AN APPROVAL ROW COUNTS BLOCKS, NOT ROWS — the same rule owedHead follows, so the mark on a
    // card and the number in the head cannot disagree.
    expect(i[docKey({ project: "alpha", id: "RFC-001" })]).toEqual({ press: 2, work: 1, says: ["does this read right?", "1 claim unmet"], lines: [12, 40] });
  });
});

describe("the shelves", () => {
  const docs = [
    { row: row({ id: "RFC-001", project: "alpha", state: { verdict: "approved", built: true, approvals: 1 } }), text: RFC },
    { row: row({ id: "ARC-9", kind: "arc", path: "RFCs/arcs/ARC-9-a.md", project: "alpha", state: { verdict: "approved", objectives: { total: 3, planned: 0, complete: 0 } } }), text: ARC },
    { row: row({ id: "G-1", kind: "gap", path: "gaps/G-1-a.md", project: "beta", state: { hasProof: true } }), text: GAP },
  ];
  const roots = { alpha: "/a", beta: "/b", gamma: "/g" };

  it("keeps a project that has a folder and no documents, so 'never parsed' cannot read as 'nothing to do'", () => {
    const { shelves } = shelvesFrom({ docs, roots });
    const gamma = shelves.find((s) => s.project === "gamma");
    expect(gamma.documents).toBe(0);
    expect(gamma.root).toBe("/g");
  });

  it("leads with the shelf asking for the most, not the one holding the most", () => {
    const { shelves } = shelvesFrom({ docs, roots });
    expect(shelves.map((s) => s.project)).toEqual(["alpha", "beta", "gamma"]);
    expect(shelves[0].press + shelves[0].work).toBeGreaterThan(0);
  });

  it("marks the cards the obligations landed on, and leaves the rest unmarked", () => {
    const { shelves } = shelvesFrom({ docs, roots });
    const alpha = shelves.find((s) => s.project === "alpha");
    const rfc = alpha.cards.rfc[0];
    expect(rfc.station).toBe("built");
    // one unsigned approval in the file, and claims resting on nothing
    expect(rfc.press).toBe(1);
    expect(rfc.work).toBe(1);
    expect(rfc.says.length).toBe(2);
    const arc = alpha.cards.arc[0];
    expect(arc.work).toBeGreaterThan(0);
  });

  it("gives a document whose file could not be read a card that SAYS so, rather than dropping it", () => {
    const { shelves, skipped } = shelvesFrom({
      docs: [...docs, { row: row({ id: "RFC-002", path: "RFCs/RFC-002-b.md", project: "alpha" }) }],
      roots,
    });
    const alpha = shelves.find((s) => s.project === "alpha");
    const blind = alpha.cards.rfc.find((c) => c.id === "RFC-002");
    expect(blind.unread).toBe(true);
    expect(blind.line).toBe("could not read the file");
    expect(alpha.unread).toBe(1);
    expect(skipped).toMatch(/could not be read/);
  });

  it("says a row pointing at a file that is gone in its own words", () => {
    const { shelves } = shelvesFrom({ docs: [{ row: row({ id: "RFC-003", path: "RFCs/RFC-003-c.md", project: "alpha", missing: true }) }], roots: {} });
    expect(shelves[0].cards.rfc[0].line).toBe("the file this row points at is gone");
  });

  it("names WHICH emptiness it is, because three of them mean three different things", () => {
    expect(shelvesFrom({ docs: [], roots: {} }).empty).toBe("projects");
    expect(shelvesFrom({ docs: [], roots }).empty).toBe("documents");
    expect(shelvesFrom({ docs: [{ row: row({ id: "RFC-009", path: "RFCs/RFC-009-x.md", project: "alpha" }) }], roots }).empty).toBe("unread");
    expect(shelvesFrom({ docs, roots }).empty).toBe("");
  });
});

describe("the current", () => {
  it("puts every document on its kind's own trail, all projects at once", () => {
    const { shelves } = shelvesFrom({
      docs: [
        { row: row({ id: "RFC-001", project: "alpha", state: { verdict: "approved", built: true } }), text: RFC },
        { row: row({ id: "RFC-002", path: "RFCs/RFC-002-b.md", project: "beta", state: {} }), text: "::rfc{id=RFC-002}" },
        { row: row({ id: "G-1", kind: "gap", path: "gaps/G-1-a.md", project: "beta", state: { hasProof: true } }), text: GAP },
      ],
      roots: { alpha: "/a", beta: "/b" },
    });
    const tracks = currentFrom(shelves);
    const rfc = tracks.find((t) => t.kind === "rfc");
    expect(rfc.total).toBe(2);
    expect(rfc.stations.map((s) => s.station)).toEqual(["draft", "approved", "built", "settled", "retired"]);
    expect(rfc.stations.find((s) => s.station === "built").cards.map((c) => c.project)).toEqual(["alpha"]);
    expect(rfc.stations.find((s) => s.station === "draft").cards.map((c) => c.project)).toEqual(["beta"]);
    // A kind with nothing in it gets no track at all — the band's own rule, unchanged here.
    expect(tracks.map((t) => t.kind)).toEqual(["rfc", "gap"]);
  });

  // A DECLINED RFC IS A DRAFT (his ruling, 2026-11-07), so the shelf no longer has to draw a
  // station the trail never promised in order to keep the document visible.
  it("a declined RFC stands on draft, and no off-trail station is drawn for it", () => {
    const { shelves } = shelvesFrom({
      docs: [{ row: row({ id: "RFC-004", path: "RFCs/RFC-004-d.md", project: "alpha", state: { verdict: "rejected" } }), text: RFC }],
      roots: { alpha: "/a" },
    });
    const [rfc] = currentFrom(shelves);
    expect(rfc.stations.map((s) => s.station)).not.toContain("rejected");
    expect(rfc.stations.find((s) => s.station === "draft").cards.length).toBe(1);
  });

  it("counts documents the registry has no state for as unparsed, beside the track and not on it", () => {
    const { shelves } = shelvesFrom({
      docs: [{ row: { id: "RFC-005", kind: "rfc", path: "RFCs/RFC-005-e.md", project: "alpha" }, text: RFC }],
      roots: { alpha: "/a" },
    });
    const [rfc] = currentFrom(shelves);
    expect(rfc.unparsed).toBe(1);
    expect(rfc.stations.every((s) => !s.cards.length)).toBe(true);
  });
});
