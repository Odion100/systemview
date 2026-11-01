// THE PAGES OF THE DASHBOARD — the strip that used to be a three-way switch between candidates.
//
// His design: the switcher stays and LOOKS THE SAME. What it grows is an `×` on each tab and one
// `+` at the end of the row — *"not a plus button on the tab itself, but a plus button up there"*
// — and the `×` only when there is more than one tab, because a strip that lets you close the
// last page leaves a surface with nothing on it and no way back.
//
// A PAGE IS A STACK, his ruling: an ordered list of tiles, full width, reordered by dragging.
// Not a grid — no per-tile width, no resize handles.
//
// THE THREE CANDIDATES BECOME PAGES RATHER THAN BEING DELETED. *"Let's not delete this current
// dashboard… so that I can check them against each other piece by piece."* Each one is a single
// page-sized tile holding the whole of the dashboard it names, still running its own code — so
// what he compares a extracted tile against is the real thing, not a screenshot of it. They go
// when he picks, and not before.

// `window`, not `globalThis` — this project's eslint env has no `globalThis` and the production
// build fails on it while jest passes, because jsdom defines it. Resolved lazily rather than at
// module load so a test can hand in its own store.
const theStore = () => (typeof window === "undefined" ? null : window.localStorage);

const KEY = "sv.dash.pages";
const PICK = "sv.dash.pick";

// THREE PAGES, EACH BUILT ONLY FROM ITS OWN TILES, in the order that page stacks them.
//
// They began as replicas of three whole-dashboard candidates, kept side by side so a difference
// was a bug rather than an opinion. The candidates are retired — *"you can retire the three
// previous pages, those are not needed anymore"* — and the comparison survives where it belongs:
// `equivalence.test.js` still mounts the original components over the same rows and holds the
// tiles to them node for node. The check outlived the pages, which is the point of writing it
// as a test rather than as something to look at.
const REBUILT = {
  a: ["head", "owed", "standing"],
  b: ["head", "owed", "standing", "reports", "projects"],
  c: ["head", "owed", "standing", "projects"],
};
const rebuilt = (variant, label) => ({
  id: `r${variant}`,
  label,
  tiles: REBUILT[variant].map((kind) => ({ kind, variant })),
});

/** What a fresh window gets: the three pages, in the order the candidates were in. */
export const DEFAULT_PAGES = [rebuilt("a", "A · one track"), rebuilt("b", "B · the floor"), rebuilt("c", "C · the shelves")];

const clean = (p) => {
  if (!p || typeof p !== "object" || typeof p.id !== "string" || !p.id) return null;
  const tiles = Array.isArray(p.tiles) ? p.tiles.filter((t) => t && typeof t.kind === "string") : [];
  // A RETIRED CANDIDATE IS DROPPED, NOT EMPTIED. `legacy` meant "render that whole dashboard
  // instead of a stack", so those pages carry no tiles — strip the field and what is left is a
  // blank page, which is a worse answer than no page. His saved layout still holds all three,
  // and this is the only place that reads it, so the retirement reaches a window nobody cleared.
  // A legacy page WITH tiles never existed, but if one does it is kept: dropping something he
  // arranged is the one mistake this cannot make.
  if (p.legacy && !tiles.length) return null;
  return { id: p.id, label: typeof p.label === "string" && p.label ? p.label : p.id, tiles };
};

/**
 * Read the saved layout.
 *
 * A LAYOUT THAT CANNOT BE PARSED IS NOT A LAYOUT — it falls back to the default rather than
 * throwing or rendering an empty strip. Private mode, a half-written value, a shape from an older
 * build: all of them mean "I do not know what he arranged", and the honest answer to that is the
 * default, not a surface with no pages on it.
 */
export function loadPages(store = theStore()) {
  try {
    const raw = store && store.getItem(KEY);
    if (!raw) return DEFAULT_PAGES;
    const parsed = JSON.parse(raw);
    const pages = Array.isArray(parsed) ? parsed.map(clean).filter(Boolean) : [];
    return pages.length ? pages : DEFAULT_PAGES;
  } catch {
    return DEFAULT_PAGES;
  }
}

/** Write it. Silent on failure — a layout that could not be saved must not break the surface. */
export function savePages(pages, store = theStore()) {
  try {
    if (store) store.setItem(KEY, JSON.stringify(pages));
  } catch {
    /* private mode: it just will not be remembered */
  }
  return pages;
}

export function loadPick(pages, store = theStore()) {
  try {
    const v = store && store.getItem(PICK);
    if (pages.some((p) => p.id === v)) return v;
  } catch {
    /* fall through */
  }
  return (pages[0] || {}).id || "";
}

export function savePick(id, store = theStore()) {
  try {
    if (store) store.setItem(PICK, id);
  } catch {
    /* ignore */
  }
  return id;
}

/**
 * Add a page. Returns `{ pages, pick }` — the new page is the one you land on, because adding a
 * page you then have to go and find is a two-step version of one action.
 *
 * The id is derived from the highest numbered page rather than from the count, so adding after a
 * removal cannot mint an id that is already taken — `p1, p2, p3`, remove `p2`, add → `p4`.
 */
export function addPage(pages, label) {
  const used = new Set(pages.map((p) => p.id));
  let n = pages.length + 1;
  while (used.has(`p${n}`)) n += 1;
  const page = { id: `p${n}`, label: label || `Page ${n}`, tiles: [] };
  return { pages: [...pages, page], pick: page.id };
}

/**
 * Remove a page. Returns `{ pages, pick }`.
 *
 * THE LAST PAGE CANNOT BE REMOVED and this refuses rather than relying on the strip to hide the
 * control: a surface with no pages has nothing to draw and no way back, and a rule enforced only
 * in the renderer is a rule one refactor from being gone.
 *
 * Removing the page you are standing on lands you on its NEIGHBOUR — the one to its left, or the
 * first if it was leftmost. Landing on page one from anywhere would lose your place every time.
 */
export function removePage(pages, id, pick) {
  if (pages.length <= 1) return { pages, pick, refused: "the last page cannot be closed" };
  const at = pages.findIndex((p) => p.id === id);
  if (at < 0) return { pages, pick };
  const left = pages.filter((p) => p.id !== id);
  const next = pick === id ? (left[Math.max(0, at - 1)] || left[0]).id : pick;
  return { pages: left, pick: next };
}

/** Move a page to sit where another one is — the strip reorders by drag, same as the tab strip. */
export function movePage(pages, id, beforeId) {
  const from = pages.findIndex((p) => p.id === id);
  if (from < 0 || id === beforeId) return pages;
  const without = pages.filter((p) => p.id !== id);
  const to = beforeId == null ? without.length : without.findIndex((p) => p.id === beforeId);
  if (to < 0) return pages;
  return [...without.slice(0, to), pages[from], ...without.slice(to)];
}

export default loadPages;
