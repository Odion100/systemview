import { arcRows, arcLine, arcIdFromPath, titleFromPath } from "./arcRows";
import { BAND_KINDS, bandTabs } from "./bandTabs";

const doc = (lines) => lines.join("\n");

// `::objective` is a CONTAINER — it wraps the prose a person reads, so it opens at three colons
// and closes. `::arc` is a LEAF, one line at the top saying which arc this is, the same shape as
// `::members`. Getting those two the wrong way round is the mistake the parser's own comment
// records, and this test made it again.

const ARC = doc([
  "::arc{id=ARC-004 owner=systemview-test title=\"Arcs become trackable\"}",
  "",
  ":::objective{id=O1 state=done owner=systemview-test}",
  "Land the attachment shape.",
  ":::",
  ":::objective{id=O2 state=doing owner=systemview-test needs=ARC-004-O1}",
  "Carry them on the run record.",
  ":::",
  ":::objective{id=O3 state=open owner=systemview-test needs=ARC-004-O2}",
  "Write them at dispatch.",
  ":::",
  "",
]);

describe("an arc reads its own state out of its document", () => {
  // §3 of the RFC: the document IS the state. A row that kept its own count would be a second
  // answer, and it would drift the moment somebody ticked an objective by hand.
  it("counts the objectives in the file, not a stored number", () => {
    const [row] = arcRows([{ path: "RFCs/arcs/ARC-004-arcs-become-trackable.md", text: ARC }]);
    expect(row.total).toBe(3);
    expect(row.done).toBe(1);
  });

  it("takes its identity and title from the arc block when it has one", () => {
    const [row] = arcRows([{ path: "RFCs/arcs/ARC-004-whatever.md", text: ARC }]);
    expect(row.id).toBe("ARC-004");
    expect(row.title).toBe("Arcs become trackable");
    expect(row.owner).toBe("systemview-test");
  });

  // A document that has objectives but no `::arc` header still has to produce a usable row —
  // falling back to nothing would make a real arc invisible in the band.
  it("falls back to the filename when the document has no arc block", () => {
    const [row] = arcRows([
      { path: "RFCs/arcs/ARC-011-the-landing-order.md", text: ":::objective{id=O1 state=open}\nThe thing.\n:::" },
    ]);
    expect(row.id).toBe("ARC-011");
    expect(row.title).toBe("the landing order");
  });

  // Progress alone does not say what to do next. 2 of 7 moving and 2 of 7 waiting are different
  // situations, and the difference is what the row has to carry.
  it("counts what is BLOCKED, because that changes what he does next", () => {
    const [row] = arcRows([{ path: "RFCs/arcs/ARC-004-x.md", text: ARC }]);
    expect(row.blocked).toBe(1); // O3 needs O2, which is not done
  });

  // An arc with nothing in it is EMPTY, not finished — treating 0 of 0 as complete would quietly
  // retire an arc somebody created a minute ago.
  it("does not call an empty arc done", () => {
    const [row] = arcRows([{ path: "RFCs/arcs/ARC-099-empty.md", text: "::arc{id=ARC-099}" }]);
    expect(row.total).toBe(0);
    expect(row.complete).toBe(false);
  });

  it("calls an arc done only when every objective is", () => {
    const all = doc(["::arc{id=ARC-002}", ":::objective{id=O1 state=done}", "a", ":::", ":::objective{id=O2 state=done}", "b", ":::"]);
    expect(arcRows([{ path: "RFCs/arcs/ARC-002-x.md", text: all }])[0].complete).toBe(true);
  });
});

describe("the order is the order to act in", () => {
  it("puts unfinished arcs above finished ones, closest-to-done first", () => {
    const rows = arcRows([
      { path: "RFCs/arcs/ARC-001-a.md", text: ":::objective{id=O1 state=done}\nThe thing.\n:::" },
      { path: "RFCs/arcs/ARC-002-b.md", text: ":::objective{id=O1 state=open}\na\n:::\n:::objective{id=O2 state=open}\nb\n:::" },
      { path: "RFCs/arcs/ARC-003-c.md", text: ":::objective{id=O1 state=done}\na\n:::\n:::objective{id=O2 state=open}\nb\n:::" },
    ]);
    expect(rows.map((r) => r.id)).toEqual(["ARC-003", "ARC-002", "ARC-001"]);
  });

  it("ignores anything that is not a readable document rather than throwing", () => {
    expect(arcRows([null, { path: "x.md" }, { text: "no path" }])).toEqual([]);
  });
});

describe("the row's own line", () => {
  it("a DECLARED stop counts, even when its needs are satisfied — the case the band was silent about", () => {
    const text = [
      "::arc{id=ARC-900 title=\"the written stop\"}",
      "",
      ":::objective{id=O1 state=done}",
      "the need, already met",
      ":::",
      "",
      ':::objective{id=O2 needs=O1 state=blocked blocked="waiting on a decision only he can make"}',
      "stopped on purpose, by somebody who looked",
      ":::",
      "",
    ].join("\n");
    const [row] = arcRows([{ path: "arcs/ARC-900.md", text }]);
    // O2's `needs` ARE met, so the derived route says nothing. The document says blocked, with a
    // reason — and that is the stronger of the two signals, so the count has to carry it.
    expect(row.blocked).toBe(1);
    expect(arcLine(row)).toBe("1 of 2 · 1 blocked");
  });

  it("a declared stop that is also DONE is not blocked — done outranks a stale word", () => {
    const text = [
      "::arc{id=ARC-901}",
      "",
      ':::objective{id=O1 state=done blocked="the reason nobody cleared"}',
      "finished anyway",
      ":::",
      "",
    ].join("\n");
    const [row] = arcRows([{ path: "arcs/ARC-901.md", text }]);
    expect(row.blocked).toBe(0);
    expect(row.done).toBe(1);
  });

  it("says the count, and the blocked number only when there is one", () => {
    expect(arcLine({ done: 1, total: 3, blocked: 1 })).toBe("1 of 3 · 1 blocked");
    expect(arcLine({ done: 1, total: 3, blocked: 0 })).toBe("1 of 3");
    expect(arcLine({ done: 2, total: 2, blocked: 0, complete: true })).toBe("2 of 2 · done");
  });
});

describe("the band", () => {
  it("has an arcs kind", () => {
    expect(BAND_KINDS.some((k) => k.key === "arcs")).toBe(true);
  });

  // The band's standing rule, unchanged: a tab that can only ever say "nothing here" is furniture.
  it("gives a project with no arcs no tab", () => {
    expect(bandTabs({ jobs: 2, arcs: 0 }).tabs.map((t) => t.key)).toEqual(["jobs"]);
  });

  it("draws the tab the moment there is one arc", () => {
    expect(bandTabs({ arcs: 1 }).tabs.map((t) => t.key)).toEqual(["arcs"]);
  });
});

describe("the path is read, never stored", () => {
  it("takes the number as the identity and ignores the cosmetic title", () => {
    expect(arcIdFromPath("RFCs/arcs/ARC-004-renamed-later.md")).toBe("ARC-004");
    expect(arcIdFromPath("RFCs/arcs/ARC-004-something-else-entirely.md")).toBe("ARC-004");
  });

  it("answers empty for a path that is not an arc, rather than inventing one", () => {
    expect(arcIdFromPath("RFCs/RFC-072-arc-planning.md")).toBe("");
    expect(titleFromPath("")).toBe("");
  });
});
