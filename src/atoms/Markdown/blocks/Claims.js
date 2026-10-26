import React from "react";
import { useDocMembers, useMarkdownWrite } from "../context";
import { claimsOf } from "../claims";

// `::claims` — HOW MANY ARE VERIFIED, counted off the `::claim` blocks in the same document every
// render. The number is derived and stored nowhere, which is the whole point: the STATUS line an
// author used to type ("built, 11/12 met") was an assertion; this cannot disagree with the marks
// below it. Unchecked is its own count, never folded into either side — a claim nobody looked at is
// not met, and it is not failed either.
//
// ALL MET IS A MOMENT, NOT A JUMP (RFC-075 round two, his: "when all claims are met, will it
// automatically jump to—"). All-met is arithmetic; BUILT is a declaration with a date. So the bar
// never advances the lifecycle by itself — it says "all met", and when the document has no STATUS
// yet it offers ONE press that writes the dated heading. The press changes the file, the watcher
// re-derives, and the trail at the top advances on its own: a jump through a dated line, never
// behind anyone's back.
const Claims = () => {
  const { source = "" } = useDocMembers() || {};
  const { editable, appendEnd } = useMarkdownWrite();
  const c = claimsOf(source);
  if (!c.total) return <div className="md-claims md-claims--empty">no claims in this document yet</div>;
  const pct = Math.round((c.met / c.total) * 100);
  const rpct = Math.round((c.reviewed / c.total) * 100);
  const allMet = c.met === c.total;
  const allReviewed = c.reviewed === c.total;
  const hasStatus = /^##\s*STATUS/m.test(source);
  const today = () => {
    const d = new Date();
    const p = (x) => String(x).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  };
  return (
    <div className={`md-claims${allMet ? " md-claims--all" : ""}`}>
      <div className="md-claims__head">
        <span className="md-claims__label">Claims</span>
        <span className="md-claims__count">
          {c.met}/{c.total} met
        </span>
        {c.unmet ? <span className="md-claims__tag md-claims__tag--unmet">{c.unmet} not met</span> : null}
        {c.unchecked ? <span className="md-claims__tag md-claims__tag--unchecked">{c.unchecked} unchecked</span> : null}
        <span className="md-claims__count md-claims__count--reviewed">{c.reviewed}/{c.total} reviewed</span>
        {allMet ? (
          <span className="md-claims__tag md-claims__tag--all">
            {!allReviewed ? "all met — review open" : hasStatus ? "all met & reviewed" : "all met — awaiting STATUS"}
          </span>
        ) : null}
        {allMet && !hasStatus && editable && appendEnd ? (
          <button
            type="button"
            className="md-claims__status"
            title="Writes the dated heading; the registry re-derives and the lifecycle advances to built"
            onClick={() => appendEnd(`## STATUS — built ${today()}\n\n::claims`)}
          >
            write the STATUS
          </button>
        ) : null}
        <span className="md-claims__pct">{pct}%</span>
      </div>
      {/* TWO LAYERS, TWO WORDS (his): the pale fill is MARKED — the builder's word — and the full
          green is REVIEWED — the badges filled. A mark alone never paints the bar done. */}
      <div className="md-claims__bar" aria-hidden="true">
        <i className="md-claims__fill md-claims__fill--marked" style={{ width: `${pct}%` }} />
        <i className="md-claims__fill" style={{ width: `${rpct}%` }} />
        <i className="md-claims__fill md-claims__fill--unmet" style={{ width: `${Math.round((c.unmet / c.total) * 100)}%` }} />
      </div>
    </div>
  );
};

export default Claims;
