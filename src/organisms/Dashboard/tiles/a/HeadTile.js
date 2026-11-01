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
// AND IT READS `all`, NEVER `d`. The surface can narrow what the other tiles derive from; a head
// that counted its own narrowed answer would restate it back at itself and take away the only
// number on screen that said there had ever been more. The counts are what you filter FROM.
export const HeadTileA = ({ data }) => {
  const { all, fixtures, setFixtures } = useFold(data);
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
          {head.segs.map((s) => (
            <div key={s.key} className={`dba-tile is-${s.key}`}>
              <span className="dba-tile__flag">{s.flag}</span>
              <span className="dba-tile__text">{s.text}</span>
            </div>
          ))}
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
