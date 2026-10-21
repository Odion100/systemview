import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./styles.scss";
import { spokenForm } from "../../utils/spokenForm";
import { available, speak, stop, voices } from "../../utils/voice";
import { announce, claim, isOwner, nextSpeakerId, subscribe } from "./speaker";
import VoicePicker from "./VoicePicker";

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

const SpeakReply = ({ text, className = "" }) => {
  const CN = "speak-reply";
  const id = useMemo(() => nextSpeakerId(), []);
  const [speaking, setSpeaking] = useState(false);
  // Chrome populates the voice list asynchronously, so the first render of a cold page can see an
  // empty one. This is the re-ask, and it is why `voices()` is on the adapter's surface.
  const [ready, setReady] = useState(() => voices().length > 0);
  const handle = useRef(null);

  const spoken = useMemo(() => spokenForm(text), [text]);

  useEffect(() => {
    const off = subscribe((who) => {
      if (who !== id) setSpeaking(false);
    });
    return () => {
      off();
      // UNMOUNTING MID-SENTENCE MUST NOT LEAVE A VOICE RUNNING. The feed re-renders constantly;
      // a reply scrolled out of the list while reading would otherwise keep talking with nothing
      // on screen to stop it.
      if (isOwner(id)) {
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
          if (isOwner(id)) {
            setSpeaking(false);
            announce(false);
          }
        },
      });
    },
    [id, speaking, spoken],
  );

  if (!spoken || !available() || !ready) return null;

  // THE PICKER RIDES WITH THE BUTTON, not in a settings page. Which voice reads a reply is a
  // judgement you make WHILE listening to one — a preference buried two screens away is one he
  // would have to leave the conversation to change.
  return (
    <span className={`${CN}-row`}>
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
        {/* THE STATE IS NOT ONLY THE GLYPH. A swapped icon on a small control is easy to miss in
            a long feed, so a reply that is being read also carries a moving bar — the one thing
            in a static transcript that is unmistakably live. */}
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
      <VoicePicker />
    </span>
  );
};

export default SpeakReply;
