// A PAUSE PRESSED BETWEEN CHUNKS, WHICH IS WHERE HE KEPT CATCHING IT.
//
// His report, twice: *"in between chunks, if you press pause... or as the chunk starts to be
// transcribed, if you press pause too quickly, it will still play, because the chunk wouldn't
// really start playing yet. It should read the state and not play regardless."*
//
// Suspending the audio context is an exact pause for a chunk that is already SOUNDING, and it is
// nothing at all for one that has not started — and between chunks, that is every chunk. Two
// defects stacked on that window:
//
//   1. `playSamples` asked for the audio context on every chunk, and the getter RESUMED a
//      suspended one. So a run he had paused un-paused itself the moment the next chunk finished
//      generating. The pause was real, and a getter undid it.
//   2. The loop's guard after generation checked cancelled, pass and index — never `paused`. So
//      even with the getter fixed it would start a chunk into a pause.
//
// WHAT MAKES THIS TEST WORK IS CONTROL OVER WHEN GENERATION FINISHES. The window being pinned is
// the gap between "he pressed pause" and "the chunk is ready", so `generate` hands back a promise
// the test resolves by hand. A fake that returns immediately cannot reproduce it, and a test that
// cannot reproduce it would pass against the broken code — the only outcome worse than no test.
import { makeSpeechEngine } from "./speechEngine";

let sources;
let suspends;
let resumes;

const ctx = {
  state: "running",
  destination: {},
  suspend() {
    this.state = "suspended";
    suspends += 1;
  },
  resume() {
    this.state = "running";
    resumes += 1;
  },
  createBuffer: () => ({ copyToChannel: () => {} }),
  createBufferSource() {
    const s = new SourceStub();
    sources.push(s);
    return s;
  },
};

class SourceStub {
  constructor() {
    this.onended = null;
    this.started = false;
  }
  connect() {}
  start() {
    this.started = true;
  }
  stop() {
    if (this.onended) this.onended();
  }
  end() {
    if (this.onended) this.onended();
  }
}

// GENERATION ON A LEASH. Each chunk's promise is handed to the test, so "paused while the chunk is
// being made" is a state this file can actually sit in.
let pending;
const makeGen = () => (text) => {
  let settle;
  const p = new Promise((res) => {
    settle = () => res({ audio: new Float32Array(8), sampleRate: 24000 });
  });
  pending.push({ text, settle });
  return p;
};

const flush = () => new Promise((r) => setTimeout(r, 0));
const settle = async (n = 12) => {
  for (let i = 0; i < n; i += 1) await flush();
};

// LONG ENOUGH TO BE SEVERAL CHUNKS — `spokenChunks` groups whole sentences up to 240 characters,
// so a short string is ONE chunk and there is no between-chunks moment to test at all.
const MANY = Array.from(
  { length: 5 },
  (_, i) => `This is sentence number ${i + 1} and it is written long enough that the grouping cannot fit them all into one chunk.`,
).join(" ");

let engine;
beforeEach(() => {
  sources = [];
  suspends = 0;
  resumes = 0;
  pending = [];
  ctx.state = "running";
  // ONE CONTEXT, REUSED — the engine caches it at module level and only ever builds it once.
  window.AudioContext = function AudioContextStub() {
    return ctx;
  };
  engine = makeSpeechEngine({
    name: "test",
    generate: makeGen(),
    voices: () => [],
    available: () => true,
    defaultVoice: () => "v",
  });
});

afterEach(() => {
  engine.stop();
  delete window.AudioContext;
});

it("does not speak a chunk that finished generating AFTER the pause was pressed", async () => {
  engine.speak(MANY, {});
  await settle();
  // the first chunk is being made, and nothing has been heard yet
  expect(sources).toHaveLength(0);
  expect(pending.length).toBeGreaterThan(0);

  // HE PRESSES PAUSE while it is still being made
  engine.pause();
  expect(engine.position().paused).toBe(true);

  // the chunk becomes ready — and must stay silent
  pending[0].settle();
  await settle();
  expect(sources).toHaveLength(0);

  // and it speaks the moment he lets go, rather than being lost
  engine.resume();
  await settle();
  expect(sources).toHaveLength(1);
  expect(sources[0].started).toBe(true);
});

it("does not resume the context just because another chunk became ready", async () => {
  engine.speak(MANY, {});
  await settle();
  pending[0].settle();
  await settle();
  expect(sources).toHaveLength(1);

  engine.pause();
  expect(ctx.state).toBe("suspended");
  const wokeBefore = resumes;

  // the NEXT chunk finishes generating while he is paused. Nothing about that is a press.
  if (pending[1]) pending[1].settle();
  await settle();
  expect(ctx.state).toBe("suspended");
  expect(resumes).toBe(wokeBefore);
  // and the chunk that was already sounding is still the only one that ever started
  expect(sources).toHaveLength(1);
});

it("holds the NEXT chunk when pause is pressed while the current one is still sounding", async () => {
  engine.speak(MANY, {});
  await settle();
  pending[0].settle();
  await settle();
  expect(sources).toHaveLength(1);

  engine.pause();
  // the sentence that was sounding finishes anyway — that is what a stop does to a suspended
  // source in a real browser, and the loop must not take it as permission to continue
  if (pending[1]) pending[1].settle();
  sources[0].end();
  await settle();
  expect(sources).toHaveLength(1);

  engine.resume();
  await settle();
  expect(sources).toHaveLength(2);
});

it("lets the loop out when a paused run is cancelled, so the control never sits lit over silence", async () => {
  const ends = [];
  engine.speak(MANY, { onend: () => ends.push(1) });
  await settle();
  engine.pause();
  pending[0].settle();
  await settle();
  expect(sources).toHaveLength(0);

  engine.stop();
  await settle();
  // `onend` FIRED. A run cancelled while the loop waits at the gate would otherwise never return
  // from it, never reach finish(), and leave the reading control lit forever.
  expect(ends).toHaveLength(1);
  expect(sources).toHaveLength(0);
});

it("a seek out of a pause plays from the new place rather than waiting for a resume", async () => {
  engine.speak(MANY, {});
  await settle();
  engine.pause();
  pending[0].settle();
  await settle();
  expect(sources).toHaveLength(0);

  engine.seek(2);
  await settle();
  // A SEEK IS A PRESS, so it comes OUT of the pause — otherwise he scrubs and nothing happens
  expect(engine.position().paused).toBe(false);
  // whatever the new position needs, let it finish generating
  pending.forEach((x) => x.settle());
  await settle();
  expect(sources.length).toBeGreaterThan(0);
  expect(engine.position().index).toBe(2);
});

it("wakes a suspended context on a PRESS, which is the one place that is allowed to", async () => {
  // a context built before any gesture starts suspended — the cold-load case the old getter was
  // trying to cure in the wrong place
  ctx.state = "suspended";
  engine.speak(MANY, {});
  await settle();
  expect(ctx.state).toBe("running");
});
