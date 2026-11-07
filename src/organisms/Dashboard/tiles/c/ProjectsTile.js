import React, { useState } from "react";
import RetainClock from "../../../AgentChat/RetainClock";
import { KINDS, KIND_PLURAL, KIND_WORD } from "../../../DashboardC/dashboardC.data";
import { Ctx, FLAG, Go, useShelves } from "./surface";

// ═══ THE SHELVES, ONE PER PROJECT ══════════════════════════════════════════════════════════════
//
// His own visual cue taken seriously and generalised: *"reports looking like a stack with numbers,
// and then you click them and they expand out horizontally."* A stack is a physical thing with
// depth; press it and it FANS, card after card sliding out sideways, each with its own meter.
// Every project is on screen at once as four stacks, so "all the projects going on at the same
// time" is the default state of the page and not a filter he has to set.
//
// AND THE METERS REFUSE TO FLATTER. One percent-done over four kinds would be a number nothing can
// act on, so progress is drawn in each kind's own terms: objectives for an arc with blocked as its
// own segment, CLAIMS for an RFC with `unproved` as its own segment — met is marked met AND proved,
// and the width between them is the width of the lie a green bar would tell — and for a report, a
// clock draining, the only thing on this page that gets worse while he does nothing.

// WHAT A CARD'S MARK MEANS, and the mark belongs to the KIND of attention, never to the position —
// the rule `owed.js` wrote for the band head, obeyed here so one glyph cannot mean two things in
// one window. ⚑ is "a decision is waiting on you"; a press that is a CLOCK carries ⧗ instead,
// because a deadline is not a decision: nothing he presses makes it not have been due.
const markOf = (card) => (card.meter && card.meter.urgent ? FLAG.clock : card.press ? FLAG.press : "");

/** A meter: segments in their own hues, widths in proportion, and nothing drawn when there is nothing to say. */
const Meter = ({ meter, kind }) => {
  if (!meter || !meter.segs || !meter.segs.length) return null;
  const total = meter.total || meter.segs.reduce((n, s) => n + s.n, 0) || 1;
  return (
    <div className={`dbc-meter dbc-meter--${kind}`} aria-hidden="true">
      {meter.segs.map((s) => (
        <i key={s.k} className={`dbc-meter__seg is-${s.k}`} style={{ flexGrow: s.n / total }} />
      ))}
    </div>
  );
};

/**
 * ONE CARD — a document's face on the shelf. Its body is for READING now: his ruling, 2026-11-06,
 * *"Nothing should actually be clicked to travel, except an explicit symbol, like an arrow"* — so
 * the card is no longer a button, and the arrow in its corner is the one thing that takes the
 * window to the document.
 */
const Card = ({ card }) => (
  <div
    className={`dbc-card dbc-card--${card.kind}${card.press ? " is-press" : ""}${card.work ? " is-work" : ""}${
      card.unread || card.missing ? " is-blind" : ""
    }${card.fixture ? " is-fixture" : ""}`}
    title={`${card.id} — ${card.path}`}
  >
    <span className="dbc-card__top">
      <span className="dbc-card__id">{card.id}</span>
      {card.station ? <span className="dbc-card__station">{card.station}</span> : <span className="dbc-card__station is-none">not parsed</span>}
      {markOf(card) ? <span className={`dbc-card__mark${card.meter && card.meter.urgent ? " is-urgent" : ""}`}>{markOf(card)}</span> : null}
      <Go className="dbc-card__go" to={card} />
    </span>
    <span className="dbc-card__title">{card.title || card.path}</span>
    <Meter meter={card.meter} kind={card.kind} />
    <span className={`dbc-card__line${card.meter && card.meter.urgent ? " is-urgent" : ""}`}>
      {/* THE ONE NUMBER ON THIS PAGE THAT MOVES ON ITS OWN. `RetainClock` is the drawer's own
          counting face — one interval at the cadence the words have — so a report in its last hour
          ticks here exactly as it ticks there, and neither is a second clock. */}
      {card.kind === "report" && card.meter && card.meter.counting ? (
        <RetainClock state={card.rowState} openedAt={card.openedAt} className="dbc-card__clock" />
      ) : (
        card.line
      )}
    </span>
    {card.says.length ? <span className="dbc-card__says">{card.says[0]}</span> : null}
    {/* THE ROW IS A CACHE OF THE LAST PARSE, and when the file on disk is newer the card SAYS so
        rather than quietly being wrong about where a document stands. */}
    {card.stale ? <span className="dbc-card__stale">the file has moved on since this was read</span> : null}
    {card.fixture ? <span className="dbc-card__stale">a proof fixture — owed.js counts it out of his obligations</span> : null}
  </div>
);

/**
 * ONE STACK — closed it is depth and a number, pressed it FANS horizontally. His cue, taken as the
 * page's whole interaction model: a stack you can riffle. The closed face carries the count and
 * the one thing worth knowing before opening it (how many of these need him), so a stack he does
 * not open has still told him something.
 */
