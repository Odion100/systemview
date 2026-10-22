import React from "react";
import { useMarkdownWrite, useDocMembers } from "../context";
import { nextState, normalizeState, parseObjectives, parseArc, resolveNeeds } from "../objectives";

// RFC-072 §4 — `::objective{id=O2 owner=autobot state=open needs=ARC-004-O1}`.
//
// THE BLOCK IS THE RECORD. There is no issue store behind this and no row in a database that the
// markdown describes: the attributes ARE the fields, the document IS the state, and this renderer
// is the only view. That is why pressing the state writes back into the file — marking an
// objective done is a step somebody performs, not something a surface derives.
//
// THE SPLIT IS THE DESIGN: attributes carry what the MACHINE addresses — `id`, `owner`, `state`,
// `needs` — and the content carries what a PERSON reads: the what, the **why**, the **requirements**. The
// prose stays prose, wrapped the way `:::approval` wraps real content instead of encoding it into
// attributes, because an arc is a document first and a record second.
//
// WHY `why` IS A PART AT ALL. An objective travels alone: it reaches an agent hours or days later,
// usually with nobody to ask, and the ground has often moved. One that says only WHAT leaves that
// agent two bad options — stop, or do the literal thing that no longer serves. The purpose gives
// it the third and correct one: serve the intent, say what changed, say what you did instead.
const Objective = ({ attrs = {}, line, children }) => {
  const { editable, setAttr } = useMarkdownWrite();
  // THE WHOLE DOCUMENT, not this block's slice. `src` is the block's own text — "a block cannot
  // see past its own slice" — and `needs` is a question about the document, so it is answered
  // from the source the atom already parses once and hands down.
  const { source: docSource = "" } = useDocMembers() || {};
  const state = normalizeState(attrs.state);
  const id = attrs.id || "";

  // Needs are resolved against the document this block is sitting in — the only thing it can
  // honestly answer for. Anything in another repo or another arc comes back `elsewhere`, which is
  // rendered as such rather than being quietly dropped.
  const source = String(docSource || "");
  const ctx = { objectives: parseObjectives(source), arc: parseArc(source) };
  const needs = resolveNeeds({ needs: String(attrs.needs || "").split(/[|,]/).map((s) => s.trim()).filter(Boolean) }, ctx);

  const press = () => {
    if (!editable || !line) return;
    setAttr(line, "state", nextState(state));
  };

  return (
    <div className={`md-objective md-objective--${state}`}>
      <div className="md-objective__head">
        {/* IT SAYS WHAT IT IS. `::progress` and `::timeline` name themselves and this did not, so a
            card with an id, a title and a state could be anything — his: *"make it say objective."* */}
        <span className="md-objective__kind">objective</span>
        {id ? <span className="md-objective__id">{id}</span> : null}
        {attrs.title ? <span className="md-objective__title">{attrs.title}</span> : null}
        <button
          type="button"
          className={`md-objective__state md-objective__state--${state}`}
          disabled={!editable}
          onClick={press}
          title={
            editable
              ? `${state} — press for ${nextState(state)}`
              : "Read-only here — this surface has nothing to save to"
          }
        >
          {state}
        </button>
        {attrs.owner ? <span className="md-objective__owner">{attrs.owner}</span> : null}
        {needs.length ? (
          <span className="md-objective__needs">
            {needs.map((n) => (
              // AN ADDRESS THAT DOES NOT RESOLVE SAYS SO. Rendering an unresolved need as nothing
              // would read as "no dependency", and work started in the wrong order is the failure
              // this whole field exists to prevent.
              <span
                key={n.address || Math.random()}
                className={`md-objective__need md-objective__need--${n.status}`}
                title={
                  n.status === "unresolved"
                    ? `${n.address || "this need"} — ${n.why || "does not resolve"}`
                    : n.status === "elsewhere"
                    ? `${n.address} — in another arc or repo; this document cannot see its state`
                    : `${n.address} — ${n.status}`
                }
              >
                {n.status === "met" ? "✓" : n.status === "unresolved" ? "⚠" : "↳"} {n.address || String(n.address || "?")}
              </span>
            ))}
          </span>
        ) : null}
      </div>
      {state === "blocked" ? (
        // UNEXPLAINED IS SAID OUT LOUD. The alternative is a state nobody can act on rendering as
        // though it were complete — and the reader cannot tell "nobody wrote the reason" from
        // "there isn't one", which is the difference between a question to ask and a thing to fix.
        <div className={`md-objective__blocked${attrs.blocked ? "" : " is-unsaid"}`}>
          {attrs.blocked ? `Blocked — ${attrs.blocked}` : "Blocked, and no reason was given"}
        </div>
      ) : null}
      <div className="md-objective__body">{children}</div>
    </div>
  );
};

export default Objective;
