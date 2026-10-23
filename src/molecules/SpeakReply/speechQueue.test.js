import { enqueue, cutIn, done, drop, clear, skip, setPaused, view, subscribe, _reset, jumpTo, playFirst } from "./speechQueue";

// THE FAILURE: a reply arriving mid-sentence truncated the one being read, because auto-speech
// went through the same door as a press and a press is SUPPOSED to cancel. Every claim here is
// about the difference between arriving and being chosen.

const spoken = [];
const item = (key, label = key) => ({
  key,
  label,
  start: () => {
    spoken.push(key);
    return { stop: () => spoken.push(`stop:${key}`) };
  },
});

beforeEach(() => {
  _reset();
  spoken.length = 0;
});

describe("replies wait their turn", () => {
  it("speaks the first immediately — a queue with nothing in it is not a delay", () => {
    enqueue(item("a"));
    expect(spoken).toEqual(["a"]);
    expect(view().playing.key).toBe("a");
  });

  it("holds the second instead of cutting the first off", () => {
    enqueue(item("a"));
    enqueue(item("b"));
    expect(spoken).toEqual(["a"]);
    expect(view().waiting.map((w) => w.key)).toEqual(["b"]);
  });

  it("starts the next one when the first finishes", () => {
    enqueue(item("a"));
    enqueue(item("b"));
    done("a");
    expect(spoken).toEqual(["a", "b"]);
    expect(view().waiting).toEqual([]);
  });

  // ONLY THE ONE PLAYING CAN END THE TURN. A stale callback from a reply that was cut off would
  // otherwise advance the queue and skip whatever is being read now.
  it("ignores a finish from something that is not playing", () => {
    enqueue(item("a"));
    enqueue(item("b"));
    expect(done("b")).toBe(false);
    expect(spoken).toEqual(["a"]);
  });

  it("queues the same reply once, however many times it is offered", () => {
    enqueue(item("a"));
    expect(enqueue(item("b"))).toBe(true);
    expect(enqueue(item("b"))).toBe(false);
    expect(enqueue(item("a"))).toBe(false);
    expect(view().waiting.map((w) => w.key)).toEqual(["b"]);
  });

  it("goes quiet when the last one ends", () => {
    enqueue(item("a"));
    done("a");
    expect(view()).toEqual({ playing: null, waiting: [] });
  });
});

describe("a press cuts in, and the line goes with it", () => {
  // He said it plainly: "I can always stop it and play whatever I want." Choosing a reply means
  // choosing it INSTEAD of the backlog — resuming a minute later would be talking about something
  // he has moved on from.
  it("stops what is talking and drops everything waiting", () => {
    enqueue(item("a"));
    enqueue(item("b"));
    cutIn(item("c"));
    expect(spoken).toEqual(["a", "stop:a", "c"]);
    expect(view()).toMatchObject({ playing: { key: "c" }, waiting: [] });
  });

  it("clear() is a cut-in with nothing after it — silence, and an empty line", () => {
    enqueue(item("a"));
    enqueue(item("b"));
    clear();
    expect(spoken).toEqual(["a", "stop:a"]);
    expect(view()).toEqual({ playing: null, waiting: [] });
  });

  // A stop that throws must not strand the queue holding a reply that is no longer audible.
  it("survives a stop that throws", () => {
    enqueue({ key: "bad", label: "bad", start: () => ({ stop: () => { throw new Error("no"); } }) });
    expect(() => cutIn(item("next"))).not.toThrow();
    expect(view().playing.key).toBe("next");
  });
});

describe("taking one out of the line", () => {
  it("drops a waiting reply without touching what is being read", () => {
    enqueue(item("a"));
    enqueue(item("b"));
    enqueue(item("c"));
    expect(drop("b")).toBe(true);
    expect(view()).toMatchObject({ playing: { key: "a" }, waiting: [{ key: "c" }] });
    expect(spoken).toEqual(["a"]);
  });

  it("refuses to drop the one that is playing — that is a stop, not a drop", () => {
    enqueue(item("a"));
    expect(drop("a")).toBe(false);
    expect(view().playing.key).toBe("a");
  });
});

describe("a surface can watch it", () => {
  it("tells subscribers on every change, with a copy they cannot mutate", () => {
    const seen = [];
    const off = subscribe((v) => seen.push(v));
    enqueue(item("a"));
    enqueue(item("b"));
    done("a");
    off();
    enqueue(item("c"));
    expect(seen.length).toBe(3);
    expect(seen[seen.length - 1]).toMatchObject({ playing: { key: "b" }, waiting: [] });
    seen[0].waiting.push("nonsense");
    expect(view().waiting.every((w) => typeof w === "object")).toBe(true);
  });
});

