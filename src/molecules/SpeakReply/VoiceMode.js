import React, { useCallback, useEffect, useState } from "react";
import { readVoiceSettings, writeVoiceSettings, nextMode, VOICE_PREFS_EVENT } from "../../utils/voicePref";
import { useMarkdownScope } from "../../atoms/Markdown/context";
import VoiceSettings from "./VoiceSettings";

// WHAT THE AGENT READS TO YOU — ONE CONTROL, AT THE COMPOSER, NOT ON EVERY REPLY.
//
// It began life as a switch inside the panel on each reply's Listen button, which meant 67 copies
// of one setting on a busy page and a form to open before any of them could be changed. His
// correction, and it is the right one: *"it needs to be easy… I will be switching. Now I want it
// on everything. We're not having a conversation, I just probably want callout."* That is a
// property of the CONVERSATION, not of a reply — so it lives once, where the conversation happens.
//
// BESIDE THE MIC, DELIBERATELY. The mic is speech IN; this is speech OUT. They are the same
// decision made in two directions, he reaches for them at the same moments, and putting them
// together means the pair is learned once.
//
// ONE PRESS CYCLES: off → your set → everything → off. All three are one press from each other,
// because all three are places he actually goes — a design where "off" is cheap and "everything"
// is buried would be wrong in exactly the way he described.
//
// THE PANEL STILL EXISTS, behind the caret, and its job is now only CONFIGURATION: which voice,
// how fast, and what "your set" means. Switching never requires opening it.

const LABEL = {
  off: "off",
  set: "targeted — only the blocks you chose",
  all: "everything",
};

// THE WORDS ARE ON THE CONTROL, not only in its tooltip. Two glyphs and a caret told him nothing
// about what they did — his: *"it's hard for me to know, it's not user-friendly enough… it can
// show the text."* There is room at the foot of the chat, and a control whose whole purpose is to
// be switched constantly is the last place to be cryptic.
const WORD = { off: "Voice off", set: "Targeted", all: "Everything" };

const GLYPH = { off: "🔇", set: "🔈", all: "🔊" };

const VoiceMode = ({ className = "", scope = "" }) => {
  const CN = "voice-mode";
  // EXPLICIT SCOPE WINS. This control sits at the composer, OUTSIDE the provider that wraps the
  // feed — so without the prop it reads a "default" bucket while the replies above it read the
  // chat's own. Measured in his window: the composer said "reading everything" while this chat was
  // set to read nothing.
  const fromMarkdown = useMarkdownScope();
  const projectCode = scope || fromMarkdown.projectCode;
  const [mode, setMode] = useState(() => readVoiceSettings(projectCode).mode);

  // The scope changes under a control that is mounted once — switching chats must re-read, or it
  // shows one agent's mode while writing it to another's key. The event covers the other
  // direction: the PANEL can set the mode too, and the pill must follow it without a remount.
  useEffect(() => {
    const read = () => setMode(readVoiceSettings(projectCode).mode);
    read();
    window.addEventListener(VOICE_PREFS_EVENT, read);
    return () => window.removeEventListener(VOICE_PREFS_EVENT, read);
  }, [projectCode]);

  const cycle = useCallback(
    (e) => {
      e.stopPropagation();
      e.preventDefault();
      setMode(writeVoiceSettings({ mode: nextMode(mode) }, projectCode).mode);
    },
    [mode, projectCode],
  );

  return (
    <span className={`${CN}${className ? ` ${className}` : ""}`}>
      <button
        type="button"
        className={`${CN}__cycle ${CN}__cycle--${mode}`}
        onClick={cycle}
        aria-label={`Voice: ${LABEL[mode]}. Press to change.`}
        title={`Voice — ${LABEL[mode]}`}
      >
        <span className={`${CN}__glyph`} aria-hidden="true">
          {GLYPH[mode]}
        </span>
        <span className={`${CN}__word`}>{WORD[mode]}</span>
      </button>
      <VoiceSettings scope={projectCode} />
    </span>
  );
};

export default VoiceMode;
