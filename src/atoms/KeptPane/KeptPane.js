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
// TWO WAYS TO SAY "I AM SHOWING", because two surfaces need this and they do not agree about what
// decides it — his ask, 2026-11-10: *"how can we make a document keep state as you go across tabs
// without... coming to the page."*
//
//   `match`      — a ROUTE match, for the pages. Absent means the route does not match.
//   `show`+`keep` — a BOOLEAN and the address to remember, for the centre's TAB panels, which have
//                   no route of their own: they are a `tab` string compared against the URL.
//
// One component rather than two, deliberately. The mechanism is identical and the hard-won part —
// keeping the last address — is the part a second copy would get wrong first, so a tab-flavoured
// clone of this file is exactly the drift one definition exists to prevent.
const KeptPane = ({ match, show, keep, className = "", children }) => {
  const routed = match !== undefined;
  const here = routed ? !!match : !!show;
  // The address to remember WHILE HERE. A route carries it in `params`; a tab is handed it as
  // `keep`. A pane with nothing to carry still records that it has been here, so `{}` is a real
  // answer and not the same as "never shown".
  const address = here ? (routed ? match.params || {} : keep || {}) : null;
  const kept = useRef(null);
  if (address) kept.current = address;
  // Never rendered yet and not showing now — there is nothing to keep, so stay out of the DOM
  // entirely. The first visit mounts it; from then on it only ever hides.
  if (!here && !kept.current) return null;
  return (
    <div className={`kept-pane${here ? "" : " kept-pane--away"} ${className}`.trim()} aria-hidden={!here}>
      {typeof children === "function" ? children(kept.current || {}) : children}
    </div>
  );
};

export default KeptPane;
