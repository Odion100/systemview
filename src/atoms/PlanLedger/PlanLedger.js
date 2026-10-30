import React from "react";
import { rollupOf, tallyOf } from "../../utils/specRun";
import "./styles.scss";

// THE PLAN LEDGER — where this plan is, and what is stopping it, in one screenful.
//
// WHAT IT REPLACES AND WHY. `SpecMap` drew the arc fanning into its objectives fanning into their
// plans. His verdict on it is the brief: *"It looks cool, maybe, but it's not really helpful.
// Figure out something visual that allows you to see the entire plan's progress."* Measured on the
// live MOCK-ARC fixture, what it actually cost:
//
//   - TWO PROGRESS NUMBERS THAT NEVER MET. The header counted objectives (`1/7 done · 14%`), the
//     chips summed claims (`5/16 · 31%`), two hundred pixels apart, and nothing reconciled them.
//   - 720 × 650 PIXELS for seven state words and six chips, because at 240px columns a document
//     pane fits three, so seven objectives wrapped into three rows and the whole drawing grew
//     downward faster than a list of the same seven would have.
//   - EVERY EDGE WAS INFORMATION-FREE. arc→objective→plan is the identical shape for every arc
//     that will ever exist, so the geometry carried no fact. Meanwhile `timelineOf` had been
//     computing REAL dependency order and per-objective `blockedBy` since RFC-072, and nothing but
//     its own test file ever read it.
//   - THE `blocked=` REASON — the one thing he asked to see — reached the screen as a `title=`
//     hover on a ten-pixel state word.
//
// WHAT IS KEPT. The three run scopes (arc, objective, plan) land on the hub's three scopes
// unchanged, exactly as the map's menu did — no new vocabulary, because the old one was right.
// The station chips, the claims-beside-specs distinction, and the state colour tokens are the
// page's own and are carried over verbatim. What is dropped is the fan: the geometry, the menu,
// and the wrapping.
//
// THE SHAPE INSTEAD. Rows, because an objective is a line of facts and a line is what reads at a
// glance; one segmented bar above them, because the plan has a SHAPE and a single percentage hides
// it; and the stoppers lifted out of the rows and said first, because "where is it" and "what is
// stopping it" are two questions and only the second one is actionable.
//
//   plan       — `arcPlan.planOf(source, { byObj, arcRow })`, whole. ONE composition: the header's
//                percent, the bar's segments and every row's fill are the same field read three
//                times, which is the only way two numbers can be stopped from disagreeing.
//   stoppers   — `arcPlan.stoppersOf(plan)`
//   marks      — `{ [specKey]: "queued"|"running"|"pass"|"fail" }` off `utils/proofsBus`. The SAME
//                map the proofs panel's cards read, which is what makes the two surfaces agree by
//                construction rather than by being kept in step.
//   onRun({ kind, id })  — the runner; the promise is not awaited here because the marks say more
//                          than a spinner can.
//   onOpen({ project, path, line })  — open a document, optionally at a line
//   onJump(id) — scroll to an objective's own block in the document this ledger indexes

const pctOf = (f) => `${Math.round((f || 0) * 100)}%`;

// The written state is `doing`; the surface says `progress` (his call, 2026-10-28) — a display
// word, never a second state. `ready` is not a state either: it is the derived frontier, every
// claim met and nobody has pressed done, and it earns a word because it is the row to act on.
const wordOf = (o) => {
  if (o.cycle) return "cycle";
  if (o.state === "doing") return "progress";
  if (o.ready) return "ready";
  return o.state || "open";
};
const toneOf = (o) => (o.cycle ? "cycle" : o.ready && o.state !== "done" ? "ready" : o.state || "open");

/** One spec, as a dot that is also its own run button. Title says which spec and what it did. */
const Dot = ({ spec, status, onRun, onOpen }) => (
  <button
    type="button"
    className={`sv-ledger__dot${status ? ` is-${status}` : ""}`}
    title={`${spec.name}${spec.claim ? ` — defends ${spec.claim}` : ""}\n${
      status === "pass" ? "passed" : status === "fail" ? "FAILED" : status === "running" ? "running now" : status === "queued" ? "queued" : "not run in this window"
    }\nclick to run it · shift-click to open the block`}
    onClick={(e) => (e.shiftKey ? onOpen && onOpen(spec) : onRun && onRun(spec))}
  >
    <span className="sv-ledger__dot-ink" />
  </button>
);

