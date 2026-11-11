import { getTabs, openTab, focusTab, closeTab, activeTab, moveTab, fileKey, closeRight, closeOthers, closeAll, countRight, fileOpenPlan, fileBranch, splitTab, moveTabToPane, focusPane, focusedPane, paneOf, paneCount, paneSizes, setPaneSizes } from "./tabsStore";

// the open set. The rules under test are the ones his asks named: multiple files open at
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

// ─── THE SPLIT ────────────────────────────────────────────────────────────────────────────────
//
// His ask, 2026-11-10: *"a feature where you can split into two and you can drag documents across
// and resize between them. Close all the tabs on one side and it goes back to regular."*
//
// The rules worth pinning are the ones that are invariants rather than behaviours — a pane that
// empties cannot survive, a document cannot be on both sides, and sizes cannot disagree with the
// pane count. Those are asserted here because `normalize` is the only thing enforcing them, and a
// verb added later that forgets to call it must go red.
describe("splitting the centre into two sides", () => {
  it("starts as one pane, full width — an unsplit project is indistinguishable from before", () => {
    openTab(PC, file("a.js"));
    expect(paneCount(PC)).toBe(1);
    expect(paneSizes(PC)).toEqual([1]);
    expect(focusedPane(PC)).toBe(getTabs(PC).panes[0]);
  });

  it("splits a tab onto its own side, MOVING it rather than copying — one document, one side", () => {
    openTab(PC, file("a.js"));
    openTab(PC, file("b.js"));
    const to = splitTab(PC, fileKey({ projectCode: PC, path: "b.js" }));
    expect(to).toBe(1);
    expect(paneCount(PC)).toBe(2);
    expect(getTabs(PC).panes[0].tabs.map((t) => t.file.path)).toEqual(["a.js"]);
    expect(getTabs(PC).panes[1].tabs.map((t) => t.file.path)).toEqual(["b.js"]);
    // and the new side is where you are, because you just asked for it
    expect(getTabs(PC).focus).toBe(1);
    expect(paneSizes(PC)).toEqual([0.5, 0.5]);
  });

  it("refuses to split the only tab — a split that empties its own origin is a focus change with extra steps", () => {
    openTab(PC, file("only.js"));
    expect(splitTab(PC, fileKey({ projectCode: PC, path: "only.js" }))).toBe(null);
    expect(paneCount(PC)).toBe(1);
  });

  it("a second split does not make a THIRD pane — it sends the tab to the other side", () => {
    openTab(PC, file("a.js"));
    openTab(PC, file("b.js"));
    openTab(PC, file("c.js"));
    splitTab(PC, fileKey({ projectCode: PC, path: "c.js" }));
    expect(paneCount(PC)).toBe(2);
    splitTab(PC, fileKey({ projectCode: PC, path: "b.js" }));
    expect(paneCount(PC)).toBe(2);
    expect(getTabs(PC).panes[1].tabs.map((t) => t.file.path).sort()).toEqual(["b.js", "c.js"]);
  });

  it("drags a document across the divider, landing exactly where it was dropped", () => {
    ["a.js", "b.js", "c.js", "d.js"].forEach((f) => openTab(PC, file(f)));
    splitTab(PC, fileKey({ projectCode: PC, path: "d.js" }));
    moveTabToPane(PC, fileKey({ projectCode: PC, path: "a.js" }), 1, fileKey({ projectCode: PC, path: "d.js" }));
    // dropped BEFORE d.js, so it is first on the right-hand side — not appended
    expect(getTabs(PC).panes[1].tabs.map((t) => t.file.path)).toEqual(["a.js", "d.js"]);
    expect(getTabs(PC).panes[0].tabs.map((t) => t.file.path)).toEqual(["b.js", "c.js"]);
  });

  // HIS SENTENCE, LITERALLY.
  it("closing the last tab on one side goes back to regular — one pane, full width", () => {
    openTab(PC, file("a.js"));
    openTab(PC, file("b.js"));
    splitTab(PC, fileKey({ projectCode: PC, path: "b.js" }));
    expect(paneCount(PC)).toBe(2);
    closeTab(PC, fileKey({ projectCode: PC, path: "b.js" }));
    expect(paneCount(PC)).toBe(1);
    expect(paneSizes(PC)).toEqual([1]);
    expect(getTabs(PC).panes[0].tabs.map((t) => t.file.path)).toEqual(["a.js"]);
    expect(getTabs(PC).focus).toBe(0);
  });

  it("`close all` on one side collapses the split in one press, and leaves the other side untouched", () => {
    ["a.js", "b.js", "c.js"].forEach((f) => openTab(PC, file(f)));
    splitTab(PC, fileKey({ projectCode: PC, path: "c.js" }));
    moveTabToPane(PC, fileKey({ projectCode: PC, path: "b.js" }), 1);
    expect(getTabs(PC).panes[1].tabs).toHaveLength(2);
    closeAll(PC, 1);
    expect(paneCount(PC)).toBe(1);
    expect(getTabs(PC).panes[0].tabs.map((t) => t.file.path)).toEqual(["a.js"]);
  });

  it("`close all` is scoped to ONE side — pressing it on the left never empties the right", () => {
    ["a.js", "b.js"].forEach((f) => openTab(PC, file(f)));
    splitTab(PC, fileKey({ projectCode: PC, path: "b.js" }));
    closeAll(PC, 0);
    expect(paneCount(PC)).toBe(1);
    expect(getTabs(PC).panes[0].tabs.map((t) => t.file.path)).toEqual(["b.js"]);
  });

  it("closing the RIGHT side leaves you on the left, not flung across the screen", () => {
    ["a.js", "b.js", "c.js"].forEach((f) => openTab(PC, file(f)));
    splitTab(PC, fileKey({ projectCode: PC, path: "c.js" }));
    expect(getTabs(PC).focus).toBe(1);
    closeTab(PC, fileKey({ projectCode: PC, path: "c.js" }));
    expect(getTabs(PC).focus).toBe(0);
  });

  it("opening a document already open on the OTHER side focuses it there instead of copying it", () => {
    openTab(PC, file("a.js"));
    openTab(PC, file("b.js"));
    splitTab(PC, fileKey({ projectCode: PC, path: "b.js" }));
    focusPane(PC, 0);
    openTab(PC, file("b.js")); // asked for again from the left
    expect(paneCount(PC)).toBe(2);
    expect(getTabs(PC).panes[0].tabs.map((t) => t.file.path)).toEqual(["a.js"]);
    expect(getTabs(PC).focus).toBe(1);
    expect(activeTab(PC).file.path).toBe("b.js");
  });

  it("clicking a tab focuses its PANE too, so the next document opens where you are working", () => {
    ["a.js", "b.js", "c.js"].forEach((f) => openTab(PC, file(f)));
    splitTab(PC, fileKey({ projectCode: PC, path: "c.js" }));
    focusTab(PC, fileKey({ projectCode: PC, path: "a.js" }));
    expect(getTabs(PC).focus).toBe(0);
    openTab(PC, file("new.js"));
    expect(paneOf(PC, fileKey({ projectCode: PC, path: "new.js" }))).toBe(0);
  });

  it("a reorder stays inside its own pane — crossing is a different verb", () => {
    ["a.js", "b.js", "c.js"].forEach((f) => openTab(PC, file(f)));
    splitTab(PC, fileKey({ projectCode: PC, path: "c.js" }));
    moveTab(PC, fileKey({ projectCode: PC, path: "b.js" }), fileKey({ projectCode: PC, path: "a.js" }));
    expect(getTabs(PC).panes[0].tabs.map((t) => t.file.path)).toEqual(["b.js", "a.js"]);
    expect(getTabs(PC).panes[1].tabs.map((t) => t.file.path)).toEqual(["c.js"]);
  });
});

