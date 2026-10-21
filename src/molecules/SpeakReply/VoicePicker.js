import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { speak, stop, voices } from "../../utils/voice";
import { sortVoices, qualityOf, PREMIUM, ENHANCED, NOVELTY } from "../../utils/voiceChoice";
import { readVoicePref, writeVoicePref } from "../../utils/voicePref";
import { announce, claim, isOwner, nextSpeakerId, subscribe } from "./speaker";

// HEAR IT BEFORE YOU KEEP IT. The first attempt at auditioning voices was a shell loop that read
// seven of them end to end: forty seconds of serial playback with no way to skip, and he killed
// it — correctly. Comparing voices is a thing you do by jumping between them, so every row plays
// on press AND THE MENU STAYS OPEN. Choosing is a second, separate press.
//
// WHY NOT `SvSelect`. It is the app's selector and this would otherwise be a job for it, but it
// closes on choose and has exactly one action per row. A list where pressing a row is "let me
// hear that" rather than "I'll take it" is a different control, not a configured one — so this
// borrows its dismiss behaviour and its tokens, and nothing else.
//
// EVERY VOICE HERE IS LOCAL. `voices()` filters on `localService`, which is the whole of the
// "nothing leaves the machine" claim — so the list cannot offer a network voice by accident.

const SAMPLE =
  "Here is a full sentence, so you can hear how this voice handles ordinary prose.";

const TIER = { [PREMIUM]: "premium", [ENHANCED]: "enhanced", [NOVELTY]: "novelty" };

const VoicePicker = () => {
  const CN = "voice-picker";
  const id = useMemo(() => nextSpeakerId(), []);
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState(() => readVoicePref());
  const [playing, setPlaying] = useState("");
  const ref = useRef(null);
  const handle = useRef(null);

  const list = useMemo(() => (open ? sortVoices(voices()) : []), [open]);

  const halt = useCallback(() => {
    if (handle.current) handle.current.stop();
    else stop();
    handle.current = null;
    setPlaying("");
    announce(false);
  }, []);

  // Dismiss exactly as SvSelect does — away-click and Escape — and SILENCE ON THE WAY OUT. A menu
  // that closes while still talking leaves a voice playing with nothing on screen to stop it.
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const esc = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  useEffect(() => {
    if (!open) halt();
  }, [open, halt]);

  useEffect(() => {
    const off = subscribe((who) => {
      if (who !== id) setPlaying("");
    });
    return () => {
      off();
      if (isOwner(id)) {
        stop();
        announce(false);
      }
      if (handle.current) handle.current.stop();
    };
  }, [id]);

  const preview = (v) => {
    if (playing === v.id) {
      halt();
      return;
    }
    claim(id);
    setPlaying(v.id);
    announce(true);
    handle.current = speak(`${v.name.replace(/\s*\([^)]*\)\s*$/, "")}. ${SAMPLE}`, {
      voice: v,
      onend: () => {
        handle.current = null;
        if (isOwner(id)) {
          setPlaying("");
          announce(false);
        }
      },
    });
  };

  const keep = (voiceId) => {
    setChosen(writeVoicePref(voiceId));
    halt();
    setOpen(false);
  };

  if (!voices().length) return null;

  return (
    <span className={CN} ref={ref}>
      <button
        type="button"
        className={`${CN}__open${open ? ` ${CN}__open--on` : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setOpen(!open);
        }}
        aria-expanded={open}
        aria-label="Choose the voice"
        title="Choose the voice — press one to hear it"
      >
        ▾
      </button>

      {open && (
        <div className={`${CN}__menu`} role="menu">
          <div className={`${CN}__head`}>
            {list.length} local {list.length === 1 ? "voice" : "voices"} — press to hear, Keep to
            set
          </div>

          {/* THE WAY BACK. Without this, picking once is permanent and there is no way to say
              "you choose" again — and automatic is the right answer the moment he downloads a
              better voice than the one he picked. */}
          <button
            type="button"
            className={`${CN}__row${chosen ? "" : ` ${CN}__row--on`}`}
            onClick={() => keep("")}
          >
            <span className={`${CN}__name`}>Choose for me</span>
            <span className={`${CN}__lang`}>best quality available</span>
          </button>

          {list.map((v) => {
            const tier = TIER[qualityOf(v.name)];
            const on = playing === v.id;
            return (
              <div
                key={v.id}
                className={`${CN}__row${chosen === v.id ? ` ${CN}__row--on` : ""}${on ? ` ${CN}__row--playing` : ""}`}
              >
                <button
                  type="button"
                  className={`${CN}__play`}
                  onClick={() => preview(v)}
                  aria-label={on ? `Stop ${v.name}` : `Hear ${v.name}`}
                  title={on ? "Stop" : "Hear this voice"}
                >
                  {on ? "◼" : "▶"}
                </button>
                <span className={`${CN}__name`}>{v.name}</span>
                <span className={`${CN}__lang`}>{v.lang}</span>
                {tier && <span className={`${CN}__tier ${CN}__tier--${tier}`}>{tier}</span>}
                <button type="button" className={`${CN}__keep`} onClick={() => keep(v.id)}>
                  {chosen === v.id ? "kept" : "Keep"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </span>
  );
};

export default VoicePicker;
