import React from "react";
import LifecycleTrail from "./lifecycle";

// RFC-073 §1.2 — `::gap{id=G-12}` at the top of a document.
//
// A GAP IS A MESSAGE FROM OUTSIDE. It is written INTO ANOTHER PROJECT'S repo by the agent who hit
// it there — a bug, or a feature that project is missing, found while doing work that needed it.
// Not the owner's own note (that is the board); it is filed where the fix lives, for that project's
// owner to pick up. The body may be one line: a gap needs only its leaf and its completion.
//
// `resolved=` is that completion — what DONE means for this kind (§1.4) — and it is the one state
// this leaf shows, because a reader opening a gap needs exactly one answer: is this still open.
const Gap = ({ attrs = {} }) => (
  <div className="md-arc md-gap">
    <span className="md-arc__kind">gap</span>
    <span className="md-arc__id">{attrs.id || "gap"}</span>
    {attrs.title ? <span className="md-arc__title">{attrs.title}</span> : null}
    {attrs.resolved ? (
      <span className="md-arc__relation md-gap__resolved" title={`resolved ${attrs.resolved}`}>
        resolved
      </span>
    ) : null}
    {/* RFC-075 — the lifecycle, from the registry: open → resolved → retired. */}
    <LifecycleTrail kind="gap" id={attrs.id} />
  </div>
);

export default Gap;
