import React, { useEffect, useMemo, useRef, useState } from "react";
import { useDocMembers } from "../context";
import { getAgent } from "../../../utils/hub";
import { parseArc } from "../objectives";
import { planOf, stoppersOf } from "../arcPlan";
import { openAddress } from "../openRef";
import PlanLedger from "../../PlanLedger/PlanLedger";
import { askProofs, subscribe } from "../../../utils/proofsBus";

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
    <div className="md-progress" ref={rootRef}>
      <div className="md-progress__label">Progress</div>
      <PlanLedger
        className="md-progress__ledger"
        plan={plan}
        stoppers={stoppers}
        marks={marks}
        // RUN — the same three scopes the map's menu offered, landing on the hub's three scopes
        // unchanged (`proofsBus.scopeOf`). What changed is that they are controls you can see
        // rather than a menu you had to summon, and that the run now SAYS SO while it happens:
        // the bus walks the scope a document at a time and marks each spec as it goes.
        //
        // IT STILL GOES THROUGH THE BUS, by design. The run belongs in the Proofs tab as well —
        // "you can go back and open it if you want and see if anything goes wrong, from wherever
        // you ran it" — so this asks and the panel answers, and both read the same marks.
        onRun={(target) => askProofs(projectCode, target)}
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
        // "jump to its block" — the objectives live in THIS document; the ledger is its index
        onJump={(id) => {
          const root = (rootRef.current && rootRef.current.closest(".markdown")) || document;
          const hit = [...root.querySelectorAll(".md-objective__id")].find((el) => el.textContent.trim() === id);
          if (hit) hit.closest(".md-objective").scrollIntoView({ behavior: "smooth", block: "center" });
        }}
      />
    </div>
  );
};

export default Progress;
