import React, { useState } from "react";
import { filterCards, reportChips } from "../../../DashboardB/dashboardB.data";
import Ring from "./Ring";
import { Ctx, HUES, Reading, floorOf, openBead } from "./floor";

// ─── THE REPORT STACKS ─────────────────────────────────────────────────────────────────────────
//
// His one visual cue, verbatim: *"reports looking like a stack with numbers, and then you click
// them and they expand out horizontally."* It lands on reports and not on the other kinds because
// it is TRUE of reports: a report does not progress, it AGES. Their trail is `filed → retired` and
// the second station is their death, so they get no track — they arrive in a pile and the pile
// drains. One stack per project, because "all the projects going on at the same time" is the other
// half of the ask and a single global pile would bury the project that is actually producing.
//
// A CARD IS READING, AND THE ARROW IS THE DOOR. There is no selection here: a selection has to have
// something under it, and a report holds nothing — his ruling, 2026-11-07: *"What the fuck could a
// report filter? What is a report sitting on top of?"* The fill he asked for belongs to the
// projects, where a press means every tile below is that project. Travel is the arrow, because
// *"nothing should actually be clicked to travel, except an explicit symbol."*
//
// THE CHIPS ARE THE OTHER THING, AND THEY ARE NOT A SELECTION EITHER. His ask: *"when it's a card
// it should look the same way that it is right now when it's closed. When you click it open it just
// grows more options and those options become clickable options to filter the list right next to
// it."* So the closed pile is untouched, and an open one grows a row of chips that narrows ITS OWN
// fan and nothing else on the surface. That is why this tile still takes no `filter` prop: a report
// is not a dimension, and choosing which of twelve reports to look at was never that question.
//
// THE CHOICE DIES WITH THE PRESS THAT CLOSES THE PILE, and it is per project — one pile is open at
// a time, so a filter surviving the close would come back on a different project's cards.
export default function ReportsTile({ data }) {
  const [fanned, setFanned] = useState("");
  const [chip, setChip] = useState("all");
  const floor = floorOf(data);
  if (!floor) return <Reading />;
  const { stacks } = floor;
  const open = (card) => openBead(card, data && data.open);
  const fan = (project) => {
    setFanned(project);
    setChip("all");
  };
  return (
    <Ctx>
      <section className="dbb-stacks">
        <div className="dbb-flow__head">
          <h2>the reports</h2>
          <span>
            a report does not progress, it ages — the ring is what is LEFT of its retention, and the clock does not
            start until you first open it
          </span>
        </div>
        {stacks.length ? (
          <div className="dbb-stacks__row">
            {stacks.map((s) => {
              const isOpen = fanned === s.project;
              const chips = isOpen ? reportChips(s) : [];
              const shown = isOpen ? filterCards(s.cards, chip) : s.cards;
              return (
                <div key={s.project} className={`dbb-stack${isOpen ? " is-open" : ""}${s.urgent ? " is-urgent" : ""}`}>
                  {/* THE CARD IS THE FACE AND WHAT THE FACE GROWS. Closed, this column is the face
                      and nothing else, at the same 164px the pile behind it is drawn to — which is
                      what keeps the closed stack exactly the pile he already has. */}
                  <div className="dbb-stack__card">
                    <button
                      type="button"
                      className="dbb-stack__face"
                      onClick={() => fan(isOpen ? "" : s.project)}
                      aria-expanded={isOpen}
                    >
                      <span className="dbb-stack__n">{s.n}</span>
                      <span className="dbb-stack__proj">{s.project}</span>
                      <span className="dbb-stack__urgent">
                        {s.urgent ? `${s.urgent} about to go` : isOpen ? "press to close" : "press to open out"}
                      </span>
                      {/* UNSEEN, ON THE FACE. A closed stack shows no cards, so without this the one
                          fact he asked for is behind a press on every pile. */}
                      {s.unseen ? (
                        <span className="dbb-stack__unseen" title={`${s.unseen} not opened yet — their clocks have not started`}>
                          {s.unseen} unopened
                        </span>
                      ) : null}
                    </button>
                    {/* THE OPTIONS THE OPEN CARD GREW. A radio group and not a row of toggles,
                        because that is what single-select IS — one chip holds at a time and `all`
                        is how he lets go. Only drawn when the pile earned at least one. */}
                    {chips.length ? (
                      <div className="dbb-stack__chips" role="radiogroup" aria-label={`narrow ${s.project}'s reports`}>
                        {chips.map((k) => (
                          <button
                            key={k.chip}
                            type="button"
                            role="radio"
                            aria-checked={chip === k.chip}
                            className={`dbb-chip${chip === k.chip ? " is-on" : ""}`}
                            onClick={() => setChip(k.chip)}
                            title={
                              k.chip === "all"
                                ? `every report in ${s.project} — ${k.n}`
                                : `show only the ${k.n} ${k.label} ${k.n === 1 ? "report" : "reports"} in ${s.project}`
                            }
                          >
                            {k.label}
                            <i>{k.n}</i>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="dbb-fan">
                    {shown.map((c, i) => (
                      // A PLAIN DIV: nothing here is pressed but the arrow. It carried a role and a
                      // press while the press published a filter, and the filter was the mistake.
                      <div
                        key={c.key}
                        className={`dbb-rcard${c.mark === "⧗" ? " is-urgent" : ""}`}
                        style={{ "--i": i, zIndex: shown.length - i }}
                        title={`${c.id}${c.title ? ` — ${c.title}` : ""}\n${c.says}`}
                      >
                        <span className="dbb-rcard__top">
                          <Ring ratio={c.ratio} hue={HUES.report} drains />
                          {c.mark ? <b className="dbb-rcard__mark">{c.mark}</b> : null}
                          <button
                            type="button"
                            className="dbb-rcard__go"
                            tabIndex={isOpen ? 0 : -1}
                            title={`open ${c.id}`}
                            aria-label={`open ${c.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              open(c);
                            }}
                          >
                            →
                          </button>
                        </span>
                        <span className="dbb-rcard__id">{c.title || c.id}</span>
                        {/* WHAT KIND OF REPORT, and whether he has opened it — the two facts a
                            clock is meaningless without. The subtype is what SET the retention,
                            and an unopened report's ring is full because its clock has not
                            started, which is indistinguishable from "plenty of time left" unless
                            the card says so. */}
                        <span className="dbb-rcard__meta">
                          {c.subtype ? <em className="dbb-rcard__as">{c.subtype}</em> : null}
                          {!c.seen && c.station !== "retired" ? (
                            <em className="dbb-rcard__unseen" title="you have not opened this — its clock has not started">
                              unopened
                            </em>
                          ) : null}
                        </span>
                        <span className="dbb-rcard__says">{c.says}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="dbb-flow__none">no reports are registered in any project.</p>
        )}
      </section>
    </Ctx>
  );
}
