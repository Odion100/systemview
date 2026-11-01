import React from "react";

// THE FOOTER EVERY PAGE HAS, including an empty one.
//
// His instruction: *"You see how page A has the definitions of things at the bottom — RFC, arc,
// gap, report. That should be the default on any page as the bottom footer, so that if I go to
// create a new page that's always there and empty. You have something there before you start
// adding and moving things around."*
//
// So it is not a tile. It cannot be added, removed, reordered or switched — it is the page's own
// floor, and a page he just made is a page with the vocabulary on it rather than a void.
//
// WHAT IT DOES NOT CARRY is A's closing sentence about rings and pulsing marks. That paragraph
// describes A's own drawing, and a legend on a page made of C's tiles would be explaining marks
// that are not there. Four kinds, four definitions, nothing about how any one page draws them.
const KINDS = [
  ["rfc", "RFC", "a design, reduced to claims somebody can check"],
  ["arc", "ARC", "a body of work, made of objectives"],
  ["gap", "GAP", "something another project gets wrong or lacks"],
  ["report", "REPORT", "an account of work done, with a clock on it"],
];

export default function PageLegend() {
  return (
    <footer className="pagelegend">
      {KINDS.map(([kind, word, says]) => (
        <span key={kind} className="pagelegend__item">
          <span className={`pagelegend__chip pagelegend__chip--${kind}`}>{word}</span>
          {says}
        </span>
      ))}
      <span className="pagelegend__rule">Everything here opens its document; nothing here presses it.</span>
    </footer>
  );
}
