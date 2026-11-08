import React from "react";
import "./styles.scss";

// THE TRAIL — one drawing of a lifecycle, extracted from the how-we-work page (his call,
// 2026-10-28: "I'm trying to make this our registration blocks"). Two homes, one picture:
//
//   - the how-we-work page feeds it teaching stations and a press that opens prose;
//   - the registration leaf feeds it the kind's real steps with the document's state lit,
//     and a press that MOVES the document (or refuses with what is missing).
//
// The component owns the look and nothing else: rings on a line, the current state lit in the
// kind's accent, and a FORK drawn as a dead end — a fork station shares its column with the
// station before it, the stroke leaves the PREVIOUS node and dives to its ring, and nothing
// leaves it. What a press means belongs to whoever rendered it.
//
// Stations: [{ id, label?, fork?, glyph?, title?, disabled? }] — `label` defaults to the id,
// `glyph` to "◦". `at` is the current station's id. No `onPress` renders spans, not buttons.
const Trail = ({ kind = "", stations = [], at, onPress, className = "" }) => {
  const cols = stations.reduce((acc, s) => {
    if (s.fork && acc.length) acc[acc.length - 1].push(s);
    else acc.push([s]);
    return acc;
  }, []);
  // THE ACCENT TRACES THE PATH ACTUALLY TAKEN (his call: "the orange line should be showing the
  // path that it went down"). Segments up to the current station wear the kind's accent; roads not
  // taken — the segments ahead, and a fork nothing died at — stay border-grey. The column holding
  // `at` is the last walked one, so its outgoing segment is already untraveled.
  const atCol = cols.findIndex((col) => col.some((s) => s.id === at));
  // A FORK ENDING IS REACHED BY THE DIAGONAL ALONE — the stroke leaves the PREVIOUS node and dives
  // to the ring, so the horizontal beside it is the OTHER road (his catch: rejecting lit the line
  // toward resolved too, and the drawing claimed both directions). The incoming horizontal into a
  // fork ending stays grey; only the diagonal lights.
  const atIsFork = !!(cols[atCol] || []).find((s) => s.id === at && s.fork);
  const lastWalked = atIsFork ? atCol - 1 : atCol;
  return (
    <ol className={`sv-trail${kind ? ` sv-trail--${kind}` : ""}${className ? ` ${className}` : ""}`}>
      {cols.map((col, i) => (
        <li
          key={col[0].id}
          className={`sv-trail__col${col.length > 1 ? " sv-trail__col--split" : ""}${
            atCol > -1 && i < lastWalked ? " sv-trail__col--walked" : ""
          }`}
        >
          {col.map((s) => {
            const body = (
              <>
                {/* decorative — kept out of the accessible name so a button reads as its state */}
                <span className="sv-trail__ring" aria-hidden="true">
                  {s.glyph || "◦"}
                </span>
                <span className="sv-trail__name">{s.label || s.id}</span>
              </>
            );
            const cls = `sv-trail__st${s.fork ? " sv-trail__st--fork" : ""}${
              s.dead ? " sv-trail__st--dead" : ""
            }${s.id === at ? " is-at" : ""}`;
            return (
              <div key={s.id} className={cls}>
                {onPress && !s.disabled ? (
                  <button
                    type="button"
                    className="sv-trail__btn"
                    title={s.title || ""}
                    onClick={() => onPress(s.id)}
                  >
                    {body}
                  </button>
                ) : (
                  // A DISABLED STATION IS NO BUTTON AT ALL (RFC-076 c22): a derived station you
                  // are standing on has no press that could mean anything, and a disabled button
                  // still reads as a control that might wake up. The span is the honest shape —
                  // the same one every station takes on a read-only trail.
                  <span className="sv-trail__btn" title={s.title || ""}>
                    {body}
                  </span>
                )}
              </div>
            );
          })}
        </li>
      ))}
    </ol>
  );
};

export default Trail;
