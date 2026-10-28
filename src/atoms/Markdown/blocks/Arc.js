import React from "react";
import { arcProgress } from "../objectives";
import { useDocMembers } from "../context";
import LifecycleTrail from "./lifecycle";

// RFC-072 §4 — `::arc{id=ARC-004 owner=systemview-test title=…}` at the top of a document.
//
// IT MAKES THE DOCUMENT SELF-DESCRIBING. Without it the system has to know which arc it is reading
// from a filename convention or an index — two things that drift from the file and have to be
// maintained. With it the answer is in the document, where the rest of the state already is.
//
// It also counts itself. Progress is objectives complete and nothing else: there are no milestones
// here, because the question a milestone is reached for — *where are we* — is already answered by
// how many objectives are done, and the ordering it usually stands in for is a property of an
// objective (`needs`) rather than a box drawn around a group of them.
const Arc = ({ attrs = {}, line }) => {
  // Counted from the WHOLE document — a leaf block has no slice of its own to count, and the
  // objectives it is counting sit below it rather than inside it.
  const { source = "" } = useDocMembers() || {};
  const { total, done } = arcProgress(String(source || ""));
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="md-arc">
      <span className="md-arc__id">{attrs.id || "arc"}</span>
      {attrs.title ? <span className="md-arc__title">{attrs.title}</span> : null}
      {attrs.owner ? <span className="md-arc__owner">{attrs.owner}</span> : null}
      {/* Zero of zero is a true and useful thing to say — an arc with no objectives yet is a
          document somebody has started, not a broken one. */}
      <span className="md-arc__count">
        {done}/{total} done
      </span>
      <span className="md-arc__bar" aria-hidden="true">
        <i style={{ width: `${pct}%` }} />
      </span>
      {/* RFC-075 — the lifecycle, from the registry: open → done → retired. The count above is this
          document's own parse; the trail is the system's. Both drawn, because they can disagree —
          and a disagreement is a stale row saying so. */}
      <LifecycleTrail kind="arc" id={attrs.id} line={line} attrs={attrs} />
    </div>
  );
};

export default Arc;
