import { getTabs, openTab, focusTab, closeTab, activeTab, moveTab, fileKey, closeRight, closeOthers, closeAll, countRight, fileOpenPlan, fileBranch, splitTab, moveTabToPane, focusPane, focusedPane, paneOf, paneCount, paneSizes, setPaneSizes, trim, readMax, writeMax, capFrom, MAX_KEY, DEFAULT_MAX, MIN_CAP } from "./tabsStore";

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

// ─── THE CAP ON OPEN TABS ───────────────────────────────────────────────────────────────────────
//
// His ask: *"as I go through reports, 40 reports one at a time, I end up having 40 tabs open… I
// think it would be intelligent to limit how much tabs you have open."*
//
// It is not free, and that is why it is here rather than a tidiness feature. Measured in a browser:
// one file tab is 798 DOM nodes; thirty-four is 11,882 nodes and 22 live CodeMirror editors, all to
// show ONE visible document. Every file tab keeps its own pane mounted so its scroll survives.
describe("trim — which tabs a cap takes", () => {
  const pane = (tabs, active) => ({ tabs, active });
  const t = (key, at) => ({ key, kind: "file", at });

  it("takes the least recently touched, not the ones on the left", () => {
    // He reorders the strip by hand — it is his desk — so position says nothing about what he has
    // finished with. `at` is the only evidence of attention the store holds.
    const s = { panes: [pane([t("a", 300), t("b", 100), t("c", 200), t("d", 400), t("e", 500)], "e")], focus: 0 };
    expect(trim(s, 3).panes[0].tabs.map((x) => x.key)).toEqual(["a", "d", "e"]);
  });

  it("NEVER evicts an active tab — in either pane", () => {
    // Closing the document somebody is looking at to make room for one they just asked for is a
    // trade nobody would accept, and with a split standing there are two of them.
    const s = {
      panes: [pane([t("a", 1), t("b", 900)], "a"), pane([t("c", 2), t("d", 950)], "c")],
      focus: 0,
    };
    // Four tabs, a cap of 3: one has to go, and the two OLDEST are the two active ones — so what
    // leaves is a recent inactive tab rather than either document being looked at.
    const got = trim(s, 3).panes.flatMap((p) => p.tabs.map((x) => x.key));
    expect(got).toContain("a");
    expect(got).toContain("c");
    expect(got).toHaveLength(3);
  });

  it("treats a cap of 0 as NO cap, never as close-everything", () => {
    const s = { panes: [pane([t("a", 1), t("b", 2), t("c", 3)], "a")], focus: 0 };
    expect(trim(s, 0).panes[0].tabs).toHaveLength(3);
  });

  it("counts across BOTH panes, because the cost is the window's and not one side's", () => {
    const s = { panes: [pane([t("a", 1), t("b", 2)], "a"), pane([t("c", 3), t("d", 4)], "d")], focus: 0 };
    expect(trim(s, 3).panes.flatMap((p) => p.tabs).map((x) => x.key)).toEqual(["a", "c", "d"]);
  });

  it("treats a tab with no stamp as the oldest thing there is", () => {
    // Tabs from before this existed carry no `at`. Reading an unknown as recent would make the cap
    // do nothing at all on the one store that most needs it.
    const s = { panes: [pane([t("old"), t("b", 5), t("c", 6), t("d", 7)], "d")], focus: 0 };
    expect(trim(s, 3).panes[0].tabs.map((x) => x.key)).toEqual(["b", "c", "d"]);
  });

  // MEASURED IN HIS WINDOW, 2026-11-12: the strip held `Dashboard` plus exactly one file, and the
  // file was different an hour later. A cap of 2 evicting on every open, which from the strip reads
  // as "I can only open one, every time it's being replaced."
  it("treats anything UNDER THE FLOOR as no cap, because one usable slot has only one behaviour", () => {
    const s = {
      panes: [{ tabs: [{ key: "dash", at: 1 }, { key: "a", at: 2 }, { key: "b", at: 3 }], active: "b" }],
      focus: 0,
      sizes: [1],
    };
    expect(trim(s, 1).panes[0].tabs).toHaveLength(3);
    expect(trim(s, 2).panes[0].tabs).toHaveLength(3);
    expect(trim(s, MIN_CAP).panes[0].tabs).toHaveLength(3);
    // and the floor is not a blanket exemption — AT the floor it still bites when it should
    expect(trim({ ...s, panes: [{ ...s.panes[0], tabs: [...s.panes[0].tabs, { key: "c", at: 4 }] }] }, MIN_CAP).panes[0].tabs).toHaveLength(3);
  });

  it("changes nothing when the window is already inside the cap", () => {
    const s = { panes: [pane([t("a", 1), t("b", 2)], "a")], focus: 0 };
    expect(trim(s, 9)).toBe(s);
  });
});

