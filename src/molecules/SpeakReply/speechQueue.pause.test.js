import { enqueue, done, isPaused, setPaused, view, whenResumed, release, skip, cutIn, _reset } from "./speechQueue";

// PAUSE IS NOT STOP, AND THE QUEUE HAS TO KNOW THE DIFFERENCE. His model: stop ends what is
// reading and empties the line; pause holds position with the line intact, and resuming carries on
// and then flows into the next — unless he stops there.
//
// The queue advances on exactly ONE signal: `done(key)`, which the control calls from `onend`.
// Pause suspends the AudioContext and never reaches `onend` (speechEngine.js — suspending freezes
// the waveform where it is, which is the difference between a pause and a rewind), so there is no
// path by which pausing can advance the line. These claims pin that, because the failure would be
// silent and infuriating: pause, come back, and the thing you paused has been skipped.
//
// AND IT IS THE LINE'S PAUSE, NOT THE UTTERANCE'S (his report, 2026-11-10: *"in between cues,
// nothing is playing, but the pause button is there… it will just start talking. I would have to
// press it again and then press it again"*). The silences are where he presses, so a press has to
// be takeable when nothing is speaking and has to survive into the next cue.

const started = [];
const item = (key) => ({ key, label: key, start: () => { started.push(key); return { stop: () => {} }; } });
const mine = (key, scope) => ({ ...item(key), scope });

beforeEach(() => { _reset(); started.length = 0; });

it("a pause is not a finish — the line does not move", () => {
  enqueue(item("a"));
  enqueue(item("b"));
  // Whatever a pause does to the audio, it never calls done(). Nothing else can advance the queue.
  expect(view()).toMatchObject({ playing: { key: "a" }, waiting: [{ key: "b" }] });
  expect(started).toEqual(["a"]);
});

it("resuming and finishing then flows into the next, in order", () => {
  enqueue(item("a"));
  enqueue(item("b"));
  enqueue(item("c"));
  done("a");
  expect(started).toEqual(["a", "b"]);
  done("b");
  expect(started).toEqual(["a", "b", "c"]);
  expect(view().waiting).toEqual([]);
});

// HIS BUG. The press lands in a silence — between two cues, nothing speaking — and the next cue
// starts talking anyway, so he has to press again, and again, to land one.
describe("a pause pressed when nothing is playing", () => {
  it("is held, and says so, with no item to hang it on", () => {
    expect(setPaused(true)).toBe(true);
    expect(view().playing).toBeNull();
    expect(view().paused).toEqual([""]);
    expect(isPaused("")).toBe(true);
  });

  it("holds the next cue back instead of letting it talk", () => {
    setPaused(true);
    enqueue(item("next-cue"));
    expect(started).toEqual([]);
    expect(view()).toMatchObject({ playing: null, waiting: [{ key: "next-cue" }] });
    expect(view().paused).toEqual([""]);
  });

  it("holds the line when the one that was reading has already ended", () => {
    enqueue(item("a"));
    enqueue(item("b"));
    setPaused(true); // the gap: a is between beats, b has not started
    done("a");
    expect(started).toEqual(["a"]);
    expect(view()).toMatchObject({ playing: null, waiting: [{ key: "b" }] });
  });

  // HELD, NOT SKIPPED — the whole difference between a pause and a seek.
  it("keeps the held one at the head and reads it when he lets go", () => {
    enqueue(item("a"));
    setPaused(true);
    done("a");
    enqueue(item("b"));
    expect(started).toEqual(["a"]);
    expect(view().waiting.map((w) => w.key)).toEqual(["b"]);
    setPaused(false);
    expect(started).toEqual(["a", "b"]);
    expect(view()).toMatchObject({ playing: { key: "b" }, waiting: [] });
    expect(view().paused).toEqual([]);
  });
});

