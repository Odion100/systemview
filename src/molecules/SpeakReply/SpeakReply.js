import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./styles.scss";
import { AIMED_AT_YOU, spokenForm } from "../../utils/spokenForm";
import { available, ready as engineReady, speak, stop, voices } from "../../utils/voice";
import { readVoicePref, readVoiceSettings } from "../../utils/voicePref";
import { takeIfNew } from "./autoSpeak";
import { enqueue, cutIn, done as queueDone, drop as queueDrop, setPaused } from "./speechQueue";
import { behind, register } from "./lineUp";
import { useMarkdownScope } from "../../atoms/Markdown/context";
import { announce, claim, isOwner, nextSpeakerId, subscribe } from "./speaker";

// PRESS A REPLY AND HEAR IT.
//
// THE WORD STAYED, THE PANEL DID NOT. The settings that used to ride beside this button belong to
// the CONVERSATION rather than to a reply, so they moved to the composer where they exist once
// instead of once per message. The label is a different question and he settled it both ways in
// one sitting — stripped to a bare glyph, then back: *"the button that says listen can go back to
// saying listen."* It reads better with the word and costs nothing, and the state it carries is
// the thing the glyph alone had to work hardest to say.
//
// THE TRANSPORT APPEARS ONLY WHILE IT IS PLAYING. His rule, and it is what keeps a feed of forty
// replies from carrying forty pause buttons and forty scrubbers for a thing that is not happening.
// Idle, this is one small triangle; reading, it grows a pause and a position you can drag.
//
// EVERYTHING THIS COMPONENT KNOWS IS IN THIS FILE. It is mounted with one line where the reply
// renders, and it holds all of the behaviour: what is speakable (`spokenForm`), who says it
// (`voice`), and which reply owns the speaker right now (below). That is deliberate — the chat is
// worked on by a lot of hands at once, and a feature that spreads across it cannot be added
// without taking something else apart.
//
// IT HIDES ITSELF WHEN IT CANNOT WORK. No audio on the machine, or a reply with nothing speakable
// in it (a bare screenshot, a lone table), and there is no button at all. A control that does
// nothing when pressed is worse than an absent one, because it costs a press to learn that.
//
// BUT "NOT READY YET" IS NOT "CANNOT WORK", and the difference is a download. The voice is a model
// that arrives once per machine, so the FIRST press has a wait in front of it — and a button that
// says "Reading" into forty seconds of silence is lying in the exact way the engine contract
// exists to prevent. Three states, then: Listen, Loading (pressed, nothing audible yet), Reading
// (`onstart` has fired, sound is actually coming out). The fourth is the one with no fallback
// underneath it — a load that FAILED has to say so on the button, because there is no system
// voice left to quietly stand in.