/** The ▶ that runs a scope, wearing the state of everything under it. */
const RunBtn = ({ label, state, onClick, title }) => (
  <button
    type="button"
    className={`sv-ledger__run${state ? ` is-${state}` : ""}`}
    title={title}
    onClick={onClick}
    disabled={!onClick || state === "running" || state === "queued"}
  >
    {/* THE CONTROL NEVER CHANGES SIZE. `queued` used to render a bare "·" and the button
        collapsed to a sliver — a control that shrinks the moment a run reaches it. The state is
        in the ring and the colour; the glyph only changes for the one that is actually moving. */}
    {state === "running" ? "⟳" : "▶"}
    {label ? <span className="sv-ledger__run-label">{label}</span> : null}
  </button>
);

const PlanLedger = ({ plan, stoppers = [], marks = {}, onRun, onOpen, onJump, className = "" }) => {
  const { arc, objectives = [], totals = {} } = plan || {};
  const [open, setOpen] = React.useState(() => new Set());
  const toggle = (id) =>
    setOpen((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // EVERY SPEC KEY IN THE PLAN, grouped the three ways a run can be scoped — so a control's live
  // state is the rollup of exactly what pressing it would run, and never an approximation.
  const keysOfPlan = (p) => (p.specRows || []).map((s) => s.key).filter(Boolean);
  const keysOfObj = (o) => (o.plans || []).flatMap(keysOfPlan);
  const allKeys = [...((arc && arc.specRows) || []).map((s) => s.key).filter(Boolean), ...objectives.flatMap(keysOfObj)];
  const tally = tallyOf(Object.fromEntries(allKeys.filter((k) => marks[k]).map((k) => [k, marks[k]])));

  const runSpec = (spec, planId) => onRun && onRun({ kind: "plan", id: planId, spec });
  const openSpec = (spec, p) => onOpen && onOpen({ project: p.project, path: p.path, line: spec.line, end: spec.end });

  if (!objectives.length)
    return <div className={`sv-ledger sv-ledger--empty${className ? ` ${className}` : ""}`}>no objectives in this document yet</div>;

  return (
    <div className={`sv-ledger${className ? ` ${className}` : ""}`}>
      {/* ── THE ONE NUMBER ───────────────────────────────────────────────────────────────────
          It is `totals.pct` and nothing else computes a percent anywhere on this surface. The
          bar below is the same value spread over its segments, and each row's fill is the
          segment it contributed. Two numbers cannot disagree when there is one. */}
      <div className="sv-ledger__head">
        <div className="sv-ledger__ident">
          <span className="sv-ledger__kind">arc</span>
          <code>{(arc && arc.id) || "this plan"}</code>
          {arc && arc.station ? (
            <span className={`sv-ledger__station is-${arc.station}`}>{arc.station === "inProgress" ? "in progress" : arc.station}</span>
          ) : null}
          {arc && arc.title ? <span className="sv-ledger__arctitle">{arc.title}</span> : null}
        </div>
        <div className="sv-ledger__figure">
          <b>{totals.pct}%</b>
          <span>of the plan</span>
        </div>
        <RunBtn
          label={`run ${totals.specs} spec${totals.specs === 1 ? "" : "s"}`}
          state={rollupOf(allKeys, marks)}
          title="run every spec in this arc and its plans"
          onClick={onRun && arc ? () => onRun({ kind: "arc", id: arc.id }) : undefined}
        />
      </div>

      <div className="sv-ledger__facts">
        <span>
          <b>{totals.objectives}</b> objectives
        </span>
        <span className="is-done">
          <b>{totals.complete}</b> done
        </span>
        {totals.doing ? (
          <span className="is-doing">
            <b>{totals.doing}</b> in progress
          </span>
        ) : null}
        {totals.ready ? (
          <span className="is-ready" title="every claim met and nobody has marked it done — the frontier">
            <b>{totals.ready}</b> ready
          </span>
        ) : null}
        {totals.blocked ? (
          <span className="is-blocked">
            <b>{totals.blocked}</b> blocked
          </span>
        ) : null}
        {totals.unplanned ? (
          <span className="is-unplanned" title="an objective with no plan attached is incomplete, not empty">
            <b>{totals.unplanned}</b> unplanned
          </span>
        ) : null}
        <span className="sv-ledger__facts-gap" />
        <span title="claims agreed and checked, summed over every plan in this arc">
          <b>
            {(totals.claims || {}).met}/{(totals.claims || {}).total}
          </b>{" "}
          claims
        </span>
        {/* SPECS ARE NOT CLAIMS, and the two were being conflated into one number. A claim is what
            was agreed and checked once; a spec is what re-runs and can go red on its own. */}
        <span title="specs collected under this arc — what re-runs">
          <b>{totals.specs}</b> specs
        </span>
        {tally.total ? (
          <span className="sv-ledger__tally">
            {tally.pass ? <i className="is-pass">✓ {tally.pass}</i> : null}
            {tally.fail ? <i className="is-fail">✗ {tally.fail}</i> : null}
            {tally.running ? <i className="is-running">⟳ {tally.running}</i> : null}
            {tally.queued ? <i className="is-queued">· {tally.queued} queued</i> : null}
          </span>
        ) : null}
      </div>

      {/* ── THE PLAN AS ONE OBJECT ───────────────────────────────────────────────────────────
          One segment per objective, each filled by its own claims. A single percentage says how
          far; this says WHERE — which chunks are finished, which are empty, and that an unplanned
          objective is a gap in the plan rather than a thing that is simply absent from it. */}
      <div className="sv-ledger__bar">
        {objectives.map((o) => (
          <button
            type="button"
            key={o.id}
            className={`sv-ledger__seg is-${toneOf(o)}${o.unplanned ? " is-unplanned" : ""}`}
            title={`${o.id} — ${o.title || "untitled"}\n${wordOf(o)} · ${
              o.unplanned ? "no plan attached" : o.claims.total ? `${o.claims.met}/${o.claims.total} claims` : "nothing claimed yet"
            }`}
            onClick={() => onJump && onJump(o.id)}
          >
            <i style={{ width: pctOf(o.fraction) }} />
          </button>
        ))}
      </div>

      {/* ── WHAT IS STOPPING IT ──────────────────────────────────────────────────────────────
          Said in sentences, worst first, where it can be read. The `blocked=` reason used to be a
          `title=` hover on a ten-pixel word; a dependency that could not be resolved was not on
          the screen at all. Nothing here when nothing is stuck — an empty strip reading "nothing
          is blocked" is furniture. */}
      {stoppers.length ? (
        <div className="sv-ledger__stoppers">
          <div className="sv-ledger__stoppers-head">
            what is stopping it <b>{stoppers.length}</b>
          </div>
          <ul>
            {stoppers.map((s, i) => (
              <li key={`${s.id}-${i}`} className={`is-${s.kind}`}>
                <button type="button" className="sv-ledger__stopper-at" onClick={() => onJump && onJump(s.id)} title={`jump to ${s.id}`}>
                  {s.id}
                </button>
                <span className="sv-ledger__stopper-kind">{s.kind}</span>
                <span className="sv-ledger__stopper-text">{s.text}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* ── A ROW PER OBJECTIVE ──────────────────────────────────────────────────────────────
          The order column appears only when `needs=` really ordered something. Most arcs declare
          none — MOCK-ARC has none — and a column of 1s would imply a sequence nobody wrote. */}
      <ul className="sv-ledger__rows">
        {objectives.map((o) => {
          const keys = keysOfObj(o);
          const state = rollupOf(keys, marks);
          const isOpen = open.has(o.id);
          return (
            <li key={o.id} className={`sv-ledger__row${isOpen ? " is-open" : ""}`}>
              <div className="sv-ledger__line">
                <button
                  type="button"
                  className="sv-ledger__fold"
                  onClick={() => toggle(o.id)}
                  title={o.plans.length ? `${o.plans.length} plan${o.plans.length === 1 ? "" : "s"}` : "no plan attached"}
                  disabled={!o.plans.length}
                >
                  {o.plans.length ? (isOpen ? "▾" : "▸") : "·"}
                </button>
                {totals.ordered ? (
                  <span className="sv-ledger__rank" title={`dependency depth ${o.rank} — nothing above it can start later`}>
                    {o.rank}
                  </span>
                ) : null}
                <button type="button" className="sv-ledger__id" onClick={() => onJump && onJump(o.id)} title={`jump to ${o.id}`}>
                  {o.id}
                </button>
                <span className={`sv-ledger__state is-${toneOf(o)}`}>{wordOf(o)}</span>
                <span className="sv-ledger__title">{o.title || <i>untitled</i>}</span>
                {o.owner ? <span className="sv-ledger__owner">{o.owner}</span> : <span className="sv-ledger__owner is-unowned">unowned</span>}
                <span className="sv-ledger__mini" title={o.claims.total ? `${o.claims.met}/${o.claims.total} claims met` : "nothing claimed yet"}>
                  <i style={{ width: pctOf(o.fraction) }} />
                </span>
                <span className="sv-ledger__claims">
                  {o.unplanned ? <em>no plan</em> : o.claims.total ? `${o.claims.met}/${o.claims.total}` : <em>unclaimed</em>}
                </span>
                {/* THE SPECS OF THIS OBJECTIVE, one dot each, lit by the run. A dot is what makes
                    the run visible without opening anything: six dots going amber then green left
                    to right is the run, drawn. */}
                <span className="sv-ledger__dots">
                  {o.plans.flatMap((p) => (p.specRows || []).map((s) => <Dot key={s.key} spec={s} status={marks[s.key]} onRun={() => runSpec(s, p.id)} onOpen={() => openSpec(s, p)} />))}
                </span>
                <RunBtn state={state} title={`run every spec under ${o.id}`} onClick={onRun && keys.length ? () => onRun({ kind: "objective", id: o.id }) : undefined} />
              </div>

              {/* THE REASON, IN THE ROW. Not a hover, and not only in the strip above — the strip
                  answers "what is stopping the plan", this answers "what is stopping THIS", and a
                  reader scanning rows should not have to look back up. */}
              {o.state === "blocked" || o.cycle || (o.waits || []).length ? (
                <div className="sv-ledger__why">
                  {o.cycle ? <span className="is-cycle">in a dependency cycle</span> : null}
                  {o.state === "blocked" ? <span className="is-blocked">{o.because || "marked blocked, with no reason written down"}</span> : null}
                  {(o.waits || []).map((w, i) => (
                    <span key={i} className={`is-${w.kind}`}>
                      {w.to ? (
                        <button type="button" className="sv-ledger__waitlink" onClick={() => onJump && onJump(w.to)}>
                          {w.text}
                        </button>
                      ) : (
                        w.text
                      )}
                    </span>
                  ))}
                </div>
              ) : null}

              {isOpen ? (
                <ul className="sv-ledger__plans">
                  {o.plans.map((p) => (
                    <li key={p.id}>
                      <button type="button" className="sv-ledger__plan-id" onClick={() => onOpen && onOpen({ project: p.project, path: p.path })} title={`open ${p.id}`}>
                        {p.id}
                      </button>
                      <span className={`sv-ledger__station is-${p.station || "draft"}`}>{p.station === "inProgress" ? "in progress" : p.station || "draft"}</span>
                      {p.stale ? <span className="sv-ledger__stale" title="edited since the last parse — this inventory may be behind">stale</span> : null}
                      <span className="sv-ledger__plan-claims">{p.total ? `claims ${p.met}/${p.total}` : "no claims yet"}</span>
                      <span className="sv-ledger__dots">
                        {(p.specRows || []).map((s) => (
                          <Dot key={s.key} spec={s} status={marks[s.key]} onRun={() => runSpec(s, p.id)} onOpen={() => openSpec(s, p)} />
                        ))}
                      </span>
                      <RunBtn state={rollupOf(keysOfPlan(p), marks)} title={`run ${p.id}'s specs`} onClick={onRun ? () => onRun({ kind: "plan", id: p.id }) : undefined} />
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>

      {arc && (arc.specRows || []).length ? (
        <div className="sv-ledger__own">
          <span>the arc's own specs</span>
          <span className="sv-ledger__dots">
            {arc.specRows.map((s) => (
              <Dot key={s.key} spec={s} status={marks[s.key]} onRun={() => onRun && onRun({ kind: "plan", id: arc.id, spec: s })} onOpen={() => onOpen && onOpen({ project: arc.project, path: arc.path, line: s.line, end: s.end })} />
            ))}
          </span>
        </div>
      ) : null}
    </div>
  );
};

export default PlanLedger;