// THE TRAP, AND IT WAS PAID FOR ONCE (2026-10-25: pause on autobot's bubble paused
// systemview-test's reply). One queue serves every chat, so a hold that forgot whose it was would
// silence an agent he never touched.
describe("a hold belongs to the reading it was pressed on", () => {
  it("leaves another agent's reply to read", () => {
    setPaused(true, "autobot");
    enqueue(mine("theirs", "systemview-test"));
    expect(started).toEqual(["theirs"]);
    expect(view().playing.paused).toBe(false);
  });

  it("still holds its own, behind the one it let through", () => {
    setPaused(true, "autobot");
    enqueue(mine("theirs", "systemview-test"));
    enqueue(mine("ours", "autobot"));
    done("theirs");
    expect(started).toEqual(["theirs"]);
    expect(view()).toMatchObject({ playing: null, waiting: [{ key: "ours" }] });
    setPaused(false, "autobot");
    expect(started).toEqual(["theirs", "ours"]);
  });

  // A SURFACE THAT OWNS NO PROJECT holds the window — it is the line that draws everyone's
  // readings, so its pause is everyone's.
  it("holds every chat when it was pressed where no chat owns it", () => {
    setPaused(true, "");
    enqueue(mine("a", "autobot"));
    enqueue(mine("b", "systemview-test"));
    expect(started).toEqual([]);
    setPaused(false, "autobot"); // the chat's resume lets go of the window's hold too
    expect(started).toEqual(["a"]);
  });
});

// A PRESS MEANS HE WANTS SOUND. Playing under a line that still claims to be paused is the same
// lie, one move along.
describe("choosing something to hear lets go of the hold", () => {
  it("the play on a standing line starts it", () => {
    setPaused(true);
    enqueue(item("a"));
    expect(release()).toBe(true);
    expect(started).toEqual(["a"]);
    expect(view().paused).toEqual([]);
  });

  it("a cut-in plays, and leaves no hold behind to mute what comes next", () => {
    setPaused(true);
    cutIn(item("chosen"));
    expect(started).toEqual(["chosen"]);
    expect(view().paused).toEqual([]);
    done("chosen");
    enqueue(item("after"));
    expect(started).toEqual(["chosen", "after"]);
  });

  it("stop takes the hold with it, so the next reply is not silently swallowed", () => {
    enqueue(item("a"));
    setPaused(true);
    cutIn(null);
    expect(view().paused).toEqual([]);
    enqueue(item("b"));
    expect(started).toEqual(["a", "b"]);
  });

  // SKIP IS THE ESCAPE FROM A PAUSE (the stall he hit: paused by accident, replies piling up). It
  // only escapes if it lets go — otherwise it holds the next one too.
  it("skip gets him out of a pause and into the new thing", () => {
    enqueue(item("a"));
    enqueue(item("b"));
    setPaused(true);
    expect(skip()).toBe(true);
    expect(started).toEqual(["a", "b"]);
    expect(view().paused).toEqual([]);
  });
});

// THE BEATS INSIDE ONE REPLY. A reply reads its prose, its passages and its cues inside a SINGLE
// queue item, so the line never sees the seams between them — which is where his press landed. The
// player asks, and parks the rest of the sequence here.
describe("a sequence playing inside one item holds between its beats", () => {
  it("parks the next beat and runs it when he lets go", () => {
    const beats = [];
    enqueue(item("reply"));
    setPaused(true);
    expect(isPaused("")).toBe(true);
    whenResumed("", () => beats.push("beat-2"));
    expect(beats).toEqual([]);
    setPaused(false);
    expect(beats).toEqual(["beat-2"]);
  });

  it("drops a parked beat whose item has already left the floor", () => {
    const beats = [];
    enqueue(item("reply"));
    setPaused(true);
    whenResumed("", () => beats.push("stale"));
    cutIn(null); // stop — the reply is gone, and its parked beat with it
    setPaused(true);
    setPaused(false);
    expect(beats).toEqual([]);
  });

  it("leaves a beat parked while the hold is another chat's business", () => {
    const beats = [];
    enqueue(mine("reply", "autobot"));
    setPaused(true, "autobot");
    whenResumed("autobot", () => beats.push("beat-2"));
    setPaused(false, "systemview-test");
    expect(beats).toEqual([]);
    setPaused(false, "autobot");
    expect(beats).toEqual(["beat-2"]);
  });
});
