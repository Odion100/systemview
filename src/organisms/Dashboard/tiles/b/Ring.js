import React from "react";

// ─── THE RING ──────────────────────────────────────────────────────────────────────────────────
//
// SVG, not a conic gradient: a stroked arc is one compositor-cheap path and it reads correctly at
// 18px, where a gradient's edge goes to mush. NO ANIMATION ON IT — this page can hold a hundred of
// these and a hundred animated rings is a hot GPU for no information gained.
const Ring = ({ ratio, hue, drains }) => {
  const R = 7.5;
  const C = 2 * Math.PI * R;
  // NULL IS A REAL ANSWER and it draws as an EMPTY ring with a dashed edge, never as 0%. An RFC
  // with no claims list has no progress; painting it at zero would invent a failure nobody reported.
  const none = ratio == null;
  return (
    <svg className="dbb-ring" viewBox="0 0 20 20" aria-hidden="true">
      <circle className={`dbb-ring__track${none ? " is-none" : ""}`} cx="10" cy="10" r={R} />
      {!none && (
        <circle
          className="dbb-ring__fill"
          cx="10"
          cy="10"
          r={R}
          // STYLE, NOT A PRESENTATION ATTRIBUTE. `hue` is `var(--dbb-rfc)`, and `var()` is NOT
          // substituted inside an SVG presentation attribute in any browser — `stroke="var(…)"`
          // is an invalid paint, and SVG's initial stroke is `none`, so with no CSS rule supplying
          // one the arc never drew at all. Every ring showed its grey track and nothing else: the
          // progress signal this page is built around was invisible, and the tests could not see
          // it because jsdom computes no SVG paint.
          //
          // AND THE VALUE IS A CUSTOM PROPERTY, which is the other half of why every tile wears
          // `.dbb-ctx`: outside it, `var(--dbb-rfc)` resolves to nothing and the arc is gone again.
          style={{ stroke: hue }}
          strokeDasharray={`${Math.max(0, Math.min(1, ratio)) * C} ${C}`}
          // a draining ring reads anticlockwise from the top — it is giving the length back
          transform={drains ? "rotate(-90 10 10) scale(1,-1) translate(0,-20)" : "rotate(-90 10 10)"}
        />
      )}
    </svg>
  );
};

export default Ring;
