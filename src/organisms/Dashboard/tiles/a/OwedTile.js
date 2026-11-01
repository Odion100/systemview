import React, { useState } from "react";
import "../../../DashboardA/styles.scss";
import { skippedLine, groupOwed } from "../../../AgentChat/owed";
import { OwedGroup } from "./pieces";
import { useFold } from "./fold";

// ─── KIND `owed`, VARIANT A — WHAT NEEDS HIM, IN TWO HALVES ────────────────────────────────────
//
// `.dba__owed`, unchanged: PRESS on the left, OUTSTANDING on the right, and the header of each
// half is the legend — his standing rule for this surface, *"the reason I know it's an approval is
// because it says it above."*
//
// THE TWO HALVES ARE ONE TILE because they are one `auto-fit` grid that collapses to a single
// column when the tile is narrow, and because the skipped line spans both (`grid-column: 1 / -1`)
// — a statement about what was left out of BOTH lists. Split them and the exclusion has to be
// printed twice or dropped once.
export const OwedTileA = ({ data }) => {
  const { d, open } = useFold(data);
  const read = !!(data && data.read);
  const { totals, owed } = d;

  // WHICH DOCUMENTS ARE FANNED OPEN. Keyed by `groupOwed`'s key, which carries the project — so
  // opening alpha's RFC-001 does not open beta's.
  const [openOwed, setOpenOwed] = useState({});
  const toggleOwed = (k) => setOpenOwed((o) => ({ ...o, [k]: !o[k] }));
  const skipped = skippedLine(owed.skipped);

  return (
    <div className="dba-ctx">
      <section className="dba__owed">
        <div className="dba__half">
          <h2>
            Press <span>your signature finishes it</span>
          </h2>
          {owed.press.length ? (
            groupOwed(owed.press).map((g) => (
              <OwedGroup key={g.key} g={g} open={!!openOwed[g.key]} onToggle={() => toggleOwed(g.key)} onOpen={open} />
            ))
          ) : (
            <p className="dba__clear">{read && totals.read ? "nothing waiting on a verdict of yours" : "not measured"}</p>
          )}
        </div>
        <div className="dba__half">
          <h2>
            Outstanding <span>nobody can press it away</span>
          </h2>
          {owed.work.length ? (
            groupOwed(owed.work).map((g) => (
              <OwedGroup key={g.key} g={g} open={!!openOwed[g.key]} onToggle={() => toggleOwed(g.key)} onOpen={open} />
            ))
          ) : (
            <p className="dba__clear">{read && totals.read ? "nothing outstanding" : "not measured"}</p>
          )}
        </div>
        {skipped ? <p className="dba__skipped">{skipped}</p> : null}
      </section>
    </div>
  );
};

export default OwedTileA;
