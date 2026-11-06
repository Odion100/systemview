import { getTabs, openTab, focusTab, closeTab, activeTab, moveTab, fileKey, closeRight, closeOthers, closeAll, countRight, fileOpenPlan } from "./tabsStore";

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

// A REFERENCE YOU FOLLOWED BELONGS NEXT TO THE THING YOU FOLLOWED IT FROM — his ruling: *"stop
// taking you to the new page and just add a tab right next door to the dashboard tab."*
describe("opening a tab beside the one you are on", () => {
  const pcN = () => `beside-${Math.random().toString(36).slice(2)}`;
  const tab = (k) => ({ key: k, kind: "file", file: { projectCode: "", path: `${k}.js` } });

  it("inserts after the named tab rather than at the end", () => {
    const pc = pcN();
    openTab(pc, tab("one"));
    openTab(pc, tab("two"));
    openTab(pc, tab("three"));
    openTab(pc, tab("new"), { beside: "one" });
    expect(getTabs(pc).panes[0].tabs.map((t) => t.key)).toEqual(["one", "new", "two", "three"]);
  });

  it("leaves you where you are when told not to focus", () => {
    const pc = pcN();
    openTab(pc, tab("one"));
    openTab(pc, tab("two"));
    openTab(pc, tab("new"), { beside: "two", focus: false });
    expect(getTabs(pc).panes[0].active).toBe("two");
    expect(getTabs(pc).panes[0].tabs.map((t) => t.key)).toEqual(["one", "two", "new"]);
  });

  // WITH AN EMPTY STRIP THERE IS NOTHING TO STAY ON, and a tab nobody is looking at over an
  // empty centre is just a hidden file.
  it("focuses anyway when nothing was open", () => {
    const pc = pcN();
    openTab(pc, tab("first"), { focus: false });
    expect(getTabs(pc).panes[0].active).toBe("first");
  });

  it("a tab that is already open is refreshed in place, never duplicated or moved", () => {
    const pc = pcN();
    openTab(pc, tab("one"));
    openTab(pc, tab("two"));
    openTab(pc, { ...tab("one"), file: { projectCode: "", path: "one.js", lines: [4, 4] } }, { beside: "two", focus: false });
    const { tabs, active } = getTabs(pc).panes[0];
    expect(tabs.map((t) => t.key)).toEqual(["one", "two"]);
    expect(tabs[0].file.lines).toEqual([4, 4]);
    expect(active).toBe("two");
  });

  it("falls back to the end when the tab it should sit beside is gone", () => {
    const pc = pcN();
    openTab(pc, tab("one"));
    openTab(pc, tab("new"), { beside: "vanished" });
    expect(getTabs(pc).panes[0].tabs.map((t) => t.key)).toEqual(["one", "new"]);
  });
});

// NAVIGATING FROM ONE FILE TO ANOTHER DROPS IT RIGHT OF WHERE YOU ARE — his rule: *"whenever you
// navigate from one file to another, that file should pop up right next to the tab you're on. I
// don't care if the file is already open — that means move it over."* `beside` + `move`.
describe("navigating to a file lands it right of the active tab, moving it if already open", () => {
  const pcN = () => `move-${Math.random().toString(36).slice(2)}`;
  const tab = (k) => ({ key: k, kind: "file", file: { projectCode: "", path: `${k}.js` } });

  it("a NEW file opens directly right of where you are, not at the end", () => {
    const pc = pcN();
    openTab(pc, tab("a"));
    openTab(pc, tab("b"));
    openTab(pc, tab("c")); // a b c
    // you are on b; navigate to a new file d
    openTab(pc, tab("d"), { beside: "b", move: true });
    expect(getTabs(pc).panes[0].tabs.map((t) => t.key)).toEqual(["a", "b", "d", "c"]);
    expect(getTabs(pc).panes[0].active).toBe("d");
  });

  it("an ALREADY-OPEN file MOVES over to sit right of where you are", () => {
    const pc = pcN();
    openTab(pc, tab("a"));
    openTab(pc, tab("b"));
    openTab(pc, tab("c")); // a b c
    // you are on a; navigate to c, already open at the far end — it moves next to a
    openTab(pc, tab("c"), { beside: "a", move: true });
    expect(getTabs(pc).panes[0].tabs.map((t) => t.key)).toEqual(["a", "c", "b"]);
    expect(getTabs(pc).panes[0].active).toBe("c");
  });

  it("navigating to the tab you are already on moves nothing — it refreshes in place", () => {
    const pc = pcN();
    openTab(pc, tab("a"));
    openTab(pc, tab("b")); // a b, active b
    openTab(pc, { ...tab("b"), file: { projectCode: "", path: "b.js", lines: [2, 2] } }, { beside: "b", move: true });
    expect(getTabs(pc).panes[0].tabs.map((t) => t.key)).toEqual(["a", "b"]);
    expect(getTabs(pc).panes[0].tabs[1].file.lines).toEqual([2, 2]);
    expect(getTabs(pc).panes[0].active).toBe("b");
  });
});

// A CLOSED FILE STAYS CLOSED — his bug: *"sometimes you close the document and it just pops up at
// the end of the tabs."* The URL outlives the close by a beat; the reopen effect reading it must
// not resurrect the tab. fileOpenPlan is the one decision, so it can be checked on its own.
describe("a closed file stays closed — fileOpenPlan", () => {
  const pcN = () => `closed-${Math.random().toString(36).slice(2)}`;
  const tab = (k) => ({ key: k, kind: "file", file: { projectCode: "", path: `${k}.js` } });

  it("opens a file that is present — a refresh or move in place", () => {
    expect(fileOpenPlan(true, "file::x.js", "file::x.js")).toBe("open");
  });
  it("SKIPS a file gone from the set that is the same one last opened — a close left the URL behind", () => {
    expect(fileOpenPlan(false, "file::x.js", "file::x.js")).toBe("skip");
  });
  it("opens a genuine navigation — gone from the set, but a different file than last time", () => {
    expect(fileOpenPlan(false, "file::y.js", "file::x.js")).toBe("open");
  });
  it("opens the very first file — nothing was opened before", () => {
    expect(fileOpenPlan(false, "file::x.js", null)).toBe("open");
  });

  it("a close followed by the stale URL being read again does NOT re-add the tab at the end", () => {
    const pc = pcN();
    openTab(pc, tab("a"));
    openTab(pc, tab("b")); // a b — 'b' is the file the URL names, and the one last opened
    const lastKey = "b";
    closeTab(pc, "b"); // his ×
    const present = getTabs(pc).panes[0].tabs.some((t) => t.key === "b");
    // the reopen effect fires again on a URL that still says file=b:
    expect(fileOpenPlan(present, "b", lastKey)).toBe("skip"); // so it is NOT re-added at the tail
    expect(getTabs(pc).panes[0].tabs.map((t) => t.key)).toEqual(["a"]);
  });
});
