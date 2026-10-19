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
      tabs: [{ key: "reports", label: "report", n: 4 }],
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

// RFC-071 — a document with members and an unsent update is work waiting on him.
describe("documents take their turn in the band", () => {
  it("has no tab when no document is waiting — the rule every kind lives by", () => {
    const { tabs } = bandTabs({ jobs: 1, documents: 0 });
    expect(tabs.map((t) => t.key)).toEqual(["jobs"]);
  });
  it("appears when one is, and speaks the band's plural", () => {
    const { tabs } = bandTabs({ documents: 2 });
    expect(tabs.map((t) => t.key)).toEqual(["documents"]);
    expect(bandLabel("documents", 1)).toBe("1 document");
    expect(bandLabel("documents", 2)).toBe("2 documents");
  });
  it("comes last, so a surface nobody has lived with yet cannot steal the opening tab", () => {
    const { tabs, active } = bandTabs({ jobs: 1, documents: 3 });
    expect(tabs.map((t) => t.key)).toEqual(["jobs", "documents"]);
    expect(active).toBe("jobs");
  });
});
