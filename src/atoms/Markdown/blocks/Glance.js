import React from "react";
import { useDocMembers } from "../context";

// THE FIXED HEADER EVERY REPORT OPENS WITH — the same fields, in the same order, in every report,
// so the eye lands in the same place twice.
//
// HIS ASK, 2026-11-11: *"I want to be able to look and see the same things across every report. I
// want to be able to open a report and my eyes can easily go to the parts that I want to see and
// then decide if I want to read the whole thing… when reports all follow the same procedure, it
// becomes easy to consume any report."* And the shape, in his words: *"new feature, none. Fix,
// none. Even if these sections are empty, they're there."*
//
// IT IS ITS OWN BLOCK BECAUSE IT IS ITS OWN THING. The first version borrowed `:::callout`, and
// borrowing is exactly why it read as a note rather than as a header — a callout is a thing to
// KNOW, one weight down from an ask, and a report's header is neither. There are only two callout
// styles and both are spoken for (`::ask` blue for a question, amber for a thing to do); dressing a
// third meaning in one of them would have cost those two their pull.
//
// THE BODY IS A PLAIN MARKDOWN LIST, read from the document's own source rather than from the
// rendered children. That is deliberate on both halves: the file still reads as a list to anyone
// opening it in an editor or a diff, and the component gets the raw value, which is what lets it
// tell an EMPTY field from a filled one and mute it.
//
//   :::glance
//   - **agent** — systemview-test
//   - **run** — the proactive-development job
//   - **new features** — none
//   :::
//
// AN EMPTY FIELD IS NOT HIDDEN, IT IS MUTED. Hiding it would make the header a different shape in
// every report, which is the whole thing this block exists to stop — his *"even if these sections
// are empty, they're there"*. Muted, the eye skips it without having to read it, and the row is
// still there to be counted.
//
// AND `none` IS NOT `not stated`. One says there was none; the other says the report never said.
// They are muted alike and worded differently, because collapsing them lets a gap in the writing
// read as an answer about the work.
const EMPTY = new Set(["none", "not stated"]);

export function rowsOf(source = "", line = 0) {
  const lines = String(source || "").split("\n");
  const out = [];
  // From the opening fence to the closing one. A `:::` at any depth ends it — the body of this
  // block is a list and never holds a fence of its own.
  for (let i = Number(line) || 0; i < lines.length; i += 1) {
    const l = lines[i];
    if (i > (Number(line) || 0) && /^:{3,}\s*$/.test(l.trim())) break;
    const m = /^\s*-\s+\*\*(.+?)\*\*\s*[—–-]\s*(.*)$/.exec(l);
    if (m) out.push({ label: m[1].trim(), value: m[2].trim() });
  }
  return out;
}

// INLINE CODE, AND ONLY INLINE CODE. Reading the raw source is what lets this block tell an empty
// field from a filled one — and the cost is that markdown's own inline syntax arrives as literal
// characters. Measured in his live window: a field naming `smoke:judges` rendered WITH its
// backticks showing.
//
// So one span is honoured and nothing else. Backticks earn it because a field value routinely
// names a path, a script or a namespace, and a colon token has to be backticked in the source
// anyway or the renderer parses it as a directive and eats it (measured the same evening:
// `smoke:judges` came out as "smokeunknown blockjudges"). Bold and links are not honoured, because
// a header that can be emphasised is a header somebody will emphasise.
const withCode = (value) =>
  String(value)
    .split(/`([^`]+)`/)
    .map((part, i) =>
      i % 2 ? (
        <code key={i} className="md-glance__code">
          {part}
        </code>
      ) : (
        part
      ),
    );

const Glance = ({ line, children }) => {
  const { source = "" } = useDocMembers() || {};
  const rows = rowsOf(source, line);
  // NO ROWS IS NOT AN ERROR AND NOT AN EMPTY BOX. A document being edited passes through a state
  // where the list is half-written, and a block that blanked itself there would flicker. With
  // nothing to read it renders its children, which is the list exactly as the markdown has it.
  if (!rows.length) return <div className="md-glance md-glance--raw">{children}</div>;
  return (
    <dl className="md-glance">
      {rows.map((r) => {
        const empty = EMPTY.has(r.value.toLowerCase());
        // The field's own name, normalised, so `new features` is addressable as one token.
        const key = r.label.toLowerCase().replace(/\s+/g, "-");
        return (
          <React.Fragment key={r.label}>
            {/* THE FIELD NAME RIDES THE DOM so the stylesheet can colour a ROW rather than a
                badge — his call: "you could potentially use colours on the fucking fields
                themselves." A colour on the field means the eye finds `correction` without
                reading the word, and it is the field that carries it, not a headline above the
                block claiming to summarise it. */}
            <dt className="md-glance__label" data-field={key}>
              {r.label}
            </dt>
            <dd
              className={`md-glance__value${empty ? " md-glance__value--empty" : ""}`}
              data-field={key}
            >
              {withCode(r.value)}
            </dd>
          </React.Fragment>
        );
      })}
    </dl>
  );
};

export default Glance;
