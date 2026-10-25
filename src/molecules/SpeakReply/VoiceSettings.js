import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { lastError, prewarm, ready, speak, stop, voices } from "../../utils/voice";
import { sortVoices } from "../../utils/voiceChoice";
import {
  MODES,
  readVoicePref,
  readVoiceSettings,
  writeVoicePref,
  writeVoiceSettings,
  VOICE_PREFS_EVENT,
} from "../../utils/voicePref";
import { AIMED_AT_YOU, BLOCK_VOICES, EVERYTHING, PROSE } from "../../utils/spokenForm";
import { useMarkdownScope } from "../../atoms/Markdown/context";
import { announce, claim, isOwner, nextSpeakerId, subscribe } from "./speaker";

// VOICE IS A SETTINGS SURFACE, NOT A VOICE LIST. It began as a dropdown of voices and outgrew it
// the moment there was more than one thing to decide — his words: *"the whole point is you got to
// be able to choose more than just switching with your voice."* Four decisions live here, and
// they are genuinely different kinds of thing, which is why they are laid out the way they are:
//
//   * THE MODE sits in the HEADER, outside the tabs, visible whichever tab is open — but the
//     control he actually reaches for is NOT here. It is at the composer (`VoiceMode`), because
//     switching should never mean opening a form. This copy exists so the panel shows the truth
//     about what is set while he is configuring it, not as the primary door.
//   * THE VOICE AND THE SPEED are one tab. Both are "how it sounds", both are picked rarely, and
//     auditioning a voice at the wrong speed tells you nothing — so the slider sits above the
//     list where it is set before anything is played.
//   * WHAT GETS READ is the other tab, and it is a MULTI-SELECT over the block vocabulary rather
//     than a mode. The blocks exist to carry intent; choosing which intents are worth
//     interrupting him for is his call, not a judgement baked in here.
//
// THE SET AND THE SWITCH ARE DELIBERATELY NOT ONE CONTROL. "Off" is not a member of the block
// set. The set is his taste and changes every few weeks; the switch is his situation and changes
// every few minutes, and folding them together would mean re-picking his blocks every time he
// turned speech back on.
//
// HEAR IT BEFORE YOU KEEP IT. The first attempt at auditioning voices was a shell loop that read
// seven of them end to end: forty seconds of serial playback with no way to skip, and he killed
// it — correctly. Comparing voices is a thing you do by jumping between them, so every row plays
// on press AND THE PANEL STAYS OPEN. Choosing is a second, separate press.
//
// AND THE FIRST PRESS DOWNLOADS 86MB, WHICH IS WHY THERE IS A LOADING LINE. A panel that draws 28
// rows and then goes silent for forty seconds is indistinguishable from a broken one. Opening it
// STARTS the download, the head says so with a percentage, and a failure says what failed.

const SAMPLE =
  "Here is a full sentence, so you can hear how this voice handles ordinary prose.";

// FOUR BANDS OVER THE MODEL'S OWN GRADES — A, B, C, and everything from D down. The grade is the
// reason the list is in this order, so it is shown rather than implied by position.
const band = (grade) => {
  const g = String(grade || "").charAt(0).toUpperCase();
  return g === "A" ? "a" : g === "B" ? "b" : g === "C" ? "c" : "d";
};

// THE PRESETS EXIST SO THE FIRST USE IS ONE PRESS. Twenty-two tick boxes is a correct control and
// a terrible first impression; a preset is a starting point he then edits, which is the way he
// described using it — *"I can see the work and I could say oh I want this one too."*
const PRESETS = [
  { id: "ask", label: "Just the ask", set: ["ask"] },
  { id: "aimed", label: "Aimed at you", set: AIMED_AT_YOU },
  { id: "all", label: "Everything", set: EVERYTHING },
  { id: "none", label: "Nothing", set: [] },
];

const PANEL_W = 380;
const PANEL_MAX = 420;

const same = (a, b) => a.length === b.length && [...a].sort().join() === [...b].sort().join();

