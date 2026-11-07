import React, { useMemo } from "react";
import "../../../DashboardC/styles.scss";
import { openDoc } from "../../dashboardData";
import { currentFrom, shelvesFrom } from "../../../DashboardC/dashboardC.data";

// ═══ THE SHELVES, AS TILES ══════════════════════════════════════════════════════════════════════
//
// C's four sections, each one standing on its own so a surface can place them. Everything about
// what they SHOW is unchanged — the components in this folder are the page's own markup, moved
// and not rewritten — and the three things a tile is GIVEN rather than takes are here:
//
//   the READ     a tile never opens the registry. It is handed `data`, the one shared object from
//                `dashboardData.js`, so four tiles on one surface cannot disagree about what is
//                owed. `data.docs` / `data.owed` are what an ordinary tile reads; `data.allDocs` /
//                `data.allOwed` are the unnarrowed truth, and only a HEAD reads those.
//   the FILTER   the `filter` prop from the stack — `{ above, mine, set }` (TileStack.js,
//                filters.js). A press publishes with `set(dimension, value)` and narrows every
//                tile BELOW this one; `data.docs` / `data.owed` arrive already cut by whatever is
//                held above, so a tile that never touches `filter` is still narrowed for free.
//   the CONTEXT  `.dbc-ctx` (see styles.scss). The sections are styled flat, so a section lifted
//                out of `.dbc` keeps its own rules and loses everything it INHERITED: the type,
//                the eight custom properties every hue resolves through, and the `h2` every
//                section is titled with. The wrapper carries them and has no box of its own.
//
// WHAT A TILE MAY STILL DO IS DERIVE. The read is the thing that must not be duplicated; C's own
// join from documents to shelves is C's point of view on the same rows and it stays exactly where
// it was, in `dashboardC.data.js`, with its own suite.

/** The context wrapper. `display: contents`, so it changes what a section INHERITS and nothing
 *  about where it sits — the page's sticky head still sticks against the page. */
export const Ctx = ({ children }) => <div className="dbc-ctx">{children}</div>;

const EMPTY_DOCS = [];
const EMPTY_ROOTS = {};

// ONE DERIVATION PER SET OF ROWS, not one per tile.
//
// Four tiles each running `shelvesFrom` over the same forty documents is four times the parse for
// one answer — and, worse, four answers computed at four slightly different `now`s, which is how a
// head saying "1 expiring" ends up above a list showing none. This is a MEMO, not a store: a pure
// function of its two arguments, keyed on their identity, so tiles sharing a read share its
// derivation and hold the same object. Two slots, because while a filter is held the head is
// deriving over `allDocs` and everything else over the narrowed `docs`, and a single slot would
// let those two evict each other on every render.
//
// The clock bound is because `now` is baked in — report meters drain — so a derivation older than
// the poll that produced it is recomputed rather than served.
const SLOTS = 2;
let cache = [];
export function shelvesOf(docs, roots) {
  const now = Date.now();
  const hit = cache.find((c) => c.docs === docs && c.roots === roots && now - c.now < 30000);
  if (hit) return hit.out;
  const entry = { docs, roots, now, out: shelvesFrom({ docs, roots, now }) };
  cache = [entry, ...cache.filter((c) => c.docs !== docs || c.roots !== roots)].slice(0, SLOTS);
  return entry.out;
}

/**
 * What an ordinary C tile reads: the NARROWED rows, so a held head segment reaches it without it
 * having to know. `data` absent or empty is not an error — a tile standing alone derives the same
 * "nothing was read" `shelvesFrom` returns for no documents, which is the one state this surface
 * may never turn into "nothing to do".
 */
export function useShelves(data) {
  const docs = (data && data.docs) || EMPTY_DOCS;
  const roots = (data && data.roots) || EMPTY_ROOTS;
  return useMemo(() => shelvesOf(docs, roots), [docs, roots]);
}

/** The lifecycle tracks, over the same derivation. */
export function useTracks(shelves) {
  return useMemo(() => currentFrom(shelves.shelves), [shelves]);
}

/**
 * THE DOOR TRAVELS NOW — `openDoc` in dashboardData.js, which takes the window to the Code page's
 * own file route. His ruling, 2026-11-06: *"Nothing should actually be clicked to travel, except
 * an explicit symbol, like an arrow, to open the next page. And it actually should travel — not
 * open it up on the side."* So nothing on a C tile calls this from a row's own body any more; the
 * arrow (`Go`, below) is the one thing that does.
 *
 * ONE DOOR FOR BOTH SHAPES, still. A card carries the line as `at` (its `line` is the row's
 * SENTENCE); an owed item carries it as `line`, a number, straight from `owedFrom`. `Number` on a
 * sentence is NaN, which is falsy, so a card's words can never be mistaken for a line number.
 */
export const open = (t) =>
  openDoc({
    project: t.project || "",
    path: t.path,
    line: Number(t.at) || Number(t.line) || 0,
  });

/**
 * THE ARROW — the explicit symbol that travels, and the only thing that does. It stops the click
 * where it stands so the row under it (a fold, a selection) never fires too: the symbol is the
 * whole gesture.
 */
export const Go = ({ to, className = "" }) => (
  <button
    type="button"
    className={`dbc-go${className ? ` ${className}` : ""}`}
    title={`open ${to.id || to.path}`}
    aria-label={`open ${to.id || to.path}`}
    onClick={(e) => {
      e.stopPropagation();
      open(to);
    }}
  >
    →
  </button>
);

/** The mark on a card and on a stack's face. ⚑ is "a decision is waiting on you"; a press that is
 *  a CLOCK carries ⧗ instead, because a deadline is not a decision — nothing he presses makes it
 *  not have been due. The rule `owed.js` wrote for the band head, obeyed here so one glyph cannot
 *  mean two things in one window. */
export const FLAG = { press: "⚑", clock: "⧗" };

export default Ctx;
