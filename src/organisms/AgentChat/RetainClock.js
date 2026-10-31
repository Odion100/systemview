import React, { useEffect, useState } from "react";
import { parseRetain, retainLine, tickFor } from "../../atoms/Markdown/blocks/retention";

// THE DRAWER'S CLOCK, COUNTING. His words: *"When it comes to reports, I want to see them expiring
// in the drawer… I want to see it counting down to incentivize — okay, this one is about to be
// retired and then swept away, I need to get to it."* The drawer said the right words and then
// stood still: `retainLine` was called inline in the reports list, and nothing re-triggers that
// render, so the number was whatever it was when the band last drew.
//
// THERE IS NOTHING TO ALIGN AND NO SECOND CLOCK HERE. The deadline is `openedAt + retain`, both
// already on disk and already joined onto the row by the registry read — so this is a REDRAW, not
// state. *"The drawer doesn't need anything special to count down… if the expiration date marked on
// something is an hour from now, that's all you need to know."* No store, no context, no global
// ticker: one interval, at the cadence the words themselves have (`tickFor`), and none at all when
// there is nothing left to count — retired, permanent, undeclared, or not yet read, all four of
// which `retainLine` already answers.
//
// IT IS A COMPONENT AND NOT A HOOK IN THE PANEL because the beat must land on the smallest thing
// that shows the number. AgentChat is the whole window's drawer; re-rendering it once a second for
// a report in its last minutes would be a tax on every keystroke beside it. `RecClock` in that file
// is the same move for the same reason. The leaf's own face (`blocks/Report.js`) keeps its own
// beat — the component there IS the smallest thing — so the shared part is `tickFor`, the rule,
// which is already shared. Two four-line effects reading one rule is not a duplication worth a
// wrapper.
const RetainClock = ({ state, openedAt, className = "md-report__clock" }) => {
  const st = state || {};
  const windowMs = parseRetain(st.retain);

  const [, setBeat] = useState(0);
  const left = windowMs != null && openedAt && !st.retired ? openedAt + windowMs - Date.now() : null;
  const every = tickFor(left);
  useEffect(() => {
    if (!every) return undefined;
    const t = setInterval(() => setBeat((b) => b + 1), every);
    return () => clearInterval(t);
  }, [every]);

  // The invalid chip beside this one already carries a leaf that declared nothing, and a retired
  // report's clock has spoken; permanent is a word the row does not need to repeat.
  if (st.invalid || st.retired) return null;
  const clock = retainLine({ retired: !!st.retired, retain: st.retain, windowMs, openedAt: openedAt || null });
  if (!clock || clock.text === "permanent") return null;
  return <span className={`${className}${clock.urgent ? " is-soon" : ""}`}>{clock.text}</span>;
};

export default RetainClock;