const VoiceSettings = ({ scope = "" }) => {
  const CN = "voice-settings";
  const id = useMemo(() => nextSpeakerId(), []);
  // WHOSE CHAT THIS IS. The chat provides it, because the URL is not the chat's identity once the
  // chat is docked. An explicit `scope` wins: this control is mounted at the COMPOSER, which sits
  // outside the provider that wraps the feed — without the prop it read a "default" bucket while
  // the replies two inches above it read the chat's own, and the two disagreed in his window.
  const fromMarkdown = useMarkdownScope();
  const projectCode = scope || fromMarkdown.projectCode;
  const [open, setOpen] = useState(false);
  // WHAT IT READS OPENS FIRST. His reasoning, and it is right: the voice is chosen once and then
  // forgotten, while the block set is the thing he comes back to. Opening on the list of 28 voices
  // put the rarely-changed decision in front of the frequently-changed one.
  const [tab, setTab] = useState("reads");
  const [chosen, setChosen] = useState(() => readVoicePref(projectCode));
  const [settings, setSettings] = useState(() => readVoiceSettings(projectCode));
  const [playing, setPlaying] = useState("");
  const [load, setLoad] = useState(() => (ready() ? "ready" : ""));
  const [pct, setPct] = useState(0);
  const ref = useRef(null);
  const handle = useRef(null);
  // WHERE TO DRAW THE PANEL, in page coordinates. It used to be an absolutely-positioned child of
  // the button, which put it inside whatever the composer's ancestors clip — and the composer is a
  // scrolling, overflow-hidden region, so the panel came out sliced. A portal to <body> is the
  // only thing that escapes an ancestor's overflow; the cost is positioning it by hand.
  const [anchor, setAnchor] = useState(null);
  const panelRef = useRef(null);
  // EVERY PREVIEW CARRIES A TOKEN, because all of these rows share one component and therefore one
  // speaker id. Pressing voice B ends voice A, and A's `onend` then arrives AFTER B has already
  // set itself playing — so without this, interrupting A would blank the control that B just lit
  // and the stop button would vanish from a voice that is still talking.
  const seq = useRef(0);
  const wasOpen = useRef(false); // the popover's last open state — halt fires on open→closed only

  const list = useMemo(() => (open ? sortVoices(voices()) : []), [open]);

  // MEASURED ON OPEN, and again if the window moves under it. Above the button when there is room
  // and below when there is not — at the foot of a chat there usually is not room below, which is
  // why it opened upward in the first place.
  useEffect(() => {
    if (!open) return undefined;
    const place = () => {
      const el = ref.current && ref.current.querySelector(`.${CN}__open`);
      if (!el) return;
      const r = el.getBoundingClientRect();
      const room = r.top;
      setAnchor({
        left: Math.max(8, Math.min(r.left, window.innerWidth - PANEL_W - 8)),
        top: room > PANEL_MAX + 12 ? r.top - PANEL_MAX - 6 : Math.min(r.bottom + 6, window.innerHeight - PANEL_MAX - 8),
        maxHeight: Math.min(PANEL_MAX, Math.max(160, room > PANEL_MAX + 12 ? PANEL_MAX : window.innerHeight - r.bottom - 16)),
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);
  // `null` means he has never chosen, which reads as the default set — NOT as the empty set. An
  // empty array is a real choice and means silence.
  const blocks = settings.blocks === null ? AIMED_AT_YOU : settings.blocks;

  // SWITCHING CHATS RE-READS — the control is mounted once and the scope changes under it, so
  // state captured at mount would show one agent's settings while writing them to another's key.
  //
  // AND IT FOLLOWS THE PILL WHILE IT IS OPEN. Cycling the speaker with the panel up must move the
  // highlight in here, because that is how the three positions are LEARNED: press the toggle,
  // watch which one lights. Two siblings holding their own copy of one setting would have shown
  // him the old answer while he was being taught the new one.
  useEffect(() => {
    const read = () => {
      setChosen(readVoicePref(projectCode));
      setSettings(readVoiceSettings(projectCode));
    };
    read();
    window.addEventListener(VOICE_PREFS_EVENT, read);
    return () => window.removeEventListener(VOICE_PREFS_EVENT, read);
  }, [projectCode]);

  const save = useCallback((patch) => setSettings(writeVoiceSettings(patch, projectCode)), [projectCode]);

  // OPENING THE PANEL IS THE DOWNLOAD'S CUE. By the time he has read the list and picked a row to
  // audition, the weights are usually already here.
  useEffect(() => {
    if (!open) return undefined;
    if (ready()) {
      setLoad("ready");
      return undefined;
    }
    let live = true;
    setLoad("loading");
    prewarm((p) => {
      if (!live || !p) return;
      if (p.status === "progress" && p.total) setPct(Math.round((p.loaded / p.total) * 100));
    }).then(() => {
      if (live) setLoad(ready() ? "ready" : "failed");
    });
    return () => {
      live = false;
    };
  }, [open]);

  // HALT STOPS ONLY WHAT THIS WIDGET STARTED. It used to fall back to the global `stop()` when it
  // had no preview handle — which silenced a reply being read, since this widget mounts (and its
  // "closed → halt" effect fires) every time the chat panel remounts: docking, undocking, reopening.
  // Measured 2026-10-25: *"when I dock you back, you stop speaking."*
  const halt = useCallback(() => {
    seq.current += 1;
    if (handle.current) handle.current.stop();
    else if (isOwner(id)) stop();
    handle.current = null;
    setPlaying("");
    if (isOwner(id)) announce(false);
  }, [id]);

  // Dismiss exactly as SvSelect does — away-click and Escape — and SILENCE ON THE WAY OUT. A panel
  // that closes while still talking leaves a voice playing with nothing on screen to stop it.
  useEffect(() => {
    if (!open) return undefined;
    // WHAT COUNTS AS "AWAY" IS THREE PLACES, and each one was a bug before it was a rule.
    //
    //   1. THE PANEL IS NOT A DESCENDANT OF THIS SPAN — it is portalled to <body> to escape the
    //      composer's overflow. An away-test that only asked the anchor closed the panel on the
    //      first tick box.
    //   2. THE PILL IS NOT EITHER. The speaker toggle is a SIBLING of this control, and pressing
    //      it while the panel was open read as away: the panel closed instead of switching, so
    //      the one gesture that teaches what the three modes mean — press the toggle, watch which
    //      one lights — was the one gesture that could not be performed. His, measured.
    //   3. Everything else closes it, which is the behaviour the whole test exists for.
    const away = (e) => {
      const inAnchor = ref.current && ref.current.contains(e.target);
      const inPanel = panelRef.current && panelRef.current.contains(e.target);
      const inPill = e.target.closest && e.target.closest(".voice-mode");
      if (!inAnchor && !inPanel && !inPill) setOpen(false);
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
    // only on a real close — mounting closed is not closing
    if (wasOpen.current && !open) halt();
    wasOpen.current = open;
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
    const token = (seq.current += 1);
    claim(id);
    setPlaying(v.id);
    announce(true);
    // AUDITIONED AT HIS OWN SPEED. A voice sampled at 1.0 and then heard at 1.3 is a different
    // voice to the ear, so the slider governs the preview too — otherwise the audition is of
    // something he will never actually listen to.
    handle.current = speak(`${v.name}. ${SAMPLE}`, {
      voice: v,
      rate: settings.speed,
      onend: () => {
        if (seq.current !== token) return; // a newer preview owns the control now
        handle.current = null;
        if (isOwner(id)) {
          setPlaying("");
          announce(false);
        }
      },
    });
  };

  const keep = (voiceId) => {
    setChosen(writeVoicePref(voiceId, projectCode));
    halt();
  };

  const toggleBlock = (name) =>
    save({ blocks: blocks.includes(name) ? blocks.filter((b) => b !== name) : [...blocks, name] });

  if (!voices().length) return null;

  const says = BLOCK_VOICES.filter((b) => b.group === "says");
  const visual = BLOCK_VOICES.filter((b) => b.group === "visual");

  const blockRow = (b) => (
    <label key={b.name} className={`${CN}__check${blocks.includes(b.name) ? ` ${CN}__check--on` : ""}`}>
      <input type="checkbox" checked={blocks.includes(b.name)} onChange={() => toggleBlock(b.name)} />
      <span className={`${CN}__check-name`}>{b.label}</span>
      <span className={`${CN}__check-says`}>{b.says}</span>
    </label>
  );

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
        aria-label="Voice settings"
        title="Voice settings — voice, speed, and what it reads on its own"
      >
        ▾
      </button>

      {open &&
        createPortal(
          <div
            className={`${CN}__panel`}
            role="dialog"
            aria-label="Voice settings"
            ref={(n) => {
              panelRef.current = n;
            }}
            style={anchor ? { left: anchor.left, top: anchor.top, maxHeight: anchor.maxHeight } : { visibility: "hidden" }}
          >
          {/* THE SWITCH LIVES ABOVE THE TABS. It is the thing he reaches for most, and it must be
              one press from anywhere in this panel. */}
          <div className={`${CN}__head`}>
            <span className={`${CN}__modes`} role="group" aria-label="What it reads on its own">
              {MODES.map((m) => (
                <button
                  type="button"
                  key={m}
                  className={`${CN}__mode${settings.mode === m ? ` ${CN}__mode--on` : ""}`}
                  onClick={() => save({ mode: m })}
                  aria-pressed={settings.mode === m}
                >
                  {m === "off" ? "Off" : m === "set" ? "Targeted" : "Everything"}
                </button>
              ))}
            </span>
            {/* ELSEWHERE — what happens when a reply lands and this agent is not on screen (his
                design): wait for him, or pop the chat out and read. A background reading is never
                a background: if it speaks, it comes out where its controls are. */}
            {settings.mode !== "off" && (
              <button
                type="button"
                className={`${CN}__elsewhere${settings.background ? ` ${CN}__elsewhere--on` : ""}`}
                title={settings.background ? "When you are on another agent: pops out and reads. Click to make it wait for you." : "When you are on another agent: lines the reply up and waits for you. Click to make it pop out and read."}
                aria-pressed={!!settings.background}
                onClick={() => save({ background: !settings.background })}
              >
                {settings.background ? "elsewhere: pop out & read" : "elsewhere: wait"}
              </button>
            )}
            {load === "loading" && <span className={`${CN}__loading`}>downloading the voice — {pct}%</span>}
            {load === "failed" && (
              <span className={`${CN}__failed`}>
                the voice could not load — {String((lastError() && lastError().message) || "unknown")}
              </span>
            )}
          </div>

          <div className={`${CN}__tabs`} role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "reads"}
              className={`${CN}__tab${tab === "reads" ? ` ${CN}__tab--on` : ""}`}
              onClick={() => setTab("reads")}
            >
              What it reads
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "sound"}
              className={`${CN}__tab${tab === "sound" ? ` ${CN}__tab--on` : ""}`}
              onClick={() => setTab("sound")}
            >
              Voice &amp; speed
            </button>
          </div>

          {tab === "sound" && (
            <div className={`${CN}__body`}>
              <div className={`${CN}__speed`}>
                <span className={`${CN}__speed-label`}>Speed</span>
                <input
                  type="range"
                  min="0.75"
                  max="1.5"
                  step="0.05"
                  value={settings.speed}
                  onChange={(e) => save({ speed: Number(e.target.value) })}
                  aria-label="Speaking speed"
                />
                <span className={`${CN}__speed-value`}>{settings.speed.toFixed(2)}×</span>
              </div>

              {/* THE WAY BACK. Without this, picking once is permanent and there is no way to say
                  "you choose" again. */}
              <button
                type="button"
                className={`${CN}__row${chosen ? "" : ` ${CN}__row--on`}`}
                onClick={() => keep("")}
              >
                <span className={`${CN}__name`}>Choose for me</span>
                <span className={`${CN}__lang`}>the best-graded voice</span>
              </button>

              {list.map((v) => {
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
                    <span
                      className={`${CN}__grade ${CN}__grade--${band(v.grade)}`}
                      title={`the model rates this voice ${v.grade}`}
                    >
                      {v.grade}
                    </span>
                    {/* "USE", NOT "KEEP". The old pair was Keep/kept, and kept is the past tense
                        of an action — it reads as a receipt for something you did rather than as
                        the state the setting is in. His question, and he was right: the row is
                        saying which voice is in use, so it should say that. */}
                    <button type="button" className={`${CN}__keep`} onClick={() => keep(v.id)}>
                      {chosen === v.id ? "in use" : "Use"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {tab === "reads" && (
            <div className={`${CN}__body`}>
              <div className={`${CN}__presets`}>
                {PRESETS.map((p) => (
                  <button
                    type="button"
                    key={p.id}
                    className={`${CN}__preset${same(blocks, p.set) ? ` ${CN}__preset--on` : ""}`}
                    onClick={() => save({ blocks: p.set })}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <div className={`${CN}__note`}>
                Pressing Listen always reads the whole reply. This is what it reads{" "}
                <strong>on its own</strong>.
              </div>

              <div className={`${CN}__group`}>Blocks that say something</div>
              {says.map(blockRow)}

              {/* NOT A SECOND-CLASS GROUP — the honest label. These are ANNOUNCED, never read:
                  the content is on screen and the only useful thing in the ear is whether to
                  look. */}
              <div className={`${CN}__group`}>Announced, not read aloud</div>
              {visual.map(blockRow)}

              <label className={`${CN}__check${blocks.includes(PROSE) ? ` ${CN}__check--on` : ""}`}>
                <input
                  type="checkbox"
                  checked={blocks.includes(PROSE)}
                  onChange={() => toggleBlock(PROSE)}
                />
                <span className={`${CN}__check-name`}>Everything else</span>
                <span className={`${CN}__check-says`}>the words outside any block</span>
              </label>
            </div>
          )}
          </div>,
          document.body,
        )}
    </span>
  );
};

export default VoiceSettings;
