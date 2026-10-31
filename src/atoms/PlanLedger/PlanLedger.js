import React, { useState } from "react";
import "./styles.scss";

// THE PLAN LEDGER — where this plan is, and what is stopping it.
//
// THE SHAPE. A header BLOCK, then rows. Not a header line: the percent, the bar and the counts
// were crammed onto one row with the run button jammed against the pane edge, which is what made
// it read as a toolbar instead of a summary. The number is the headline, the bar runs the full
// width under it, and the counts sit beneath in words.
//
// A ROW IS A SPINE, NOT A GLYPH. State was a 10px character in a 14px column — unreadable at a
// glance, which is the only way anybody reads a ledger. It is a coloured spine down the left of
// the row now, so the column of states is legible before any text resolves.
//
// AND THERE IS NO GREEN ON IT. Green carried "objective finished" AND "spec passed" and made the
// whole surface one wash of the same hue — his verdict twice over. The vocabulary now:
//
//   VIOLET  the accent, and the only positive ink — progress, a finished objective, a spec that
//           passed. One colour for "this is good", so a filled thing is good wherever it appears.
//   CORAL   failed, or a dependency that cannot be resolved
//   CYAN    moving right now
//   AMBER   blocked — somebody has to do something
//   SLATE   untouched
//
//   plan      — `arcPlan.planOf(source, { byObj, arcRow })`, whole
//   stoppers  — `arcPlan.stoppersOf(plan)`, folded back onto the row each one stops
//   marks     — `{ [specKey]: "running"|"pass"|"fail" }` from `utils/proofsBus`; the same map the
//               side panel's cards write as they run, which is why a run button turns green or
//               red without this component knowing a run exists
//   onRun({ kind, id }) · onOpen({ project, path, line })
//   onClear()  — take the results back off. A run left every control green for the rest of the
//                session with nothing anywhere to undo it, which makes a stale green indis-
//                tinguishable from a fresh one.
//   A ROW OPENS. The plans serving an objective are the detail, and seven objectives' worth of
//   them at once is a wall — so a row carries its headline (where it is, what is stopping it) and
//   OPENS to show what it is made of. The spine still signs; the line opens.
//

// THE STATE IS A WORD. It was a glyph — a tick, then a fill gauge — and both times the answer was
// the same: *"what do these symbols mean? They don't mean anything to me."* A shape has to be
// learned before it says anything, and nothing on this surface teaches it. A word is read.
//
// It is also not a checkbox and not pressable: an objective completes when the plans attached to
// it settle, so a press here would be a hand overruling a derivation.
const toneOf = (o) => (o.cycle ? "cycle" : o.state === "done" ? "done" : o.ready ? "ready" : o.state || "open");
const wordOf = (o) =>
  o.cycle ? "cycle" : o.state === "doing" ? "in progress" : o.ready ? "ready" : o.state || "open";

const specsOf = (o) => (o.plans || []).flatMap((p) => p.specRows || []);


/**
 * THE WORST THING UNDER A GROUP, so one control can speak for many — red wins, then moving.
 *
 * PART-RUN IS NOT RUNNING. The last line used to read `had.length === keys.length ? "pass" :
 * "running"`, which made "some of these have results and the rest do not" indistinguishable from
 * "something is executing right now". Run one row's single spec in a seven-spec arc and the arc's
 * own control pulsed blue for the rest of the session over a machine doing nothing — a surface
 * reporting work that was not happening. Nothing moving means nothing moving; a group that is
 * only partly answered has not all passed and is not going, so it says neither.
 */
const rollup = (keys, marks) => {
  const had = keys.map((k) => marks[k]).filter(Boolean);
  if (!had.length) return "";
  if (had.includes("fail")) return "fail";
  if (had.includes("running")) return "running";
  return had.length === keys.length ? "pass" : "";
};

