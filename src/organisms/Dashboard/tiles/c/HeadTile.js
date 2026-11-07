import React, { useMemo } from "react";
import { skippedLine } from "../../../AgentChat/owed";
import { Ctx, shelvesOf } from "./surface";

// ═══ THE COUNTS ════════════════════════════════════════════════════════════════════════════════
//
// What needs him, before anything about how much exists — and the one tile on the surface that
// does not merely show the registry but STEERS what every other tile shows.

const EMPTY_DOCS = [];
const EMPTY_ROOTS = {};

const EMPTY = {
  projects: "No project is registered with this hub. Nothing was read — this is not an empty inbox.",
  documents:
    "Projects are registered and the document registry is empty. Nothing has been parsed yet, so no arc, RFC, gap or report exists to show — that is a cold registry, not a clear desk.",
  unread:
    "Documents are registered and not one of them could be opened. Every number on this page comes out of the text, so there are no numbers — the hub could not read the files.",
};

/**
 * A HEAD COUNTS THE WHOLE WORLD, NEVER THE FILTERED ONE — `allDocs` and `allOwed`, which the
 * surface promises are never narrowed. A head that counted what its own press had already taken
 * away would restate the press back at itself: press "4 approvals waiting" and it becomes "4 of
 * 4", with no way left to see there had ever been more. The counts are the thing you filter FROM.
 */
export default function HeadTileC({ data, filter }) {
  const d = data || {};
  const allDocs = d.allDocs || d.docs || EMPTY_DOCS;
  const roots = d.roots || EMPTY_ROOTS;
  // The shelf count and the shape of the emptiness — both are facts about every project, so both
  // come off the unnarrowed derivation.
  const all = useMemo(() => shelvesOf(allDocs, roots), [allDocs, roots]);
  // THE OBLIGATIONS BEHIND THE SEGMENTS. The surface's `allOwed` when there is one (it is
  // recomputed on the minute, so an expiring clock's wording stays true between polls); the
  // tile's own derivation when it is standing alone. Both are `owedFrom` over the same rows.
  const owed = d.allOwed || { ...all.owed, head: all.head };
  const head = owed.head || { segs: [], unread: 0 };
  const skipped = skippedLine(owed.skipped || {});
  // THE PRESS PUBLISHES TO THE STACK — his ruling, 2026-11-06: *"They should be filtering
  // everything below them"*, never the whole page. The stack's `filter` carries `mine` (this
  // tile's own held segment) and `set`; standing outside a stack the old surface-wide pair is the
  // fallback, so a head mounted alone still presses SOMETHING rather than drawing a dead control.
  const only = (filter ? (filter.mine || {}).kind : d.only) || "";
  // NO SETTER, NO CONTROL. A tile handed data with nothing to press into must not draw a button
  // that quietly does nothing — the same rule as a segment with no items behind it.
  const setOnly = filter ? (key) => filter.set("kind", key) : typeof d.setOnly === "function" ? d.setOnly : null;

  return (
    <Ctx>
      <header className="dbc-head">
        <div className="dbc-head__top">
          <h1>Across everything</h1>
          <span className="dbc-head__counts">
            {all.projects} {all.projects === 1 ? "project" : "projects"} · {all.documents}{" "}
            {all.documents === 1 ? "document" : "documents"} · {owed.counted} read
          </span>
        </div>
        {/* THE COUNTS ARE DOORS. *"Waiting, expiring, outstanding — those look like you should be
            able to click them."* They did not look pressable by accident: they were the only
            numbers on the page with nothing behind them, so reading "4 approvals waiting" left
            him to go and find which four.

            AND THEY FILTER EVERYTHING BELOW THIS TILE — his ruling, 2026-11-06: *"They should be
            filtering everything below them."* Placement is scope now: the press publishes to the
            stack, which narrows the DOCUMENTS every tile UNDER this one derives from, and the
            rails, the shelves and the owed lists down there all narrow together without one of
            them knowing a filter exists. A tile standing above this head is untouched.

            THE SEGMENT CARRIES THE ITEMS IT COUNTED (`owedHead`), so pressing one shows exactly
            the rows the number came from — the list cannot drift from the count, because they
            are the same array. A segment with nothing behind it (nothing owed) stays a label:
            a control that filters to the empty set is a control that lies about having one. */}
        <div className="dbc-head__segs">
          {head.segs.map((s) =>
            s.keys && s.keys.length && setOnly ? (
              <button
                type="button"
                key={s.key}
                className={`dbc-seg is-${s.key}${only === s.key ? " is-on" : ""}`}
                aria-pressed={only === s.key}
                title={only === s.key ? "showing only these below — press to show everything" : `show only ${s.text}, below this tile`}
                onClick={() => setOnly(s.key)}
              >
                {s.flag ? <b>{s.flag}</b> : null}
                {s.text}
              </button>
            ) : (
              <span key={s.key} className={`dbc-seg is-${s.key}`}>
                {s.flag ? <b>{s.flag}</b> : null}
                {s.text}
              </span>
            ),
          )}
          {head.unread ? <span className="dbc-seg is-unread">{head.unread} unread</span> : null}
        </div>
        {/* A SURFACE THAT SILENTLY OMITS IS THE FAILURE THIS SYSTEM EXISTS TO STOP, so what was
            left out is said in `owed.js`'s own sentence, not hidden behind a count. */}
        {skipped ? <div className="dbc-head__skipped">{skipped}</div> : null}
        {d.error ? <div className="dbc-head__error">nothing was read — {d.error}</div> : null}
      </header>

      {all.empty ? <div className="dbc-void">{EMPTY[all.empty]}</div> : null}
    </Ctx>
  );
}
