import React from "react";

// A REGISTRATION LEAF READ SOMEWHERE THAT IS NOT A DOCUMENT.
//
// The four leaves — `::report`, `::rfc`, `::arc`, `::gap` — do one thing: they make the document
// they open that kind. The registry finds a document by its leaf, the lifecycle trail draws off it,
// and a report's retention clock starts the moment the leaf is rendered. Every one of those is a
// statement about a FILE.
//
// So in a chat message the same block renders a lie. Measured in his window 2026-11-07, after I had
// put one in a reply twice: it came out as the full registration UI — "REPORT · report · SUBTYPE? ·
// invalid — no subtype, no retention · retention?" — badged INVALID, in a message that has no path
// and can never be registered. His words: *"what is this report thing that 100% doesn't render
// properly and doesn't seem to make any sense?"* Nothing was broken on the code's terms, which is
// exactly why it was worth fixing: the block was doing its job in a place where its job is
// impossible, and the badge blamed the report rather than the author.
//
// IT REFUSES BY NAME AND NAMES THE BLOCK THAT WOULD HAVE WORKED. The alternative shape — render it
// as the chip it should have been — was rejected on inspection: a leaf carries an `id`, not a path
// (`::report{id="A title"}`), so there is nothing to point the chip at without guessing which file
// the author meant. A refusal that teaches the right form costs one line and invents nothing.
const SAYS = {
  report: "registers the document it opens as a report, and starts its retention clock",
  rfc: "makes the document it opens an RFC",
  arc: "makes the document it opens an arc of objectives",
  gap: "makes the document it opens a gap",
};

const LeafElsewhere = ({ kind = "report" }) => (
  <span className="md-leaf-elsewhere" title="a registration leaf only means something in a document">
    <code>{`::${kind}`}</code> {SAYS[kind] || SAYS.report} — and this is not a document, so nothing
    here can be registered. To point at one, write <code>{":file[path]"}</code>.
  </span>
);

export default LeafElsewhere;
