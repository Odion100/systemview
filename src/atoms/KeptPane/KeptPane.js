import React, { useRef } from "react";
import "./styles.scss";

// A PANE THAT IS NOT SHOWING IS STILL ALIVE.
//
// `<Switch>` renders exactly one matching route, so crossing Code↔Agents UNMOUNTED the whole page
// tree and rebuilt it — and because the chat is mounted separately inside each page, the chat, the
// terminals and the code pane were torn down and recreated every time. From his seat that is
// indistinguishable from a reload, which is why he kept reaching for refresh: *"this should be a
// single page application and I should stop refreshing every time I go from code to agents."*
// Measured 2026-10-30: there is no page reload on that path at all — the navigation was already
// client-side. The cost was the unmount.
//
// SO THE PANE HIDES INSTEAD OF LEAVING. `display: none` keeps the DOM, the React state, the open
// terminals and the scroll position.
//
// AND IT KEEPS ITS ADDRESS. The pages read `projectCode` and the namespace out of the route, and a
// route that does not match hands back nothing — so a hidden pane asked for its params would blank
// its own project the moment you looked away from it. The last address it was given IS its address
// until it is given another: that is what makes the pane survive being left, rather than merely
// stay in the DOM.
const KeptPane = ({ match, className = "", children }) => {
  const kept = useRef(null);
  if (match) kept.current = match.params || {};
  // Never rendered yet and not matching now — there is nothing to keep, so stay out of the DOM
  // entirely. The first visit mounts it; from then on it only ever hides.
  if (!match && !kept.current) return null;
  return (
    <div className={`kept-pane${match ? "" : " kept-pane--away"} ${className}`.trim()} aria-hidden={!match}>
      {typeof children === "function" ? children(kept.current || {}) : children}
    </div>
  );
};

export default KeptPane;
