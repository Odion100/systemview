import { enqueue, done, view, _reset } from "./speechQueue";

// PAUSE IS NOT STOP, AND THE QUEUE HAS TO KNOW THE DIFFERENCE. His model: stop ends what is
// reading and empties the line; pause holds position with the line intact, and resuming carries on
// and then flows into the next — unless he stops there.
//
// The queue advances on exactly ONE signal: `done(key)`, which the control calls from `onend`.
// Pause suspends the AudioContext and never reaches `onend` (speechEngine.js — suspending freezes
// the waveform where it is, which is the difference between a pause and a rewind), so there is no
// path by which pausing can advance the line. These claims pin that, because the failure would be
// silent and infuriating: pause, come back, and the thing you paused has been skipped.

const started = [];
const item = (key) => ({ key, label: key, start: () => { started.push(key); return { stop: () => {} }; } });

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