const Stack = ({ kind, cards, fanned, onToggle }) => {
  const needs = cards.reduce((n, c) => n + c.press, 0);
  const work = cards.reduce((n, c) => n + c.work, 0);
  const urgent = cards.some((c) => c.meter && c.meter.urgent);
  if (!cards.length)
    return (
      <div className={`dbc-stack dbc-stack--${kind} is-empty`}>
        <span className="dbc-stack__count">0</span>
        <span className="dbc-stack__kind">no {KIND_PLURAL[kind]} registered</span>
      </div>
    );
  return (
    <div className={`dbc-stack dbc-stack--${kind}${fanned ? " is-fanned" : ""}`}>
      <button type="button" className="dbc-stack__face" onClick={onToggle} aria-expanded={fanned}>
        {/* THE DEPTH IS DRAWN, up to four leaves — a stack of thirty and a stack of three must not
            look the same, and a stack of thirty drawn thirty deep is a smear. */}
        <span className="dbc-stack__leaves" aria-hidden="true">
          {[...Array(Math.min(4, cards.length - 1))].map((_, i) => (
            <i key={i} style={{ transform: `translate(${(i + 1) * 3}px, ${(i + 1) * 3}px)` }} />
          ))}
        </span>
        <span className="dbc-stack__count">{cards.length}</span>
        <span className="dbc-stack__kind">{cards.length === 1 ? KIND_WORD[kind] : KIND_PLURAL[kind]}</span>
        <span className="dbc-stack__owed">
          {needs ? (
            <b className={urgent ? "is-urgent" : ""}>
              {urgent ? FLAG.clock : FLAG.press} {needs}
            </b>
          ) : null}
          {work ? <i>{work} outstanding</i> : null}
          {!needs && !work ? <i className="is-clear">nothing owed</i> : null}
        </span>
      </button>
      {/* IT EXPANDS OUT HORIZONTALLY — his words exactly. The fan is a horizontal scroller, so a
          project with thirty RFCs riffles sideways instead of pushing every other project's
          shelf off the bottom of the page. */}
      <div className="dbc-fan" role="list">
        {fanned
          ? cards.map((c, i) => (
              <div className="dbc-fan__slot" role="listitem" key={c.key} style={{ animationDelay: `${Math.min(i, 12) * 22}ms` }}>
                <Card card={c} />
              </div>
            ))
          : null}
      </div>
    </div>
  );
};

export default function ProjectsTileC({ data, filter }) {
  const d = useShelves(data);
  // WHICH STACKS ARE FANNED — per project-and-kind, so opening the RFCs on one project leaves
  // every other shelf exactly as it was. Nothing is open by default: a page that opens every
  // stack is the table this is not.
  const [fanned, setFanned] = useState({});
  const toggle = (key) => setFanned((f) => ({ ...f, [key]: !f[key] }));
  // THE PROJECT NAME IS A FILTER — his ruling, 2026-11-06: *"you should be able to click on those
  // and filter everything per project."* The press publishes `project` to the stack and narrows
  // every tile BELOW this one; pressing the held name again lets go. Standing outside a stack
  // there is nothing to publish to, so the name stays the plain word it always was.
  const heldProject = (filter && (filter.mine || {}).project) || "";
  const pick = filter ? (code) => filter.set("project", code) : null;
  if (!d.shelves.length) return null;
  return (
    <Ctx>
      <section className="dbc-shelves">
        <h2>
          The shelves <i>press a stack and it fans out</i>
        </h2>
        {d.shelves.map((s) => (
          <div className="dbc-shelf" key={s.project || "(no project)"}>
            <div className="dbc-shelf__name">
              {pick && s.project ? (
                <button
                  type="button"
                  className={`dbc-shelf__pick${heldProject === s.project ? " is-on" : ""}`}
                  aria-pressed={heldProject === s.project}
                  title={
                    heldProject === s.project
                      ? "showing only this project below — press to show everything"
                      : `show only ${s.project}, below this tile`
                  }
                  onClick={() => pick(s.project)}
                >
                  <b>{s.project}</b>
                </button>
              ) : (
                <b>{s.project || "no project on the row"}</b>
              )}
              <span className="dbc-shelf__owed">
                {s.press ? <em className="is-press">⚑ {s.press} to press</em> : null}
                {s.work ? <em className="is-work">{s.work} outstanding</em> : null}
                {!s.press && !s.work && s.documents ? <em className="is-clear">nothing owed</em> : null}
                {!s.documents ? <em className="is-clear">nothing registered here</em> : null}
                {s.unread ? <em className="is-blind">{s.unread} unreadable</em> : null}
              </span>
              {s.root ? <code>{s.root}</code> : null}
            </div>
            <div className="dbc-shelf__stacks">
              {KINDS.map((k) => (
                <Stack
                  key={k}
                  kind={k}
                  cards={s.cards[k]}
                  fanned={!!fanned[`${s.project}:${k}`]}
                  onToggle={() => toggle(`${s.project}:${k}`)}
                />
              ))}
            </div>
          </div>
        ))}
      </section>
    </Ctx>
  );
}