const SpeakReply = ({ text, className = "", rowKey = "", ts = 0 }) => {
  const CN = "speak-reply";
  const id = useMemo(() => nextSpeakerId(), []);
  const { projectCode } = useMarkdownScope();
  const [speaking, setSpeaking] = useState(false);
  // PRESSED, BUT NOT YET AUDIBLE. True between the press and `onstart` — which is instant once the
  // model is cached and is the whole first-run wait before that.
  const [warming, setWarming] = useState(false);
  const [failed, setFailed] = useState("");
  // WHERE IT IS, IN SENTENCES. The engine reports a position rather than a time because a reply is
  // generated a sentence at a time — the COUNT is known immediately, the duration is not known
  // until the end, and a bar that cannot say how long it is would have to lie until it finished.
  const [at, setAt] = useState(null);
  const handle = useRef(null);
  // ONE SPEAKER ID, TWO WAYS TO START TALKING — auto-speech on arrival and his press. Interrupting
  // one makes the other's `onend` arrive AFTER the new utterance has already set itself speaking,
  // and without a token that late callback switches off the control that is currently reading.
  // Same fault the voice panel had between two previews; same remedy.
  const seq = useRef(0);

  // PRESSING LISTEN READS THE WHOLE REPLY. That is the deal and it does not change: the button is
  // "read me this", and a button that silently read a third of what is on screen would be the
  // worst kind of setting — invisible, and only discoverable by missing something.
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

  // THE VOICE LIST USED TO ARRIVE LATE AND THERE WAS A WHOLE DANCE HERE FOR IT — a `voiceschanged`
  // listener plus a 400ms second look, because `speechSynthesis.getVoices()` returns [] on a cold
  // page and the button would otherwise be permanently absent. The engine's list is now a static
  // table in `kokoroVoices.js`, known before anything loads, so there is nothing to wait for and
  // the listener is gone with the engine it belonged to.


  // A ROW THAT GOES AWAY LEAVES THE LINE. The queue holds a `start()` closing over this
  // component — so a row unmounted by a chat switch, a filter or a navigation would otherwise sit
  // in the line waiting to speak a reply from somewhere he is no longer looking, setting state on
  // something that no longer exists. Queued-but-gone is the stale conflict; this is the cleanup.
  useEffect(() => () => queueDrop(rowKey), [rowKey]);

  // ── SPEAKING ON ITS OWN ──────────────────────────────────────────────────────────────────────
  //
  // Runs ONCE per row, on mount, and `takeIfNew` is what makes that safe — it answers false for
  // every reply that was already on screen when the page loaded, so turning auto on never reads
  // the backlog.
  //
  // THE SETTINGS ARE READ HERE, NOT CLOSED OVER. A reply arriving three hours into a session must
  // honour the blocks he ticked ten minutes ago, and a component that captured them at mount would
  // honour whatever was true when the window opened.
  //
  // AND AN EMPTY SELECTION IS SILENCE, NOT EVERYTHING. `only: []` returns "" from `spokenForm`,
  // so "read me nothing" is expressible and costs no special case here — if there is nothing to
  // say, nothing is said and no state is touched.
  useEffect(() => {
    if (!takeIfNew(rowKey, ts)) return;
    const s = readVoiceSettings(projectCode);
    if (s.mode === "off" || !available()) return;
    // DON'T TALK TO AN EMPTY ROOM. His rule: it should not start if he is not here. A hidden tab
    // is the only honest, cheap test for that — and it is checked at the MOMENT of arrival rather
    // than remembered, so a reply that lands while he is away is simply never spoken. Nothing is
    // queued for his return, because he said plainly it does not need to survive anything.
    if (typeof document !== "undefined" && document.hidden) return;
    // `all` is the whole reply, which is exactly what passing no sieve means.
    const only = s.mode === "all" ? null : s.blocks === null ? AIMED_AT_YOU : s.blocks;
    const body = spokenForm(text, only ? { only } : {});
    if (!body) return;
    // IT JOINS THE LINE. This used to call `speak()` directly, which cancels whatever is talking —
    // correct for a press, wrong for a reply that simply ARRIVED. A long answer was reliably cut
    // off by the next one, and there was no way to get it back.
    enqueue({
      key: rowKey,
      label: body.replace(/\s+/g, " ").slice(0, 70),
      start: () => {
        const token = (seq.current += 1);
        claim(id);
        setSpeaking(true);
        setWarming(!engineReady());
        announce(true);
        handle.current = speak(body, {
          // THE SCOPE IS PASSED, NEVER LEFT AMBIENT. `voice.js` falls back to reading the saved
          // voice and speed itself, and it has no way to know which chat is asking — so a scoped
          // caller must say. Leaving it out is how a per-chat setting silently becomes global.
          preferId: readVoicePref(projectCode),
          rate: s.speed,
          onposition: (p) => seq.current === token && setAt(p),
          onstart: () => seq.current === token && setWarming(false),
          onend: (err) => {
            // THE LINE MOVES ON EVEN WHEN THIS ONE FAILED — a queue that only advances on success
            // stops dead at the first reply the engine could not load, and everything behind it
            // is silently lost.
            queueDone(rowKey);
            if (seq.current !== token) return;
            handle.current = null;
            if (isOwner(id)) {
              setSpeaking(false);
              setWarming(false);
              setAt(null);
              announce(false);
            }
            if (err) setFailed(String((err && err.message) || "the voice could not load"));
          },
        });
        return handle.current;
      },
    });
    // Mount only: a row is considered once, and `takeIfNew` enforces that even if React disagrees.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ONE DESCRIPTION OF HOW THIS ROW TALKS, used by the press and by the reading window that fills
  // the line behind it. Two copies would drift the first time either changed, which is the same
  // reason `speaker.js` and `speechQueue.js` each exist once.
  const listenItem = useCallback(() => {
    const chat = readVoiceSettings(projectCode);
    return {
        key: rowKey,
        label: String(spoken || "").replace(/\s+/g, " ").slice(0, 70),
        start: () => {
          const token = (seq.current += 1);
          claim(id);
          setSpeaking(true);
          setFailed("");
          setWarming(!engineReady());
          announce(true);
          handle.current = speak(spoken, {
            preferId: readVoicePref(projectCode),
            rate: chat.speed,
            onposition: (p) => seq.current === token && setAt(p),
            onstart: () => seq.current === token && setWarming(false),
            onend: (err) => {
              queueDone(rowKey);
              if (seq.current !== token) return;
              handle.current = null;
              // Only the owner clears the state — a stale callback from a reply that was
              // interrupted must not switch off the one that interrupted it.
              if (isOwner(id)) {
                setSpeaking(false);
                setWarming(false);
                setAt(null);
                announce(false);
              }
              if (err) setFailed(String((err && err.message) || "the voice could not load"));
            },
          });
          return handle.current;
        },
      };
  }, [id, rowKey, spoken, projectCode]);

  // A REPLY SAYS HOW IT SPEAKS, so the row he pressed can queue the ones after it without any of
  // them being mounted differently. Unregistering on unmount keeps a row that left the render from
  // being queued as though it were still there.
  useEffect(() => register(rowKey, listenItem), [rowKey, listenItem]);

  const press = useCallback(
    (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (speaking) {
        // STOP MEANS STOP, AND THE LINE GOES WITH IT. Leaving queued replies to start talking a
        // second later is not stopping; it is a pause he never asked for.
        seq.current += 1;
        cutIn(null);
        handle.current = null;
        setSpeaking(false);
        setAt(null);
        announce(false);
        return;
      }
      // A PRESS CUTS IN AND EMPTIES THE LINE — choosing this reply means choosing it INSTEAD of
      // what was queued. Anything else would resume, a minute later, on something he moved past.
      cutIn(listenItem());
      // AND IT LINES UP WHAT FOLLOWS. *"If I go back and I click, the queue should be showing
      // multiple things ahead of it."* The order is read off the render, from this row outward, at
      // the moment of the press — no stored order, no flag, nothing that can be left set.
      const mine = e.currentTarget.closest("[data-row]");
      const scope = mine && mine.parentElement;
      if (scope) {
        const order = Array.prototype.slice
          .call(scope.querySelectorAll("[data-row]"))
          .map((n) => n.dataset.row);
        behind(rowKey, order).forEach((item) => enqueue(item));
      }
    },
    [listenItem, rowKey, speaking],
  );

  if (!spoken || !available() || !voices().length) return null;

  // Four words for four states. "Loading" is the one that earns the label: on a cold machine the
  // first press waits on an 86MB download, and a control that said "Reading" into forty seconds of
  // silence would be lying in exactly the way the engine contract exists to prevent.
  const word = failed ? "Voice failed" : warming ? "Loading" : speaking ? "Reading" : "Listen";

  const paused = !!(at && at.paused);
  const total = (at && at.total) || 0;
  const played = at ? at.index : 0;
  const buffered = (at && at.buffered) || 0;

  // THE TRANSPORT, and it exists only while something is coming out of the speakers.
  const transport = speaking && !warming && total > 1 && (
    <span className={`${CN}__transport`}>
      <button
        type="button"
        className={`${CN}__pause`}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          if (!handle.current) return;
          // THE LINE HAS TO KNOW. A pause holds the current item forever, so a queue stalled
          // behind one is indistinguishable from a queue working — which is the state he got
          // stuck in without being told.
          if (paused) {
            handle.current.resume();
            setPaused(rowKey, false);
          } else {
            handle.current.pause();
            setPaused(rowKey, true);
          }
        }}
        aria-label={paused ? "Resume reading" : "Pause reading"}
        title={paused ? "Resume" : "Pause"}
      >
        {paused ? "▶" : "❙❙"}
      </button>

      {/* THE SCRUBBER IS OVER SENTENCES, which is the only timeline that is honest here: the
          sentence COUNT is known the instant the reply is chunked, while its duration in seconds
          does not exist until the whole thing has been generated. The filled-behind part is what
          has been generated — seeking into it is instant, seeking past it waits. */}
      <input
        type="range"
        className={`${CN}__seek`}
        min="0"
        max={Math.max(0, total - 1)}
        step="1"
        value={played}
        onChange={(e) => handle.current && handle.current.seek(Number(e.target.value))}
        onClick={(e) => e.stopPropagation()}
        aria-label="Position in this reply"
        title={`Sentence ${played + 1} of ${total}`}
        style={{ "--sv-buffered": `${total > 1 ? (buffered / total) * 100 : 0}%` }}
      />
    </span>
  );

  return (
    <span className={`${CN}-row`}>
      <button
        type="button"
        className={`${CN}${speaking ? ` ${CN}--on` : ""}${failed ? ` ${CN}--failed` : ""}${className ? ` ${className}` : ""}`}
        onClick={press}
        aria-pressed={speaking}
        aria-label={speaking ? "Stop reading this reply" : "Read this reply aloud"}
        title={
          failed
            ? failed
            : warming
              ? "Fetching the voice — it is a one-time download, then it is on this machine for good"
              : speaking
                ? "Stop reading"
                : `Read this aloud — ${Math.max(1, Math.round(spoken.length / 900))} min, local voice, nothing leaves the machine`
        }
      >
        {/* THE STATE IS NOT ONLY THE WORD. A reply being read also carries the moving bars — in a
            feed of static text they are the one thing that is unmistakably live, and the word
            alone is easy to miss on a small control. */}
        <span className={`${CN}__mark`} aria-hidden="true">
          {failed ? "!" : warming ? "◌" : speaking ? "◼" : "▶"}
        </span>
        <span className={`${CN}__word`}>{word}</span>
        {speaking && !warming && (
          <span className={`${CN}__wave`} aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        )}
      </button>
      {transport}
    </span>
  );
};

export default SpeakReply;
