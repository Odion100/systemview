import React, { useState } from "react";
import "../../../DashboardA/styles.scss";
import { PHASES, foldLanes, holdLanes } from "../../../DashboardA/dashboardA.data";
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
  // WHICH AXIS COLUMN IS HELD — a phase id, or "reports". Empty means everything, so there is no
  // `all` to press. ONE AT A TIME, everywhere on this page: *"all the filters become toggles
  // between each other, even the higher level ones."*
  const [held, setHeld] = useState("");
  const hold = (k) => setHeld((h) => (h === k ? "" : k));
  // WHICH KIND IS HELD INSIDE EACH LANE, keyed by project code — alpha's gaps are not beta's.
  const [picks, setPicks] = useState({});
  // WHICH SINGLE DOCUMENT A LANE IS PINNED TO, keyed by project code. Set by pressing its mark.
  const [only, setOnly] = useState({});
  const pick = (code, kind) => {
    const next = (picks[code] || "") === kind ? "" : kind;
    // PRESSING A COUNT LETS GO OF THE PINNED MARK. One list, one question at a time: he asked for
    // the kind, so the one document he pinned a moment ago is not the answer any more.
    setOnly((o) => ({ ...o, [code]: "" }));
    setPicks((o) => ({ ...o, [code]: next }));
    // AND HOLDING `report` OPENS THE STACK, because that is where a report actually is — it never
    // travels, so there is no row of it to narrow to. Letting go closes the fan again.
    setFanned((f) => (next === "report" ? code : f === code ? "" : f));
  };
  const pin = (code, key) => setOnly((o) => ({ ...o, [code]: o[code] === key ? "" : key }));
  // THE FOOTNOTE LANES, OPENED ON REQUEST — folded by default, never dropped.
  const [quietOpen, setQuietOpen] = useState(false);

  // THE FOLD FIRST, THEN THE FILTER, and they stay separate on purpose: a lane with nothing in it
  // is a fact about the project, and a lane the filter excluded is a fact about what he is
  // holding. One fold would make those read as the same thing.
  const { live: drawn, quiet } = foldLanes(d.projects);
  const lanes = holdLanes(drawn, held ? [held] : []);
  const showing = lanes.reduce((n, p) => n + p.marks.length, 0);
  const showingReports = lanes.reduce((n, p) => n + p.reports.length, 0);

  return (
    <div className="dba-ctx">
      <section className="dba__flow">
        <h2 className="dba__h2">
          Every project, and where its work is standing
          {/* THE NUMBERS ARE WHAT IS ON SCREEN, not what the registry holds — a subhead that said
              "22 travelling documents" over a filtered page would be describing a page he is not
              looking at. With nothing held they are the same number. */}
          <span>
            {showing} travelling {showing === 1 ? "document" : "documents"} · {showingReports} reports · across{" "}
            {lanes.length} of {totals.projects} projects
            {held ? ` · holding ${held}` : ""}
          </span>
        </h2>
        {/* THE LEGEND IS THE HEADER, ONCE, and the lanes are a grid under it so a column means the
            same thing all the way down — that alignment is what makes the mass readable. The
            columns are named for what is true of the WORK, not for any one kind's vocabulary:
            `built` means something only to an RFC and a column headed with it would be a lie about
            the other three.

            AND THE LEGEND IS ALSO THE FILTER. Hold a column and every lane below narrows to it,
            across every project at once — more than one at a time, and `reports` is a column like
            any other. Nothing held means everything, which is why there is nothing here that
            means "all": the page is already in that state before anybody presses. */}
        <div className="dba-axis">
          {PHASES.map((ph) => (
            <button
              key={ph.id}
              type="button"
              className={`dba-axis__col dba-axis__col--${ph.id}${held === ph.id ? " is-on" : ""}`}
              aria-pressed={held === ph.id}
              onClick={() => hold(ph.id)}
            >
              <b>{ph.label}</b>
              <i>{ph.hint}</i>
              <span className="dba-axis__n">{totals.phases[ph.id] || 0}</span>
            </button>
          ))}
          <button
            type="button"
            className={`dba-axis__col dba-axis__col--stack${held === "reports" ? " is-on" : ""}`}
            aria-pressed={held === "reports"}
            onClick={() => hold("reports")}
          >
            <b>reports</b>
            <i>they do not travel — they expire. press a stack to fan it out</i>
            <span className="dba-axis__n">{totals.reports}</span>
          </button>
        </div>
        {lanes.map((p) => (
          <Lane
            key={p.code}
            p={p}
            fanned={fanned === p.code}
            onFan={() => setFanned((f) => (f === p.code ? "" : p.code))}
            pick={picks[p.code] || ""}
            onPick={(kind) => pick(p.code, kind)}
            only={only[p.code] || ""}
            onOnly={(key) => pin(p.code, key)}
            heldAny={!!held}
            open={open}
          />
        ))}
        {/* A FILTER THAT MATCHES NOTHING SAYS SO IN THE FILTER'S OWN WORDS. "no projects" here
            would be a claim about the machine; this is a claim about what he is holding. */}
        {!lanes.length && drawn.length ? (
          <p className="dba-lane__none">nothing is {held} in any project right now</p>
        ) : null}
        {!d.projects.length ? (
          <p className="dba-lane__none">
            {read
              ? "no projects — neither the registry nor the shell's folder list has anything in it"
              : "waiting on the hub"}
          </p>
        ) : null}
        {/* THE FOOTNOTE, FOLDED. The count IS the statement — he can read "4 with nothing in them"
            and never open it, which is the whole ask; and the lanes are still in there, each one
            still saying why it is empty, so nothing has been hidden from him. */}
        {quiet.length ? (
          <div className={`dba-quiet${quietOpen ? " is-open" : ""}`}>
            <button
              type="button"
              className="dba-quiet__more"
              aria-expanded={quietOpen}
              onClick={() => setQuietOpen((q) => !q)}
            >
              {quietOpen ? "⌃" : "⌄"} {quiet.length} {quiet.length === 1 ? "project" : "projects"} with nothing in them
              {quiet.filter((p) => !p.registered).length === quiet.length
                ? " — nothing registered"
                : " — nothing registered, or everything in them has gone"}
            </button>
            {quietOpen
              ? quiet.map((p) => (
                  <Lane
                    key={p.code}
                    p={p}
                    fanned={fanned === p.code}
                    onFan={() => setFanned((f) => (f === p.code ? "" : p.code))}
                    pick={picks[p.code] || ""}
                    onPick={(kind) => pick(p.code, kind)}
                    only={only[p.code] || ""}
                    onOnly={(key) => pin(p.code, key)}
                    heldAny={!!held}
                    open={open}
                  />
                ))
              : null}
          </div>
        ) : null}
      </section>
    </div>
  );
};

export default StandingTileA;
