import React from "react";
import { owedHead } from "../../../AgentChat/owed";
import { Ctx, Reading, floorOfAll } from "./floor";

// ─── THE HEAD ──────────────────────────────────────────────────────────────────────────────────
//
// THE TOP IS ABOUT HIM, NOT ABOUT INVENTORY. One sentence — what is waiting on a press, then work
// nobody can press away — then how much of the system that sentence actually covers, then the
// tide: one bar, every document, four postures, the shape of everything before any reading.
//
// THE BAR COUNTS DOCUMENTS; THE SENTENCE ABOVE COUNTS OBLIGATIONS, and one document can hold two.
// Unlabelled, the two sets of numbers read as a contradiction, so the bar says what it counts.
//
// ─── IT READS THE UNNARROWED WORLD, ALWAYS ─────────────────────────────────────────────────────
//
// `allDocs` and `allOwed`, never `docs` and `owed`. A head that counted the filtered set would
// restate its own press back at itself — press "4 approvals waiting" and it becomes "4 of 4",
// with no way left to see there were ever more. The counts are the thing you filter FROM, and
// that goes for the tide too: the tide is a picture of the WHOLE, which is what makes the
// narrowed sections below it legible as a part.
//
// ─── AND THE PRESS FILTERS EVERY SECTION, NOT THIS ONE ─────────────────────────────────────────
//
// His ruling: *"especially because they're going to be components, those headers, if they have
// filters, need to filter the entire, ALL of the sections."* So the press goes up to the surface
// (`data.setOnly`) and comes back down to every tile as a narrowed `docs`. This tile owns no
// filter state of its own — it could not, once he can drag it onto a page the other sections are
// not even on.
/**
 * WHICH COLOUR A SEGMENT WEARS — its POSTURE, derived, never a list of keys.
 *
 * `owedHead` names nine segments today and will name more; a stylesheet rule per key means the
 * next kind of obligation arrives in whatever colour it inherits, which is to say in no colour at
 * all. There are only ever three postures — a press of his, work nobody can press away, and a
 * real earned nothing — and they are the same three the tide below is drawn on, so the page says
 * one thing about colour rather than two.
 *
 * THE MARK IS THE TELL, and it is `owedHead`'s own: a press segment carries ⚑ or ⧗ because it
 * ends at something he does; outstanding carries none, because a mark would promise a control
 * that does not exist. B's own fallback segments (the three nothings) keep their key, which is
 * already the word for what they are.
 */
export const toneOf = (s) => (s.keys ? (s.key === "clear" ? "clear" : s.flag ? "press" : "work") : s.key);

export default function HeadTile({ data }) {
  const floor = floorOfAll(data);
  if (!floor) return <Reading />;
  const { tide } = floor;

  // THE SEGMENTS ARE `owedHead`'S, not a second set written here. That matters for two reasons:
  // the band and the drawer already say the head in those words, and — the load-bearing one —
  // every segment carries the KEYS of the obligations it counted, so pressing one narrows the
  // surface to exactly the things the number came from rather than to a predicate written here
  // that agrees with the number today and drifts tomorrow.
  //
  // WHATEVER COMES BACK IS WHAT IS DRAWN. Not a switch on the keys that exist today: `owedHead`
  // breaks the press out by why and the outstanding half out by what the work IS, it hands a
  // `why` nobody has written a word for back under the old lump key rather than dropping it, and
  // it will learn more of both. A head that knew its segments in advance would quietly undercount
  // the first time one arrived — and an undercount reads as RESOLVED.
  const all = (data && data.allOwed) || floor.owed;
  const counted = (all.head || owedHead(all)).segs;
  // A NOTHING THAT WAS NEVER MEASURED IS NOT A NOTHING — `owedHead` says nothing at all when
  // nothing was counted, and B's own head is the one that knows how to say which nothing it is:
  // nothing owed, nothing registered, or nothing that could be read.
  const segs = counted.length ? counted : floor.head.segs;

  // AN ERROR IS SAID OUT LOUD IN THE HEAD, beside the reach, rather than replacing the page: the
  // counts below are still the last honest thing we have and hiding them teaches nothing.
  const trouble = (data && data.error) || "";
  const only = (data && data.only) || null;
  const setOnly = data && data.setOnly;

  return (
    <Ctx>
      <header className="dbb-head">
        <div className="dbb-head__title">
          <h1>The floor</h1>
          <p>every kind of thing this system carries, in every project, and what it wants from you</p>
        </div>
        <div className="dbb-head__say">
          {segs.map((s) => {
            const mark = s.flag || s.mark || "";
            const body = (
              <>
                {mark ? <b className="dbb-say__mark">{mark}</b> : null}
                {s.text}
              </>
            );
            // A SEGMENT WITH NOTHING BEHIND IT STAYS A LABEL. "nothing owed" and "nothing is
            // registered" count no obligations, so there is nothing to narrow to — and a control
            // that filters to the empty set is a control lying about having one.
            const can = !!(setOnly && s.keys && s.keys.length);
            const on = can && only === s.key;
            const cls = `dbb-say dbb-say--${toneOf(s)}`;
            if (!can)
              return (
                <span key={s.key} className={cls}>
                  {body}
                </span>
              );
            return (
              <button
                key={s.key}
                type="button"
                className={`${cls} is-able${on ? " is-on" : ""}`}
                aria-pressed={on}
                title={on ? "showing only these — press to show everything again" : "show only these, everywhere on this surface"}
                onClick={() => setOnly(s.key)}
              >
                {body}
              </button>
            );
          })}
        </div>
        <div className="dbb-head__reach">
          {floor.head.reach}
          {/* WHAT WAS LEFT OUT, ONCE. `skippedLine` is owed.js's own sentence and it already counts
              the fixtures — in OBLIGATIONS, which is the number that was actually excluded. Saying
              it again in documents put two different figures for one exclusion side by side. */}
          {floor.head.skipped ? <span className="dbb-aside"> · {floor.head.skipped}</span> : null}
          {trouble ? <span className="dbb-aside dbb-aside--bad"> · {trouble}</span> : null}
        </div>

        {/* THE TIDE — one bar, every document, four postures. The shape of the system before any
            reading happens: how much of it is waiting on him, how much is work nobody can press
            away, how much is clear, how much has left active service. */}
        <div className="dbb-tide__cap">every registered document, by what it wants from you</div>
        <div className="dbb-tide" role="img" aria-label={tide.map((t) => `${t.n} ${t.label}`).join(", ")}>
          {tide.map((t) => (
            <span key={t.key} className={`dbb-tide__seg dbb-tide__seg--${t.key}`} style={{ width: `${t.pct}%` }} title={`${t.n} ${t.label}`} />
          ))}
        </div>
        <div className="dbb-tide__legend">
          {tide.map((t) => (
            <span key={t.key} className={`dbb-tide__key dbb-tide__key--${t.key}`}>
              <i /> {t.n} {t.label}
            </span>
          ))}
        </div>
      </header>
    </Ctx>
  );
}
