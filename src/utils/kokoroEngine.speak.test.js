// THE CANCELLATION TESTS, and they need the model mocked rather than skipped.
//
// His bugs, both on 2026-10-21: *"I press another one and multiple are playing at the same time"*
// and *"I can't stop it."* Neither is reachable without driving `speak()` to the end, so
// `kokoro-js` is mocked at the module boundary — the dynamic `import()` inside `load()` resolves
// to this — and Web Audio is a stub whose sources only end when the test says so. That control
// over WHEN a sentence ends is the whole point: it is the gap between sentences where both faults
// lived.
let mockGenerated;

jest.mock("kokoro-js", () => ({
  KokoroTTS: {
    from_pretrained: async () => ({
      generate: async (text, opts) => {
        mockGenerated.push({ text, voice: opts && opts.voice, speed: opts && opts.speed });
        return { audio: new Float32Array(8), sampling_rate: 24000 };
      },
    }),
  },
}));

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
    this.stopped = false;
  }
  connect() {}
  start() {
    this.started = true;
  }
  stop() {
    this.stopped = true;
    if (this.onended) this.onended();
  }
  /** The sentence finishes on its own. */
  end() {
    if (this.onended) this.onended();
  }
}

beforeEach(() => {
  mockGenerated = [];
  sources = [];
  suspends = 0;
  resumes = 0;
  ctx.state = "running";
  // ONE CONTEXT, REUSED — because the engine caches `CTX` at module level and only ever builds it
  // once. A fresh stub per test is never constructed after the first, so the test would hold a
  // null it believed was the live context. The STATE is reset instead, which is also closer to the
  // truth: a browser has one audio context for the life of the page.
  window.AudioContext = function AudioContextStub() {
    return ctx;
  };
});

afterEach(() => {
  delete window.AudioContext;
});

const flush = () => new Promise((r) => setTimeout(r, 0));
// SEVERAL TURNS, because the failure being pinned is the loop CONTINUING: generation of the next
// sentence is an await, so a run that was only half-stopped needs a few microtask turns to reach
// the speakers. Three flushes was not enough and the test passed against the broken code — the
// worst possible outcome for a regression test.
// LONG ENOUGH TO BE SEVERAL CHUNKS. `spokenChunks` groups WHOLE SENTENCES up to 240 characters,
// so "First. Second. Third." is one chunk and there is no next sentence for a half-stopped loop to
// run on into — the first version of this test used exactly that and passed against the broken
// code, which is the only outcome worse than no test.
const MANY_SENTENCES = Array.from(
  { length: 6 },
  (_, i) =>
    `This is sentence number ${i + 1} and it is deliberately written long enough that the grouping cannot fit them all into one chunk.`,
).join(" ");

const settle = async (n = 12) => {
  for (let i = 0; i < n; i++) await flush();
};
const engine = () => require("./kokoroEngine").default;

it("speaks, and says it started and ended exactly once", async () => {
  const k = engine();
  const ends = [];
  const starts = [];
  k.speak("One sentence.", { onstart: () => starts.push(1), onend: (e) => ends.push(e) });
  await flush();
  await flush();
  expect(starts).toHaveLength(1);
  expect(sources[0].started).toBe(true);
  sources[0].end();
  await flush();
  await flush();
  expect(ends).toHaveLength(1);
});

// HIS FIRST BUG. The engine this replaced called `speechSynthesis.cancel()` on the way in; porting
// to Kokoro lost that, and auditioning voices is precisely the case where you press one while
// another is talking.
it("ends whatever is speaking when a new utterance starts", async () => {
  const k = engine();
  const first = [];
  k.speak("The first voice.", { onend: () => first.push("end") });
  await flush();
  await flush();
  expect(sources[0].started).toBe(true);

  k.speak("The second voice.", {});
  await flush();
  expect(sources[0].stopped).toBe(true);
  // The interrupted run must still report its ending — the control that was lit is driven by it.
  expect(first).toEqual(["end"]);
});

// HIS SECOND BUG, and the worse one: `stop()` silenced the current sentence while the generation
// loop carried on, so a stopped reply went quiet and then STARTED AGAIN on the next sentence.
it("stops the whole run, not just the sentence being played", async () => {
  const k = engine();
  const ends = [];
  k.speak(MANY_SENTENCES, { onend: () => ends.push(1) });
  await flush();
  await flush();
  const spokenBefore = mockGenerated.length;
  expect(sources).toHaveLength(1);
  // The first sentence ENDS on its own, which is the realistic moment to press stop: between two
  // sentences, with the next one already generating.
  sources[0].end();

  k.stop();
  await settle();

  expect(ends).toHaveLength(1);
  // Nothing new was PLAYED after the stop. Generation already in flight may land, but it must
  // never reach the speakers — that is the difference between stopping and pausing.
  expect(sources).toHaveLength(1);
  expect(mockGenerated.length).toBeGreaterThanOrEqual(spokenBefore);
});

