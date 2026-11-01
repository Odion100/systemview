import React, { useState } from "react";
import "../../../DashboardA/styles.scss";
import { PHASES } from "../../../DashboardA/dashboardA.data";
import { Lane } from "./pieces";
import { useFold } from "./fold";

// ─── KIND `standing`, VARIANT A — THE AXIS AND EVERY LANE UNDER IT ─────────────────────────────
//
// ONE TILE, NOT TWO, and the reason is the only thing on this page that cannot be re-created by
// putting two tiles side by side:
//
//   THE AXIS AND THE TRACKS SHARE ONE GRID. `$dba-grid` — five equal columns and a 210px stack —
//   is declared once and used by `.dba-axis` and by every `.dba-track`. The alignment IS the read:
//   *"scan straight down 'moving' across twelve lanes and you see what the system is actually
//   doing today."* Two tiles are two boxes the surface may size differently, and the moment the
//   axis is one pixel wider than the lanes the columns stop being columns and the legend starts
//   labelling the wrong dots. That is worse than no legend.
//
//   AND THE AXIS IS STICKY AT `top: 86px`, which it can only be while the lanes are its siblings
//   inside one scrolling section — a sticky header in its own tile has nothing to stick over.
//
// So it is filed under `standing` — "every document on its lifecycle, across every project",
// which is literally what the axis plus the lanes draws. `projects` would be the lane block on its
// own, and A does not have one that stands up without the axis above it.
export const StandingTileA = ({ data }) => {
  const { d, open } = useFold(data);
  const read = !!(data && data.read);
  const { totals } = d;

  const [fanned, setFanned] = useState("");
  const [shown, setShown] = useState({});

  return (
    <div className="dba-ctx">
      <section className="dba__flow">
        <h2 className="dba__h2">
          Every project, and where its work is standing
          <span>
            {totals.marks} travelling {totals.marks === 1 ? "document" : "documents"} · {totals.reports} reports · across{" "}
            {totals.live} of {totals.projects} projects
          </span>
        </h2>
        {/* THE LEGEND IS THE HEADER, ONCE, and the lanes are a grid under it so a column means the
            same thing all the way down — that alignment is what makes the mass readable. The
            columns are named for what is true of the WORK, not for any one kind's vocabulary:
            `built` means something only to an RFC and a column headed with it would be a lie about
            the other three. */}
        <div className="dba-axis">
          {PHASES.map((ph) => (
            <div key={ph.id} className={`dba-axis__col dba-axis__col--${ph.id}`}>
              <b>{ph.label}</b>
              <i>{ph.hint}</i>
              <span className="dba-axis__n">{totals.phases[ph.id] || 0}</span>
            </div>
          ))}
          <div className="dba-axis__col dba-axis__col--stack">
            <b>reports</b>
            <i>they do not travel — they expire. press a stack to fan it out</i>
            <span className="dba-axis__n">{totals.reports}</span>
          </div>
        </div>
        {d.projects.map((p) => (
          <Lane
            key={p.code}
            p={p}
            fanned={fanned === p.code}
            onFan={() => setFanned((f) => (f === p.code ? "" : p.code))}
            shown={!!shown[p.code]}
            onShow={() => setShown((s) => ({ ...s, [p.code]: !s[p.code] }))}
            open={open}
          />
        ))}
        {!d.projects.length ? (
          <p className="dba-lane__none">
            {read
              ? "no projects — neither the registry nor the shell's folder list has anything in it"
              : "waiting on the hub"}
          </p>
        ) : null}
      </section>
    </div>
  );
};

export default StandingTileA;
