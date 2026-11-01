import React, { useState } from "react";
import { KINDS } from "../../../DashboardB/dashboardB.data";
import { Ctx, HUES, Reading, floorOf } from "./floor";

// ─── THE PROJECTS ──────────────────────────────────────────────────────────────────────────────
//
// "All the projects going on at the same time" — and EVERY project the hub knows, not only the
// ones carrying documents. A project with nothing registered is a FACT, not an absence; folding
// them into one honest line beats eleven empty cards and beats hiding them.
//
// NOTHING IS OPENED FROM HERE. A project is not a document and B has no door for one, so these
// cards say what is there and stop — the only control is the fold on the quiet list.
export default function ProjectsTile({ data }) {
  const [showQuiet, setShowQuiet] = useState(false);
  const floor = floorOf(data);
  if (!floor) return <Reading />;
  const live = floor.projects.filter((p) => !p.quiet);
  const quiet = floor.projects.filter((p) => p.quiet);
  return (
    <Ctx>
      <section className="dbb-projects">
        <div className="dbb-flow__head">
          <h2>the projects</h2>
          <span>ordered by what they want from you · the time is when the shell last PARSED something there</span>
        </div>
        <div className="dbb-projects__grid">
          {live.map((p) => (
            <div key={p.code} className={`dbb-proj${p.press ? " is-press" : ""}`}>
              <div className="dbb-proj__name">
                <b>{p.code}</b>
                {p.press ? <span className="dbb-proj__flag">⚑ {p.press}</span> : null}
              </div>
              <div className="dbb-proj__pips">
                {/* FOUR PIPS IN THE SAME ORDER ON EVERY CARD, zeroes included — that is what makes
                    two projects comparable at a glance rather than readable one by one. */}
                {KINDS.map((k) => (
                  <span key={k.kind} className={`dbb-pip${p.counts[k.kind] ? "" : " is-none"}`} style={{ "--hue": HUES[k.kind] }} title={`${p.counts[k.kind]} ${k.label}`}>
                    <i />
                    {p.counts[k.kind]}
                  </span>
                ))}
              </div>
              <div className="dbb-proj__foot">
                {p.work ? <span>{p.work} outstanding</span> : <span className="dbb-aside">nothing outstanding</span>}
                {p.lastWords ? <span className="dbb-aside">parsed {p.lastWords}</span> : null}
                {p.stale ? <span className="dbb-proj__stale">{p.stale} drifted past their parse</span> : null}
              </div>
            </div>
          ))}
        </div>
        {quiet.length ? (
          <p className="dbb-quiet">
            <button type="button" onClick={() => setShowQuiet(!showQuiet)}>
              {`${quiet.length} ${quiet.length === 1 ? "project" : "projects"} the hub knows with no registered documents`}
            </button>
            {showQuiet ? <span className="dbb-quiet__list"> — {quiet.map((p) => p.code).join(" · ")}</span> : null}
            <span className="dbb-aside">
              {" "}
              — registered, not empty: nothing in them carries a registration leaf the shell has parsed, so this page
              cannot see inside them and neither can anything else in the window.
            </span>
          </p>
        ) : null}
      </section>
    </Ctx>
  );
}