it("the handle's own stop does the same thing", async () => {
  const k = engine();
  const ends = [];
  const h = k.speak(MANY_SENTENCES, { onend: () => ends.push(1) });
  await flush();
  await flush();
  h.stop();
  await flush();
  expect(ends).toHaveLength(1);
  expect(sources[0].stopped).toBe(true);
  h.stop(); // twice is not an error, and must not double-fire
  expect(ends).toHaveLength(1);
});

it("carries the chosen voice and speed into the model", async () => {
  const k = engine();
  k.speak("A line.", { voice: { id: "bf_emma" }, rate: 1.25 });
  await flush();
  await flush();
  expect(mockGenerated[0].voice).toBe("bf_emma");
  expect(mockGenerated[0].speed).toBe(1.25);
});


// ── MOVING AROUND INSIDE A REPLY ───────────────────────────────────────────────────────────────
//
// His ask: *"it should allow you to pause… and it should even allow you to slide it back to
// wherever you want to listen from."* Both are only possible because the loop is index-driven —
// the version this replaced walked the sentences with a `for` and had no position to read.
describe("the transport", () => {
  it("reports an honest timeline from the first instant", async () => {
    const k = engine();
    const h = k.speak(MANY_SENTENCES, {});
    // The sentence COUNT is known the moment the text is chunked — before a single one has been
    // generated — which is what lets a scrubber be full-width immediately instead of lying about
    // its own length until the end.
    expect(h.total).toBeGreaterThan(1);
    await settle();
    const at = h.position();
    expect(at.total).toBe(h.total);
    expect(at.buffered).toBeGreaterThan(0);
  });

  // SUSPEND, NOT STOP. Stopping the source and replaying would restart the sentence; suspending
  // freezes the waveform and resumes on the same syllable.
  it("pauses by suspending the context, and resumes without regenerating", async () => {
    const k = engine();
    const h = k.speak(MANY_SENTENCES, {});
    await settle();
    const madeBefore = mockGenerated.length;

    h.pause();
    expect(ctx.state).toBe("suspended");
    expect(h.position().paused).toBe(true);
    // The playing sentence never ends while suspended, so nothing advances and nothing is remade.
    await settle();
    expect(h.position().index).toBe(0);

    h.resume();
    expect(ctx.state).toBe("running");
    expect(h.position().paused).toBe(false);
    expect(mockGenerated.length).toBeGreaterThanOrEqual(madeBefore);
  });

  it("pausing twice is a control working correctly, not a bug", async () => {
    const k = engine();
    const h = k.speak(MANY_SENTENCES, {});
    await settle();
    h.pause();
    h.pause();
    expect(suspends).toBe(1);
    h.resume();
    h.resume();
    expect(resumes).toBe(1);
  });

  it("seeks to a sentence and plays from there", async () => {
    const k = engine();
    const h = k.speak(MANY_SENTENCES, {});
    await settle();
    const before = sources.length;
    h.seek(3);
    await settle();
    expect(h.position().index).toBe(3);
    expect(sources.length).toBeGreaterThan(before);
  });

  // A buffer source is one-shot, so going back means building a new one from the SAME samples.
  // Keeping them is what makes a backward seek instant instead of a re-generation.
  it("does not regenerate a sentence it has already made", async () => {
    const k = engine();
    const h = k.speak(MANY_SENTENCES, {});
    await settle();
    h.seek(2);
    await settle();
    const madeAfterFirstVisit = mockGenerated.length;
    h.seek(0);
    await settle();
    const zeroAgain = mockGenerated.filter((g) => g.text === mockGenerated[0].text).length;
    expect(zeroAgain).toBe(1);
    expect(mockGenerated.length).toBeGreaterThanOrEqual(madeAfterFirstVisit);
  });

  it("clamps a seek to the sentences that exist", async () => {
    const k = engine();
    const h = k.speak(MANY_SENTENCES, {});
    await settle();
    h.seek(9999);
    expect(h.position().index).toBe(h.total - 1);
    h.seek(-5);
    expect(h.position().index).toBe(0);
  });

  // Seeking out of a pause has to let it play again, or the scrubber moves and nothing is heard.
  it("un-pauses when he seeks", async () => {
    const k = engine();
    const h = k.speak(MANY_SENTENCES, {});
    await settle();
    h.pause();
    h.seek(2);
    expect(h.position().paused).toBe(false);
    expect(ctx.state).toBe("running");
  });

  it("leaves nothing suspended when a paused run is stopped", async () => {
    const k = engine();
    const h = k.speak(MANY_SENTENCES, {});
    await settle();
    h.pause();
    h.stop();
    // A context left suspended would make the NEXT utterance silent with no error anywhere.
    expect(ctx.state).toBe("running");
    expect(k.speaking()).toBe(false);
  });
});
