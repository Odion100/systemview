import React, { useState } from "react";
import Ring from "./Ring";
import { Ctx, HUES, Reading, floorOf, openBead } from "./floor";
import { reportChips, filterCards } from "../../../DashboardB/dashboardB.data";

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
export default function ReportsTile({ data }) {
  const [fanned, setFanned] = useState("");
  // WHICH WORD IS HOLDING THE FAN. "" is the open card exactly as it has always been — every card
  // spread out — because opening already shows everything and there is nothing to add a control
  // for. Pressing the word that is holding lets go of it.
  const [only, setOnly] = useState("");
  const floor = floorOf(data);
  if (!floor) return <Reading />;
  const { stacks } = floor;
  const open = (card) => openBead(card, data && data.open);
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
              // THE WORDS THE CARD CAN OFFER, and the two that are already on it are the first two:
              // "about to go" and "unopened" are not labels beside a control, they ARE the control
              // (his anchor: *"do you see how it says about to go, do you see how it says unopened —
              // when it opens up and shows the gallery those could become filters, and more could
              // become under it"*). So the subtypes are drawn UNDER them, in the same words.
              const ways = isOpen ? reportChips(s) : [];
              const held = (k) => (only === k ? " is-on" : "");
              const press = (k) => (e) => {
                e.stopPropagation();
                setOnly(only === k ? "" : k);
              };
              const shown = isOpen ? filterCards(s.cards, only) : s.cards;
              return (
                <div key={s.project} className={`dbb-stack${isOpen ? " is-open" : ""}${s.urgent ? " is-urgent" : ""}`}>
                  <button
                    type="button"
                    className="dbb-stack__face"
                    onClick={() => {
                      setFanned(isOpen ? "" : s.project);
                      setOnly("");
                    }}
                    aria-expanded={isOpen}
                  >
                    <span className="dbb-stack__n">{s.n}</span>
                    <span className="dbb-stack__proj">{s.project}</span>
                    <span
                      className={`dbb-stack__urgent${s.urgent && isOpen ? ` dbb-stack__pick${held("urgent")}` : ""}`}
                      {...(s.urgent && isOpen
                        ? {
                            role: "button",
                            tabIndex: 0,
                            onClick: press("urgent"),
                            onKeyDown: (e) => (e.key === "Enter" || e.key === " ") && press("urgent")(e),
                            title: `show only the ${s.urgent} about to go`,
                          }
                        : {})}
                    >
                      {s.urgent ? `${s.urgent} about to go` : isOpen ? "press to close" : "press to open out"}
                    </span>
                    {/* UNSEEN, ON THE FACE. A closed stack shows no cards, so without this the one
                        fact he asked for is behind a press on every pile. */}
                    {s.unseen ? (
                      <span
                        className={`dbb-stack__unseen${isOpen ? ` dbb-stack__pick${held("unseen")}` : ""}`}
                        title={
                          isOpen
                            ? `show only the ${s.unseen} not opened yet`
                            : `${s.unseen} not opened yet — their clocks have not started`
                        }
                        {...(isOpen
                          ? {
                              role: "button",
                              tabIndex: 0,
                              onClick: press("unseen"),
                              onKeyDown: (e) => (e.key === "Enter" || e.key === " ") && press("unseen")(e),
                            }
                          : {})}
                      >
                        {s.unseen} unopened
                      </span>
                    ) : null}
                    {/* AND MORE WORDS UNDER THEM — one per subtype the pile actually holds, in the
                        same line the deadline above is written in. Nothing new to look at: they are
                        more of the card's own words, which is the whole of what he asked for. */}
                    {ways
                      .filter((k) => String(k.chip).startsWith("as:"))
                      .map((k) => (
                        <span
                          key={k.chip}
                          className={`dbb-stack__urgent dbb-stack__pick${held(k.chip)}`}
                          role="button"
                          tabIndex={0}
                          onClick={press(k.chip)}
                          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && press(k.chip)(e)}
                          title={`show only the ${k.n} ${k.label} ${k.n === 1 ? "report" : "reports"}`}
                        >
                          {k.n} {k.label}
                        </span>
                      ))}
                  </button>
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
