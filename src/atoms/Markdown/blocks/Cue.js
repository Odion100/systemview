import React, { useEffect, useRef, useState } from "react";
import { useMarkdownScope } from "../context";
import { enqueue, done as queueDone } from "../../../molecules/SpeakReply/speechQueue";
import { performCue, cueVerb, cueLabel } from "../../../utils/cuePerform";

// `::cue` — ONE DIRECTED ACTION, rendered as a command log (his call, 2026-10-28: "render the
// command log in a neat way"). The row shows what the cue will do; pressing play performs it —
// voice and motion together, through the one speech line, so a replay waits its turn behind
// whatever is already talking.
//
// The row is a RECORD: a tour that played lives on in the chat as these rows, each replayable.
// Arrival-play is NOT here — a new reply's cues are played by the reply's own reader (SpeakReply
// segments), which already knows new from old. A cue rendered in history or in a document never
// plays itself; here, the press is the consent.
//
// say ❝ · highlight ▣ · point ➤ · press ⏻ · call ⚙ (call renders honest: designed, not wired)
const GLYPH = { say: "❝", highlight: "▣", point: "➤", press: "⏻", call: "⚙" };

let seq = 0;

const Cue = ({ attrs = {}, label, line }) => {
  const scope = useMarkdownScope() || {};
  const projectCode = scope.projectCode || "";
  // THE ROW THE SEQUENCE IS ON (his, 2026-10-29: the chat stays visible on full animation, so the
  // running action should be shown). The player broadcasts {row, line} around each cue; this row
  // answers when both match — the line is its own source line, the row is the reply it sits in
  // (read from the DOM, the same [data-row] the speech line-up walks). Matching rows light and the
  // chat FOLLOWS: nearest-scroll, so the log tracks without yanking the panel around.
  const rootRef = useRef(null);
  const [live, setLive] = useState(false);
  useEffect(() => {
    const on = (e) => {
      const d = (e && e.detail) || {};
      if (Number(d.line) !== Number(line)) return;
      const row = rootRef.current && rootRef.current.closest("[data-row]");
      if (!row || String(row.dataset.row) !== String(d.row)) return;
      setLive(!!d.on);
      // CENTER, not nearest (his rule, 2026-10-29: a follow-scroll "should be trying to scroll
      // the item to the middle") — same block the voice's own read-line follow uses.
      if (d.on && rootRef.current && rootRef.current.scrollIntoView)
        rootRef.current.scrollIntoView({ block: "center", behavior: "smooth" });
    };
    window.addEventListener("sv:cueLive", on);
    return () => window.removeEventListener("sv:cueLive", on);
  }, [line]);
  const cue = {
    body: label || "",
    at: attrs.at,
    highlight: attrs.highlight,
    press: attrs.press,
    call: attrs.call,
    say: attrs.say,
    exclude: attrs.exclude, // per-command: what this reading leaves out of the spoken text
  };
  const verb = cueVerb(cue);
  const text = cueLabel(cue);
  const [playing, setPlaying] = useState(false);
  const keyRef = useRef(null);

  const play = () => {
    if (playing) return;
    const key = `cue:${(seq += 1)}`;
    keyRef.current = key;
    enqueue({
      key,
      scope: projectCode,
      label: text || verb,
      start: () => {
        setPlaying(true);
        const h = performCue(cue, {
          projectCode,
          onend: () => {
            setPlaying(false);
            queueDone(key);
          },
        });
        if (!h) {
          // nothing performable (dead selector, no body) — the line moves on, honestly
          setPlaying(false);
          queueDone(key);
          return null;
        }
        return {
          stop: () => {
            setPlaying(false);
            if (h.stop) h.stop();
          },
        };
      },
    });
  };

  return (
    <div ref={rootRef} className={`md-cue md-cue--${verb}${playing || live ? " is-playing" : ""}`}>
      <span className="md-cue__glyph" aria-hidden="true">
        {GLYPH[verb]}
      </span>
      <span className="md-cue__verb">{verb}</span>
      <span className="md-cue__label">{text}</span>
      {verb === "call" ? (
        <span className="md-cue__unwired" title="the call verb is designed, not wired yet">
          not wired yet
        </span>
      ) : (
        <button type="button" className="md-cue__play" onClick={play} title="play this cue">
          {playing ? "playing" : "play"}
        </button>
      )}
    </div>
  );
};

export default Cue;
