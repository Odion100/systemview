// THE OPEN SET. The center is a tab strip of open documents; this is the one writer for
// what is open, per project, cached:
//
//   { panes: [ { tabs: [tab], active: key } ], focus: 0, sizes: [1] }
//
// PANES ARE PLURAL NOW — his ask, 2026-11-10: *"a feature where you can split into two and you can
// drag documents across and resize between them. Close all the tabs on one side and it goes back to
// regular."* The shape was written for this from the first version; what was missing is that every
// verb reached for `panes[0]` by hand.
//
//   `focus`  — WHICH pane the verbs act on. A click, an open and a close all need a current side,
//              and an index is the honest address: a pane has no identity beyond its position, and
//              inventing an id for it would be a second thing to keep in step with the array.
//   `sizes`  — one fraction per pane, summing to 1. This is the divider. It lives in the store
//              rather than in the component because it survives a reload, and because the pane
//              count and the sizes are one fact: a size array that disagrees with the pane count is
//              the bug this shape makes unrepresentable (see `normalize`).
//
// EVERY EXISTING VERB KEEPS ITS SIGNATURE and acts on the FOCUSED pane. That is what let this land
// without touching eight callers: an unsplit project has one pane, focus is 0, and every one of
// them behaves exactly as before.
//
// A tab is an open document — his rule: "everything is a sort of document, even a namespace":
//
//   { key: "file:<pc>:<path>", kind: "file",   file: {path, projectCode, serviceId, language, lines, side} }
//   { key: "doc",              kind: "doc"    }   // ONE doc tab; it NAVIGATES as the tree moves,
//   { key: "report",           kind: "report" }   // like a browser tab — a tab per tree click would
//   { key: "logs",             kind: "logs"   }   // bury the strip in a minute of browsing.
//
// FILES ACCUMULATE (the core ask: "multiple files open"); doc/logs/report are one tab each in v1.
// The KEY leaves room to loosen that later (a keyed doc tab is legal by shape) without migration.
//
// The store is deliberately dumb: open/focus/close/order. The URL owns which tab is ACTIVE — this
// remembers WHAT IS OPEN, which is exactly the split he asked for: "the URL should include what
// type someone is in the center", and the cache brings the strip back after a reload.

// ONE STORE FOR THE WINDOW, not one per project — and this was a measured bug, not a tidy-up.
//
// His, 2026-11-12: *"I got my dashboard, open up one file, open up another file. Nope, they all
// replacing each other."* Measured in two browsers before changing anything: tabs accumulate
// correctly INSIDE a project — 12 standing in one store, 2→3 on a second open in another — and the
// strip was keyed per project while the DASHBOARD he works from spans every project by design.
// So opening a document from another project swapped the whole strip for that project's. Nothing
// was deleted and nothing said so, which is the worst shape a surface can take: it looked exactly
// like tabs being destroyed.
//
// The two surfaces disagreed and the Dashboard is the one he works from, so the strip is the
// WINDOW'S now. The enabling fact is that a tab key already carries its project where it needs to
// (`file:<pc>:<path>`, `dash:<pc>`, `how:<pc>`) — so one store can hold several projects' tabs
// without collision — and `tabPc` answers for the kinds whose key is a path or a namespace.
let store = null; // { state, subs } — one, for the whole window

const KEY = () => "sv.tabs";

export const fileKey = (file) => `file:${file.projectCode || ""}:${file.path}`;

// WHAT TO DO WITH A FILE THE URL NAMES — his rule "close stays closed." The URL is a slower writer
// than this store: closing a file tab removes it here, but a consumer effect that reads the URL
// re-runs on its own other triggers, and a `?file=` a close left behind would send it back through
// openTab — landing at the END of the strip, since the tab is no longer in the set. So: a file that
// is PRESENT opens (refresh/move in place); a file that is GONE but is the SAME key the consumer
// last opened was closed on purpose, so it is SKIPPED; anything else is a real navigation and opens.
export function fileOpenPlan(present, key, lastKey) {
  if (present) return "open";
  if (key && key === lastKey) return "skip";
  return "open";
}

