// WHERE A TAB GOES, AS CLAIMS — tabRoutes was extracted so two pages could share
// one routing opinion; these claims are what "share" means. Pure functions, no render: every kind's
// route and label, and the params a route must CLEAR so a file's leftovers never ride into a stats
// tab. Written while the proof of the extraction was still "press it and see".
import { buildRoute, labelOfTab, tabForUrl, floorTab, seedable } from "./tabRoutes";

const q = (r) => Object.fromEntries(new URLSearchParams(r.search));

describe("buildRoute", () => {
  it("routes a project file to the docs tab with its whole address", () => {
    const r = buildRoute(
      { kind: "file", file: { path: "cli/index.js", projectCode: "pc2", language: "js", lines: [40, 80], side: "right" } },
      "pc",
      ""
    );
    expect(r.pathname).toBe("/specs/pc");
    expect(q(r)).toMatchObject({ tab: "docs", file: "cli/index.js", fproj: "pc2", flang: "js", flines: "40-80", fside: "right" });
    expect(q(r).fmachine).toBeUndefined();
  });

  it("stamps fmachine=1 on a machine file and carries no project", () => {
    const r = buildRoute({ kind: "file", file: { path: "/Users/x/.autobot/jobs/j/job.md", machine: true } }, "pc", "");
    expect(q(r)).toMatchObject({ tab: "docs", file: "/Users/x/.autobot/jobs/j/job.md", fmachine: "1" });
    expect(q(r).fproj).toBeUndefined();
  });

  it("clears every file param when routing away — a file's leftovers never ride into stats", () => {
    const prior = "?tab=docs&file=a.js&fproj=pc2&flang=js&flines=1-2&fside=left&fmachine=1&fnav=1&ftab=x&help=y";
    const r = buildRoute({ kind: "stats" }, "pc", prior);
    expect(q(r)).toEqual({ tab: "stats" });
  });

  it("routes board/links/cmds to their own tab and drops any open report", () => {
    for (const kind of ["board", "links", "cmds"]) {
      const r = buildRoute({ kind }, "pc", "?tab=reports&rdoc=.systemview/report.pc.X.md");
      expect(q(r)).toEqual({ tab: kind });
    }
  });

  it("routes logs through the namespace segments", () => {
    const r = buildRoute({ kind: "logs", logs: { serviceId: "S", moduleName: "M", methodName: "m" } }, "pc", "");
    expect(r.pathname).toBe("/specs/pc/S/M/m");
    expect(q(r).tab).toBe("logs");
  });

  it("routes a report to the reports tab carrying rdoc — and clears rdoc when the tab has no report", () => {
    const withDoc = buildRoute({ kind: "report", report: { path: ".systemview/report.pc.X.md" } }, "pc", "");
    expect(q(withDoc)).toMatchObject({ tab: "reports", rdoc: ".systemview/report.pc.X.md" });
    const bare = buildRoute({ kind: "report" }, "pc", "?rdoc=.systemview/report.pc.X.md");
    expect(q(bare).rdoc).toBeUndefined();
  });

  it("routes a doc namespace through its segments, and anything unknown to the docs floor", () => {
    const d = buildRoute({ kind: "doc", doc: { serviceId: "S", moduleName: "M" } }, "pc", "");
    expect(d.pathname).toBe("/specs/pc/S/M");
    const f = buildRoute({ kind: "???" }, "pc", "");
    expect(f.pathname).toBe("/specs/pc");
    expect(q(f).tab).toBe("docs");
  });
});

describe("labelOfTab", () => {
  it("names a file tab by its basename, machine or not", () => {
    expect(labelOfTab({ kind: "file", file: { path: "src/a/b/Center.js" } }, "pc")).toBe("Center.js");
    expect(labelOfTab({ kind: "file", file: { path: "/Users/x/.autobot/presence.md", machine: true } }, "pc")).toBe("presence.md");
  });

  it("names the fixed kinds with the project beside them", () => {
    expect(labelOfTab({ kind: "stats" }, "pc")).toBe("Stats · pc");
    expect(labelOfTab({ kind: "board" }, "pc")).toBe("Board · pc");
    expect(labelOfTab({ kind: "links" }, "pc")).toBe("Links · pc");
    expect(labelOfTab({ kind: "cmds" }, "pc")).toBe("Commands · pc");
  });

  it("names an agentdoc by its own label — the door-backed documents keep their names", () => {
    expect(labelOfTab({ kind: "agentdoc", adoc: { label: "def prompt" } }, "pc")).toBe("def prompt");
    expect(labelOfTab({ kind: "agentdoc" }, "pc")).toBe("agent doc");
  });

  it("names a report from its filename, un-dashed, naming the project only when it is not this one", () => {
    expect(labelOfTab({ kind: "report", report: { path: ".systemview/report.pc.a-b-c.md" } }, "pc")).toBe("a b c");
    expect(labelOfTab({ kind: "report", report: { path: ".systemview/report.other.a-b.md" } }, "pc")).toBe("a b · other");
    expect(labelOfTab({ kind: "report" }, "pc")).toBe("Reports");
  });
});

