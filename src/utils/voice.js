// THE PLAYER, AND THE SEAM A BETTER VOICE SLOTS INTO. Four verbs — `speak`, `stop`, `voices`,
// `available` — and the built-in `speechSynthesis` behind them. The surface is this small on
// purpose: the button and `spokenForm.js` are the parts worth keeping, and neither one may ever
// learn the name of an engine. Swapping in OpenAI, ElevenLabs or Azure later is `useEngine(impl)`
// and nothing else is touched.
//
// WHAT A SECOND IMPLEMENTATION HAS TO PROVIDE — the whole contract, so nobody has to read this
// file to write one:
//
//   available()            → boolean. Can this machine speak AT ALL, right now? A service engine
//                            answers "do I have a key and a network", and answering `false` is a
//                            first-class outcome: the control hides rather than lying.
//   voices()               → [{ id, name, lang, local }]. `local` is not decoration — see below.
//                            May be empty before the engine has loaded them; the caller re-asks.
//   speak(text, opts)      → a HANDLE: { stop() }. opts = { voice, rate, pitch, volume,
//                            onstart, onend, onerror }. `onend` MUST fire exactly once, on
//                            finishing OR on being stopped OR on failing, because the button's
//                            "speaking" state is driven by it and a handle that never resolves
//                            leaves a control stuck mid-press. The engine owns its own chunking,
//                            buffering and prefetch; the caller hands it one string.
//   stop()                 → silence everything this engine is playing, immediately. Not pause.
//
// A network engine additionally owes two things this one gets for free: it must not block the UI
// while it fetches audio (start playing the first chunk while fetching the rest), and it must
// treat a failed request as `onerror` rather than as silence — "nothing happened" is the one
// outcome a listener cannot distinguish from a broken feature.
//
// THE REASON `local` IS IN THE VOICE SHAPE AT ALL. Version one is offline and sends nothing
// anywhere, and that claim is NOT free: `speechSynthesis.getVoices()` in this Chrome build offers
// 199 voices and NINETEEN of them are Google network voices with `localService === false` — pick
// one of those and the text of his reply goes to a server. Measured on 2026-10-20:
//
//   Electron 43.4.1 (the shell he actually works in): 180 voices, every one localService: true.
//   Chrome 155 (another machine, another person):     199 voices, 180 local + 19 network.
//
// So the filter below is the privacy guarantee, not a preference. It is also why `voices()` is
// part of the surface: a caller that cannot see `local` cannot honour it.

import { spokenChunks } from "./spokenForm";

const synth = () =>
  (typeof window !== "undefined" && window.speechSynthesis) || null;

// ── the built-in engine ────────────────────────────────────────────────────────────────────────

// ALL THINGS BEING EQUAL, PICK A VOICE THAT SOUNDS LIKE A PERSON. `default: true` is not good
// enough to trust: the same machine reports Samantha as default in Chrome and ALBERT in Electron,
// and Albert is the robot voice from 1991. This list is a HINT, in order, and every entry is
// optional — the fallbacks below are what make it platform-independent. Nothing breaks on a
// machine that has none of these; it just takes the first local voice for the language.
const PREFERRED = [
  "Samantha", "Karen", "Moira", "Tessa", "Daniel", "Rishi", // macOS
  "Microsoft Aria", "Microsoft Jenny", "Microsoft Guy", "Microsoft Zira", // Windows
  "English (America)", "English (Great Britain)", // common espeak/Linux naming
];

const asVoice = (v) => ({ id: v.voiceURI || v.name, name: v.name, lang: v.lang, local: !!v.localService, raw: v });

// Chrome populates the list asynchronously — the first call after a cold load returns []. The
// caller is expected to re-ask (the button does, on `voiceschanged`), so this stays a plain read
// with no promise and no cache to go stale.
function builtinVoices() {
  const s = synth();
  if (!s || typeof s.getVoices !== "function") return [];
  // LOCAL ONLY. This single filter is the entire "works offline, sends nothing" claim.
  return (s.getVoices() || []).map(asVoice).filter((v) => v.local);
}

