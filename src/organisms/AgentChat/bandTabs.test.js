import { bandTabs, bandLabel, bandHead, readBandTab, writeBand, TAB_KEY } from "./bandTabs";

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

  it("orders them the way the head reads them — jobs, lanes, lists", () => {
    const { tabs } = bandTabs({ jobs: 1, lanes: 1, lists: 1 });
    expect(tabs.map((t) => t.key)).toEqual(["jobs", "lanes", "lists"]);
  });

  // THE BAND IS WORK IN FLIGHT, AND NOTHING ELSE — his ruling, 2026-11-06, once the dashboard
  // existed: *"all these documents being shown here are irrelevant… I would make it all about the
  // worklist. Work in flight."* Every kind the band grew through October — owed, reports and their
  // subtypes, RFCs, arcs, gaps — was asked for in its day and now lives on the dashboard. The
  // counts still ARRIVE (one object from one caller), so this is the claim that matters: a kind
  // BAND_KINDS does not name can never draw a tab, however many rows it reports.
  it("gives no tab to a kind that moved to the dashboard, however many rows it has", () => {
    expect(bandTabs({ owed: 3, reports: 9, rfcs: 4, arcs: 2, gaps: 7 })).toEqual({ tabs: [], active: "" });
  });

  it("and a stored key from the document era falls through to the work that is running", () => {
    expect(bandTabs({ jobs: 1, reports: 9 }, "reports").active).toBe("jobs");
    expect(bandTabs({ jobs: 1, reports: 9 }, "reports:spec").active).toBe("jobs");
    expect(bandTabs({ jobs: 1, owed: 3 }, "owed").active).toBe("jobs");
  });

  it("speaks the head's own words, singular and plural", () => {
    expect(bandLabel("job", 1)).toBe("1 job");
    expect(bandLabel("lanes", 3)).toBe("3 lanes");
    expect(bandLabel("lists", 1)).toBe("1 list");
    expect(bandLabel("lists", 4)).toBe("4 lists");
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
  // THE OBJECT COUNT THAT SURVIVED THE CUT. Two kinds used to arrive as an object and they meant
  // opposite things — a report subtype became its own tab, a lane-less subagent becomes a SECTION
  // inside the lane tab. Only the second one is left, so it is worth claiming on its own.
  it("still folds the lane tab's two parts into one tab, ignoring a document count beside it", () => {
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

// TWO FAMILIES IN ONE BAND. Work that is running, and documents in a folder — the second group is
// the one that becomes configurable, and the band has to carry the distinction before anything can
// render it. Reports sits in it by default because of where it lives, not because it is special.
describe("a tab says which family it belongs to", () => {
  it("calls jobs, lists and lanes work", () => {
    const { tabs } = bandTabs({ jobs: 1, lists: 1, lanes: 1 });
    expect(tabs.map((t) => t.family)).toEqual(["work", "work", "work"]);
  });

  it("has one family left, because one kind of thing is left", () => {
    const { tabs } = bandTabs({ jobs: 1, lanes: 1, lists: 1 });
    expect(tabs.every((t) => t.family === "work")).toBe(true);
    expect(bandTabs({ reports: 1, rfcs: 1, arcs: 1, gaps: 1, owed: 1 }).tabs).toEqual([]);
  });

  it("carries the family through alongside the count, so the render needs no second lookup", () => {
    const [tab] = bandTabs({ jobs: 4 }).tabs;
    expect(tab).toMatchObject({ key: "jobs", n: 4, family: "work" });
  });
});

// ── THE CLOSED BAND'S ONE LINE ─────────────────────────────────────────────────────────────────
// The head spent a week saying what was OWED; the same ruling that took the document tabs out took
// that with it. It answers one question now — is anything running right now — and every word is
// derived from the rows the tabs count, so the line and the pane can never disagree.
describe("the head speaks work-state", () => {
  it("names what is running, in the order the tabs sit in", () => {
    expect(bandHead({ jobs: 1, lanes: 2, subagents: 1, runs: 3 }).map((s) => s.text)).toEqual([
      "1 job running",
      "2 lanes out",
      "1 subagent running",
      "3 runs open",
    ]);
  });

  it("says nothing about what it does not have", () => {
    expect(bandHead({ lanes: 1 }).map((s) => s.text)).toEqual(["1 lane out"]);
  });

  // A MEASURED ZERO, and not a door: the band can render with nothing moving — finished runs he
  // has not cleared, a whiteboard with no work beside it — and a button opening a tab that does
  // not exist is a press that answers nothing.
  it("says nothing in flight when nothing is, and that segment opens no tab", () => {
    const [only] = bandHead({});
    expect(only.text).toBe("nothing in flight");
    expect(only.tab).toBe("");
    expect(bandHead().length).toBe(1);
  });

  it("every other segment names the tab it opens", () => {
    for (const s of bandHead({ jobs: 1, lanes: 1, subagents: 1, runs: 1 })) {
      expect(["jobs", "lanes", "lists"]).toContain(s.tab);
    }
  });

  // A subagent is not a lane and the head keeps them apart, the same way the tab's label does.
  it("counts a subagent separately from a lane, because they are not the same thing", () => {
    expect(bandHead({ lanes: 0, subagents: 2 }).map((s) => s.text)).toEqual(["2 subagents running"]);
  });
});
