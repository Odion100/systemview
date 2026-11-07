import React, { useState } from "react";
import Ring from "./Ring";
import { docKey } from "../../../AgentChat/owed";
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
// A CARD IS A SELECTION NOW, NOT A DOOR. His ruling, 2026-11-06: *"the selection can't change
// anything about it now, but you need to be able to click it and show a selection — might have to
// be just a fill."* So a press on a card publishes `reportWindow` to the stack (the tiles below
// narrow to that report — mostly to nothing else today, which is the honest size of it) and wears
// the fill; the ARROW is what travels, because *"nothing should actually be clicked to travel,
// except an explicit symbol."*
export default function ReportsTile({ data, filter }) {
  const [fanned, setFanned] = useState("");
  const floor = floorOf(data);
  if (!floor) return <Reading />;
  const { stacks } = floor;
  const open = (card) => openBead(card, data && data.open);
  const held = (filter && (filter.mine || {}).reportWindow) || "";
  const pick = filter ? (card) => filter.set("reportWindow", docKey(card)) : null;
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
              return (
                <div key={s.project} className={`dbb-stack${isOpen ? " is-open" : ""}${s.urgent ? " is-urgent" : ""}`}>
                  <button
                    type="button"
                    className="dbb-stack__face"
                    onClick={() => setFanned(isOpen ? "" : s.project)}
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
                  <div className="dbb-fan">
                    {s.cards.map((c, i) => (
                      // A DIV WITH A ROLE, not a button, because the arrow inside it is a button
                      // and a button may not hold one. Plain press = the selection (the fill);
                      // the arrow = the travel.
                      // eslint-disable-next-line jsx-a11y/click-events-have-key-events
                      <div
                        key={c.key}
                        role="button"
                        className={`dbb-rcard${c.mark === "⧗" ? " is-urgent" : ""}${held && held === docKey(c) ? " is-on" : ""}`}
                        style={{ "--i": i, zIndex: s.cards.length - i }}
                        onClick={pick ? () => pick(c) : undefined}
                        aria-pressed={pick ? !!held && held === docKey(c) : undefined}
                        tabIndex={isOpen ? 0 : -1}
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