// THE DOCUMENT MARK. A plan is a document, and the one shape nobody has to be told is a page —
// so it is drawn as one: a leaf with a folded corner and ruled lines, the rules shortening at the
// fold the way text in a real page does. It carries the plan's own station as its tint, which is
// what lets a column of cards be scanned for "what is still a draft" without reading a word.
const DocMark = ({ station = "draft" }) => (
  <svg className={`pl__doc is-${station}`} viewBox="0 0 22 26" aria-hidden="true">
    <path
      className="pl__doc-leaf"
      d="M2.5 1.5h11l6 6v17a1 1 0 0 1-1 1h-16a1 1 0 0 1-1-1v-22a1 1 0 0 1 1-1z"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
    <path className="pl__doc-fold" d="M13.5 1.5v6h6" fill="none" strokeWidth="1.4" strokeLinejoin="round" />
    <g className="pl__doc-rule" strokeWidth="1.4" strokeLinecap="round">
      <path d="M6 11.5h6" />
      <path d="M6 15.5h10" />
      <path d="M6 19.5h10" />
    </g>
  </svg>
);

// A CLAIM IS `c`. The glyph drawn for it meant nothing — his: *"that symbol for claims don't mean
// nothing, we usually just put c in front of claims, we've been doing that."* Claim ids ARE `c1`,
// `c2` throughout; the letter is the system's own name for the kind and needs no learning.
const ClaimMark = () => <i className="pl__kind">c</i>;

const SAID = { pass: "passed", fail: "FAILED", running: "running now", "": "not run in this window" };

/**
 * THE SPEC MARK — the dot, saying these are specs and filling with how they last went. Hollow
 * until something runs them, then green, red, or filled and pulsing. Not a control: the triangle
 * beside it is, and it fills the same way.
 */
const SpecDot = ({ tone }) => <span className={`pl__dot${tone ? ` is-${tone}` : ""}`} aria-hidden="true" />;

/**
 * THE PLAY — the dot's behaviour, on the play's shape. THE SHAPE FILLS, not a box behind it: the
 * dot was a hollow ring that took a fill when it ran, and the first attempt at this moved that
 * onto the button's CONTAINER — a rounded rectangle that changed background and threw a halo —
 * which is a different thing wearing the same colours. There is no container. An outlined
 * triangle, hollow until something runs it, filled green or red by what happened, and taking the
 * accent on hover exactly as the ring did.
 */
const Play = ({ tone, title, onRun, onOpen }) => (
  <button
    type="button"
    className={`pl__play${tone ? ` is-${tone}` : ""}`}
    title={title}
    onClick={(e) => (e.shiftKey && onOpen ? onOpen() : onRun && onRun())}
  >
    {/* AN OUTLINE THAT FILLS — the dot's whole behaviour, on the play's shape. Drawn as a path
        rather than a CSS border-triangle because a border triangle cannot be hollow, and hollow
        is the half that carries the meaning: nothing has run this yet. */}
    <svg viewBox="0 0 18 18" aria-hidden="true">
      <path d="M5 3.4 14.6 9 5 14.6z" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  </button>
);

