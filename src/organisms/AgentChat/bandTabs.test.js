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

  it("orders them the way the head reads them — jobs, lanes, lists, reports", () => {
    const { tabs } = bandTabs({ jobs: 1, lanes: 1, lists: 1, reports: 1 });
    expect(tabs.map((t) => t.key)).toEqual(["jobs", "lanes", "lists", "reports"]);
  });

  // Reports used to be a fold under the band rather than a kind in it, so this is the claim that
  // the band can now stand on reports ALONE — a room whose only work is filed reports.
  it("gives reports a tab of their own, and shows it when nothing else stands", () => {
    expect(bandTabs({ jobs: 0, lanes: 0, lists: 0, reports: 4 })).toEqual({
      tabs: [{ key: "reports", label: "report", n: 4, family: "document" }],
      active: "reports",
    });
  });

  it("speaks the head's own words, singular and plural", () => {
    expect(bandLabel("job", 1)).toBe("1 job");
    expect(bandLabel("lanes", 3)).toBe("3 lanes");
    expect(bandLabel("lists", 1)).toBe("1 list");
    expect(bandLabel("reports", 1)).toBe("1 report");
    expect(bandLabel("reports", 9)).toBe("9 reports");
  });

  it("survives a storage that refuses to answer — private mode is not an error", () => {
    const hostile = { getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("denied"); } };
    expect(readBandTab(hostile)).toBe("");
    expect(() => writeBand(TAB_KEY, "lanes", hostile)).not.toThrow();
  });
});

// RFCs TOOK THE DOCUMENTS TAB'S PLACE. That tab counted "documents somebody has not been pinged
// about", and the premise did not survive being played out: an agent reads a document when it
// works, so it is never meaningfully behind on one. An RFC with an unpressed approval IS a thing
// waiting on him, and nothing else in the band shows it.
describe("RFCs take their turn in the band", () => {
  it("has no tab when there are none — the rule every kind lives by", () => {
    const { tabs } = bandTabs({ jobs: 1, rfcs: 0 });
    expect(tabs.map((t) => t.key)).toEqual(["jobs"]);
  });
  it("appears when there are some, and speaks the band's plural", () => {
    const { tabs } = bandTabs({ rfcs: 2 });
    expect(tabs.map((t) => t.key)).toEqual(["rfcs"]);
    expect(bandLabel("rfcs", 1)).toBe("1 RFC");
    expect(bandLabel("rfcs", 2)).toBe("2 RFCs");
  });
  it("comes last, so a surface nobody has lived with yet cannot steal the opening tab", () => {
    const { tabs, active } = bandTabs({ jobs: 1, rfcs: 3 });
    expect(tabs.map((t) => t.key)).toEqual(["jobs", "rfcs"]);
    expect(active).toBe("jobs");
  });
  // The tab it replaced must be gone from the vocabulary, not merely unrendered — a key nothing
  // draws is how a count ends up over an empty pane, which is the bug this replaced.
  it("no longer knows the word documents at all", () => {
    expect(bandTabs({ documents: 5 }).tabs).toEqual([]);
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

  it("calls reports, RFCs and arcs documents — reports included", () => {
    const { tabs } = bandTabs({ reports: 1, rfcs: 1, arcs: 1 });
    expect(tabs.map((t) => [t.key, t.family])).toEqual([
      ["reports", "document"],
      ["rfcs", "document"],
      ["arcs", "document"],
    ]);
  });

  it("carries the family through alongside the count, so the render needs no second lookup", () => {
    const [tab] = bandTabs({ arcs: 4 }).tabs;
    expect(tab).toMatchObject({ key: "arcs", n: 4, family: "document" });
  });
});
