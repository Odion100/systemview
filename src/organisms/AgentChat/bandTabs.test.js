import { bandTabs, bandLabel, readBandTab, writeBand, TAB_KEY } from "./bandTabs";

// The band's rule is about EMPTINESS, which is the only thing a tabbed surface can get wrong in a
// way the user feels: a tab bar that says there is work beside a pane that shows none.
describe("the work band is tabs — one per type of work", () => {
  it("gives a tab only to a kind that has rows", () => {
    const { tabs } = bandTabs({ jobs: 2, lanes: 0, lists: 0 });
    expect(tabs.map((t) => t.key)).toEqual(["jobs"]);
  });

  it("keeps the stored choice while it still has rows", () => {
    expect(bandTabs({ jobs: 1, lanes: 3 }, "lanes").active).toBe("lanes");
  });

  it("moves off a tab whose rows are gone, instead of showing an empty pane", () => {
    expect(bandTabs({ jobs: 1, lanes: 0 }, "lanes").active).toBe("jobs");
  });

  it("has no tabs and no active tab when nothing stands", () => {
    expect(bandTabs({}, "lanes")).toEqual({ tabs: [], active: "" });
  });

  it("orders them the way the head reads them — owed, jobs, lanes, lists", () => {
    const { tabs } = bandTabs({ owed: 1, jobs: 1, lanes: 1, lists: 1 });
    expect(tabs.map((t) => t.key)).toEqual(["owed", "jobs", "lanes", "lists"]);
  });

  // THE BAND IS WORK IN FLIGHT, AND ONLY THAT — his ruling: *"I would make it all about the
  // worklist. Work in flight. Not about dashboard shit, which I already have on an amazing
  // dashboard."* A folder of documents is an inventory, and the dashboard is where an inventory
  // belongs. The counts still ARRIVE (callers hand over one object), which is why this is a claim:
  // a kind BAND_KINDS does not name can never draw a tab, however many rows it reports.
  it("gives no tab to a document kind, however many rows it has", () => {
    const { tabs, active } = bandTabs({ reports: 9, rfcs: 4, arcs: 2, gaps: 7 });
    expect(tabs).toEqual([]);
    expect(active).toBe("");
  });

  it("and a stored document tab falls through to the work that is actually running", () => {
    expect(bandTabs({ jobs: 1, reports: 9 }, "reports").active).toBe("jobs");
    expect(bandTabs({ jobs: 1, reports: 9 }, "reports:spec").active).toBe("jobs");
  });

  it("speaks the head's own words, singular and plural", () => {
    expect(bandLabel("job", 1)).toBe("1 job");
    expect(bandLabel("lanes", 3)).toBe("3 lanes");
    expect(bandLabel("lists", 1)).toBe("1 list");
    expect(bandLabel("owed", 3)).toBe("3 owed");
    // A kind the band no longer draws has no word of its own — it falls back to the key, which is
    // the honest answer for something that cannot appear.
    expect(bandLabel("reports", 9)).toBe("9 reportss");
  });

  // ── THE LANE TAB HOLDS TWO KINDS ────────────────────────────────────────────────────────────
  // His ask, 2026-11-01: a subagent with no branch gets the lane's row shape, and the tab reads as
  // two sections. The bug underneath it was arithmetic: `lanes` counted REGISTERED lanes only, so
  // two lane-less subagents and no lanes scored 0, the tab was deleted by the emptiness rule, and
  // the render gate (`active === "lanes"`) could never be true. The rows and their chats existed
  // and nothing on screen could reach them — the exact opposite of "no subagent runs unseen".
  it("gives the lane tab to a running subagent even with no lane registered at all", () => {
    const { tabs, active } = bandTabs({ lanes: { lanes: 0, subagents: 2 } }, "");
    expect(tabs.map((t) => t.key)).toEqual(["lanes"]);
    expect(active).toBe("lanes");
    expect(tabs[0].n).toBe(2);
  });

  it("still has no lane tab when neither kind stands", () => {
    expect(bandTabs({ lanes: { lanes: 0, subagents: 0 } }, "lanes")).toEqual({ tabs: [], active: "" });
  });

  it("counts every row in the pane, so the number cannot disagree with what opening it shows", () => {
    expect(bandTabs({ lanes: { lanes: 1, subagents: 2 } }).tabs[0].n).toBe(3);
  });

  // THE COUNT THAT BUYS THE TAB AND THE WORDS ON IT ARE NOT THE SAME CLAIM. A subagent with no
  // branch has no run record and nothing to diff, so "3 lanes" over one lane and two subagents
  // would trade an invisible row for a false one. The label names both instead.
  it("names both kinds rather than counting a subagent as a lane", () => {
    const t = bandTabs({ lanes: { lanes: 1, subagents: 2 } }).tabs[0];
    expect(bandLabel(t.key, t.n, t.parts)).toBe("1 lane · 2 subagents");
  });

  it("collapses to one kind's words when only one kind stands", () => {
    const only = bandTabs({ lanes: { lanes: 0, subagents: 2 } }).tabs[0];
    expect(bandLabel(only.key, only.n, only.parts)).toBe("2 subagents");
    const lanesOnly = bandTabs({ lanes: { lanes: 3, subagents: 0 } }).tabs[0];
    expect(bandLabel(lanesOnly.key, lanesOnly.n, lanesOnly.parts)).toBe("3 lanes");
    expect(bandLabel("lanes", 1, { lanes: 1, subagents: 0 })).toBe("1 lane");
  });

  // A plain number still works — every other kind passes one, and the lane tab did until today.
  it("takes the lane count as a plain number too", () => {
    expect(bandTabs({ lanes: 2 }).tabs[0].n).toBe(2);
    expect(bandLabel("lanes", 2)).toBe("2 lanes");
  });

  // Reports' object fans OUT into tabs; the lane tab's folds IN. Opposite meanings, same shape —
  // so this is the claim that widening one did not widen the other.
  // THE LANE TAB'S OBJECT COUNT SURVIVED THE CUT, and the one that fanned out did not. Both kinds
  // arrived as an object and they meant opposite things — a report subtype became its own tab, a
  // lane-less subagent became a section inside the lane tab — so the surviving one is worth a claim
  // of its own now that there is no sibling to tell it apart from.
  it("still folds the lane tab's two parts into one tab, with a report count beside it ignored", () => {
    const { tabs } = bandTabs({ lanes: { lanes: 1, subagents: 1 }, reports: { "": 1, spec: 2 } });
    expect(tabs.map((t) => t.key)).toEqual(["lanes"]);
    expect(tabs[0].n).toBe(2);
    expect(tabs[0].parts).toEqual({ lanes: 1, subagents: 1 });
  });

  it("survives a storage that refuses to answer — private mode is not an error", () => {
    const hostile = { getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("denied"); } };
    expect(readBandTab(hostile)).toBe("");
    expect(() => writeBand(TAB_KEY, "lanes", hostile)).not.toThrow();
  });
});

