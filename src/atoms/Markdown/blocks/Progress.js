import React from "react";
import { useDocMembers } from "../context";
import { progressOf, timelineOf } from "../objectives";

// RFC-072 §5 — `::progress`. WHERE THE ARC IS: how many are done, by whom, and what is waiting on
// what. It recounts from the `::objective` blocks in the same document every render — there is no
// stored total anywhere, so it cannot disagree with the objectives above it.
//
// THIS USED TO BE TWO BLOCKS. `::progress` counted and `::timeline` ordered, and the first time
// they rendered together he read them as one thing — *"I see progress time, I guess that's the
// timeline."* He was right: they are one thing. Same source, same recount, and an arc carrying one
// without the other is half-instrumented in a way nothing would ever flag — progress with no order
// cannot say what is blocked, which is the question the numbers make you ask.
//
// NO PERCENTAGE OF A HALF-FINISHED OBJECTIVE. An objective that is partly done is two objectives
// nobody has split yet, so `doing` is its own count rather than a half-filled bar — the honest
// shape of "we have started it" is not 50%.
const Progress = ({ attrs = {} }) => {
  const { source = "" } = useDocMembers() || {};
  const src = String(source || "");
  const p = progressOf(src);
  const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
  // The rows are the normal case. `rows=off` leaves the summary alone, for the top of a long arc
  // or a report that wants to say how far along something is without pulling in every objective.
  const wantRows = String(attrs.rows || "") !== "off";
  const rows = wantRows ? timelineOf(src) : [];

  // A document with no objectives says so. A bar at 0/0 reading 100% complete is the kind of
  // cheerful lie this system refuses everywhere else.
  if (!p.total) return <div className="md-progress md-progress--empty">no objectives in this document yet</div>;

  return (
    <div className="md-progress">
      <div className="md-progress__label">Progress</div>
      <div className="md-progress__head">
        <span className="md-progress__count">
          {p.done}/{p.total} done
        </span>
        {p.doing ? <span className="md-progress__tag">{p.doing} in progress</span> : null}
        {p.blocked ? <span className="md-progress__tag md-progress__tag--blocked">{p.blocked} blocked</span> : null}
        <span className="md-progress__pct">{pct}%</span>
      </div>
      <div className="md-progress__bar" aria-hidden="true">
        <i style={{ width: `${pct}%` }} />
      </div>
      {attrs.by === "owner" || attrs.by === undefined ? (
        <ul className="md-progress__owners">
          {p.byOwner.map((r) => (
            <li key={r.owner} className={r.owner === "unowned" ? "is-unowned" : ""}>
              <span className="md-progress__owner">{r.owner}</span>
              <span className="md-progress__owner-count">
                {r.done}/{r.total}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {/* THE ORDER, under the numbers. It comes from `needs` and nothing else — no phases and no
          swimlanes, because order is a property of an objective rather than a box drawn around a
          group of them. And it FLAGS what it cannot resolve rather than dropping it: an objective
          missing from this list would read as "no such work", the worst answer available. */}
      {rows.length ? (
        <>
          <div className="md-progress__label md-progress__label--order">Objectives</div>
          <ol className="md-timeline">
            {rows.map((o, i) => {
              const unseen = (o.blockedBy || []).filter((b) => b.status === "unresolved" || b.status === "elsewhere");
              return (
                <li
                  key={o.id}
                  className={`md-timeline__row md-timeline__row--${o.state}${o.cycle ? " md-timeline__row--cycle" : ""}`}
                >
                  <span className="md-timeline__n">{i + 1}</span>
                  <span className="md-timeline__id">{o.id}</span>
                  <span className="md-timeline__state">{o.state}</span>
                  {o.title ? <span className="md-timeline__title">{o.title}</span> : null}
                  {o.owner ? <span className="md-timeline__owner">{o.owner}</span> : null}
                  {o.cycle ? (
                    <span
                      className="md-timeline__flag"
                      title="These objectives depend on each other — the order cannot be resolved until one of them stops needing the other."
                    >
                      ⚠ circular dependency
                    </span>
                  ) : null}
                  {unseen.map((b) => (
                    <span
                      key={b.address || b.why}
                      className={`md-timeline__flag md-timeline__flag--${b.status}`}
                      title={
                        b.status === "elsewhere"
                          ? `${b.address} is in another arc or repo — this document cannot see whether it is done`
                          : `${b.address || "this need"} — ${b.why || "does not resolve"}`
                      }
                    >
                      {b.status === "elsewhere" ? "↗" : "⚠"} {b.address || "unreadable need"}
                    </span>
                  ))}
                </li>
              );
            })}
          </ol>
        </>
      ) : null}
    </div>
  );
};

export default Progress;
