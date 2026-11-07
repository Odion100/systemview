import React, { useState } from "react";
import { KINDS } from "../../../DashboardB/dashboardB.data";
import { Ctx, HUES, Reading, floorOf } from "./floor";

// ─── THE PROJECTS ──────────────────────────────────────────────────────────────────────────────
//
// "All the projects going on at the same time" — and EVERY project the hub knows, not only the
// ones carrying documents. A project with nothing registered is a FACT, not an absence; folding
// them into one honest line beats eleven empty cards and beats hiding them.
//
// NOTHING IS OPENED FROM HERE. A project is not a document and B has no door for one.
//
// A CARD IS A SELECTION, AND THIS IS THE TILE THE SELECTION WAS ALWAYS FOR — his ruling,
// 2026-11-07: *"the projects you should be able to click to filter, and it needs to show it
// selected properly."* Pressing one publishes `project` to the stack, so every tile BELOW this one
// is that project and nothing else; pressing it again lets go. The fill is the whole point of
// asking for it: a narrowed page that does not say which selection narrowed it reads as the world.
export default function ProjectsTile({ data, filter }) {
  const [showQuiet, setShowQuiet] = useState(false);
  const floor = floorOf(data);
  if (!floor) return <Reading />;
  const held = (filter && (filter.mine || {}).project) || "";
  const pick = filter ? (code) => filter.set("project", code) : null;
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
          {live.map((p) => {
            const on = held === p.code;
            // A BUTTON, not a div with a role: nothing inside a project card is interactive, so the
            // whole card can be the press without nesting one control in another.
            const Card = pick ? "button" : "div";
            return (
            <Card
              key={p.code}
              {...(pick
                ? {
                    type: "button",
                    onClick: () => pick(p.code),
                    "aria-pressed": on,
                    title: on
                      ? `showing only ${p.code} below — press to show every project again`
                      : `press to show only ${p.code} below this tile`,
                  }
                : {})}
              className={`dbb-proj${p.press ? " is-press" : ""}${on ? " is-on" : ""}`}
            >
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
            </Card>
            );
          })}
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
