import React from "react";
import Ring from "./Ring";
import { HUES } from "./floor";

// ─── ONE BEAD ──────────────────────────────────────────────────────────────────────────────────
//
// A document, standing at its station, wearing its own progress and the mark of whatever it wants
// from him. It OPENS; it never presses — the control lives in the document.
const Bead = ({ bead, onOpen }) => (
  <button
    type="button"
    className={`dbb-bead${bead.press ? " is-press" : ""}${bead.work ? " is-work" : ""}${bead.stale ? " is-stale" : ""}`}
    style={{ "--hue": HUES[bead.kind] }}
    onClick={() => onOpen(bead)}
    title={[
      `${bead.id}${bead.title ? ` — ${bead.title}` : ""}`,
      bead.project,
      bead.says,
      bead.warn,
      bead.owes,
      bead.stale ? "the file has changed since this was parsed" : "",
    ]
      .filter(Boolean)
      .join("\n")}
  >
    <Ring ratio={bead.ratio} hue={HUES[bead.kind]} drains={bead.drains} />
    <span className="dbb-bead__id">{bead.id}</span>
    {bead.mark ? <span className="dbb-bead__mark">{bead.mark}</span> : null}
  </button>
);

export default Bead;