function pick(list, lang) {
  if (!list.length) return null;
  const want = String(lang || (typeof navigator !== "undefined" && navigator.language) || "en-US");
  const base = want.split("-")[0].toLowerCase();
  const sameLang = list.filter((v) => String(v.lang || "").toLowerCase().startsWith(base));
  const pool = sameLang.length ? sameLang : list;
  for (const name of PREFERRED) {
    const hit = pool.find((v) => v.name === name) || pool.find((v) => v.name.startsWith(name));
    if (hit) return hit;
  }
  return pool.find((v) => v.raw && v.raw.default) || pool[0];
}

const builtin = {
  name: "speechSynthesis",

  available: () => {
    const s = synth();
    return !!(s && typeof s.speak === "function");
  },

  voices: builtinVoices,

  stop() {
    const s = synth();
    if (s && typeof s.cancel === "function") s.cancel();
  },

  // SPOKEN IN CHUNKS, QUEUED. One long utterance cannot be interrupted on a boundary and several
  // builds stall or truncate on them, so the text arrives as whole sentences and `stop()` lands
  // between two of them instead of waiting out a paragraph.
  speak(text, opts = {}) {
    const s = synth();
    const body = String(text || "").trim();
    if (!s || !body) {
      if (opts.onend) opts.onend();
      return { stop() {} };
    }

    const chunks = spokenChunks(body);
    const chosen = opts.voice || pick(builtinVoices(), opts.lang);
    let done = false;
    let started = false;
    // EXACTLY ONCE, whatever happens. The button's state is this callback; a path that forgets it
    // leaves the control stuck reading "speaking" over silence.
    const finish = (err) => {
      if (done) return;
      done = true;
      if (err && opts.onerror) opts.onerror(err);
      if (opts.onend) opts.onend(err);
    };

    // A fresh cancel first: the queue is global to the page, so a second press anywhere would
    // otherwise append to whatever is already talking.
    s.cancel();

    let n = 0;
    const next = () => {
      if (done) return;
      if (n >= chunks.length) return finish();
      const u = new window.SpeechSynthesisUtterance(chunks[n]);
      n += 1;
      if (chosen && chosen.raw) u.voice = chosen.raw;
      if (chosen && chosen.lang) u.lang = chosen.lang;
      u.rate = opts.rate || 1;
      u.pitch = opts.pitch || 1;
      u.volume = opts.volume === undefined ? 1 : opts.volume;
      u.onstart = () => {
        if (started || done) return;
        started = true;
        if (opts.onstart) opts.onstart();
      };
      u.onend = next;
      // A CANCEL ARRIVES HERE AS AN ERROR, and it is not one. Treating it as a failure would pop
      // an error state every time he presses stop, which is the normal way this ends.
      u.onerror = (e) => {
        const why = (e && e.error) || "";
        if (why === "interrupted" || why === "canceled" || why === "cancelled") return finish();
        return finish(e);
      };
      s.speak(u);
    };
    next();

    return {
      stop() {
        if (done) return;
        done = true;
        s.cancel();
        if (opts.onend) opts.onend();
      },
    };
  },
};

// ── the seam ───────────────────────────────────────────────────────────────────────────────────

let ENGINE = builtin;

/** Replace the implementation. The only line a service engine needs to touch. */
export function useEngine(impl) {
  ENGINE = impl || builtin;
  return ENGINE;
}

export const engineName = () => ENGINE.name || "custom";
export const available = () => !!ENGINE.available && ENGINE.available();
export const voices = () => (ENGINE.voices ? ENGINE.voices() : []);
export const stop = () => ENGINE.stop && ENGINE.stop();
export const speak = (text, opts) => ENGINE.speak(text, opts || {});

const voice = { available, voices, speak, stop, useEngine, engineName };
export default voice;
