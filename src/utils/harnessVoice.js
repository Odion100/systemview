// VOICE FROM THE HARNESS — the engine this window should be using whenever it is running inside
// the shell.
//
// HIS RULING, and it is a correction to how I first built this: *"you should be getting the
// functionality from the harness."* Speech is not a SystemView feature that the shell also happens
// to have — it is a harness CAPABILITY, like `files`, `dictation` and `vectors`, and SystemView is
// one of its consumers. The difference is not cosmetic:
//
//   * ONE MODEL FOR THE WHOLE WINDOW. The weights live once at ~/.autobot/models/voice and every
//     app the shell hosts speaks with them. In-page, every app would fetch its own 86MB into its
//     own browser cache, and the product would sound different depending on which tab you were in.
//   * THE WINDOW NEVER DOES INFERENCE. Generation happens in a node child process out in the
//     shell — so a long reply cannot jank the UI, and a crash in the model is a rejected promise
//     instead of a dead renderer.
//   * APPS THAT DO NOT EXIST YET GET IT FREE, which is the whole argument for a capability.
//
// IT IS STILL ONE FUNCTION DIFFERENT from the in-page engine. The player — the audio context, the
// pause, the buffer cache, the seekable loop — is `speechEngine.js` and is shared.
import { makeSpeechEngine } from "./speechEngine";
import { KOKORO_VOICES, bestVoice } from "./kokoroVoices";

/** The capability, or null when this window is not inside the harness (a plain browser tab). */
export const door = () => {
  try {
    return (typeof window !== "undefined" && window.systemview && window.systemview.voice) || null;
  } catch {
    return null;
  }
};

export const available = () =>
  !!door() && typeof window !== "undefined" && !!(window.AudioContext || window.webkitAudioContext);

// BASE64 FLOAT32 OVER IPC, decoded straight into the samples an AudioBuffer wants. Nothing encodes
// a WAV on either side: the model produces float32 and the player consumes float32, so any
// container in between would be two conversions to arrive back where we started.
const decode = (b64) => {
  const bin = window.atob(b64 || "");
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Float32Array(bytes.buffer);
};

let READY = false;
let LAST_ERROR = null;

// THE VOICE LIST IS THE SAME TABLE, and it is read locally rather than over IPC on purpose: the
// panel draws 28 rows the instant it opens, and a round trip would make the list a spinner. The
// harness answers with the same model's voices — `kokoroVoices.js` is generated from it — so this
// is a cached copy of the truth rather than a second opinion. (A mismatch would show up as a
// `speak` refusing an id, which is loud.)
const asVoice = (v) => ({
  id: v.id,
  name: v.name,
  lang: v.lang,
  local: true, // the weights are on this machine; the shell is not a server
  grade: v.grade,
  gender: v.gender,
});

const generate = async (text, { voice, speed }) => {
  const api = door();
  if (!api) throw new Error("the harness is not here");
  const r = await api.speak(text, { voice, speed });
  if (!r || !r.audio) throw new Error("the harness returned no audio");
  READY = true;
  return { audio: decode(r.audio), sampleRate: r.sampleRate };
};

// PREWARM IS A STATUS CALL, NOT A DOWNLOAD. The shell may already hold the weights from another
// app or an earlier session, and `modelReady` is its honest answer — so a surface can say
// "downloading" only when something really is.
const prewarm = async () => {
  const api = door();
  if (!api) return null;
  try {
    const s = await api.status();
    READY = !!(s && s.ready);
    LAST_ERROR = null;
    return s;
  } catch (e) {
    LAST_ERROR = e;
    throw e;
  }
};

const harness = makeSpeechEngine({
  name: "harness",
  generate,
  voices: () => KOKORO_VOICES.map(asVoice),
  available,
  ready: () => READY,
  loading: () => !!door() && !READY,
  lastError: () => LAST_ERROR,
  progress: () => null,
  prewarm,
  defaultVoice: () => bestVoice().id,
});

export default harness;
