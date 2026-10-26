import { verdict, nearBottom, createSticking } from "./sticking";

const geo = (sh, st, ch) => ({ scrollHeight: sh, scrollTop: st, clientHeight: ch });

describe("following the conversation", () => {
  it("follows when he is near the bottom and leaves when he is not", () => {
    expect(nearBottom(geo(10000, 9344, 656))).toBe(true);
    expect(nearBottom(geo(10000, 8000, 656))).toBe(false);
  });

  // THE BUG, as it was measured in his window. The drawer is a sibling below the list and the list
  // absorbs the space, so opening it takes 122px out of clientHeight with scrollTop untouched.
  it("does not stop following because the drawer took the viewport", () => {
    const s = createSticking();
    s.scrolled(geo(9810, 9032, 778));          // 9810 - 778 = at the bottom, drawer shut
    expect(s.following).toBe(true);
    s.resized(geo(9810, 9032, 656));           // drawer opens: 122px of viewport gone
    s.scrolled(geo(9810, 9032, 656));          // now reads 122 from the bottom, untouched
    expect(s.following).toBe(true);
  });

  it("nor because the content grew under a stationary scrollTop", () => {
    const s = createSticking();
    s.scrolled(geo(9810, 9032, 778));
    [9830, 9849, 9869, 9888, 9908, 9927, 9947, 9966, 9990].forEach((sh) => {
      s.resized(geo(sh, 9032, 656));
      s.scrolled(geo(sh, 9032, 656));
    });
    expect(s.following).toBe(true);
  });

  // The other half has to keep working, or the fix is just "always follow" — which yanks the view
  // out of what he is reading, the disrespect in the other direction.
  it("stops following when HE scrolls up, the box unchanged", () => {
    const s = createSticking();
    s.scrolled(geo(10000, 9344, 656));
    expect(s.following).toBe(true);
    s.scrolled(geo(10000, 5000, 656));
    expect(s.following).toBe(false);
  });

  it("follows again when he scrolls back down to it", () => {
    const s = createSticking();
    s.scrolled(geo(10000, 5000, 656));
    expect(s.following).toBe(false);
    s.scrolled(geo(10000, 9344, 656));
    expect(s.following).toBe(true);
  });

  it("gives our own pin no vote — one bad frame must not switch following off for the session", () => {
    const s = createSticking();
    s.scrolled(geo(10000, 9344, 656));
    s.pin(geo(10000, 9344, 656), 1000);
    s.scrolled(geo(10000, 4000, 656), 1100);
    expect(s.following).toBe(true);
  });

  it("and the pin expires, so a real scroll after it still counts", () => {
    const s = createSticking();
    s.scrolled(geo(10000, 9344, 656));
    s.pin(geo(10000, 9344, 656), 1000);
    s.scrolled(geo(10000, 4000, 656), 1400);
    expect(s.following).toBe(false);
  });

  it("sending resets it — he just spoke, so the bottom is where he is", () => {
    const s = createSticking();
    s.scrolled(geo(10000, 2000, 656));
    expect(s.following).toBe(false);
    s.reset();
    expect(s.following).toBe(true);
  });

  it("says nothing at all about an event where nothing moved", () => {
    expect(verdict(geo(10000, 5000, 656), geo(10000, 5000, 656))).toBe("keep");
  });

  it("decides from the geometry alone on the very first event, with nothing to compare", () => {
    expect(verdict(null, geo(10000, 9344, 656))).toBe("follow");
    expect(verdict(null, geo(10000, 1000, 656))).toBe("leave");
  });
});

// NOTHING BUT A SCROLL OR A RESET DECIDES FOLLOWING. There was an `aim()` here that let a caller
// SET it — written for the automatic voice-follow, then used by the press that goes to a queue row,
// where it meant one press stopped the chat following for the rest of the session. He never asked
// for that. A deliberate move pins (so our own scroll gets no vote) and leaves following alone.
describe("following is not something a caller gets to set", () => {
  it("has no aim — a view move pins instead, and following survives it", () => {
    const s = createSticking();
    s.scrolled(geo(10000, 9344, 656));
    expect(s.following).toBe(true);
    expect(s.aim).toBeUndefined();
    s.pin(geo(10000, 9344, 656), 1000);
    s.scrolled(geo(10000, 3000, 656), 1100); // our own scroll to an older row
    expect(s.following).toBe(true);
  });
});

// HIS REPORT: *"it doesn't scroll like it used to, literally as it streamed in."* The first rule
// suppressed every verdict while geometry was moving — which is every frame of a stream — so a
// deliberate scroll back to the bottom mid-stream was read as layout and thrown away.
describe("he can take following back while a reply is streaming", () => {
  it("judges his scroll even though the content grew in the same breath", () => {
    const s = createSticking();
    s.scrolled(geo(10000, 2000, 656));
    expect(s.following).toBe(false);
    // content is still arriving — scrollHeight moves AND he scrolls to the bottom
    s.resized(geo(10400, 2000, 656));
    s.scrolled(geo(10400, 9744, 656));
    expect(s.following).toBe(true);
  });

  it("and lets him leave mid-stream too, not just rejoin", () => {
    const s = createSticking();
    s.scrolled(geo(10000, 9344, 656));
    s.resized(geo(10400, 9344, 656));
    s.scrolled(geo(10400, 1000, 656));
    expect(s.following).toBe(false);
  });

  // The drawer fix has to survive the new rule — and it does, because a drawer never moves scrollTop.
  it("still ignores the drawer, which changes the box without him touching it", () => {
    const s = createSticking();
    s.scrolled(geo(9810, 9032, 778));
    expect(s.following).toBe(true);
    s.resized(geo(9810, 9032, 656));
    s.scrolled(geo(9810, 9032, 656));
    expect(s.following).toBe(true);
  });
});

// THE KARAOKE FOLLOW'S ONE QUESTION: was that scroll HIS HAND? A reading follows its highlight
// until he takes the wheel — so our own pinned nearest-scrolls and pure layout must both answer
// "not his", or the follow dies on the first thing it does.
describe("lastScrollWasHis — only an unpinned scrollTop move is his", () => {
  it("a pinned scroll (our own nearest-scroll) is never his", () => {
    const s = createSticking();
    s.scrolled(geo(10000, 9344, 656));
    s.pin(geo(10000, 5000, 656));
    s.scrolled(geo(10000, 5000, 656));
    expect(s.lastScrollWasHis).toBe(false);
  });

  it("an unpinned scrollTop move is his — in either direction", () => {
    const s = createSticking();
    s.scrolled(geo(10000, 9344, 656));
    s.scrolled(geo(10000, 2000, 656));
    expect(s.lastScrollWasHis).toBe(true);
    s.scrolled(geo(10000, 9344, 656));
    expect(s.lastScrollWasHis).toBe(true);
  });

  it("layout that moves nothing he touched is not his", () => {
    const s = createSticking();
    s.scrolled(geo(9810, 9032, 778));
    s.resized(geo(9810, 9032, 656));
    s.scrolled(geo(9810, 9032, 656));
    expect(s.lastScrollWasHis).toBe(false);
  });

  it("reset clears it — a fresh panel has no scroll to blame on him", () => {
    const s = createSticking();
    s.scrolled(geo(10000, 9344, 656));
    s.scrolled(geo(10000, 2000, 656));
    s.reset();
    expect(s.lastScrollWasHis).toBe(false);
  });
});
