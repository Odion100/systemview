import kokoro, { ready } from "./kokoroEngine";
import { KOKORO_VOICES } from "./kokoroVoices";

// WHAT CAN BE PROVEN WITHOUT THE MODEL, AND IT IS MORE THAN IT LOOKS. The weights are an 86MB
// download and `kokoro-js` is untransformed ESM in node_modules, so nothing here may touch
// `load()` — jest would die on the dynamic import rather than fail an assertion. Everything
// below is the part of the contract that must hold BEFORE anything is fetched, which is exactly
// the part a surface depends on while the download is still in flight.

// THE TEST THAT WAS MISSING, AND THE BUG IT NOW HOLDS DOWN. `voice.js` reads the ENGINE OBJECT —
// `ENGINE.ready`, `ENGINE.prewarm` — because an engine is swappable at runtime. The first version
// of this engine declared all five readiness verbs as module-level `export const`s and put none of
// them on the object, so `ready()` fell through to `available()` and answered TRUE with no model
// loaded: the picker never drew its download line and `prewarm()` resolved null without fetching a
// byte. Everything above passed, because importing a named export is not calling the surface.
// Asserting the DEFAULT export is what closes that gap, and it is caught here rather than in his
// window.
describe("the engine object carries every verb voice.js reads off it", () => {
  it.each(["available", "voices", "speak", "stop", "ready", "loading", "lastError", "progress", "prewarm"])(
    "exposes %s on the default export",
    (verb) => {
      expect(typeof kokoro[verb]).toBe("function");
    },
  );

  it("agrees with its own named export rather than shadowing it", () => {
    expect(kokoro.ready()).toBe(ready());
  });
});

describe("the engine answers before the model exists", () => {
  it("is not ready, and says so rather than pretending", () => {
    expect(ready()).toBe(false);
    expect(kokoro.ready()).toBe(false);
  });

  // THE EXACT SHIPPED BUG: with no `ready` on the object, voice.js fell back to `available()` —
  // which is TRUE on any machine with Web Audio — and the surface concluded the model was loaded.
  it("does not let availability masquerade as readiness", () => {
    window.AudioContext = function AudioContextStub() {};
    try {
      expect(kokoro.available()).toBe(true);
      expect(kokoro.ready()).toBe(false);
    } finally {
      delete window.AudioContext;
    }
  });

  it("knows every voice with nothing loaded — the picker draws rows, not a spinner", () => {
    expect(kokoro.voices()).toHaveLength(KOKORO_VOICES.length);
  });

  it("claims every voice is local, which is the whole privacy promise", () => {
    expect(kokoro.voices().every((v) => v.local === true)).toBe(true);
  });

  it("carries the grade through, because the picker sorts and shows it", () => {
    expect(kokoro.voices()[0].grade).toBe("A");
  });

  // AVAILABILITY IS ABOUT THE MACHINE, NOT THE DOWNLOAD. jsdom has no Web Audio, so this is the
  // genuine "this browser cannot speak" answer — and the control hides rather than lying.
  it("reports unavailable on a machine with no Web Audio", () => {
    expect(kokoro.available()).toBe(false);
  });

  it("reports available the moment Web Audio exists, model or no model", () => {
    window.AudioContext = function AudioContextStub() {};
    try {
      expect(kokoro.available()).toBe(true);
    } finally {
      delete window.AudioContext;
    }
  });
});

// `onend` EXACTLY ONCE, ON EVERY PATH — the button's state is this callback, so a path that
// forgets it leaves a control stuck reading "Reading" over silence. Empty text is the one path
// that can be driven here without loading anything.
describe("speak() with nothing to say", () => {
  it("ends once and never reaches the model", () => {
    const ends = [];
    const h = kokoro.speak("   ", { onend: (e) => ends.push(e) });
    expect(ends).toHaveLength(1);
    expect(ready()).toBe(false);
    expect(typeof h.stop).toBe("function");
    h.stop();
    expect(ends).toHaveLength(1);
  });
});
