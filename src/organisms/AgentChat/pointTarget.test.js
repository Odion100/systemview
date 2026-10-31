import { pointTargetOf } from "./pointTarget";

// WHAT EACH SPEC IS DOING. The claim is that NAVIGATION DOES NOT POINT — he asked for the pointer
// that walks over to the document he was just taken to to be gone, twice, and a thing removed by
// hand is a thing that comes back by hand. These specs are what notices.

describe("navigation points at nothing", () => {
  it("a file pulled up draws no gesture — you are already looking at it", () => {
    expect(pointTargetOf({ cmd: "nav", args: { file: "src/App.js" } })).toBe(null);
    expect(pointTargetOf({ cmd: "nav", args: { file: "src/App.js", lines: [20, 30] } })).toBe(null);
  });

  it("nor a report, a tab, a namespace or the stats page", () => {
    expect(pointTargetOf({ cmd: "nav", args: { report: "r.md" } })).toBe(null);
    expect(pointTargetOf({ cmd: "nav", args: { report: "r.md", lines: [4, 9] } })).toBe(null);
    expect(pointTargetOf({ cmd: "nav", args: { tab: "docs" } })).toBe(null);
    expect(pointTargetOf({ cmd: "nav", args: { namespace: "Svc.Math.add" } })).toBe(null);
    expect(pointTargetOf({ cmd: "nav", args: { stats: { report: "load" } } })).toBe(null);
  });

  it("UNLESS THE AGENT SAID SOMETHING — the dialogue box is the only place a `say` renders", () => {
    expect(pointTargetOf({ cmd: "nav", args: { file: "src/App.js" }, say: "here is the bug" })).toEqual({
      file: "src/App.js",
    });
    expect(pointTargetOf({ cmd: "nav", args: { report: "r.md", lines: [4, 9] }, say: "read this" })).toEqual({
      docLines: [4, 9],
    });
    expect(pointTargetOf({ cmd: "nav", args: { stats: {} }, say: "look" })).toEqual({ region: "reports" });
    expect(pointTargetOf({ cmd: "nav", args: { tab: "docs" }, say: "over here" })).toEqual({ region: "docs" });
  });
});

describe("the commands that name something you are not already staring at", () => {
  it("highlight is not a command at all — the name belongs to the cue verb", () => {
    // `::cue{highlight=".sel"}` draws the box in a walk. One word cannot mean two things in one
    // system, so the command that pointed the tree at a file was the one that went — and this
    // claim is what notices if somebody reintroduces it.
    expect(pointTargetOf({ cmd: "highlight", args: { file: "a.js", lines: [3, 7] } })).toBe(null);
    expect(pointTargetOf({ cmd: "highlight", args: { namespace: "Svc.M.f" } })).toBe(null);
  });

  it("show is across the room and act is off to the side", () => {
    expect(pointTargetOf({ cmd: "show", args: {} })).toEqual({ region: "tv" });
    expect(pointTargetOf({ cmd: "act", args: { run: "yarn test" } })).toEqual({ region: "center" });
    expect(pointTargetOf({ cmd: "act", args: { test: "x" } })).toEqual({ region: "scratchpad" });
  });

  it("refresh names a chore, so there is nothing to look at", () => {
    expect(pointTargetOf({ cmd: "refresh", args: { scope: "all" } })).toBe(null);
    expect(pointTargetOf({})).toBe(null);
    expect(pointTargetOf()).toBe(null);
  });
});
