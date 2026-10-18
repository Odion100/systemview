// WHERE A TAB GOES, AS CLAIMS — tabRoutes was extracted (RFC-069 slice 4) so two pages could share
// one routing opinion; these claims are what "share" means. Pure functions, no render: every kind's
// route and label, and the params a route must CLEAR so a file's leftovers never ride into a stats
// tab. Written while the proof of the extraction was still "press it and see".
import { buildRoute, labelOfTab } from "./tabRoutes";

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