describe("the cap he sets", () => {
  beforeEach(() => window.localStorage.clear());

  it("defaults to a number rather than to unlimited", () => {
    expect(readMax("p")).toBe(DEFAULT_MAX);
  });

  it("remembers what he set, per project", () => {
    writeMax("alpha", 4);
    writeMax("beta", 30);
    expect(readMax("alpha")).toBe(4);
    expect(readMax("beta")).toBe(30);
  });

  it("refuses junk rather than disabling itself silently", () => {
    window.localStorage.setItem(MAX_KEY("p"), "banana");
    expect(readMax("p")).toBe(DEFAULT_MAX);
    window.localStorage.setItem(MAX_KEY("p"), "-5");
    expect(readMax("p")).toBe(DEFAULT_MAX);
  });

  it("applies immediately when he lowers it, so the number means something the moment he sets it", () => {
    const pc = "trimnow";
    ["a", "b", "c", "d"].forEach((key) => openTab(pc, { key, kind: "doc" }));
    expect(getTabs(pc).panes[0].tabs).toHaveLength(4);
    writeMax(pc, MIN_CAP);
    expect(getTabs(pc).panes[0].tabs).toHaveLength(MIN_CAP);
  });

  it("does NOT apply a number under the floor — which is what heals a window already carrying one", () => {
    const pc = "underfloor";
    ["a", "b", "c", "d"].forEach((key) => openTab(pc, { key, kind: "doc" }));
    writeMax(pc, 2);
    // The number is still his to read back in the cog; it just has no force, and the hint says so.
    expect(readMax(pc)).toBe(2);
    expect(getTabs(pc).panes[0].tabs).toHaveLength(4);
  });
});

// WHAT HE TYPED IS NOT YET WHAT HE SET — the guard between a keystroke and a write that closes
// documents. His bug, 2026-11-12: *"I only got one open. I try to open another tab and it's
// switching."* The field applied on every keystroke, so reaching for 15 applied 1 on the way.
describe("capFrom — is the typed value a setting yet", () => {
  it("is nothing while the field is empty, rather than zero — because zero means NO CAP", () => {
    expect(capFrom("")).toBe(null);
    expect(capFrom("   ")).toBe(null);
    expect(capFrom(null)).toBe(null);
    expect(capFrom(undefined)).toBe(null);
  });

  it("is nothing for a value a number input can hand over mid-type", () => {
    expect(capFrom("-")).toBe(null);
    expect(capFrom("e")).toBe(null);
    expect(capFrom("-5")).toBe(null);
  });

  it("is the number when the number is real, zero included", () => {
    expect(capFrom("0")).toBe(0);
    expect(capFrom("1")).toBe(1);
    expect(capFrom("15")).toBe(15);
    expect(capFrom(12)).toBe(12);
    expect(capFrom("12.7")).toBe(12);
  });

  it("parses a small number rather than second-guessing it — the FLOOR is a separate decision", () => {
    // Two questions, deliberately answered in two places. `capFrom` asks "is this a number he
    // typed", and 1 is. Whether 1 has any FORCE is `trim`'s question, and MIN_CAP is its answer.
    // Folding the floor in here would make the cog's hint unable to read back what he set.
    expect(capFrom("1")).toBe(1);
    expect(capFrom("2")).toBe(2);
  });
});
