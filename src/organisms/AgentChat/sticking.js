// WHETHER THE CONVERSATION STILL FOLLOWS — and the one distinction the old test could not make.
//
// Following was decided by distance from the bottom alone: `scrollHeight - scrollTop - clientHeight
// < 120`. That is a fine question to ask about a scroll HE performed, and the wrong question to ask
// after a layout change, because two of the three terms belong to the UI rather than to him.
//
// The work drawer is the proof. It is a sibling BELOW the list and the list is `flex: 1 1 0%`, so
// opening the drawer subtracts its whole height from the list's viewport in a single frame. Measured
// in his window: `clientHeight` lost 122px, the distance walked from 706 to 862 in 19px steps while
// `scrollTop` sat frozen at 8750 for twelve seconds, and 53 of 154 observations were past the
// threshold. He never touched the wheel. The view was pulled out from under a stationary scrollTop,
// the test read it as "he has scrolled away", and the chat stopped following for the rest of the
// session — recoverable only by scrolling to the bottom by hand.
//
// So: GEOMETRY MOVING IS NOT A DECISION. Only a scroll that changes `scrollTop` while the box stays
// the same size gets a vote. Everything else — the drawer, a late image, the voice line appearing,
// the panel being resized — leaves following exactly as it was.
export const NEAR = 120;

export const nearBottom = ({ scrollHeight = 0, scrollTop = 0, clientHeight = 0 } = {}, near = NEAR) =>
  scrollHeight - scrollTop - clientHeight < near;

/**
 * The verdict on one scroll event.
 * @returns {"follow"|"leave"|"keep"} — keep means this event says nothing; do not touch the flag.
 */
export const verdict = (prev, next, near = NEAR) => {
  if (!prev) return nearBottom(next, near) ? "follow" : "leave";
  // HE MOVED IT: `scrollTop` changed, so this is his scroll and it gets judged — whatever else
  // changed alongside it.
  //
  // THE FIRST VERSION ASKED THE WRONG QUESTION. It suppressed the verdict whenever the box or the
  // content had changed at all, which is true on EVERY frame of a streaming reply — so scrolling
  // back down mid-stream was classified as layout and ignored, and following could never be
  // regained while anything was arriving. His report: *"it doesn't scroll like it used to,
  // literally as it streamed in… it used to scroll as you went."* Geometry moving alongside him is
  // the normal case, not a reason to disbelieve him.
  if (prev.scrollTop !== next.scrollTop) return nearBottom(next, near) ? "follow" : "leave";
  // HE DIDN'T: `scrollTop` is where he left it and only the box or the content moved. That is
  // layout — the work drawer taking 122px, a late image, the voice line appearing — and layout gets
  // no vote. This is the drawer fix, and it survives the rule above because the drawer does not
  // move `scrollTop`.
  return "keep";
};

/** A small stateful keeper, so the component holds one object instead of three refs. */
export const createSticking = (near = NEAR) => {
  let following = true;
  let last = null;
  let pinUntil = 0;
  return {
    get following() {
      return following;
    },
    /** We are about to scroll it ourselves — our own scroll must not get a vote. */
    pin(geo, now = Date.now()) {
      pinUntil = now + 300;
      last = { ...geo };
    },
    /** He sent a message, or the panel just opened: the bottom is where he is. */
    reset() {
      following = true;
      last = null;
    },
    /** A scroll event arrived. */
    scrolled(geo, now = Date.now()) {
      if (now < pinUntil) {
        last = { ...geo };
        return following;
      }
      const v = verdict(last, geo, near);
      if (v !== "keep") following = v === "follow";
      last = { ...geo };
      return following;
    },
    /** The box or the content changed size. Record it; never re-decide on it. */
    resized(geo) {
      last = { ...geo };
      return following;
    },
  };
};
