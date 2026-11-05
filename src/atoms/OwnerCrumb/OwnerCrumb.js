import React from "react";
import "./styles.scss";

// THE owner address — one component, one anatomy, everywhere a pane header names whose document
// this is: plum segments (project, then the namespace inside it), muted › separators as their own
// spans, an optional trailing › when something else (a path, a title) follows. Panes render THIS,
// never their own copy — his rule, learned the hard way when the report bar's hand-rolled imitation
// drifted from the code pane's crumb inside a single afternoon.
// `kind` TINTS THE ADDRESS TO THE DOCUMENT IT ADDRESSES — optional, and absent everywhere the
// address is not about a registered document, which is why the house plum is still the default
// rather than a fallback nobody reaches.
//
// It exists because the plum and the arc badge were ΔE 18.2 apart in dark — close enough to read
// as a near-miss and not close enough to read as a pair, which is the worst of both. Two colours
// that nearly match look like a mistake; the same colour looks like a sentence. Measured against
// the other kinds the plum is 41, 84 and 81 away, so arc was the one real collision and tinting
// fixes it by making the relationship deliberate instead of nudging one hue off the other.
const OwnerCrumb = ({ segments = [], trail = false, dark = true, kind = null }) => {
  const segs = segments.filter(Boolean);
  if (!segs.length) return null;
  return (
    <span
      className={`owner-crumb${dark ? "" : " owner-crumb--light"}${kind ? ` owner-crumb--${kind}` : ""}`}
      title={segs.join(" › ")}
    >
      {segs.map((seg, i) => (
        <span key={i}>
          {i > 0 && <span className="owner-crumb__sep">›</span>}
          <span className="owner-crumb__seg">{seg}</span>
        </span>
      ))}
      {trail && <span className="owner-crumb__sep owner-crumb__sep--trail">›</span>}
    </span>
  );
};

export default OwnerCrumb;
