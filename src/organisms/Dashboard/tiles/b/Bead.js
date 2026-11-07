import React from "react";
import Ring from "./Ring";
import { HUES } from "./floor";

// ─── ONE BEAD ──────────────────────────────────────────────────────────────────────────────────
//
// A document, standing at its station, wearing its own progress and the mark of whatever it wants
// from him. IT NO LONGER OPENS ON ITS BODY — his ruling, 2026-11-06: *"Nothing should actually be
// clicked to travel, except an explicit symbol, like an arrow."* The arrow (`→`) is that symbol
// and the only thing here that travels; the body is either a SELECTION (an arc bead publishes its
// arc to the stack and everything below narrows to it) or plain reading.
//
// The arrow is a SIBLING of the body, never a child, because a selectable body is a button and a
// button inside a button is not markup.
const Bead = ({ bead, onOpen, onPick, picked = false }) => {
  const words = [
    `${bead.id}${bead.title ? ` — ${bead.title}` : ""}`,
    bead.project,
    bead.says,
    bead.warn,
    bead.owes,
    bead.stale ? "the file has changed since this was parsed" : "",
  ]
    .filter(Boolean)
    .join("\n");
  const face = (
    <>
      <Ring ratio={bead.ratio} hue={HUES[bead.kind]} drains={bead.drains} />
      <span className="dbb-bead__id">{bead.id}</span>
      {bead.mark ? <span className="dbb-bead__mark">{bead.mark}</span> : null}
    </>
  );
  return (
    <span
      className={`dbb-bead${bead.press ? " is-press" : ""}${bead.work ? " is-work" : ""}${bead.stale ? " is-stale" : ""}${
        picked ? " is-on" : ""
      }`}
      style={{ "--hue": HUES[bead.kind] }}
    >
      {onPick ? (
        <button
          type="button"
          className="dbb-bead__body"
          aria-pressed={picked}
          onClick={() => onPick(bead)}
          title={`${words}\n\n${picked ? "showing only this arc below — press to show everything" : "press to show only this arc below"}`}
        >
          {face}
        </button>
      ) : (
        <span className="dbb-bead__body" title={words}>
          {face}
        </span>
      )}
      <button
        type="button"
        className="dbb-bead__go"
        title={`open ${bead.id}`}
        aria-label={`open ${bead.id}`}
        onClick={() => onOpen(bead)}
      >
        →
      </button>
    </span>
  );
};

export default Bead;
