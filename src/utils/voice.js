// THE PLAYER, AND THE SEAM AN ENGINE SLOTS INTO. Four verbs — `speak`, `stop`, `voices`,
// `available` — with Kokoro behind them. The surface is this small on purpose: the button and
// `spokenForm.js` are the parts worth keeping, and neither one may ever learn the name of an
// engine.
//
// THE BROWSER'S OWN `speechSynthesis` USED TO BE THE ENGINE, AND REMOVING IT WAS THE POINT.
// His ruling, and the portability runs the opposite way to how I first argued it: the BUILT-IN
// voices are the machine-specific half. `speechSynthesis` hands a Mac 184 voices, a Windows box a
// handful of Microsoft ones, and a Linux box whatever `espeak` was compiled with — so "fall back
// to the system voice" means the product sounds different on every machine and acceptable on
// exactly one. Kokoro is a FILE: the same 28 voices, the same quality, wherever it runs. Keeping
// the old engine underneath as a fallback would have preserved the single behaviour we were
// trying to delete, and it would have done it silently — the worst moment to hear a voice he
// rejected is the moment the good one failed to load.
//
// WHAT A SECOND IMPLEMENTATION HAS TO PROVIDE — the whole contract, so nobody has to read an
// engine to write one:
//
//   available()            → boolean. Can this machine speak AT ALL? Not "is it ready this
//                            millisecond" — a model still downloading is available and not yet
//                            ready, and conflating the two hides the control for the first
//                            minute of every cold start. Answering `false` is a first-class
//                            outcome: the control hides rather than lying.
//   voices()               → [{ id, name, lang, local, grade }]. Answerable with nothing loaded,
//                            because the picker draws its rows before anything is fetched.
//                            `local` is the "nothing leaves the machine" claim, per voice.
//   speak(text, opts)      → a HANDLE: { stop() }. opts = { voice, rate, lang, onstart, onend,
//                            onerror, onprogress }. `onend` MUST fire exactly once, on finishing
//                            OR on being stopped OR on failing, because the button's "speaking"
//                            state is driven by it and a handle that never resolves leaves a
//                            control stuck mid-press. The engine owns its own chunking and
//                            prefetch; the caller hands it one string.
//   stop()                 → silence everything this engine is playing, immediately. Not pause.
//
// AND ONE OBLIGATION THAT ONLY MATTERS BECAUSE THERE IS NO FALLBACK: a failure must be SAID.
// `onerror` with the reason, never silence — "nothing happened" is the one outcome a listener
// cannot distinguish from a broken feature, and with nothing to fall through to it is also the
// only one that could happen by accident.
import kokoro from "./kokoroEngine";
import harness, { available as harnessHere } from "./harnessVoice";
import { chooseVoice } from "./voiceChoice";
import { readVoicePref, readVoiceSettings } from "./voicePref";

// THE HARNESS FIRST, ALWAYS, WHEN IT IS THERE. Speech is a harness capability and this window is
// a consumer of it — one model for every app, generation out in a node process, nothing inferred
// in the renderer. The in-page engine is not a fallback for a BAD harness voice (there is no such
// thing; it is the same model) — it is the answer for a window that is not inside the harness at
// all, which is a plain browser tab on localhost:3000. Picked once at load because the shell does
// not appear halfway through a session.
let ENGINE = harnessHere() ? harness : kokoro;

/** Replace the implementation. The only line another engine needs to touch. */
export function useEngine(impl) {
  ENGINE = impl || kokoro;
  return ENGINE;
}

export const engineName = () => ENGINE.name || "custom";
export const available = () => !!ENGINE.available && ENGINE.available();
export const voices = () => (ENGINE.voices ? ENGINE.voices() : []);
export const stop = () => ENGINE.stop && ENGINE.stop();

// THE TRANSPORT, reachable without holding the handle that started the utterance. A control that
// appears only while something is playing did not necessarily start it — and an engine with no
// transport simply has none of these, which reads as "no pause, no seek" rather than as an error.
export const pause = () => ENGINE.pause && ENGINE.pause();
export const resume = () => ENGINE.resume && ENGINE.resume();
export const seek = (to) => ENGINE.seek && ENGINE.seek(to);
export const speaking = () => (ENGINE.speaking ? !!ENGINE.speaking() : false);
export const position = () => (ENGINE.position ? ENGINE.position() : null);

// READINESS IS NOT AVAILABILITY, and both are read rather than remembered. An engine with a model
// to fetch answers `loading()` while it fetches and `lastError()` when it could not — a surface
// that wants to say "downloading the voice, 40%" has somewhere to read it, and one that does not
// care is unaffected. Optional on purpose: an engine with nothing to load simply has no opinion,
// and `ready()` answers from `available()` instead of being false forever.
export const ready = () => (ENGINE.ready ? !!ENGINE.ready() : available());
export const loadingVoice = () => (ENGINE.loading ? !!ENGINE.loading() : false);
export const lastError = () => (ENGINE.lastError ? ENGINE.lastError() : null);
export const loadProgress = () => (ENGINE.progress ? ENGINE.progress() : null);
/** Start loading before anybody presses anything — the picker calls this when it opens. */
export const prewarm = (onprogress) =>
  ENGINE.prewarm ? ENGINE.prewarm(onprogress) : Promise.resolve(null);

// THE CHOICE IS MADE HERE, NOT IN THE ENGINE — so every engine inherits it and none of them has
// to know about localStorage. Read at press time and never cached: the picker writes the
// preference and nothing has to tell this file about it, which is also what lets a second window
// honour a choice made in the first.
export const speak = (text, opts = {}) => {
  const o = { ...opts };
  // SPEED IS READ HERE FOR THE SAME REASON THE VOICE IS — at press time, never cached, so the
  // slider takes effect on the next thing played with no wiring between the panel and the button.
  // An explicit `rate` from the caller still wins: the panel's own preview passes one so a voice
  // is auditioned at the speed it will actually be heard at.
  if (o.rate === undefined) o.rate = readVoiceSettings().speed;
  if (!o.voice) {
    const chosen = chooseVoice(voices(), {
      lang: o.lang,
      preferId: o.preferId || readVoicePref(),
    });
    if (chosen) o.voice = chosen;
  }
  return ENGINE.speak(text, o);
};

const voice = {
  available,
  voices,
  speak,
  stop,
  useEngine,
  engineName,
  pause,
  resume,
  seek,
  speaking,
  position,
  ready,
  loadingVoice,
  lastError,
  loadProgress,
  prewarm,
};
export default voice;
