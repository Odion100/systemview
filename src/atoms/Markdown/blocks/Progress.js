import React, { useEffect, useRef, useState } from "react";
import { useDocMembers } from "../context";
import { getAgent } from "../../../utils/hub";
import { progressOf, parseArc } from "../objectives";
import { stateOf } from "./lifecycleState";
import { openAddress } from "../openRef";
import SpecMap from "../../SpecMap/SpecMap";
import { askProofs } from "../../../utils/proofsBus";

// RFC-072 §5 — `::progress`. WHERE THE ARC IS: how many are done, by whom — and, under the bar,
// THE WHOLE SPEC AS ONE PICTURE (his call, 2026-10-28): the arc fanning into its objectives, each
// objective fanning into the RFCs attached to it by address (`arc=ARC-004-O2` on the plan's own
// leaf). The timeline rows this used to draw are gone — the map says the same thing spatially.
//
// The objectives and their order are this document's own parse (recounted every render — no
// stored total anywhere); the attached RFCs and their claims are the REGISTRY's — the shell's
// parse of those other documents.
//
// NO PERCENTAGE OF A HALF-FINISHED OBJECTIVE. An objective that is partly done is two objectives
// nobody has split yet, so `doing` is its own count rather than a half-filled bar — the honest
// shape of "we have started it" is not 50%.

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
  const p = progressOf(src);
  const arc = parseArc(src);
  const { byObj, arcRow } = useAttachedPlans(arc && arc.id, projectCode);
  const rootRef = useRef(null);
  const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
  // The map is the normal case. `rows=off` leaves the summary alone, for the top of a long arc
  // or a report that wants to say how far along something is without pulling in the picture.
  const wantMap = String(attrs.rows || "") !== "off";

  // A document with no objectives says so. A bar at 0/0 reading 100% complete is the kind of
  // cheerful lie this system refuses everywhere else.
  if (!p.total) return <div className="md-progress md-progress--empty">no objectives in this document yet</div>;

  return (
    <div className="md-progress" ref={rootRef}>
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

      {wantMap && arc ? (
        <SpecMap
          className="md-progress__map"
          arc={{
            id: arc.id,
            station: arcRow ? stateOf("arc", arcRow) : undefined,
          }}
          objectives={p.objectives.map((o) => {
            const rows = byObj.get(o.id) || [];
            const claims = rows.reduce(
              (acc, r) => {
                const c = (r.state || {}).claims || {};
                return { met: acc.met + (c.met || 0), total: acc.total + (c.total || 0) };
              },
              { met: 0, total: 0 }
            );
            // HOW MANY SPECS SIT UNDER THIS OBJECTIVE — free, because the registry row already
            // carries each document's inventory. His ask: "this presentation should be able to see
            // how many tests you got." The claims count answers "how much is agreed and checked";
            // this answers "how much of it is defended by something that re-runs", and they are
            // different questions that were being conflated into one number.
            const specs = rows.reduce((n, r) => n + ((r.specs || []).length), 0);
            return {
              id: o.id,
              label: o.title || "",
              specs,
              // the objective's own written state, and the reason when that state is blocked
              state: o.state,
              because: o.because,
              // the count is the CLAIMS — summed off the RFCs this objective points at
              count: claims.total ? `${claims.met}/${claims.total}` : "—",
              plans: rows.map((r) => {
                const c = (r.state || {}).claims || {};
                return {
                  id: r.id,
                  station: stateOf("rfc", r),
                  specs: (r.specs || []).length,
                  met: c.met || 0,
                  total: c.total || 0,
                  project: r.project,
                  path: r.path,
                  title: `${r.id} — settles in its own document`,
                };
              }),
            };
          })}
          // "open the document" — the one opener every reference chip rides (openRef.js)
          onOpen={(plan) =>
            plan.path
              ? openAddress({ projectCode: plan.project || projectCode, path: plan.path, language: "markdown" })
              : undefined
          }
          // RUN THE SPECS — from the DIAGRAM, not the bar (his call: "not the progress bar — the
          // visual diagram, from where you initiate the test. It has a click menu: you can run the
          // entire spec, you can run objectives level, or you could just run from the RFC").
          //
          // The three menu scopes land on the hub's three scopes unchanged, which is why the menu
          // needed no new vocabulary: an arc runs its own document plus every plan under it, an
          // objective runs the plans pointed at that objective, a plan runs its own document.
          //
          // IT GOES THROUGH THE PANEL, by event. The run itself belongs in the Proofs tab — "you
          // can go back and open it if you want and see if anything goes wrong, from wherever you
          // ran it" — so the diagram asks and the panel answers, and there is one place results
          // live however they were started. The promise is what the node's `is-running` border
          // waits on, so it resolves when the RUN does and not when the event is dispatched.
          onRun={(target) => askProofs(projectCode, target)}
          // "jump to its block" — the objectives live in THIS document; the map is its index
          onJump={(o) => {
            const root = (rootRef.current && rootRef.current.closest(".markdown")) || document;
            const hit = [...root.querySelectorAll(".md-objective__id")].find(
              (el) => el.textContent.trim() === o.id
            );
            if (hit) hit.closest(".md-objective").scrollIntoView({ behavior: "smooth", block: "center" });
          }}
        />
      ) : null}
    </div>
  );
};

export default Progress;
