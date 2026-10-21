// KOKORO — THE VOICE, RUNNING ON HIS MACHINE AS A FILE. An 82M-parameter model, no key, no
// account, nothing left after the weights are cached. It implements `voice.js`'s engine contract
// exactly — `available`, `voices`, `speak`, `stop` — so the Listen button and `spokenForm.js` never
// learn its name.
//
// WHY IT REPLACED `speechSynthesis` OUTRIGHT RATHER THAN SITTING BEHIND IT. His ruling, and he is
// right about the direction the portability runs: the BUILT-IN voices are the machine-specific
// half. `speechSynthesis` hands a Mac 184 voices, a Windows box three, and a Linux box whatever
// `espeak` was compiled with — so "fall back to the system voice" means the product sounds
// different on every machine and good on exactly one. This model ships the same 28 voices
// everywhere. Keeping the old engine as a fallback would have preserved the one behaviour we were
// trying to delete.
//
// SO THERE IS NO FALLBACK, AND THAT IS A PROMISE ABOUT ERRORS. With nothing to fall back to, a
// failed load must be SAID — `onerror` with the reason, and `lastError()` for a surface that wants
// to show it. Silence is the one outcome a listener cannot tell apart from a broken feature, and it
// is exactly what a quiet fallback produces.
import { makeSpeechEngine } from "./speechEngine";
import { KOKORO_MODEL, KOKORO_VOICES, bestVoice } from "./kokoroVoices";

// ── loading the model, once, lazily ────────────────────────────────────────────────────────────
//
// DYNAMIC IMPORT, NOT A TOP-LEVEL ONE. `kokoro-js` pulls in `@huggingface/transformers`, which is
// megabytes of runtime — imported at the top of this file it lands in the main bundle and every
// cold load of the window pays for it whether or not anybody presses Listen. `import()` makes it
// its own chunk, fetched the first time speech is asked for.
//
// WEBGPU IS TRIED FIRST AND IT IS NOT A PREFERENCE. On the GPU this is roughly real-time; on the
// WASM backend a sentence takes a second or two. The dtype has to move WITH the device — the q8
// quantisation that keeps the WASM download small is not what the WebGPU backend wants, and asking
// for the pair that does not exist fails the load rather than running slowly.
const DEVICE = () =>
  typeof navigator !== "undefined" && navigator.gpu
    ? { device: "webgpu", dtype: "fp32" }
    : { device: "wasm", dtype: "q8" };

let MODEL = null;
let LOADING = null;
let LAST_ERROR = null;
let PROGRESS = null;

export const ready = () => !!MODEL;
export const loading = () => !!LOADING && !MODEL;
export const lastError = () => LAST_ERROR;
export const progress = () => PROGRESS;

// A FAILED LOAD CLEARS THE PROMISE. Caching a rejected promise makes the first failure permanent:
// every later press would re-reject with a stale error and the real cause (offline for one minute)
// could never be retried. The model itself is cached; the attempt is not.
function load(onprogress) {
  if (MODEL) return Promise.resolve(MODEL);
  if (!LOADING) {
    const { device, dtype } = DEVICE();
    LOADING = import("kokoro-js")
      .then(({ KokoroTTS }) =>
        KokoroTTS.from_pretrained(KOKORO_MODEL, {
          device,
          dtype,
          progress_callback: (p) => {
            PROGRESS = p;
            if (onprogress) onprogress(p);
          },
        }),
      )
      .then((m) => {
        MODEL = m;
        LAST_ERROR = null;
        PROGRESS = null;
        return m;
      })
      .catch((e) => {
        LOADING = null;
        PROGRESS = null;
        LAST_ERROR = e;
        throw e;
      });
  }
  return LOADING;
}

/** Start the download before anybody presses anything — the picker calls this when it opens. */
export const prewarm = (onprogress) => load(onprogress).catch(() => null);

// ── the engine ─────────────────────────────────────────────────────────────────────────────────
//
// THE PLAYER IS NOT HERE — it is `speechEngine.js`, shared with the harness-backed engine, because
// the two differ in exactly one function: how a sentence becomes samples. Everything else (the
// audio context, the suspend-based pause, the buffer cache, the seekable loop) is the half with
// all the bugs in it, and two copies would be two places to fix the next one.
const asVoice = (v) => ({
  id: v.id,
  name: v.name,
  lang: v.lang,
  local: true, // every one of them: the weights are on disk and nothing is sent anywhere
  grade: v.grade,
  gender: v.gender,
});

// THE ONE FUNCTION THAT MAKES THIS ENGINE ITSELF. The model is in this page, so a sentence is
// generated on this thread — which is the reason to prefer the harness when there is one: out
// there it runs in a node child process and the window never does inference at all.
const generate = async (text, { voice, speed }) => {
  const tts = await load();
  const out = await tts.generate(text, { voice, speed });
  return { audio: out.audio, sampleRate: out.sampling_rate };
};

const kokoro = makeSpeechEngine({
  name: "kokoro",
  generate,
  // STATIC, so the menu draws 28 rows with no model loaded. `kokoroVoices.js` says why.
  voices: () => KOKORO_VOICES.map(asVoice),
  // TRUE BEFORE THE MODEL EXISTS, and that is deliberate. `available()` answers *can this machine
  // speak at all* — not *is it ready this millisecond*. Answering `false` while the weights
  // download would hide the Listen button for the first minute of every cold start, so readiness
  // is `ready()`/`loading()` and the control stays where he left it.
  available: () => typeof window !== "undefined" && !!(window.AudioContext || window.webkitAudioContext),
  ready,
  loading,
  lastError,
  progress,
  prewarm,
  defaultVoice: () => bestVoice().id,
});

export default kokoro;
