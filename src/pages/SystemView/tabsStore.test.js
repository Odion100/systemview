import { getTabs, openTab, focusTab, closeTab, activeTab, moveTab, fileKey, closeRight, closeOthers, closeAll, countRight } from "./tabsStore";

// RFC-054 — the open set. The rules under test are the ones his asks named: multiple files open at
// once; open-or-focus (never duplicate); closing the active tab lands on a neighbor, never nowhere;
// and the strip survives a reload because the set is cached.
// ONE PROJECT PER TEST — the in-memory store deliberately outlives localStorage clears (a project's
// store lives for the session in the app too), so tests isolate by project code, not by cleanup.
let n = 0;
let PC;
const file = (path) => ({ key: fileKey({ projectCode: PC, path }), kind: "file", file: { path, projectCode: PC } });

beforeEach(() => { PC = `test-proj-${n++}`; localStorage.removeItem(`sv.tabs.${PC}`); });

describe("the open set", () => {
  it("starts EMPTY — nothing is open until he opens something (his rule, after the seeded doc tab kept resurrecting a namespace nobody chose)", () => {
    expect(getTabs(PC).panes[0].tabs).toEqual([]);
    expect(activeTab(PC)).toBe(null);
  });

  it("files accumulate — three opens, three tabs, newest focused", () => {
    openTab(PC, file("a.js"));
    openTab(PC, file("b.js"));
    openTab(PC, file("c.js"));
    const pane = getTabs(PC).panes[0];
    expect(pane.tabs.filter((t) => t.kind === "file")).toHaveLength(3);
    expect(activeTab(PC).file.path).toBe("c.js");
  });

  it("opening an open document FOCUSES it — and refreshes its address in place", () => {
    openTab(PC, file("a.js"));
    openTab(PC, file("b.js"));
    openTab(PC, { ...file("a.js"), file: { path: "a.js", projectCode: PC, lines: [4, 9] } });
    const pane = getTabs(PC).panes[0];
    expect(pane.tabs.filter((t) => t.file && t.file.path === "a.js")).toHaveLength(1);
    expect(activeTab(PC).file.lines).toEqual([4, 9]);
  });

  it("closing the active tab focuses the neighbor that takes its place", () => {
    openTab(PC, file("a.js"));
    openTab(PC, file("b.js"));
    openTab(PC, file("c.js"));
    focusTab(PC, fileKey({ projectCode: PC, path: "b.js" }));
    closeTab(PC, fileKey({ projectCode: PC, path: "b.js" }));
    expect(activeTab(PC).file.path).toBe("c.js");
  });

  it("closing a background tab never steals focus", () => {
    openTab(PC, file("a.js"));
    openTab(PC, file("b.js"));
    closeTab(PC, fileKey({ projectCode: PC, path: "a.js" }));
    expect(activeTab(PC).file.path).toBe("b.js");
  });

  it("an emptied strip is legal — active null, the center's nothing-open state", () => {
    openTab(PC, file("a.js"));
    closeTab(PC, fileKey({ projectCode: PC, path: "a.js" }));
    expect(getTabs(PC).panes[0].tabs).toHaveLength(0);
    expect(activeTab(PC)).toBe(null);
  });

  it("dragging a tab drops it where the target sat — active untouched", () => {
    openTab(PC, file("a.js"));
    openTab(PC, file("b.js"));
    openTab(PC, file("c.js")); // order: a b c · active c
    moveTab(PC, fileKey({ projectCode: PC, path: "c.js" }), fileKey({ projectCode: PC, path: "a.js" }));
    expect(getTabs(PC).panes[0].tabs.map((t) => t.file.path)).toEqual(["c.js", "a.js", "b.js"]);
    expect(activeTab(PC).file.path).toBe("c.js");
    // …and to the END when dropped past everything
    moveTab(PC, fileKey({ projectCode: PC, path: "c.js" }), null);
    expect(getTabs(PC).panes[0].tabs.map((t) => (t.file ? t.file.path : "doc")).pop()).toBe("c.js");
  });

  it("the set survives a reload — cached whole, shaped for panes", () => {
    openTab(PC, file("a.js"));
    const raw = JSON.parse(localStorage.getItem(`sv.tabs.${PC}`));
    expect(Array.isArray(raw.panes)).toBe(true);
    expect(raw.panes[0].tabs.some((t) => t.kind === "file")).toBe(true);
  });
});

// RIGHT-CLICK VERBS — the anchor is what survives, and it is where focus lands.
describe("bulk close", () => {
  const PC = "bulk-close-proj";
  const t = (k) => ({ key: k, kind: "file", file: { path: k, projectCode: PC } });
  beforeEach(() => {
    closeAll(PC);
    ["a", "b", "c", "d"].forEach((k) => openTab(PC, t(k)));
  });

  it("closes everything to the right and keeps the anchor", () => {
    expect(closeRight(PC, "b")).toBe("b");
    expect(getTabs(PC).panes[0].tabs.map((x) => x.key)).toEqual(["a", "b"]);
  });

  it("leaves active alone when the close did not swallow it", () => {
    focusTab(PC, "a");
    expect(closeRight(PC, "b")).toBe("a");
  });

  it("closes others and focuses the anchor", () => {
    expect(closeOthers(PC, "c")).toBe("c");
    expect(getTabs(PC).panes[0].tabs.map((x) => x.key)).toEqual(["c"]);
  });

  it("closes all and reports nothing active", () => {
    expect(closeAll(PC)).toBe(null);
    expect(getTabs(PC).panes[0].tabs).toEqual([]);
  });

  it("counts what closeRight would remove, so a dead menu item can be hidden", () => {
    expect(countRight(PC, "a")).toBe(3);
    expect(countRight(PC, "d")).toBe(0);
  });

  it("is a no-op when there is nothing to the right", () => {
    focusTab(PC, "b");
    expect(closeRight(PC, "d")).toBe("b");
    expect(getTabs(PC).panes[0].tabs).toHaveLength(4);
  });
});
