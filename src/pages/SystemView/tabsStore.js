// RFC-054 — THE OPEN SET. The center is a tab strip of open documents; this is the one writer for
// what is open, per project, cached, shaped for the split-pane work he has already named as next:
//
//   { panes: [ { tabs: [tab], active: key } ] }     // v1 holds exactly one pane
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

const stores = new Map(); // projectCode → { state, subs }

const KEY = (pc) => `sv.tabs.${pc}`;

export const fileKey = (file) => `file:${file.projectCode || ""}:${file.path}`;

// VERSIONED — the shape changed once mid-day (reports went from one tab to tab-per-document) and
// the stale cache produced exactly the bug he replicated: a leftover "Stage" tab written under the
// old meaning, wearing the new code's clothes. A cache that outlives its shape lies; on mismatch we
// start fresh (the open set is a convenience, losing it once is cheap — believing it wrongly isn't).
const V = 5; // v5: doc tabs are PER NAMESPACE (doc:<svc>.<mod>.<meth>) — a link from content opens a tab, never navigates the page you are on
const load = (pc) => {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY(pc)));
    if (raw && raw.v === V && Array.isArray(raw.panes) && raw.panes[0] && Array.isArray(raw.panes[0].tabs))
      return raw;
  } catch {}
  return { v: V, panes: [{ tabs: [], active: null }] };
};

function storeOf(pc) {
  if (!stores.has(pc)) stores.set(pc, { state: load(pc), subs: new Set() });
  return stores.get(pc);
}

function write(pc, next) {
  const s = storeOf(pc);
  next.v = V;
  s.state = next;
  try {
    localStorage.setItem(KEY(pc), JSON.stringify(next));
  } catch {}
  s.subs.forEach((f) => f(next));
}

export function getTabs(pc) {
  return storeOf(pc).state;
}

export function subscribeTabs(pc, fn) {
  const s = storeOf(pc);
  s.subs.add(fn);
  return () => s.subs.delete(fn);
}

// OPEN OR FOCUS — his rule, and the dedupe he called out: "existing navigation calls need to open
// tabs or navigate to the tab if it's already open." One entry point, so no caller can duplicate.
export function openTab(pc, tab) {
  const s = storeOf(pc).state;
  const pane = s.panes[0];
  const found = pane.tabs.find((t) => t.key === tab.key);
  const tabs = found
    ? // Same document, possibly a fresher address (new line range, a side) — the tab updates in
      // place rather than pretending the old address is still what you asked for.
      pane.tabs.map((t) => (t.key === tab.key ? { ...t, ...tab } : t))
    : [...pane.tabs, tab];
  write(pc, { panes: [{ tabs, active: tab.key }] });
}

export function focusTab(pc, key) {
  const s = storeOf(pc).state;
  const pane = s.panes[0];
  if (!pane.tabs.some((t) => t.key === key)) return;
  if (pane.active === key) return;
  write(pc, { panes: [{ tabs: pane.tabs, active: key }] });
}

// Closing the active tab focuses its NEIGHBOR (the one that took its place, else the last one) —
// the strip never leaves you nowhere. An empty strip is legal: the center shows the project's own
// doc, the honest "nothing open".
export function closeTab(pc, key) {
  const s = storeOf(pc).state;
  const pane = s.panes[0];
  const idx = pane.tabs.findIndex((t) => t.key === key);
  if (idx === -1) return null;
  const tabs = pane.tabs.filter((t) => t.key !== key);
  let active = pane.active;
  if (pane.active === key) active = tabs.length ? tabs[Math.min(idx, tabs.length - 1)].key : null;
  write(pc, { panes: [{ tabs, active }] });
  return active;
}

// DRAG REORDER — his ask: the strip is his desk, so the order is his. Move the tab to sit where
// the one he dropped it on sits; everything else shifts. Active never changes on a reorder.
export function moveTab(pc, key, beforeKey) {
  const s = storeOf(pc).state;
  const pane = s.panes[0];
  const from = pane.tabs.findIndex((t) => t.key === key);
  if (from === -1 || key === beforeKey) return;
  const tabs = pane.tabs.filter((t) => t.key !== key);
  const to = beforeKey ? tabs.findIndex((t) => t.key === beforeKey) : tabs.length;
  tabs.splice(to === -1 ? tabs.length : to, 0, pane.tabs[from]);
  write(pc, { panes: [{ tabs, active: pane.active }] });
}

// BULK CLOSE — the right-click verbs. One writer, so they cannot disagree with closeTab about
// what "active" means afterwards.
//
// The ANCHOR (the tab he right-clicked) is the one guaranteed to survive `closeRight`/`closeOthers`,
// so it is where focus lands when the close swallowed whatever was active. Focusing the neighbor
// instead — closeTab's rule for a single close — would be wrong here: the neighbor may be one of
// the tabs he just asked to be rid of.
//
// Returns the key now active (null when nothing is left), so the caller knows whether to navigate.
function closeMany(pc, keep, anchorKey) {
  const s = storeOf(pc).state;
  const pane = s.panes[0];
  const tabs = pane.tabs.filter(keep);
  if (tabs.length === pane.tabs.length) return pane.active;
  const active = tabs.some((t) => t.key === pane.active)
    ? pane.active
    : tabs.some((t) => t.key === anchorKey)
    ? anchorKey
    : tabs.length
    ? tabs[tabs.length - 1].key
    : null;
  write(pc, { panes: [{ tabs, active }] });
  return active;
}

export function closeRight(pc, key) {
  const pane = storeOf(pc).state.panes[0];
  const idx = pane.tabs.findIndex((t) => t.key === key);
  if (idx === -1) return pane.active;
  return closeMany(pc, (_t, i) => i <= idx, key);
}

export function closeOthers(pc, key) {
  return closeMany(pc, (t) => t.key === key, key);
}

export function closeAll(pc) {
  return closeMany(pc, () => false, null);
}

// How many would each verb remove — so the menu can hide a verb that would do nothing rather than
// offering a dead item.
export function countRight(pc, key) {
  const tabs = storeOf(pc).state.panes[0].tabs;
  const idx = tabs.findIndex((t) => t.key === key);
  return idx === -1 ? 0 : tabs.length - idx - 1;
}

export function activeTab(pc) {
  const s = storeOf(pc).state;
  const pane = s.panes[0];
  return pane.tabs.find((t) => t.key === pane.active) || null;
}
