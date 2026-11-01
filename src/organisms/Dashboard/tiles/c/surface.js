import React, { useMemo } from "react";
import "../../../DashboardC/styles.scss";
import { openAddress } from "../../../../atoms/Markdown/openRef";
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
//   the FILTER   `data.only` / `data.setOnly` / `data.filtering`. The press lands on the surface
//                and narrows the documents, so every tile narrows together without any tile but
//                the head knowing a filter exists.
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
 * THE ONE OPENER (openRef.js): *"every surface that opens a file address calls THIS, and nothing
 * else dispatches sv:openFileInNav."* A document is a markdown file, so it rides the door files
 * already ride — the Code page's own listener (pages/SystemView) and every other page's doc panel
 * (useOpenedFile) both answer it, which is why there is no second branch here and no navigation
 * fallback: throwing the window over to another page to read one card would undo the thing these
 * tiles are for. `lines` carries the obligation's own line, so a card marked by an unsigned
 * approval lands him ON the approval rather than at the top of a forty-page RFC.
 *
 * ONE DOOR FOR BOTH SHAPES. A card carries the line as `at` (its `line` is the row's SENTENCE); an
 * owed item carries it as `line`, a number, straight from `owedFrom`. Both are accepted here so
 * there is one opener rather than two — and `Number` on a sentence is NaN, which is falsy, so a
 * card's words can never be mistaken for a line number.
 */
export const open = (t) =>
  openAddress({
    projectCode: t.project || "",
    path: t.path,
    language: "markdown",
    lines: Number(t.at) ? [Number(t.at)] : Number(t.line) ? [Number(t.line)] : null,
  });

/** The mark on a card and on a stack's face. ⚑ is "a decision is waiting on you"; a press that is
 *  a CLOCK carries ⧗ instead, because a deadline is not a decision — nothing he presses makes it
 *  not have been due. The rule `owed.js` wrote for the band head, obeyed here so one glyph cannot
 *  mean two things in one window. */
export const FLAG = { press: "⚑", clock: "⧗" };

export default Ctx;