const PlanLedger = ({ className = "", plan, stoppers = [], marks = {}, onRun, onOpen, onClear }) => {
  // WHICH ROWS ARE OPEN. Several at once, deliberately: comparing two objectives' plans is the
  // reason to open either of them, and an accordion that shuts one to show another makes that the
  // one thing you cannot do.
  const [opened, setOpened] = useState({});
  const toggle = (id) => setOpened((o) => ({ ...o, [id]: !o[id] }));
  if (!plan || !plan.objectives) return null;
  const { arc, objectives, totals } = plan;
  const { claims = {} } = totals;

  // THE STOPPERS GO BACK ON THEIR ROWS. `stoppersOf` sorts them worst-first across the whole plan,
  // which is right for a summary and wrong for reading a list — so the order is kept within an
  // objective and the objectives stay in the document's own order. Nobody has to match an id
  // between two lists to find out why a row is stuck.
  const allTone = rollup(objectives.flatMap((o) => specsOf(o).map((sp) => sp.key)), marks);

  const because = new Map();
  stoppers.forEach((s) => because.set(s.id, [...(because.get(s.id) || []), s]));


  return (
    <div className={`pl ${className}`.trim()}>
      {/* THE HEADER IS A BLOCK, THE BODY IS A LIST. Two different jobs: the summary is the one
          thing read every time the document is opened, so it gets room; the rows are scanned, and
          an arc with twenty objectives turns any generosity there into a wall. */}
      <div className="pl__head">
        <div className="pl__headline">
          <span className="pl__pct">{totals.pct}%</span>
          <span className="pl__id">{arc ? arc.id : "plan"}</span>
          {/* THE ARC'S OWN STATION. It derives UPWARD the same way an objective does — approved is
              the decision with objectives unplanned, inProgress is every objective planned with a
              plan still moving, settled is every plan settled. The percent was on screen and the
              word it belongs to was not. */}
          {arc && arc.station ? <span className={`pl__station is-${arc.station}`}>{arc.station}</span> : null}
          {/* THE SAME CONTROL AS EVERY ROW. It was a filled pill twice the height of anything near
              it, saying the same thing in more space — his: *"this big ass dumb ass button is
              stupid and unnecessary, make them the same."* One control for "run these specs",
              wherever it appears, so its colour and its hover mean one thing everywhere. */}
          <span className={`pl__n${totals.specs ? "" : " is-none"}`} title={`${totals.specs} specs in this arc`}>
            <SpecDot tone={allTone} />
            {totals.specs}
          </span>
          {/* TAKE IT BACK OFF. Only offered once something has actually run — a clear with nothing
              to clear is a control that does nothing, which teaches you to stop reading it. */}
          {onClear && allTone ? (
            <button type="button" className="pl__clear" title="clear these results" onClick={onClear}>
              clear
            </button>
          ) : null}
          {arc && totals.specs ? (
            <Play
              tone={allTone}
              title={`run all ${totals.specs} specs in ${arc.id}, in the side panel\n${SAID[allTone || ""]}`}
              onRun={() => onRun && onRun({ kind: "arc", id: arc.id })}
            />
          ) : null}
        </div>
        <div className="pl__bar" aria-hidden="true">
          <i style={{ width: `${totals.pct}%` }} />
        </div>
        {/* SETTLED IS THE WORD. A bare `1/7 · 5/16` says two fractions and leaves the reader to
            guess what the numerator counts. Settled is what the system already calls a finished
            objective and a walked claim, so the label is the vocabulary rather than a new one. */}
        <div className="pl__meta">
          <span className="pl__meta-label">settled</span>
          <span>
            <b>{totals.complete}</b> of {totals.objectives} objectives
          </span>
          {claims.total ? (
            <span>
              <b>{claims.met}</b> of {claims.total} claims
            </span>
          ) : null}
          {totals.blocked ? <span className="is-warn">{totals.blocked} blocked</span> : null}
          {totals.unplanned ? <span className="is-warn">{totals.unplanned} with no plan</span> : null}
        </div>
      </div>

      <ul className="pl__rows">
        {objectives.map((o) => {
          const stops = because.get(o.id) || [];
          const open = !!opened[o.id];
          const specCount = specsOf(o).length;
          const specTone = rollup(specsOf(o).map((sp) => sp.key), marks);
          return (
            <li key={o.id} className={`pl__row is-${toneOf(o)}`}>
              <span className="pl__state">{wordOf(o)}</span>

              {/* THE LINE OPENS THE ROW — it does not navigate. What it shows is what this
                  objective is made of, in place. */}
              <button
                type="button"
                className="pl__title"
                aria-expanded={open}
                title={open ? "close" : o.plans.length ? `show the ${o.plans.length === 1 ? "plan" : `${o.plans.length} plans`} serving this` : "show the detail"}
                onClick={() => toggle(o.id)}
              >
                <span className="pl__row-id">{o.id}</span>
                <span className="pl__row-text">{o.title}</span>
                {o.owner ? <span className="pl__owner">{o.owner}</span> : null}
              </button>

              {/* A COUNT NEEDS A LABEL, NOT A SENTENCE. `2/6` named nothing; `2 of 6 claims` named
                  it and tripled the width of a row built to be scanned. The fraction was never the
                  problem — the missing noun was. So the noun goes in FRONT and stays short, and
                  where a glyph already means the thing it is used instead of a word: a plan is a
                  document, and the page mark says that without spending a column on it. */}
              <span
                className={`pl__n${o.plans.length ? "" : " is-none"}`}
                title={`${o.plans.length} ${o.plans.length === 1 ? "plan serves" : "plans serve"} this objective`}
              >
                <DocMark station={o.plans.length ? "approved" : "draft"} />
                {o.plans.length}
              </span>
              {/* A COUNT NEEDS ITS NOUN, AND A MARK IS A SHORTER NOUN THAN A WORD. `2 of 6 claims`
                  named it and tripled the width of a row built to be scanned; a bare `2/6` named
                  nothing. The glyph says which kind and the fraction stays a fraction. */}
              <span
                className={`pl__n${o.claims.total ? "" : " is-none"}`}
                title={`${o.claims.met} of ${o.claims.total} claims settled across every plan serving this objective`}
              >
                <ClaimMark />
                {o.claims.total ? `${o.claims.met}/${o.claims.total}` : "0"}
              </span>
              <span
                className={`pl__n${specCount ? "" : " is-none"}`}
                title={`${specCount} ${specCount === 1 ? "spec" : "specs"} across this objective's plans${specTone ? ` — last run: ${SAID[specTone]}` : ""}`}
              >
                <SpecDot tone={specTone} />
                {specCount}
              </span>
              {specCount ? (
                <Play
                  tone={specTone}
                  title={`run this objective's ${specCount} ${specCount === 1 ? "spec" : "specs"} in the side panel\n${SAID[specTone || ""]}`}
                  onRun={() => onRun && onRun({ kind: "objective", id: arc ? `${arc.id}-${o.id}` : o.id })}
                />
              ) : (
                <span className="pl__play-gap" />
              )}

              {open && o.plans.length ? (
                <ul className="pl__plans">
                  {o.plans.map((p) => {
                    const keys = (p.specRows || []).map((r) => r.key);
                    const ptone = rollup(keys, marks);
                    return (
                      <li key={p.id} className={`pl__plan${p.stale ? " is-stale" : ""}${ptone ? ` has-${ptone}` : ""}`}>
                        <button
                          type="button"
                          className="pl__plan-open"
                          title={`open ${p.id}${p.title ? ` — ${p.title}` : ""}`}
                          onClick={() => onOpen && onOpen({ project: p.project, path: p.path })}
                        >
                          <DocMark station={p.station || "draft"} />
                          <span className="pl__plan-id">{p.id}</span>
                          {p.title ? <span className="pl__plan-title">{p.title}</span> : null}
                        </button>
                        <span className={`pl__station is-${p.station || "draft"}`}>{p.station || "draft"}</span>
                        <span className="pl__gap" />
                        <span
                          className={`pl__n${p.total ? "" : " is-none"}`}
                          title={`${p.met} of ${p.total} claims settled in ${p.id}`}
                        >
                          <ClaimMark />
                          {p.total ? `${p.met}/${p.total}` : "0"}
                        </span>
                        <span
                          className={`pl__n${(p.specRows || []).length ? "" : " is-none"}`}
                          title={`${(p.specRows || []).length} in ${p.id}${ptone ? ` — last run: ${SAID[ptone]}` : ""}`}
                        >
                          <SpecDot tone={ptone} />
                          {(p.specRows || []).length}
                        </span>
                        {(p.specRows || []).length ? (
                          <Play
                            tone={ptone}
                            title={`run ${p.id} — ${p.specRows.length} ${p.specRows.length === 1 ? "spec" : "specs"}, in the side panel\n${SAID[ptone || ""]}\nshift-click to open the document`}
                            onRun={() => onRun && onRun({ kind: "document", id: p.id })}
                            onOpen={() => onOpen && onOpen({ project: p.project, path: p.path })}
                          />
                        ) : (
                          <span className="pl__play-gap" />
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : null}

              {/* THE REASON, IN THE SENTENCE IT WAS WRITTEN IN. It used to reach the screen only
                  as a `title=` hover on a ten-pixel word, which is the same as not reaching it. */}
              {stops.length ? (
                <ul className="pl__why">
                  {stops.map((s, i) => (
                    <li key={i} className={`is-${s.kind}`}>
                      {s.text}
                      {s.to ? <span className="pl__to">{s.to}</span> : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default PlanLedger;
