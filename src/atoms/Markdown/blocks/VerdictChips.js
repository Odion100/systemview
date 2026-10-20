import React, { useState } from "react";
import { useDocMembers, useMarkdownWrite } from "../context";
import { approvalOf, verdictPlan, verdictTitle } from "../verdictPlan";
import { revealBlock } from "../revealBlock";

// A VERDICT WITHOUT SCROLLING TO THE BLOCK.
//
// His ask, RFC-070 threads t1 + t5: ✓/✗ at the top-right of any open document — *"a remote for the
// approval block, same setAttr write, one source of truth"* — and the inversion, *"on a document
// with NO block, the press writes block + verdict in one stroke, so nothing lives in the draft
// until he decides."*
//
// IT IS A REMOTE, NOT A SECOND STORE. With a block present the press writes `verdict=` onto that
// block's own line. `verdict=approved|rejected` is already what every reader checks — the band's
// unanswered scan, `tv`, the job document's binding-work rule — so a chip with its own field would
// be a second truth whose first disagreement nobody could find.
//
// THE WHOLE DECISION IS IN `verdictPlan`, not here. Nothing importing the markdown renderer can be
// mounted under jest, so a control whose logic lives in its JSX is a control that cannot be tested
// — which is how two render-time crashes once shipped beside 543 green claims.
//
// IT SHOWS THE CURRENT VERDICT, because this corner is also the only place you can see one without
// scrolling. A document already approved shows an approved mark, and pressing it again withdraws.
const VerdictChips = () => {
  const { source = "" } = useDocMembers() || {};
  const { editable, setAttr, insertAt } = useMarkdownWrite();
  // The optimistic mark, so the corner answers the press before the file round-trips. Cleared the
  // moment the document comes back carrying its own answer.
  const [local, setLocal] = useState(null);
  const [refusal, setRefusal] = useState("");

  if (!editable) return null;

  const block = approvalOf(source);
  const verdict = local != null ? local : (block && block.verdict) || "";

  const press = (value) => {
    const plan = verdictPlan(source, value);
    if (plan.kind === "refuse") {
      setRefusal(plan.why);
      // A REFUSAL THAT CAN POINT, POINTS. Two blocks means he has to pick one, so send him there
      // rather than leaving him to find them.
      if (plan.line) revealBlock(typeof document !== "undefined" ? document : null, plan.line);
      return;
    }
    setRefusal("");
    if (plan.kind === "attr") {
      setLocal(plan.value);
      setAttr(plan.line, "verdict", plan.value || null);
      return;
    }
    // kind === "insert" — the block and the verdict in one stroke.
    if (typeof insertAt !== "function") {
      // ABSENCE STATED. An older host whose write context has no insert door cannot do the
      // inversion, and saying so beats a chip that looks pressed and wrote nothing.
      setRefusal("this surface cannot create a block — scroll down and add an approval block");
      return;
    }
    setLocal(value);
    insertAt(plan.insertAfter, plan.text);
  };

  return (
    <div className="md-verdict">
      <button
        type="button"
        className={`md-verdict__chip md-verdict__chip--yes${verdict === "approved" ? " is-on" : ""}`}
        title={verdictTitle(source, "approved")}
        onClick={() => press("approved")}
      >
        ✓
      </button>
      <button
        type="button"
        className={`md-verdict__chip md-verdict__chip--no${verdict === "rejected" ? " is-on" : ""}`}
        title={verdictTitle(source, "rejected")}
        onClick={() => press("rejected")}
      >
        ✗
      </button>
      {/* THE BLOCK IS STILL THE THING, so the corner can take you to it — the same door the members
          pin's pills use. Only when there is one; with no block there is nowhere to go yet. */}
      {block && (
        <button
          type="button"
          className="md-verdict__goto"
          title="go to the approval block"
          onClick={() => revealBlock(typeof document !== "undefined" ? document : null, block.line)}
        >
          ›
        </button>
      )}
      {!!refusal && <span className="md-verdict__refusal">{refusal}</span>}
    </div>
  );
};

export default VerdictChips;
