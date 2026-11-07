import React from "react";
import "../../../DashboardA/styles.scss";
import { readingLine } from "../../../DashboardA/dashboardA.data";
import { useFold } from "./fold";

// ─── KIND `head`, VARIANT A — THE MASTHEAD, AND THE SURFACE'S FILTER ───────────────────────────
//
// `.dba__top` whole, because it is one CSS grid with three named areas (`mast`, `gauge`,
// `fixtures`) and the gauge is placed by that grid against the masthead beside it. Lift the gauge
// out on its own and the reading line has nothing to sit next to; the task asked for "the gauge
// plus the reading line" and on this page that IS the header element.
//
// THE READING LINE IS NEVER CONDITIONAL. An empty dashboard that read as "you are clear" when it
// meant "nobody answered" is the one failure this surface may not have, so the sentence saying
// what the tile is standing on is above the fold whatever happened.
//
// ─── THE GAUGE FILTERS EVERYTHING, NOT THE SECTION UNDER IT ────────────────────────────────────
//
// His ruling: *"especially because they're going to be components, those headers, if they have
// filters, need to filter the entire, all of the sections."* So a segment's press goes to the
// SURFACE (`data.setOnly`), which narrows the rows every tile derives from — this one included,
// except that this one deliberately looks past the narrowing:
//
//   THE HEAD COUNTS THE WHOLE WORLD, ALWAYS. It reads `all`, never `d`. A head that counted its
//   own filter's answer would turn "4 approvals waiting" into "4 of 4" the instant he pressed it,
//   and take away the only number on screen that said there had ever been more. The counts are
//   what you filter FROM.
//
//   AND A SEGMENT WITH NOTHING BEHIND IT IS NOT A CONTROL. `owedHead` hands every segment the
//   `keys` of the obligations it counted; "nothing owed" carries none, so it stays a plain div
//   rather than becoming a button that filters to the empty set.
//
// THE HELD STATE IS FILLED, IN THE SEGMENT'S OWN COLOUR. A surface-wide filter you cannot tell is
// on means reading a narrowed dashboard as the whole world — so held is not a hairline or a tint,
// it is the box inverted, and it keeps the press/outstanding hue so he can still see WHICH one.
export const HeadTileA = ({ data, filter }) => {
  const fold = useFold(data);
  const { all, fixtures, setFixtures } = fold;
  // THE PRESS PUBLISHES TO THE STACK when one is there — his ruling, 2026-11-06: a tile filters
  // everything BELOW it, never the whole page. The fold's surface pair is the standalone fallback.
  const only = filter ? (filter.mine || {}).kind || null : fold.only;
  const setOnly = filter ? (key) => filter.set("kind", key) : fold.setOnly;
  const read = !!(data && data.read);
  const error = (data && data.error) || "";
  const { totals, head } = all;

  return (
    <div className="dba-ctx">
      <header className="dba__top">
        <div className="dba__mast">
          <h1>What is going on, and what needs you</h1>
          {/* THE TILE SAYS WHAT IT IS STANDING ON, always. An empty dashboard that read as "you
              are clear" when it meant "nobody answered" is the one failure this page may not have,
              so the reading line is above the fold and never conditional. */}
          <p className="dba__reading">
            {error ? `the registry could not be read — ${error}` : read ? readingLine(totals) : "reading the registry…"}
          </p>
        </div>
        {/* THE GAUGE IS `owedHead`'s OWN SEGMENTS — same marks, same words, same order as the
            drawer's band, because two surfaces disagreeing about how much he owes is worse than
            either of them being slightly wrong. ⚑ means a decision waits on him; ⧗ means a
            deadline, which is not a decision: nothing he presses makes it not have been due. */}
        <div className="dba__gauge">
          {head.segs.map((s) => {
            const held = only === s.key;
            const cls = `dba-tile is-${s.key}${held ? " is-held" : ""}`;
            const face = (
              <>
                <span className="dba-tile__flag">{s.flag}</span>
                <span className="dba-tile__text">{s.text}</span>
              </>
            );
            // A segment with no obligations behind it never becomes a press — same box, same type,
            // same spacing; the only difference at rest between the two is the cursor.
            return (s.keys || []).length ? (
              <button
                key={s.key}
                type="button"
                className={cls}
                aria-pressed={held}
                onClick={() => setOnly(s.key)}
              >
                {face}
              </button>
            ) : (
              <div key={s.key} className={cls}>
                {face}
              </div>
            );
          })}
          {!head.segs.length && read ? <div className="dba-tile is-cold">nothing was read — no answer to give</div> : null}
          {head.unread ? <div className="dba-tile is-cold">{head.unread} unread</div> : null}
        </div>
        {/* THE EXCLUSION IS ARGUABLE, NEVER SILENT — `owed.js`'s rule, kept: the number is what
            lets him disagree with the exclusion instead of taking it on trust. No fixtures in the
            registry means no switch, because a switch over nothing is furniture. */}
        {totals.fixtures ? (
          <label className="dba__fixtures">
            <input type="checkbox" checked={fixtures} onChange={(e) => setFixtures(e.target.checked)} />
            show the {totals.fixtures} proof {totals.fixtures === 1 ? "fixture" : "fixtures"} — test data wearing a document
          </label>
        ) : null}
      </header>
    </div>
  );
};

export default HeadTileA;
