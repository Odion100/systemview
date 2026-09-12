import React from "react";
import "./styles.scss";

// THE owner address — one component, one anatomy, everywhere a pane header names whose document
// this is: plum segments (project, then the namespace inside it), muted › separators as their own
// spans, an optional trailing › when something else (a path, a title) follows. Panes render THIS,
// never their own copy — his rule, learned the hard way when the report bar's hand-rolled imitation
// drifted from the code pane's crumb inside a single afternoon.
const OwnerCrumb = ({ segments = [], trail = false, dark = true }) => {
  const segs = segments.filter(Boolean);
  if (!segs.length) return null;
  return (
    <span className={`owner-crumb${dark ? "" : " owner-crumb--light"}`} title={segs.join(" › ")}>
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