// ─── URL → TAB, AND THE LOOP IT CLOSES ────────────────────────────────────────────────────────
//
// His bug: *"restart, land on how-we-work because everything else is loading. And then if you close
// a tab, or you open another document, a bunch of other tabs open."*
//
// The centre's effect had `onFloor` in its deps, computed from `pane.tabs.length === 0` — which the
// effect changes by opening a tab. Close the last tab and it ran: strip empties → onFloor true →
// open `how:` → strip has one → onFloor false → open `doc:` . One close, two tabs.
//
// THE ASSERTION THAT MATTERS IS THE FIRST ONE: the planner is a function of the URL and the scope
// ALONE. A function that cannot read what it writes cannot feed back into itself, so this is the
// test that keeps the loop closed rather than merely recording that it was.
describe("tabForUrl — which tab a URL state wants", () => {
  const S = { urlTab: "docs", sService: "svc", sModule: "Mod", sMethod: "fn", projectCode: "p" };

  it("takes NOTHING from the store — the same inputs answer the same thing however many tabs are open", () => {
    const a = tabForUrl(S);
    const b = tabForUrl({ ...S });
    expect(a).toEqual(b);
    // HANDED THE STORE ANYWAY, it changes nothing — the loop came back through `tabs.length`, so
    // the assertion worth having is that an empty strip and a full one plan the same tab.
    expect(tabForUrl({ ...S, panes: [{ tabs: [], active: null }], tabs: [] })).toEqual(a);
    expect(tabForUrl({ ...S, panes: [{ tabs: [{ key: "x" }, { key: "y" }], active: "x" }] })).toEqual(a);
    // and the floor seed is the one decision that reads emptiness — it is deliberately NOT here
    expect(typeof floorTab).toBe("function");
  });

  it("answers ONE tab per state, never a list — so one transition can only ever open one tab", () => {
    ["docs", "logs", "dash", "how", "board", "stats", "links", "cmds", "reports"].forEach((urlTab) => {
      const got = tabForUrl({ ...S, urlTab });
      expect(Array.isArray(got)).toBe(false);
      if (got) expect(typeof got.key).toBe("string");
    });
  });

  it("maps each kind to the key that identifies it", () => {
    expect(tabForUrl({ ...S, urlTab: "logs" }).key).toBe("logs:svc.Mod.fn");
    expect(tabForUrl({ ...S, urlTab: "dash" }).key).toBe("dash:p");
    expect(tabForUrl({ ...S, urlTab: "how" }).key).toBe("how:p");
    expect(tabForUrl({ ...S, urlTab: "board" }).key).toBe("board:p");
    expect(tabForUrl({ ...S, urlTab: "stats" }).key).toBe("stats:p");
    expect(tabForUrl({ ...S, urlTab: "cmds" }).key).toBe("cmds:p");
    expect(tabForUrl({ ...S, urlTab: "docs" }).key).toBe("doc:svc.Mod.fn");
  });

  it("a report OPEN is its own tab; bare tab=reports is not a picker and falls back to the scope", () => {
    expect(tabForUrl({ ...S, urlTab: "reports", reportPath: "reports/x.md" }).key).toBe("report:reports/x.md");
    expect(tabForUrl({ ...S, urlTab: "reports" }).key).toBe("doc:svc.Mod.fn");
  });

  // "OPENS NOTHING" IS A REAL ANSWER, and it is the one the loading state hits — which is why it
  // must be expressible. The old code had no way to say it, so it fell through to the floor branch.
  it("opens NOTHING at project level with no service — the landing is background, not a tab", () => {
    expect(tabForUrl({ urlTab: "docs", projectCode: "p" })).toBe(null);
    expect(tabForUrl({ urlTab: "reports", projectCode: "p" })).toBe(null);
  });

  it("the floor is a real addressable tab, and @none is never seeded into", () => {
    expect(floorTab("p")).toEqual({ key: "how:p", kind: "how" });
    expect(seedable("p")).toBe(true);
    // `@none` is what tabsPc wears before the project resolves on a cold start — a real cached
    // store with its own localStorage key that no surface will ever show again.
    expect(seedable("@none")).toBe(false);
    expect(seedable("")).toBe(false);
    expect(seedable(undefined)).toBe(false);
  });

  it("a scope change moves the doc key, so the guard can tell a real navigation from a re-render", () => {
    const one = tabForUrl({ ...S, sMethod: "" }).key;
    const two = tabForUrl(S).key;
    expect(one).not.toBe(two);
    expect(tabForUrl(S).key).toBe(two);
  });
});
