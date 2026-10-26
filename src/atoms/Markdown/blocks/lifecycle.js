import React, { useEffect, useState } from "react";
import { getAgent } from "../../../utils/hub";
import { useDocMembers } from "../context";

// RFC-075 §2 (his, folded at execution): *"the blocks for RFC and reports are literally just
// labels — make the interactive component about the LIFE CYCLE of the document."*
//
// The registration leaf stops being a bare label: it renders its kind's lifecycle with the
// document's CURRENT state lit, read from the registry's derived state — the one place that state
// already lives (RFC-073: the shell's parse derives it, nothing else writes it). No new state
// machinery, no press: this is a READ, and like every surface here it never testifies — a document
// with no registry row shows no trail at all, because absence stated beats a trail invented.

// What each kind can be, in the order it becomes them. These are the registry's own derivations
// (blocks.cjs deriveState) given their reading names — not a parallel state machine.
export const TRAILS = {
  // SETTLED (his, round two): built means landed AND still moving — reviewed, amended, proofs
  // pressed. Settled is when the modification stops because nothing is left to modify; retired is
  // the document leaving active service. A declaration (`settled=` on the leaf), never derived.
  rfc: ["draft", "approved", "built", "settled", "retired"],
  arc: ["open", "done", "retired"],
  gap: ["open", "resolved", "retired"],
  // A report is never done — it is a view, it only gets old (LIFECYCLE table). Two stations.
  report: ["filed", "retired"],
};

/** The one state a registry row is in, in its kind's vocabulary. */
export function stateOf(kind, row) {
  const st = (row && row.state) || {};
  if (st.retired) return "retired";
  if (kind === "rfc") {
    if (st.settled) return "settled";
    if (st.built) return "built";
    const v = String(st.verdict || "").toLowerCase();
    if (v === "rejected") return "rejected";
    return v ? "approved" : "draft";
  }
  if (kind === "arc") return st.done ? "done" : "open";
  if (kind === "gap") return st.done ? "resolved" : "open";
  return "filed";
}

// The row for THIS document, by identity — the id is the address everything points at. Read once
// per mount; the registry is the shell's and a leaf has no business polling it.
export function useRegistryRow(kind, id) {
  const { projectCode = "" } = useDocMembers() || {};
  const [row, setRow] = useState(null);
  useEffect(() => {
    let dead = false;
    const agent = getAgent();
    if (!agent || !agent.documentsRegistry || !id) return undefined;
    Promise.resolve(agent.documentsRegistry({ projectCode: projectCode || undefined, kind }))
      .then((rows) => {
        if (dead) return;
        setRow((rows || []).find((r) => r.id === id) || null);
      })
      .catch(() => {});
    return () => {
      dead = true;
    };
  }, [kind, id, projectCode]);
  return row;
}

// The trail itself: every station the kind passes through, the current one lit. A rejected RFC
// shows its real ending — the trail is draft → rejected, because approved/built are stations it
// will never reach and drawing them would read as "still coming".
export const LifecycleTrail = ({ kind, id }) => {
  const row = useRegistryRow(kind, id);
  if (!row) return null; // unregistered, or an older hub — the leaf stays the label it was
  const current = stateOf(kind, row);
  const steps = current === "rejected" ? ["draft", "rejected"] : TRAILS[kind] || [];
  const reached = steps.indexOf(current);
  return (
    <span className="md-arc__life" title={`the registry's derived state — parse, never testimony`}>
      {steps.map((s, i) => (
        <span
          key={s}
          className={`md-arc__station${i === reached ? " md-arc__station--now" : ""}${
            i < reached ? " md-arc__station--past" : ""
          }${s === "rejected" && i === reached ? " md-arc__station--dead" : ""}`}
        >
          {s === "done" && row.state && row.state.objectives && i === reached
            ? `done ${row.state.objectives.done}/${row.state.objectives.total}`
            : s}
        </span>
      ))}
    </span>
  );
};

export default LifecycleTrail;
