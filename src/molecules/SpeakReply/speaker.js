// WHO IS TALKING, AND THE SIGNAL THE MICROPHONE LISTENS FOR. Lifted out of `SpeakReply` the
// moment a second control could start audio: the picker previews a voice, and a preview has to
// stand the reply buttons down exactly as another reply does. Two copies of "who owns the
// speaker" would have drifted the first time either one changed.
//
// ONE SPEAKER, ONE PRESS. `speak()` cancels whatever was talking — that is right — but the
// control that WAS talking would be left wearing its speaking state over silence. So a press
// announces itself and everything else mounted stands down.
const listeners = new Set();
let owner = 0;
let seq = 1;

/** A stable id for one control, for the life of its mount. */
export const nextSpeakerId = () => seq++;

/** Take the speaker. Everything else hears it and switches itself off. */
export const claim = (id) => {
  owner = id;
  listeners.forEach((fn) => fn(id));
};

/** Am I still the one talking? A stale callback from an interrupted control must not switch off
 *  the control that interrupted it. */
export const isOwner = (id) => owner === id;

export const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

// `sv:speaking` — AND IT IS NOT DECORATION. The dictation mic in this app is a TOGGLE, and while
// it is on the host holds the audio track open continuously: `dictationBridge.cjs` calls
// getUserMedia ONCE and recycles only the MediaRecorder, so every sound over an RMS threshold of
// 0.023 is cut into a segment and sent to whisper — and it re-transcribes the live buffer every
// 1200ms. A reply read out of the speakers while the mic is armed is therefore transcribed back
// as if he had said it.
//
// THE FIX IS HOST-SIDE AND IT IS TWO LINES — `pause()`/`resume()` on the control object
// `dictationBridge.cjs` returns, toggling `track.enabled`, which makes the track deliver silence
// so all four existing guards (the RMS gate, the draft timer's `!spoke`, `closeSegment`'s
// `hadSpeech`, and the −45 dB floor in `dictation.cjs`) do the right thing for free. That lives
// in another repo. What belongs HERE is the one thing it has to listen for:
//
//   window.addEventListener("sv:speaking", (e) => (e.detail.on ? mic.pause() : mic.resume()))
//
// Fired on every start and every end — including a press of stop and a failure, because a mute
// that is never released is a dead microphone. A VOICE PREVIEW COUNTS: it comes out of the same
// speakers and is transcribed just as happily.
export const announce = (on) => {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent("sv:speaking", { detail: { on } }));
  } catch {
    /* an environment with no CustomEvent still gets to hear the reply */
  }
};

const speaker = { nextSpeakerId, claim, isOwner, subscribe, announce };
export default speaker;
