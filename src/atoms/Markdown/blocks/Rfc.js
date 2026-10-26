import React from "react";
import LifecycleTrail from "./lifecycle";

// RFC-073 §1.2 — `::rfc{id=RFC-073 arc=ARC-004}` at the top of a document.
//
// IT MAKES THE DOCUMENT AN RFC. Not its folder, not its filename — the leaf. `::arc` already worked
// this way (RFC-072: *"self-describing — no filename convention, no index"*); this finishes the
// thought for the second kind. A design kept in `docs/designs/` is an RFC the moment it says so, and
// a file in `RFCs/` that says nothing is a file.
//
// `arc=` is the one relationship the registry holds — "what is being built for this arc" becomes a
// read instead of a grep. It renders as a chip because that is what a pointer looks like here.
//
// NO PRESS, NO STATE OF ITS OWN. This is identity, and identity is the one thing that must not be
// edited by accident: the number is what every attachment, hook and registry row points at.
const Rfc = ({ attrs = {} }) => (
  <div className="md-arc md-rfc">
    <span className="md-arc__kind">RFC</span>
    <span className="md-arc__id">{attrs.id || "rfc"}</span>
    {attrs.title ? <span className="md-arc__title">{attrs.title}</span> : null}
    {attrs.arc ? (
      <span className="md-arc__relation" title={`this RFC serves ${attrs.arc}`}>
        for {attrs.arc}
      </span>
    ) : null}
    {/* RFC-075 — the leaf stops being a bare label: the kind's lifecycle, current state lit,
        read from the registry. Identity stays unpressable; this is a read. */}
    <LifecycleTrail kind="rfc" id={attrs.id} />
  </div>
);

export default Rfc;