// THE STALL HE ACTUALLY HIT: paused by accident, replies arriving and queueing, and the line could
// not move — because a pause is indefinite, which is what a pause IS. Stop was the only escape and
// it threw away everything that had arrived while he was stuck.
describe("getting past the one that is reading", () => {
  it("skips to the next, abandoning the current one", () => {
    enqueue(item("a"));
    enqueue(item("b"));
    expect(skip()).toBe(true);
    expect(spoken).toEqual(["a", "stop:a", "b"]);
    expect(view()).toMatchObject({ playing: { key: "b" }, waiting: [] });
  });

  it("skipping the last one leaves silence rather than an empty playing slot", () => {
    enqueue(item("a"));
    skip();
    expect(view()).toEqual({ playing: null, waiting: [] });
  });

  it("refuses when nothing is reading, instead of pretending", () => {
    expect(skip()).toBe(false);
  });

  // THE LINE SAYS WHY IT IS NOT MOVING. A stalled queue and a working one are identical from
  // outside otherwise, which is exactly the state he was stuck in without knowing it.
  it("carries the paused flag so the surface can say so", () => {
    enqueue(item("a"));
    enqueue(item("b"));
    expect(view().playing.paused).toBe(false);
    setPaused("a", true);
    expect(view().playing.paused).toBe(true);
    setPaused("a", false);
    expect(view().playing.paused).toBe(false);
  });

  it("ignores a paused flag from something that is not reading", () => {
    enqueue(item("a"));
    expect(setPaused("b", true)).toBe(false);
    expect(view().playing.paused).toBe(false);
  });
});

// JUMPING THE LINE — *"clicking a queue item, jump to it, forward to it."* Distinct from going to
// the reply in the conversation: that moves the view, this moves the reading.
describe("jumping the line to one of its own items", () => {
  const made = [];
  const row = (key) => ({ key, label: key, start: () => { made.push(key); return { stop: () => {} }; } });

  beforeEach(() => { made.length = 0; cutIn(null); });

  it("starts the one he picked, now", () => {
    cutIn(row("a"));
    enqueue(row("b"));
    enqueue(row("c"));
    expect(jumpTo("c")).toBe(true);
    expect(view().playing.key).toBe("c");
    expect(made).toEqual(["a", "c"]);
  });

  it("goes FORWARD — what sat ahead of it is dropped, never held to rewind into", () => {
    cutIn(row("a"));
    ["b", "c", "d"].forEach((k) => enqueue(row(k)));
    jumpTo("d");
    expect(view().playing.key).toBe("d");
    expect(view().waiting).toEqual([]);
  });

  it("keeps what sat behind it", () => {
    cutIn(row("a"));
    ["b", "c", "d"].forEach((k) => enqueue(row(k)));
    jumpTo("c");
    expect(view().waiting.map((w) => w.key)).toEqual(["d"]);
  });

  it("does nothing for the one already talking — there is nowhere to jump", () => {
    cutIn(row("a"));
    enqueue(row("b"));
    expect(jumpTo("a")).toBe(false);
    expect(view().playing.key).toBe("a");
    expect(view().waiting.map((w) => w.key)).toEqual(["b"]);
  });

  it("refuses a key that is not in the line rather than emptying it", () => {
    cutIn(row("a"));
    enqueue(row("b"));
    expect(jumpTo("nope")).toBe(false);
    expect(view().playing.key).toBe("a");
    expect(view().waiting.map((w) => w.key)).toEqual(["b"]);
  });
});

// THE FRONT OF THE LINE — *"it's not added to the back of the queue, it's added to the front."*
// Nothing removed, nothing replaced: that is what separates it from `cutIn`.
describe("playing something first without emptying the line", () => {
  const spoke = [];
  const row = (key) => ({ key, label: key, start: () => { spoke.push(key); return { stop: () => {} }; } });

  beforeEach(() => { spoke.length = 0; cutIn(null); });

  it("plays it now and leaves what was waiting exactly where it was", () => {
    cutIn(row("reply"));
    enqueue(row("b"));
    enqueue(row("c"));
    playFirst(row("selection"));
    expect(view().playing.key).toBe("selection");
    expect(view().waiting.map((w) => w.key)).toEqual(["reply", "b", "c"]);
  });

  it("puts the interrupted one at the HEAD, so it picks up again next", () => {
    cutIn(row("reply"));
    enqueue(row("b"));
    playFirst(row("selection"));
    done("selection");
    expect(view().playing.key).toBe("reply");
    expect(spoke).toEqual(["reply", "selection", "reply"]);
  });

  it("just plays when nothing was reading", () => {
    playFirst(row("selection"));
    expect(view().playing.key).toBe("selection");
    expect(view().waiting).toEqual([]);
  });

  it("refuses something that cannot speak rather than silencing the line", () => {
    cutIn(row("reply"));
    expect(playFirst({ key: "x" })).toBe(false);
    expect(view().playing.key).toBe("reply");
  });
});
