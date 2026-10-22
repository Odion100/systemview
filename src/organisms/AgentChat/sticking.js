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

const same = (a, b) => a.scrollHeight === b.scrollHeight && a.clientHeight === b.clientHeight;

/**
 * The verdict on one scroll event.
 * @returns {"follow"|"leave"|"keep"} — keep means this event says nothing; do not touch the flag.
 */
export const verdict = (prev, next, near = NEAR) => {
  if (!prev) return nearBottom(next, near) ? "follow" : "leave";
  // The box changed size or the content grew: this is layout, not him. Say nothing.
  if (!same(prev, next)) return "keep";
  // Same box, same content, and he has not moved either — nothing happened worth a verdict.
  if (prev.scrollTop === next.scrollTop) return "keep";
  return nearBottom(next, near) ? "follow" : "leave";
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
    /**
     * SOMETHING ELSE TOOK THE VIEW DELIBERATELY — the voice moving to the row it is reading. That
     * is a choice, not a scroll, so it SETS following rather than being measured for it: reading
     * an old reply must not be yanked to the bottom by the next thing that arrives, and reading
     * the newest one must not stop following just because we scrolled to it.
     */
    aim(on) {
      following = !!on;
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
