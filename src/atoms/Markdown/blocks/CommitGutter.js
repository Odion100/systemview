import React from "react";

// A FILE WITH MARKERS DOWN THE SIDE — never a diff.
//
// His standing preference, and the reason this is not a diff view: *"I don't really like seeing
// the diffs. I actually like seeing the files themselves, which has the markers on the side."* A
// unified diff is a third artifact — not the file before and not the file after, but an encoding
// of the distance between them that the reader decodes in their head. The file as it stood, with
// the changed lines marked, reads as code; the margin says which of it is new.
//
// THE TWO MARKS ARE NOT SYMMETRICAL, and that asymmetry is the whole design:
//
//   added    a line that exists in THIS file and did not before. It has a line number, so it
//            gets a bar in the gutter beside it.
//   removed  a line that existed before and does not exist here. It has no line of its own on
//            this screen, so it cannot be marked — it is drawn as the GAP it left, a wedge at the
//            boundary between the lines that survived it.
//
// Rendering removed lines inline would make this a diff again, which is the thing it is not.
export default function CommitGutter({ content, marks }) {
  const lines = String(content || "").split("\n");
  const added = new Set((marks && marks.added) || []);
  const gaps = new Map();
  for (const r of (marks && marks.removed) || []) gaps.set(r.after, (gaps.get(r.after) || 0) + r.count);
  return (
    <pre className="md-commit__gutterfile">
      {/* `after: 0` is a deletion at the very top — above line one, with no surviving line before
          it to hang from. Drawn first rather than folded into the loop, which starts at 1. */}
      {gaps.get(0) ? <span className="md-commit__gap" title={`${gaps.get(0)} lines removed above`} /> : null}
      {lines.map((text, i) => {
        const n = i + 1;
        const gap = gaps.get(n);
        return (
          <React.Fragment key={n}>
            <span className={`md-commit__gline${added.has(n) ? " md-commit__gline--add" : ""}`}>
              <span className="md-commit__gn">{n}</span>
              {/* A BLANK LINE STILL NEEDS HEIGHT, or the gutter's bars stop lining up with the
                  numbers beside them the first time the file has an empty line in it. */}
              <span className="md-commit__gcode">{text || " "}</span>
            </span>
            {gap ? <span className="md-commit__gap" title={`${gap} line${gap === 1 ? "" : "s"} removed here`} /> : null}
          </React.Fragment>
        );
      })}
    </pre>
  );
}