// WHICH BRANCH THE CENTRE'S URL→STORE EFFECT IS IN — and the answer is the URL's, never a prop's.
//
// His bug, 2026-11-11: *"you got two panes open, you bring one back into the other pane — it
// doesn't want to let go of that tab"*, and beside it *"you click something and then some other
// tabs show up."* Both are one fault. The centre is handed a `codeFile` prop that SystemView
// derives from the URL in an effect — and React runs a child's effects BEFORE its parent's, so
// there is always one render where the URL has moved on and the prop still names the document you
// just left. Acting on the prop in that render re-opens the old document: it steals the selection
// back, and when that document is no longer open it is re-created as a tab out of nowhere.
//
// Three answers, and the middle one is the whole fix:
//
//   "file"  — the URL names a file and the prop agrees. Open it; this is a real navigation.
//   "wait"  — they disagree. Do NOTHING. One of them is a render behind, and which one does not
//             matter: the next render brings them together, and a render is cheap. Guessing is not.
//   "tabs"  — the URL names no file at all, whatever the prop still says. The tab param decides.
export function fileBranch(urlFile, codePath) {
  if (!urlFile) return "tabs";
  return codePath && codePath === urlFile ? "file" : "wait";
}


// ── HOW MANY MAY BE OPEN AT ONCE ────────────────────────────────────────────────────────────────
//
// His ask, 2026-11-11: *"as I go through reports, 40 reports one at a time, I end up having 40 tabs
// open. It doesn't really mean anything… I think it would be intelligent to limit how much tabs you
// have open."*
//
// AND IT IS NOT FREE, WHICH IS THE PART WORTH RECORDING. Measured in a browser: every file tab
// mounts its OWN `CodePane` and its own CodeMirror editor and keeps them alive — that is the design
// that makes a scroll position survive leaving a document. One tab is 798 DOM nodes; thirty-four is
// 11,882 nodes and 22 live editors, to show ONE visible document. Linear, and all of it for tabs
// nobody is looking at.
//
// THE CAP IS HIS NUMBER, NOT A GOOD ONE I PICKED. `0` means no cap, which is what the window did
// before this existed and what anyone who wants the old behaviour sets.
// THE CAP IS THE WINDOW'S TOO, for the same reason the store is: the cost being capped is the
// window's — every open tab mounts its own editor — and a per-project number over a shared strip
// could not mean anything. A window with no cap set starts at the default rather than inheriting
// the largest per-project number it can find: those numbers were never statements about the
// window, and one of them was the accident that started this whole thread.
export const MAX_KEY = () => "sv.tabs.max";
export const DEFAULT_MAX = 12;

// THE FLOOR, AND IT IS A JUDGEMENT I AM MAKING RATHER THAN A NUMBER HE CHOSE.
//
// Measured in his window, 2026-11-12, twice an hour apart: the strip held `Dashboard` plus exactly
// ONE file, and the file was different each time. That is a cap of 2 evicting on every open, and
// what it looks like from the strip is *"I can only open one, every time it's being replaced."*
// He never chose 2 — the cog applied each keystroke, so reaching for a two-digit number set it.
//
// The reason the floor is the right repair and not just a nicety: the doc / dash / board tab
// occupies a slot of its own. At a cap of 2 there is exactly one slot left for a file, so every
// open evicts the previous one; at 1 there are none. Neither value can produce a usable window —
// the only behaviour available to them is the one he just reported as a bug. And 0 already means
// no cap, so below the floor there is no meaning left to honour.
//
// So anything under this reads as NO CAP, which also heals a window already carrying the accident
// without him having to find the cog. The control SAYS so at that value rather than going quiet,
// because a number that is set and does nothing is the other half of this same fault.
export const MIN_CAP = 3;

export function readMax() {
  try {
    const raw = localStorage.getItem(MAX_KEY());
    if (raw == null) return DEFAULT_MAX;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : DEFAULT_MAX;
  } catch {
    return DEFAULT_MAX;
  }
}