// ─── THE DIVIDER ──────────────────────────────────────────────────────────────────────────────
//
// *"resize between them"* — and he said it twice, so it is not a detail of the split, it is part of
// it. The sizes live in the store so the position survives a reload; `normalize` is what keeps them
// legal, which is why a caller may hand over raw ratios mid-drag.
describe("resizing between the panes", () => {
  const split = () => {
    openTab(PC, file("a.js"));
    openTab(PC, file("b.js"));
    splitTab(PC, fileKey({ projectCode: PC, path: "b.js" }));
  };

  it("takes a dragged position and normalizes it to fractions that sum to 1", () => {
    split();
    setPaneSizes(PC, [0.7, 0.3]);
    expect(paneSizes(PC)).toEqual([0.7, 0.3]);
    // raw pixel-ish ratios are legal input — the store does the arithmetic
    setPaneSizes(PC, [900, 300]);
    expect(paneSizes(PC)).toEqual([0.75, 0.25]);
  });

  it("survives a reload, because the divider is state and not a component's memory", () => {
    split();
    setPaneSizes(PC, [0.6, 0.4]);
    const raw = JSON.parse(localStorage.getItem(`sv.tabs.${PC}`));
    expect(raw.sizes).toEqual([0.6, 0.4]);
    expect(raw.panes).toHaveLength(2);
  });

  // DRAGGED TO THE EDGE, he gets the SMALLEST pane — not a lost one, and not a divider that snaps
  // back to the middle and argues with his hand.
  it("clamps a pane to a floor instead of letting it vanish or snapping back to even", () => {
    split();
    setPaneSizes(PC, [1, 0]);
    expect(paneSizes(PC)).toEqual([0.88, 0.12]);
    setPaneSizes(PC, [0, 1]);
    expect(paneSizes(PC)).toEqual([0.12, 0.88]);
    // nonsense is clamped by the same one rule rather than by a second special case
    setPaneSizes(PC, [-2, 3]);
    expect(paneSizes(PC)).toEqual([0.12, 0.88]);
    // and a size array that cannot mean anything falls back to even
    setPaneSizes(PC, [Number.NaN, 1]);
    expect(paneSizes(PC)).toEqual([0.5, 0.5]);
  });

  it("does nothing while there is only one pane — there is no divider to move", () => {
    openTab(PC, file("a.js"));
    setPaneSizes(PC, [0.3, 0.7]);
    expect(paneSizes(PC)).toEqual([1]);
  });

  it("a divider he dragged is remembered through the other side closing and reopening", () => {
    split();
    setPaneSizes(PC, [0.25, 0.75]);
    closeTab(PC, fileKey({ projectCode: PC, path: "b.js" }));
    expect(paneSizes(PC)).toEqual([1]);
    openTab(PC, file("c.js"));
    splitTab(PC, fileKey({ projectCode: PC, path: "c.js" }));
    // a fresh split is even — the remembered drag is not resurrected from a pane that no longer
    // existed, which would put the divider somewhere he did not leave it for THIS pair
    expect(paneSizes(PC)).toEqual([0.5, 0.5]);
  });
});

