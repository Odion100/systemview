import React, { useState } from "react";
import { useMarkdownWrite } from "../context";
import useDecisionTell from "../useDecisionTell";

// `:::approval{id=…}` — the story APPROVAL verdict, as a wrapper.
//
// An agent proposes something and needs an answer it can read back: a plan, a migration, a diff, a
// run it wants to make. It wraps the proposal in this block; you hit ✓ or ✗; the verdict is written
// INTO THE DOCUMENT as an attribute (`verdict=approved`), which is the whole point — the agent reads
// the document, so it reads the decision, with no second store to consult and nothing to sync.
//
// Same wrapper logic as `:::thread`: it belongs to what it surrounds, so it moves with it. And like
// `::question`, clicking the verdict you already gave CLEARS it — "I take that back" has to be
// expressible, or the first click is a trap.
const Approval = ({ attrs = {}, line, children }) => {
  const { editable, setAttr } = useMarkdownWrite();
  const [local, setLocal] = useState(null);
  // A PRESS IS NEWS. Who hears it and where the stamp lands is one rule for every deciding
  // block, so it lives in the hook rather than here.
  const tell = useDecisionTell();
  const verdict = local != null ? local : attrs.verdict || "";
  const label = attrs.ask || attrs.label || "Approval needed";

  // THE WRITE FIRST, ALWAYS. The decision is the point and the telling is bookkeeping, so a send
  // that refuses — no host door, nobody on the document, a hub that is down — must never cost the
  // verdict. That ordering is the whole safety property here, and it is why the send is not
  // awaited before the document is changed.
  const decide = (value) => {
    if (!editable) return;
    const next = verdict === value ? "" : value;
    setLocal(next);
    setAttr(line, "verdict", next || null);

    // A PRESS JUMPS THE QUIET PERIOD. Prose waits twenty seconds and then his send, because an
    // unfinished paragraph is not a decision — a press is complete the instant it happens and is
    // usually the thing the others were waiting on. His: "maybe it should notify you right away."
    tell("approval", attrs, next);
  };

  return (
    <div className={`md-approval${verdict ? ` md-approval--${verdict}` : ""}`}>
      <div className="md-approval__head">
        <span className="md-approval__kind">approval</span>
        <span className="md-approval__label">{label}</span>
        <span className="md-approval__actions">
          <button
            type="button"
            className={`md-approval__btn md-approval__btn--yes${verdict === "approved" ? " is-on" : ""}`}
            disabled={!editable}
            onClick={() => decide("approved")}
            title={
              !editable
                ? "Read-only here — this surface has nothing to save to"
                : verdict === "approved"
                ? "Click again to withdraw"
                : "Approve — writes into the document"
            }
          >
            ✓ Approve
          </button>
          <button
            type="button"
            className={`md-approval__btn md-approval__btn--no${verdict === "rejected" ? " is-on" : ""}`}
            disabled={!editable}
            onClick={() => decide("rejected")}
            title={
              !editable
                ? "Read-only here — this surface has nothing to save to"
                : verdict === "rejected"
                ? "Click again to withdraw"
                : "Reject — writes into the document"
            }
          >
            ✗ Reject
          </button>
        </span>
      </div>
      <div className="md-approval__body">{children}</div>
      {verdict ? (
        <div className="md-approval__stamp">
          {verdict === "approved" ? "approved" : "rejected"}
          <span className="md-approval__stamp-note">written into the document</span>
        </div>
      ) : null}
    </div>
  );
};

export default Approval;
