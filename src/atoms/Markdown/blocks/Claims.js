import React from "react";
import { useDocMembers } from "../context";
import { claimsOf } from "../claims";

// `::claims` — HOW MANY ARE VERIFIED, counted off the `::claim` blocks in the same document every
// render. The number is derived and stored nowhere, which is the whole point: the STATUS line an
// author used to type ("built, 11/12 met") was an assertion; this cannot disagree with the marks
// below it. Unchecked is its own count, never folded into either side — a claim nobody looked at is
// not met, and it is not failed either.
const Claims = () => {
  const { source = "" } = useDocMembers() || {};
  const c = claimsOf(source);
  if (!c.total) return <div className="md-claims md-claims--empty">no claims in this document yet</div>;
  const pct = Math.round((c.met / c.total) * 100);
  return (
    <div className="md-claims">
      <div className="md-claims__head">
        <span className="md-claims__label">Claims</span>
        <span className="md-claims__count">
          {c.met}/{c.total} met
        </span>
        {c.unmet ? <span className="md-claims__tag md-claims__tag--unmet">{c.unmet} not met</span> : null}
        {c.unchecked ? <span className="md-claims__tag md-claims__tag--unchecked">{c.unchecked} unchecked</span> : null}
        <span className="md-claims__pct">{pct}%</span>
      </div>
      <div className="md-claims__bar" aria-hidden="true">
        <i className="md-claims__fill" style={{ width: `${pct}%` }} />
        <i className="md-claims__fill md-claims__fill--unmet" style={{ width: `${Math.round((c.unmet / c.total) * 100)}%` }} />
      </div>
    </div>
  );
};

export default Claims;