// ─── WHICH BRANCH THE CENTRE IS IN — the URL's call, never the prop's ────────────────────────────
//
// His bug, 2026-11-11: two panes, a document dragged back, and the tab would not let go — plus
// *"you click something and then some other tabs show up."* Measured in a real browser, one press
// on the Dashboard tab produced EIGHT events: the click wrote `active=dash`, the route pushed
// `?tab=dash`, and the centre's effect then fired on the changed tab param while the `codeFile`
// prop still held the file, re-opened it, and the focus-routing effect pushed the file's URL back.
//
// The prop is the URL copied into state by the PARENT's effect, and React runs a child's effects
// first — so the disagreeing render is not a race, it happens every single navigation.
describe("fileBranch — the URL decides, and disagreement means wait", () => {
  it("opens the file when the URL names it and the prop agrees", () => {
    expect(fileBranch("RFCs/RFC-076.md", "RFCs/RFC-076.md")).toBe("file");
  });

  it("WAITS when the prop names a different file from the URL — neither is trusted", () => {
    // The render where he has navigated from one document to another. Acting on either answer
    // opens the wrong one; the next render has them agreeing.
    expect(fileBranch("RFCs/RFC-076.md", "gaps/G-16.md")).toBe("wait");
  });

  it("WAITS when the URL names a file the prop has not caught up to yet", () => {
    expect(fileBranch("RFCs/RFC-076.md", null)).toBe("wait");
    expect(fileBranch("RFCs/RFC-076.md", undefined)).toBe("wait");
  });

  it("lets the TAB PARAM decide when the URL names no file, whatever the prop still says", () => {
    // THE BUG ITSELF. Pressing Dashboard clears `?file=` and the prop is still the document —
    // "tabs" is what stops it being re-opened and stealing the selection straight back.
    expect(fileBranch(null, "RFCs/RFC-076.md")).toBe("tabs");
    expect(fileBranch("", "RFCs/RFC-076.md")).toBe("tabs");
  });

  it("is a plain three-way answer with no fourth state", () => {
    const answers = new Set([
      fileBranch(null, null),
      fileBranch("a", "a"),
      fileBranch("a", "b"),
      fileBranch("", ""),
    ]);
    expect([...answers].sort()).toEqual(["file", "tabs", "wait"]);
  });
});
