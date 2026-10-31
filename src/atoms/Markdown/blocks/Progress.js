import React, { useEffect, useMemo, useRef, useState } from "react";
import { useDocMembers } from "../context";
import { getAgent } from "../../../utils/hub";
import { parseArc } from "../objectives";
import { planOf, stoppersOf } from "../arcPlan";
import { openAddress } from "../openRef";
import PlanLedger from "../../PlanLedger/PlanLedger";
import { askProofs, clear as clearMarks, subscribe } from "../../../utils/proofsBus";

// RFC-072 §5 — `::progress`. WHERE THE PLAN IS, AND WHAT IS STOPPING IT.
//
// The timeline rows this once drew are still gone — the ledger says the same thing in its order
// column, and only when `needs=` really ordered something. The spec MAP that replaced them is
// gone too, and his verdict is why: *"It looks cool, maybe, but it's not really helpful. Figure
// out something visual that allows you to see the entire plan's progress."* What is in its place
// is `atoms/PlanLedger`, and the reasoning for the shape lives in that file.
//
// THIS BLOCK IS NOW A WIRE AND NOTHING ELSE. It used to compute a percent off `progressOf` for its
// own header while handing the diagram a second, differently-derived count — `1/7 done · 14%` two
// hundred pixels from chips summing `5/16 · 31%`. There is one composition now, `arcPlan.planOf`,
// and every number on the surface is a field of it.
//
// The objectives and their order are this document's own parse (recounted every render — no
// stored total anywhere); the attached RFCs, their claims and their spec inventory are the
// REGISTRY's — the shell's parse of those other documents.

/**
 * Every rfc row serving this arc, keyed by the objective suffix of its address — and RE-READ on an
 * interval while the block is mounted. The map claims to show state; a mount-only read showed a
 * photograph (measured 2026-10-28: a claim landing while the arc was open moved nothing until a
 * tab flip remounted the block).
 */
const REREAD_MS = 10000;
function useAttachedPlans(arcId, projectCode) {
  const [plans, setPlans] = useState({ byObj: new Map(), arcRow: null });
  useEffect(() => {
    let dead = false;
    const agent = getAgent();
    if (!agent || !agent.documentsRegistry || !arcId) return undefined;
    const read = () =>
      Promise.all([
        Promise.resolve(agent.documentsRegistry({ projectCode: projectCode || undefined, kind: "rfc" })).catch(() => []),
        Promise.resolve(agent.documentsRegistry({ projectCode: projectCode || undefined, kind: "arc" })).catch(() => []),
      ]).then(([rfcs, arcs]) => {
        if (dead) return;
        const byObj = new Map();
        (rfcs || []).forEach((r) => {
          const addr = String(r.arc || "");
          if (!addr.startsWith(`${arcId}-`)) return;
          const obj = addr.slice(arcId.length + 1);
          byObj.set(obj, [...(byObj.get(obj) || []), r]);
        });
        const arcRow = (arcs || []).find((r) => r.id === arcId) || null;
        setPlans({ byObj, arcRow });
      });
    read();
    const t = setInterval(read, REREAD_MS);
    return () => {
      dead = true;
      clearInterval(t);
    };
  }, [arcId, projectCode]);
  return plans;
}

const Progress = ({ attrs = {} }) => {
  const { source = "", projectCode = "" } = useDocMembers() || {};
  const src = String(source || "");
  const arc = parseArc(src);
  const { byObj, arcRow } = useAttachedPlans(arc && arc.id, projectCode);
  const rootRef = useRef(null);

  // ONE COMPOSITION, read three times — the header's percent, the bar's segments and every row's
  // fill are the same object. Recomputed when the document or the registry moves, and not per
  // render: it walks every objective and every attached plan.
  const plan = useMemo(() => planOf(src, { byObj, arcRow }), [src, byObj, arcRow]);
  const stoppers = useMemo(() => stoppersOf(plan), [plan]);

  // WHAT EACH SPEC IS DOING, from the one place that knows. The bus fires immediately on
  // subscribe, so a document opened after a run shows that run's results rather than a blank
  // ledger — the same reason the proofs panel subscribes instead of asking.
  const [marks, setMarks] = useState({});
  useEffect(() => subscribe((s) => setMarks(s.marks || {})), []);

  // NOTHING IS PRE-LOADED HERE. The rule is the simple one the system already had: a document
  // loads its own tests, and the press collects and runs. Loading an arc's documents ahead of the
  // press added a second thing that could be showing when you looked, and it bought nothing — the
  // press collects and runs in a blink either way.

  // The ledger is the normal case. `rows=off` leaves the summary alone, for the top of a long arc
  // or a report that wants to say how far along something is without pulling in the picture.
  const wantLedger = String(attrs.rows || "") !== "off";

  // A document with no objectives says so. A bar at 0/0 reading 100% complete is the kind of
  // cheerful lie this system refuses everywhere else.
  if (!plan.totals.objectives)
    return <div className="md-progress md-progress--empty">no objectives in this document yet</div>;

  // `rows=off` — the one number and the bar, nothing else. Still off the same composition, so the
  // short form and the long form cannot disagree either.
  if (!wantLedger)
    return (
      <div className="md-progress" ref={rootRef}>
        <div className="md-progress__label">Progress</div>
        <div className="md-progress__head">
          <span className="md-progress__count">
            {plan.totals.complete}/{plan.totals.objectives} done
          </span>
          {plan.totals.doing ? <span className="md-progress__tag">{plan.totals.doing} in progress</span> : null}
          {plan.totals.blocked ? (
            <span className="md-progress__tag md-progress__tag--blocked">{plan.totals.blocked} blocked</span>
          ) : null}
          <span className="md-progress__pct">{plan.totals.pct}%</span>
        </div>
        <div className="md-progress__bar" aria-hidden="true">
          <i style={{ width: `${plan.totals.pct}%` }} />
        </div>
        {/* WHO HAS WHAT — only in the short form. The ledger carries an owner on every row, which
            is the same answer with the objectives still attached to it, so printing the roll-up
            under it would be the tally twice. */}
        {attrs.by === "owner" || attrs.by === undefined ? (
          <ul className="md-progress__owners">
            {plan.totals.byOwner.map((r) => (
              <li key={r.owner} className={r.owner === "unowned" ? "is-unowned" : ""}>
                <span className="md-progress__owner">{r.owner}</span>
                <span className="md-progress__owner-count">
                  {r.done}/{r.total}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );

  return (
    // ONE FRAME, NOT TWO. The ledger carried its own card and this block already had one, so it
    // rendered as a box inside a box. The block is the surface; the ledger sits on it.
    <div className="md-progress md-progress--ledger" ref={rootRef}>
      <div className="md-progress__label">Progress</div>
      <PlanLedger
        className="md-progress__ledger"
        plan={plan}
        stoppers={stoppers}
        marks={marks}
        // RUN — this does NOT run anything. It collects the scope into the side panel and asks the
        // panel's own ▶ Run all to drive it, card by card, in the page. The specs a document shows
        // are the specs that panel already lists, so running them from here was never an extra
        // feat: *"the system can already pull up all tests and run them."* The dots below light one
        // at a time because they read the marks those cards write as they go.
        onRun={(target) => askProofs(projectCode, target)}
        onClear={clearMarks}
        // "open the document" — the one opener every reference chip rides (openRef.js)
        onOpen={(where) =>
          where && where.path
            ? openAddress({
                projectCode: where.project || projectCode,
                path: where.path,
                language: "markdown",
                lines: where.line ? [where.line, where.end || where.line] : undefined,
              })
            : undefined
        }
      />
    </div>
  );
};

export default Progress;