// WHAT IS OWED BY HIM TAKES THE FRONT OF THE ROW. The inventory counts came out of the band head
// (*"why do you think I'm attached to inventory and it being a tab I can get through from up
// there?"*) and what replaced them had to land somewhere — one line across every kind at once,
// which is not a folder and therefore not a document tab.
describe("owed leads the band", () => {
  it("has no tab when nothing is owed — the rule every kind lives by", () => {
    expect(bandTabs({ jobs: 1, owed: 0 }).tabs.map((t) => t.key)).toEqual(["jobs"]);
  });

  it("comes first, so the band opens on what is waiting", () => {
    const { tabs, active } = bandTabs({ jobs: 1, lanes: 2, owed: 5 });
    expect(tabs.map((t) => t.key)).toEqual(["owed", "jobs", "lanes"]);
    expect(active).toBe("owed");
  });

  // LEADING IS NOT HIJACKING. A tab that took the pane every time an approval landed would move the
  // band out from under whatever he was reading in it.
  it("does not steal the tab he is standing on", () => {
    expect(bandTabs({ owed: 5, lanes: 2 }, "lanes").active).toBe("lanes");
  });

  it("is its own family — neither running work nor a folder of documents", () => {
    expect(bandTabs({ owed: 3 }).tabs).toEqual([{ key: "owed", label: "owed", n: 3, family: "owed" }]);
  });

  // "3 oweds" is not English, and a word he has to translate is a word that costs him the glance.
  it("says the word without an s, however many there are", () => {
    expect(bandLabel("owed", 1)).toBe("1 owed");
    expect(bandLabel("owed", 12)).toBe("12 owed");
  });
});

// TWO FAMILIES IN ONE BAND. Work that is running, and documents in a folder — the second group is
// the one that becomes configurable, and the band has to carry the distinction before anything can
// render it. Reports sits in it by default because of where it lives, not because it is special.
describe("a tab says which family it belongs to", () => {
  it("calls jobs, lists and lanes work", () => {
    const { tabs } = bandTabs({ jobs: 1, lists: 1, lanes: 1 });
    expect(tabs.map((t) => t.family)).toEqual(["work", "work", "work"]);
  });

  it("no longer calls anything a document — that half of the band went to the dashboard", () => {
    expect(bandTabs({ reports: 1, rfcs: 1, arcs: 1, gaps: 1 }).tabs).toEqual([]);
    // Nothing the band can draw carries the family any more, which is the removal stated as a
    // property rather than as four absent tabs.
    const { tabs } = bandTabs({ owed: 1, jobs: 1, lanes: 1, lists: 1 });
    expect(tabs.every((t) => t.family !== "document")).toBe(true);
  });

  it("carries the family through alongside the count, so the render needs no second lookup", () => {
    const [tab] = bandTabs({ jobs: 4 }).tabs;
    expect(tab).toMatchObject({ key: "jobs", n: 4, family: "work" });
  });
});
