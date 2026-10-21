import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./styles.scss";
import { spokenForm } from "../../utils/spokenForm";
import { available, speak, stop, voices } from "../../utils/voice";

// PRESS A REPLY AND HEAR IT. His ask, straight: he reads a lot of long replies and wants the
// option to listen instead. One control, and it is the same control both ways — press to start,
// press again to stop — because a separate stop button is a second thing to find at the moment
// you most want the noise to end.
//
// EVERYTHING THIS COMPONENT KNOWS IS IN THIS FILE. It is mounted with one line where the reply
// renders, and it holds all of the behaviour: what is speakable (`spokenForm`), who says it
// (`voice`), and which reply owns the speaker right now (below). That is deliberate — the chat is
// worked on by a lot of hands at once, and a feature that spreads across it cannot be added
// without taking something else apart.
//
// IT HIDES ITSELF WHEN IT CANNOT WORK. No voice on the machine, or a reply with nothing speakable
// in it (a bare screenshot, a lone table), and there is no button at all. A control that does
// nothing when pressed is worse than an absent one, because it costs a press to learn that.

// ONE SPEAKER, ONE REPLY. `speak()` cancels whatever was talking — that is right — but the button
// that WAS talking would be left wearing its speaking state over silence. So a press announces
// itself and every other mounted button stands down. A module-local list, not context: it is a
// detail of this component and nothing above it should have to know about it.
const listeners = new Set();
let owner = 0;
let nextId = 1;
const claim = (id) => {
  owner = id;
  listeners.forEach((fn) => fn(id));
};

// `sv:speaking` — AND IT IS NOT DECORATION. The dictation mic in this app is a TOGGLE, and while
// it is on the host holds the audio track open continuously: `dictationBridge.cjs` calls
// getUserMedia ONCE and recycles only the MediaRecorder, so every sound over an RMS threshold of
// 0.023 is cut into a segment and sent to whisper — and it re-transcribes the live buffer every
// 1200ms. A reply read out of the speakers while the mic is armed is therefore transcribed back as
// if he had said it. (The chat's send happens to cancel the recorder, so a reply spoken right
// after a send is safe; re-arming the mic while one is still being read is not, and the Board,
// Thread and code-comment mics have no such rule at all.)
//
// THE FIX IS HOST-SIDE AND IT IS TWO LINES — `pause()`/`resume()` on the control object
// `dictationBridge.cjs` returns, toggling `track.enabled`, which makes the track deliver silence
// so all four of the existing guards (the RMS gate, the draft timer's `!spoke`, `closeSegment`'s
// `hadSpeech`, and the −45 dB floor in `dictation.cjs`) do the right thing for free. That lives in
// another repo. What belongs HERE is the one thing it has to listen for, named the way every other
// cross-surface signal in this app is named:
//
//   window.addEventListener("sv:speaking", (e) => (e.detail.on ? mic.pause() : mic.resume()))
//
// Fired on every start and every end — including a press of stop and a failure, because a mute
// that is never released is a dead microphone.
const announce = (on) => {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent("sv:speaking", { detail: { on } }));
  } catch {
    /* an environment with no CustomEvent still gets to hear the reply */
  }
};

const SpeakReply = ({ text, className = "" }) => {
  const CN = "speak-reply";
  const id = useMemo(() => nextId++, []);
  const [speaking, setSpeaking] = useState(false);
  // Chrome populates the voice list asynchronously, so the first render of a cold page can see an
  // empty one. This is the re-ask, and it is why `voices()` is on the adapter's surface.
  const [ready, setReady] = useState(() => voices().length > 0);
  const handle = useRef(null);

  const spoken = useMemo(() => spokenForm(text), [text]);

  useEffect(() => {
    const fn = (who) => {
      if (who !== id) setSpeaking(false);
    };
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
      // UNMOUNTING MID-SENTENCE MUST NOT LEAVE A VOICE RUNNING. The feed re-renders constantly;
      // a reply scrolled out of the list while reading would otherwise keep talking with nothing
      // on screen to stop it.
      if (owner === id) {
        stop();
        announce(false);
      }
      if (handle.current) handle.current.stop();
    };
  }, [id]);

  useEffect(() => {
    if (ready || typeof window === "undefined" || !window.speechSynthesis) return undefined;
    const onChanged = () => setReady(voices().length > 0);
    window.speechSynthesis.addEventListener?.("voiceschanged", onChanged);
    // A build that fires `voiceschanged` before this mounted never fires it again, so one late
    // look is the belt — otherwise the button is permanently absent on a fast load.
    const t = setTimeout(onChanged, 400);
    return () => {
      clearTimeout(t);
      window.speechSynthesis.removeEventListener?.("voiceschanged", onChanged);
      clearTimeout(t);
    };
  }, [ready]);

  const press = useCallback(
    (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (speaking) {
        if (handle.current) handle.current.stop();
        else stop();
        handle.current = null;
        setSpeaking(false);
        announce(false);
        return;
      }
      claim(id);
      setSpeaking(true);
      announce(true);
      handle.current = speak(spoken, {
        onend: () => {
          handle.current = null;
          // Only the owner clears the state — a stale callback from a reply that was interrupted
          // must not switch off the one that interrupted it.
          if (owner === id) {
            setSpeaking(false);
            announce(false);
          }
        },
      });
    },
    [id, speaking, spoken],
  );

  if (!spoken || !available() || !ready) return null;

  return (
    <button
      type="button"
      className={`${CN}${speaking ? ` ${CN}--on` : ""}${className ? ` ${className}` : ""}`}
      onClick={press}
      aria-pressed={speaking}
      aria-label={speaking ? "Stop reading this reply" : "Read this reply aloud"}
      title={
        speaking
          ? "Stop reading"
          : `Read this aloud — ${Math.max(1, Math.round(spoken.length / 900))} min, local voice, nothing leaves the machine`
      }
    >
      {/* THE STATE IS NOT ONLY THE GLYPH. A swapped icon on a small control is easy to miss in a
          long feed, so a reply that is being read also carries a moving bar — the one thing in a
          static transcript that is unmistakably live. */}
      <span className={`${CN}__mark`} aria-hidden="true">
        {speaking ? "◼" : "▶"}
      </span>
      <span className={`${CN}__word`}>{speaking ? "Reading" : "Listen"}</span>
      {speaking && (
        <span className={`${CN}__wave`} aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      )}
    </button>
  );
};

export default SpeakReply;