// IS WHAT HE TYPED A SETTING YET? — pure, because this is the whole judgement and the judgement is
// what went wrong. `writeMax` TRIMS as it saves, so every value that reaches it closes documents:
// the question "is this a number he chose" has to be answered BEFORE the write, not inside it.
//
//  - An EMPTY field is not a setting. `Number("") || 0` is 0, 0 means no cap, so a field he cleared
//    in order to retype would have silently turned the limit off.
//  - Whitespace is empty. Same reason.
//  - Anything that is not a finite number ≥ 0 is not a setting either — a number input can still
//    hand over "e" or "-" mid-type.
//
// Returns the number to write, or `null` for "nothing he has chosen yet".
export function capFrom(raw) {
  const text = String(raw == null ? "" : raw).trim();
  if (text === "") return null;
  const n = Number(text);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

export function writeMax(pc, n) {
  const v = Math.max(0, Math.floor(Number(n) || 0));
  try {
    localStorage.setItem(MAX_KEY(), String(v));
  } catch {}
  write(pc, trim(storeOf().state, v));
  return v;
}

/**
 * Drop the least-recently-touched tabs until the whole window is within `cap`.
 *
 * PURE, and separate from the verb that calls it, because the rule here is all judgement and the
 * judgement is what somebody will disagree with:
 *

 *  - `cap` OF 0 IS NO CAP. Not "close everything" — a cap of zero open tabs is not a state anybody
 *    wants, and reading it as "off" is the only useful meaning left. ANYTHING UNDER `MIN_CAP` reads
 *    the same way, for the reason given at that constant: a window with one usable slot has only
 *    one behaviour available to it, and it is the one he reported as a bug.
 *  - AN ACTIVE TAB IS NEVER EVICTED, in ANY pane. Closing the document somebody is looking at to
 *    make room for one they just asked for is a trade nobody would accept, and with a split
 *    standing there are two of them.
 *  - OLDEST BY LAST TOUCH, not by position in the strip. He reorders the strip by hand — it is his
 *    desk — so position says nothing about what he has finished with. `at` is stamped when a tab is
 *    opened or focused, which is the only evidence of attention the store holds.
 *  - A TAB WITH NO `at` IS OLDEST. Those are tabs from before this existed; treating an unknown as
 *    recent would make the cap do nothing at all on the one store that most needs it.
 */
export function trim(state, cap) {
  const max = Math.max(0, Math.floor(Number(cap) || 0));
  // THE ONE PLACE THE FLOOR IS APPLIED, so no caller can disagree with it — `writeMax` trims
  // through here, the centre's URL effect trims through here, and a reload trims through here.
  if (!max || max < MIN_CAP) return state;
  const all = (state.panes || []).flatMap((p, pi) =>
    (p.tabs || []).map((t) => ({ key: t.key, pane: pi, at: Number(t.at) || 0, active: p.active === t.key })),
  );
  if (all.length <= max) return state;
  const droppable = all.filter((t) => !t.active).sort((a, b) => a.at - b.at);
  const doomed = new Set(droppable.slice(0, Math.max(0, all.length - max)).map((t) => t.key));
  if (!doomed.size) return state;
  return {
    ...state,
    panes: (state.panes || []).map((p) => ({ ...p, tabs: (p.tabs || []).filter((t) => !doomed.has(t.key)) })),
  };
}

const touch = (tab) => ({ ...tab, at: Date.now() });

// VERSIONED — the shape changed once mid-day (reports went from one tab to tab-per-document) and
// the stale cache produced exactly the bug he replicated: a leftover "Stage" tab written under the
// old meaning, wearing the new code's clothes. A cache that outlives its shape lies; on mismatch we
// start fresh (the open set is a convenience, losing it once is cheap — believing it wrongly isn't).
const V = 6; // v6: panes are plural — `focus` says which one the verbs act on, `sizes` is the divider
const EMPTY = () => ({ v: V, panes: [{ tabs: [], active: null }], focus: 0, sizes: [1] });

// EVERY PER-PROJECT STORE THIS WINDOW EVER WROTE, so the change costs him no open document.
//
// Merged ONCE, the first time the window store is absent, and the old keys are LEFT ON DISK
// deliberately: if this merge is wrong, the originals are still there to read. They are never
// merged twice, because after the first write `sv.tabs` exists and is loaded instead.
const LEGACY = /^sv\.tabs\.(?!max$)(?!max\.)(.+)$/;

export function mergeLegacy(read, keys) {
  const tabs = [];
  const seen = new Set();
  keys
    .filter((k) => LEGACY.test(k))
    .sort()
    .forEach((k) => {
      let got = null;
      try {
        got = JSON.parse(read(k));
      } catch {
        got = null;
      }
      if (!got || !Array.isArray(got.panes)) return;
      got.panes.forEach((pn) => {
        (pn && Array.isArray(pn.tabs) ? pn.tabs : []).forEach((t) => {
          if (!t || !t.key || seen.has(t.key)) return;
          seen.add(t.key);
          tabs.push(t);
        });
      });
    });
  if (!tabs.length) return null;
  // ONE PANE. A split belonged to one project's store, and there is no honest answer to "which
  // project's divider survives" — so the documents come across and the layout does not.
  // ACTIVE IS THE MOST RECENTLY TOUCHED, which is the closest thing to "where he was".
  const active = tabs.slice().sort((a, b) => (Number(b.at) || 0) - (Number(a.at) || 0))[0];
  return { v: V, panes: [{ tabs, active: active ? active.key : null }], focus: 0, sizes: [1] };
}

// THE NARROWEST A PANE MAY BE — a fraction of the centre, not pixels, because the store knows
// nothing about the viewport. At 12% a pane is still a visible strip with a grabbable tab on it,
// which is the only property that matters: a pane he cannot grab is a pane he cannot get back.
const MIN_PANE = 0.12;

// A V5 CACHE IS MIGRATED, NOT DROPPED — and that is a departure from the rule above it, so here is
// the reason. The rule exists because a cache that outlives its MEANING lies: v5 kept a "Stage" tab
// written under an older sense of the word and the new code wore it as if it meant the new thing.
// This change adds fields and changes no existing one — a v5 state IS a v6 state with one pane, so
// migrating it cannot produce a tab whose meaning shifted. Dropping it would throw away his open
// documents for nothing, which is the cost the rule was never meant to impose.
const migrate = (raw) => {
  if (!raw || !Array.isArray(raw.panes) || !raw.panes[0] || !Array.isArray(raw.panes[0].tabs)) return null;
  if (raw.v === V) return raw;
  if (raw.v === 5) return { ...raw, v: V, focus: 0, sizes: raw.panes.map(() => 1 / raw.panes.length) };
  return null; // older than v5 — the shapes really did change meaning, so start fresh
};

const load = () => {
  try {
    const got = migrate(JSON.parse(localStorage.getItem(KEY())));
    if (got) return normalize(got);
  } catch {}
  // NO WINDOW STORE YET — gather whatever the per-project stores hold, once.
  try {
    const merged = mergeLegacy((k) => localStorage.getItem(k), Object.keys(localStorage));
    if (merged) {
      // THE CAP MUST NOT EAT THE MIGRATION, and this was measured before it shipped: a browser
      // carrying 12 tabs in one project and 3 in another merged to 15 and the next open trimmed it
      // to 12 — three documents gone on the first load of a change whose whole purpose is that
      // documents stop disappearing. So the merge RAISES the cap to fit what it brought across,
      // once. The number lands in the cog where he can see it and lower it himself; what it must
      // never do is enforce a limit he set for one project against the sum of all of them.
      const n = merged.panes.reduce((a, pn) => a + pn.tabs.length, 0);
      const cap = readMax();
      if (cap && n > cap) {
        try {
          localStorage.setItem(MAX_KEY(), String(n));
        } catch {}
      }
      return normalize(merged);
    }
  } catch {}
  return EMPTY();
};

// THE INVARIANTS, IN ONE PLACE, APPLIED ON EVERY WRITE.
//
// His *"close all the tabs on one side and it goes back to regular"* is here and nowhere else, and
// that is the whole design decision in this slice. A rule like "prune the pane when its last tab
// closes" written at each call site is a rule with five chances to be forgotten — and the call
// sites that would forget it are the bulk closes, which are exactly where a side empties. So no
// verb prunes: they write whatever they write, and this makes the result legal.
//
// Four invariants:
//   1. An EMPTY pane does not exist — except the last one, because "nothing open" is a legal state
//      and the honest one (the centre shows the project's own doc).
//   2. `focus` names a pane that exists.
//   3. `sizes` has one entry per pane, each > 0, summing to 1.
//   4. A pane's `active` names one of its own tabs, or is null.
function normalize(next) {
  const panes = (next.panes || []).map((p) => ({
    tabs: Array.isArray(p.tabs) ? p.tabs : [],
    active: p.active || null,
  }));
  // 1 · prune the empty ones, remembering where focus was pointing so it can follow its pane.
  const keep = [];
  const kept = [];
  panes.forEach((p, i) => {
    if (p.tabs.length) {
      keep.push(p);
      kept.push(i);
    }
  });
  const live = keep.length ? keep : [panes[0] || { tabs: [], active: null }];
  const liveFrom = keep.length ? kept : [0];

  // 2 · focus follows its own pane through the prune; if its pane went, the nearest survivor takes
  // it. "Nearest" and not 0, because closing the right-hand side should leave you on the left and
  // closing the left should not fling you across the screen.
  const want = Number.isInteger(next.focus) ? next.focus : 0;
  let focus = liveFrom.indexOf(want);
  if (focus === -1) {
    let best = 0;
    liveFrom.forEach((from, i) => {
      if (Math.abs(from - want) < Math.abs(liveFrom[best] - want)) best = i;
    });
    focus = best;
  }

  // 3 · sizes, one per pane, summing to 1, and NONE OF THEM INVISIBLE.
  //
  // A size array carried over from a different pane count is re-spread proportionally rather than
  // reset, so a divider survives a pane being pruned.
  //
  // THE FLOOR IS THE INTERESTING PART. Dragging the divider to the very edge is a thing he will do,
  // and the two obvious answers are both wrong: honouring it leaves a pane 0px wide — still holding
  // documents, with no strip to grab and no way back — and rejecting it snaps the divider to the
  // middle, which is a window arguing with his hand. So a pane has a MINIMUM and the drag stops
  // there: he gets the smallest pane rather than either a lost one or a fight.
  //
  // Clamped AFTER normalizing, and the remainder re-spread over the others, because clamping first
  // and then normalizing pushes the clamped pane straight back under the floor.
  let sizes = Array.isArray(next.sizes) ? liveFrom.map((from) => Number(next.sizes[from])) : [];
  const usable = sizes.length === live.length && sizes.every((n) => Number.isFinite(n));
  const sum = usable ? sizes.reduce((a, n) => a + Math.max(n, 0), 0) : 0;
  sizes = usable && sum > 0 ? sizes.map((n) => Math.max(n, 0) / sum) : live.map(() => 1 / live.length);
  if (live.length > 1 && MIN_PANE * live.length <= 1) {
    const under = sizes.map((n) => n < MIN_PANE);
    if (under.some(Boolean)) {
      const held = under.filter(Boolean).length * MIN_PANE;
      const rest = sizes.reduce((a, n, i) => a + (under[i] ? 0 : n), 0);
      sizes = sizes.map((n, i) => (under[i] ? MIN_PANE : rest > 0 ? (n / rest) * (1 - held) : (1 - held) / (live.length - under.filter(Boolean).length)));
    }
  }

  // 4 · a pane cannot point at a tab it does not hold.
  const panesOut = live.map((p) => ({
    tabs: p.tabs,
    active: p.tabs.some((t) => t.key === p.active) ? p.active : p.tabs.length ? p.tabs[p.tabs.length - 1].key : null,
  }));

  return { v: V, panes: panesOut, focus, sizes };
}

// THE PROJECT ARGUMENT IS KEPT ON EVERY VERB AND IGNORED HERE. Eight call sites pass it and they
// are all still correct — they are naming the project they are acting IN, which is what a tab's
// own `pc` records. Dropping the parameter would have been a rename across five files for no
// behaviour, and keeping it means a caller that genuinely needs the project later still has it.
function storeOf() {
  if (!store) store = { state: load(), subs: new Set() };
  return store;
}

// TEST SEAM ONLY — the module caches one store for the life of the page, which is right in a
// browser and wrong in a suite where each case needs a fresh localStorage.
export function __resetStore() {
  store = null;
}

// THE CAP BITES ON OPEN — AND A RELOAD IS AN OPEN, which is worth saying because the first version
// of this comment claimed the opposite and the browser disagreed. `load` itself does not trim: a
// store read off disk comes back whole. But the centre's URL→store effect opens the document the
// URL names on every load, and that open is an open — so a window carrying 20 tabs under a cap of
// 12 comes back with 12.
//
// Measured, not reasoned: reloaded with 20 seeded tabs and an untouched cap, the strip came back
// at 12. That is the cap doing what it was asked to do, but it happens at a moment he did not
// obviously cause, so it is stated here rather than left to be discovered.
function writeCapped(pc, next) {
  write(pc, trim(next, readMax()));
}

function write(pc, next) {
  const s = storeOf();
  // NORMALIZED ON THE WAY IN, so no reader ever has to defend itself against an empty pane, a
  // focus pointing past the end, or sizes that do not add up.
  s.state = normalize(next);
  try {
    localStorage.setItem(KEY(), JSON.stringify(s.state));
  } catch {}
  s.subs.forEach((f) => f(s.state));
}

export function getTabs(pc) {
  return storeOf().state;
}

export function subscribeTabs(pc, fn) {
  const s = storeOf();
  s.subs.add(fn);
  return () => s.subs.delete(fn);
}

// THE FOCUSED PANE — what every verb below means by "the pane", and what a consumer should read
// instead of reaching for `panes[0]`. With one pane the two are the same thing, which is why the
// older callers kept working; with two they are not, and `panes[0]` would silently mean "the left
// one" at every site that happened to be written before the split existed.
export function focusedPane(pc) {
  const s = storeOf().state;
  return s.panes[s.focus] || s.panes[0];
}

export function paneCount(pc) {
  return storeOf().state.panes.length;
}

export function paneSizes(pc) {
  return storeOf().state.sizes.slice();
}

// WHICH PANE HOLDS A TAB — the question the split creates. Returns -1 when nothing does.
export function paneOf(pc, key) {
  return storeOf().state.panes.findIndex((p) => p.tabs.some((t) => t.key === key));
}

// Replace one pane and write. `at` defaults to the focused one, which is what makes every verb
// below read the same as it did when there was only ever one.
function onPane(pc, at, fn, focus, cap) {
  const s = storeOf().state;
  const i = Number.isInteger(at) ? at : s.focus;
  const pane = s.panes[i];
  if (!pane) return null;
  const nextPane = fn(pane);
  if (!nextPane) return null;
  const panes = s.panes.map((p, j) => (j === i ? nextPane : p));
  const next = { ...s, panes, focus: Number.isInteger(focus) ? focus : s.focus };
  if (cap) writeCapped(pc, next);
  else write(pc, next);
  return nextPane;
}

// OPEN OR FOCUS — his rule, and the dedupe he called out: "existing navigation calls need to open
// tabs or navigate to the tab if it's already open." One entry point, so no caller can duplicate.
/**
 * Open a tab, or refresh one that is already there.
 *
 * `opts.beside` — put a NEW tab directly after that key instead of at the end. A reference you
 * followed belongs next to the thing you followed it from, not at the far end of a strip you
 * then have to go and find it in.
 *
 * `opts.move` — with `beside`, a tab that is ALREADY open does not merely refresh in place, it
 * MOVES to sit directly after `beside`. His rule for navigating files: *"whenever you navigate
 * from one file to another, that file should pop up right next to the tab you're on — I don't
 * care if it's already open, that means move it over."* Without `move`, an already-open tab holds
 * its place (the reference-follow case, which must never shuffle the strip under you).
 *
 * `opts.focus: false` — leave the active tab where it is. The tab appears; you do not move.
 * This is what *"just add the tab next door"* means, and it is only honoured when something is
 * already open: with an empty strip there is nothing to stay on, and a tab nobody is looking at
 * over an empty centre is just a hidden file.
 *
 * `opts.pane` — which side. Omitted means the focused one.
 *
 * OPENING A DOCUMENT THAT IS ALREADY OPEN ON THE OTHER SIDE FOCUSES IT WHERE IT IS, rather than
 * making a second copy of it. Two panes showing one document would be two editors over one file,
 * and the question "which one is the real one" has no good answer — so a document lives on exactly
 * one side, and asking for it again takes you to it.
 */
export function openTab(pc, tab, opts = {}) {
  const s = storeOf().state;
  const already = paneOf(pc, tab.key);
  const want = Number.isInteger(opts.pane) ? opts.pane : s.focus;
  if (already !== -1 && already !== want) {
    onPane(pc, already, (pane) => ({ tabs: pane.tabs.map((t) => (t.key === tab.key ? touch({ ...t, ...tab }) : t)), active: tab.key }), already, true);
    return;
  }
  onPane(
    pc,
    want,
    (pane) => {
      const found = pane.tabs.find((t) => t.key === tab.key);
      let tabs;
      if (found) {
        // Same document, possibly a fresher address (new line range, a side) — the tab updates in
        // place rather than pretending the old address is still what you asked for.
        const updated = pane.tabs.map((t) => (t.key === tab.key ? touch({ ...t, ...tab }) : t));
        if (opts.move && opts.beside && opts.beside !== tab.key) {
          // NAVIGATED TO AN ALREADY-OPEN FILE — carry it over to sit right of where you are, rather
          // than leaving it wherever it happened to land the first time it was opened.
          const moving = updated.find((t) => t.key === tab.key);
          const without = updated.filter((t) => t.key !== tab.key);
          const at = without.findIndex((t) => t.key === opts.beside);
          tabs = at < 0 ? [...without, moving] : [...without.slice(0, at + 1), moving, ...without.slice(at + 1)];
        } else {
          tabs = updated;
        }
      } else if (opts.beside) {
        const at = pane.tabs.findIndex((t) => t.key === opts.beside);
        const fresh = touch(tab);
        tabs = at < 0 ? [...pane.tabs, fresh] : [...pane.tabs.slice(0, at + 1), fresh, ...pane.tabs.slice(at + 1)];
      } else {
        tabs = [...pane.tabs, touch(tab)];
      }
      const stay = opts.focus === false && pane.tabs.length > 0 && pane.active;
      return { tabs, active: stay || tab.key };
    },
    want,
    true,
  );
}

// FOCUSING A TAB FOCUSES ITS PANE TOO. Clicking a tab on the right-hand side makes that side the
// one the next open lands in — otherwise a click on the right followed by a navigation would open
// the new document on the left, which reads as the window ignoring where you are working.
export function focusTab(pc, key) {
  const at = paneOf(pc, key);
  if (at === -1) return;
  const s = storeOf().state;
  if (s.panes[at].active === key && s.focus === at) return;
  onPane(pc, at, (pane) => ({ tabs: pane.tabs.map((t) => (t.key === key ? touch(t) : t)), active: key }), at);
}

export function focusPane(pc, at) {
  const s = storeOf().state;
  if (!s.panes[at] || s.focus === at) return;
  write(pc, { ...s, focus: at });
}

// THE DIVIDER. Fractions, in pane order; `normalize` is what makes them legal, so a caller can hand
// over pixel ratios mid-drag without arithmetic of its own.
export function setPaneSizes(pc, sizes) {
  const s = storeOf().state;
  if (s.panes.length < 2) return;
  write(pc, { ...s, sizes });
}

// SPLIT — take this tab to a side of its own. His *"you can split into two"*.
//
// The tab MOVES rather than being copied, for the reason openTab gives: one document, one side.
// A second split is a no-op that focuses the existing other side instead of making a third pane —
// two is what he asked for, and the shape allows more only so that the verbs did not have to assume
// otherwise.
export function splitTab(pc, key) {
  const s = storeOf().state;
  const from = paneOf(pc, key);
  if (from === -1) return null;
  const tab = s.panes[from].tabs.find((t) => t.key === key);
  if (s.panes.length > 1) {
    const to = from === 0 ? 1 : 0;
    moveTabToPane(pc, key, to);
    return to;
  }
  // The only tab on the only pane cannot be split off — there would be nothing left behind, and a
  // split that empties its own origin is just a focus change with extra steps.
  if (s.panes[from].tabs.length < 2) return null;
  const panes = s.panes.map((p, j) => (j === from ? { tabs: p.tabs.filter((t) => t.key !== key), active: p.active } : p));
  panes.push({ tabs: [tab], active: key });
  write(pc, { ...s, panes, focus: panes.length - 1, sizes: panes.map(() => 1 / panes.length) });
  return panes.length - 1;
}

// DRAG ACROSS THE DIVIDER — his *"drag documents across"*. `beforeKey` places it, exactly as a
// reorder inside one strip does, so dropping onto the far side is as precise as dropping onto this
// one. A drop that empties the source side collapses it, which is `normalize`'s job, not this one's.
export function moveTabToPane(pc, key, to, beforeKey) {
  const s = storeOf().state;
  const from = paneOf(pc, key);
  if (from === -1 || !s.panes[to] || from === to) return;
  const tab = s.panes[from].tabs.find((t) => t.key === key);
  const panes = s.panes.map((p, j) => {
    if (j === from) return { tabs: p.tabs.filter((t) => t.key !== key), active: p.active };
    if (j === to) {
      const tabs = p.tabs.filter((t) => t.key !== key);
      const at = beforeKey ? tabs.findIndex((t) => t.key === beforeKey) : -1;
      const next = at < 0 ? [...tabs, tab] : [...tabs.slice(0, at), tab, ...tabs.slice(at)];
      return { tabs: next, active: key };
    }
    return p;
  });
  write(pc, { ...s, panes, focus: to });
}

// Closing the active tab focuses its NEIGHBOR (the one that took its place, else the last one) —
// the strip never leaves you nowhere. An empty strip is legal: the center shows the project's own
// doc, the honest "nothing open". With two panes, emptying one collapses the split (`normalize`).
export function closeTab(pc, key) {
  const at = paneOf(pc, key);
  if (at === -1) return null;
  const s = storeOf().state;
  const pane = s.panes[at];
  const idx = pane.tabs.findIndex((t) => t.key === key);
  const tabs = pane.tabs.filter((t) => t.key !== key);
  let active = pane.active;
  if (pane.active === key) active = tabs.length ? tabs[Math.min(idx, tabs.length - 1)].key : null;
  onPane(pc, at, () => ({ tabs, active }), at);
  return focusedPane(pc).active;
}

// DRAG REORDER — his ask: the strip is his desk, so the order is his. Move the tab to sit where
// the one he dropped it on sits; everything else shifts. Active never changes on a reorder.
//
// WITHIN ONE PANE. A drop on the other side's strip is `moveTabToPane`, because crossing changes
// which pane holds the document and reordering never does.
export function moveTab(pc, key, beforeKey) {
  const at = paneOf(pc, key);
  if (at === -1 || key === beforeKey) return;
  onPane(pc, at, (pane) => {
    const from = pane.tabs.findIndex((t) => t.key === key);
    const tabs = pane.tabs.filter((t) => t.key !== key);
    const to = beforeKey ? tabs.findIndex((t) => t.key === beforeKey) : tabs.length;
    tabs.splice(to === -1 ? tabs.length : to, 0, pane.tabs[from]);
    return { tabs, active: pane.active };
  });
}

// BULK CLOSE — the right-click verbs. One writer, so they cannot disagree with closeTab about
// what "active" means afterwards.
//
// The ANCHOR (the tab he right-clicked) is the one guaranteed to survive `closeRight`/`closeOthers`,
// so it is where focus lands when the close swallowed whatever was active. Focusing the neighbor
// instead — closeTab's rule for a single close — would be wrong here: the neighbor may be one of
// the tabs he just asked to be rid of.
//
// SCOPED TO ONE PANE. "Close the others" means the others on this side: a verb pressed on the left
// strip that silently emptied the right one would be the most surprising thing in the window.
// `closeAll` keeps the same scope for the same reason.
//
// Returns the key now active (null when nothing is left), so the caller knows whether to navigate.
function closeMany(pc, at, keep, anchorKey) {
  const s = storeOf().state;
  const pane = s.panes[at];
  if (!pane) return null;
  const tabs = pane.tabs.filter(keep);
  if (tabs.length === pane.tabs.length) return pane.active;
  const active = tabs.some((t) => t.key === pane.active)
    ? pane.active
    : tabs.some((t) => t.key === anchorKey)
    ? anchorKey
    : tabs.length
    ? tabs[tabs.length - 1].key
    : null;
  onPane(pc, at, () => ({ tabs, active }), at);
  return focusedPane(pc).active;
}

export function closeRight(pc, key) {
  const at = paneOf(pc, key);
  if (at === -1) return focusedPane(pc).active;
  const idx = storeOf().state.panes[at].tabs.findIndex((t) => t.key === key);
  return closeMany(pc, at, (_t, i) => i <= idx, key);
}

export function closeOthers(pc, key) {
  const at = paneOf(pc, key);
  if (at === -1) return focusedPane(pc).active;
  return closeMany(pc, at, (t) => t.key === key, key);
}

// CLOSE ALL — the focused side. With a split standing, that is his *"close all the tabs on one side
// and it goes back to regular"* in one press.
export function closeAll(pc, pane) {
  const s = storeOf().state;
  const at = Number.isInteger(pane) ? pane : s.focus;
  return closeMany(pc, at, () => false, null);
}

// How many would each verb remove — so the menu can hide a verb that would do nothing rather than
// offering a dead item.
export function countRight(pc, key) {
  const at = paneOf(pc, key);
  if (at === -1) return 0;
  const tabs = storeOf().state.panes[at].tabs;
  const idx = tabs.findIndex((t) => t.key === key);
  return idx === -1 ? 0 : tabs.length - idx - 1;
}

export function activeTab(pc) {
  const pane = focusedPane(pc);
  return pane.tabs.find((t) => t.key === pane.active) || null;
}
