import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./styles.scss";
import { AIMED_AT_YOU, spokenPositions, spokenPassageMap, spokenChunks } from "../../utils/spokenForm";
import { recitalSegments } from "../../utils/readAloud";
import { performCue } from "../../utils/cuePerform";
import { hostFiles } from "../../utils/hostFiles";
import { available, ready as engineReady, speak, voices } from "../../utils/voice";
import { readVoicePref, readVoiceSettings } from "../../utils/voicePref";
import { takeIfNew } from "./autoSpeak";
import { enqueue, cutIn, done as queueDone, setPaused, setPosition as queuePosition, setWarming as queueWarming } from "./speechQueue";
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
  // …and with every sentence's source lines beside it (RFC-074), so the position the engine
  // reports can be put on the line as a subtitle and a lit paragraph.
  const recital = useMemo(() => spokenPositions(text), [text]);
  const spoken = recital.text;
  // THE MARKDOWN IS THE INSTRUCTION (his ruling): a reply carrying `::file{voice}` reads its
  // passage AT ITS PLACE whenever the reply is read — on arrival AND on this press. The segments
  // play inside this one queue item, chained, so rows queued behind still follow the whole thing.
  const segments = useMemo(() => recitalSegments(text), [text]);

  useEffect(() => {
    const off = subscribe((who) => {
      if (who !== id) setSpeaking(false);
    });
    // THE READING OUTLIVES THE ROW (his rule, 2026-10-25: *"why should it stop reading if I close
    // it? why should it stop if I pull it out?"*). This cleanup used to stop the voice on unmount,
    // because a reply scrolled off screen would otherwise keep talking with nothing to stop it —
    // true then; now the speech line draws the reading wherever the chat is, open or closed, with
    // its own stop. So closing the panel, docking, undocking or a filter no longer cuts a sentence.
    return () => {
      off();
    };
  }, [id]);

  // THE VOICE LIST USED TO ARRIVE LATE AND THERE WAS A WHOLE DANCE HERE FOR IT — a `voiceschanged`
  // listener plus a 400ms second look, because `speechSynthesis.getVoices()` returns [] on a cold
  // page and the button would otherwise be permanently absent. The engine's list is now a static
  // table in `kokoroVoices.js`, known before anything loads, so there is nothing to wait for and
  // the listener is gone with the engine it belonged to.


  // A ROW THAT GOES AWAY STAYS IN THE LINE. It used to be dropped on unmount — a reply queued
  // from somewhere he was no longer looking — but the line is now visible from the closed chat
  // too, and a reply lined up while the panel was open must still be read after it is closed. The
  // `start()` closes over this component's setters; on an unmounted row they are no-ops.

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
    // AND IT PLAYS THE SAME SEGMENTS THE PRESS DOES. This used to build its own queue item around
    // one flat `spokenPositions(text)` body — so a reply carrying `::file{voice}` read its prose,
    // skipped the document without a sound, and continued with the text after it. Measured
    // 2026-10-27, on a reply whose whole point was the document: fetch fine, passage fine (3080
    // chars), and silence, because the arrival path never asked for segments. `listenItem` is the
    // one description of how this row talks; the sieve rides into it.
    const segs = recitalSegments(text, only ? { only } : {});
    // AN EMPTY SELECTION IS STILL SILENCE — a sieve that leaves no prose and no voiced file says
    // nothing and touches no state, which is what makes "read me nothing" expressible.
    if (!segs.some((g) => g.kind === "file" || g.kind === "cue" || (g.text && g.text.trim()))) return;
    enqueue(listenItem(only));
    // Mount only: a row is considered once, and `takeIfNew` enforces that even if React disagrees.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ONE DESCRIPTION OF HOW THIS ROW TALKS, used by the press and by the reading window that fills
  // the line behind it. Two copies would drift the first time either changed, which is the same
  // reason `speaker.js` and `speechQueue.js` each exist once.
  // `only` IS WHY THIS TAKES AN ARGUMENT. The press reads the whole reply; an ARRIVAL reads only
  // the blocks he ticked — and the arrival path used to hand-roll its own player to apply that
  // sieve, which is how it drifted: it spoke `spokenPositions(text)` as one flat body and therefore
  // DROPPED every `::file{voice}` passage, silently, while the press beside it read them. The file
  // says the intent two hundred lines up ("on arrival AND on this press"), so the fix is one
  // description with the sieve threaded through it rather than a second copy that forgets files.
  const listenItem = useCallback((only = null) => {
    const chat = readVoiceSettings(projectCode);
    const view = only ? spokenPositions(text, { only }) : recital;
    const segs = only ? recitalSegments(text, { only }) : segments;
    return {
        key: rowKey,
        scope: projectCode, // whose reading this is — the chat's own line draws only its own
        label:
          String(view.text || "").replace(/\s+/g, " ").slice(0, 70) ||
          // an all-cue reply has no prose; the line still needs a name he can read
          (segs.some((g) => g.kind === "cue") ? "the sequence" : ""),
        start: () => {
          const token = (seq.current += 1);
          claim(id);
          setSpeaking(true);
          setFailed("");
          setWarming(!engineReady());
          queueWarming(rowKey, !engineReady());
          announce(true);
          const finish = (err) => {
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
          };
          // THE SEGMENTS PLAY IN ORDER inside this one item — say, passage, say — so the queue and
          // the rows lined up behind see one reply, and stopping stops whichever part is talking.
          const playFrom = (i) => {
            if (seq.current !== token) return;
            if (i >= segs.length) return finish();
            const seg = segs[i];
            if (seg.kind === "cue") {
              // a cue plays inside the reply's own turn — voice and motion from the ONE performer
              // the rendered block also uses. An unperformable cue (dead selector, the unwired
              // `call`) is a skipped beat, never a dead reply.
              //
              // THE VOICE BOX DURING A CUE (his rule, 2026-10-29): a selector cue's words are LIT
              // ON THE PAGE — the box duplicating them adds nothing, so it reads EMPTY. A say cue
              // has no on-page text, so its words are the ones injected. `text: ""` is deliberate
              // and the line renders it as deliberate — without it the box held whatever was said
              // last and just stayed.
              const isSay = !(seg.at || seg.highlight || seg.press || seg.call);
              const sayChunks = isSay ? spokenChunks(String(seg.body || "")) : [];
              if (!isSay) queuePosition(rowKey, { index: 0, total: 0, text: "" });
              // THE RUNNING ROW WEARS IT (his, 2026-10-29: "follow and highlight each thing that
              // is running — that's the action we're on"). The row matches on the reply's data-row
              // + the cue's source line, the same line findCues stamped on this segment.
              const mark = (on) =>
                window.dispatchEvent(
                  new CustomEvent("sv:cueLive", { detail: { row: rowKey, line: seg.line, on } })
                );
              const h = performCue(seg, {
                projectCode,
                onstart: () => {
                  if (seq.current !== token) return;
                  setWarming(false);
                  queueWarming(rowKey, false);
                },
                onposition: (p) => {
                  if (seq.current !== token) return;
                  queuePosition(rowKey, { ...p, text: isSay ? sayChunks[p.index] || "" : "" });
                },
                onend: (err) => {
                  mark(false);
                  return err ? finish(err) : playFrom(i + 1);
                },
              });
              if (h) mark(true);
              if (!h) return playFrom(i + 1);
              handle.current = h;
              return;
            }
            if (seg.kind === "file") {
              (async () => {
                try {
                  const res = await hostFiles(projectCode).readFile({ path: seg.path });
                  if (seq.current !== token) return;
                  const pm = spokenPassageMap(res && res.content, seg.lines, seg.path);
                  if (!pm.text) return playFrom(i + 1);
                  handle.current = speak(pm.text, {
                    preferId: readVoicePref(projectCode),
                    rate: chat.speed,
                    // `file:` rides the position so the embed showing this file can follow the
                    // voice even though the queue item is the reply's, not the passage's.
                    onposition: (p) => {
                      if (seq.current !== token) return;
                      queuePosition(rowKey, { ...p, ...(pm.chunks[p.index] || {}), file: seg.path });
                    },
                    onstart: () => {
                      if (seq.current !== token) return;
                      setWarming(false);
                      queueWarming(rowKey, false);
                    },
                    onend: (err) => (err ? finish(err) : playFrom(i + 1)),
                  });
                } catch {
                  playFrom(i + 1); // an unreadable file is a skipped passage, never a dead reply
                }
              })();
              return;
            }
            handle.current = speak(seg.text, {
              preferId: readVoicePref(projectCode),
              rate: chat.speed,
              onposition: (p) => {
                if (seq.current !== token) return;
                setAt(p);
                queuePosition(rowKey, { ...p, ...(seg.chunks[p.index] || {}) });
              },
              onstart: () => {
                if (seq.current !== token) return;
                setWarming(false);
                queueWarming(rowKey, false);
              },
              onend: (err) => (err ? finish(err) : playFrom(i + 1)),
            });
          };
          // One segment and no files is yesterday's reply, spoken exactly as before.
          if (segs.length === 1 && segs[0].kind === "say") {
            handle.current = speak(view.text, {
              preferId: readVoicePref(projectCode),
              rate: chat.speed,
              onposition: (p) => {
                if (seq.current !== token) return;
                setAt(p);
                queuePosition(rowKey, { ...p, ...(view.chunks[p.index] || {}) });
              },
              onstart: () => {
                if (seq.current !== token) return;
                setWarming(false);
                queueWarming(rowKey, false);
              },
              onend: finish,
            });
            return handle.current;
          }
          playFrom(0);
          return {
            stop: () => {
              // THE CHAIN DIES WITH THE STOP. Stopping only the current utterance let onend advance
              // to the next segment — audio restarting in the background after he killed the queue
              // (measured, 2026-10-26). Bumping the token is what every playFrom checks first.
              seq.current += 1;
              try {
                if (handle.current && handle.current.stop) handle.current.stop();
              } catch {}
              queueDone(rowKey);
              if (isOwner(id)) {
                setSpeaking(false);
                setWarming(false);
                setAt(null);
                announce(false);
              }
            },
          };
        },
      };
  }, [id, rowKey, text, recital, segments, projectCode]);

  // A REPLY SAYS HOW IT SPEAKS, so the row he pressed can queue the ones after it without any of
  // them being mounted differently. Unregistering on unmount keeps a row that left the render from
  // being queued as though it were still there.
  // Wrapped, so a caller that hands its own argument to this cannot accidentally sieve a press.
  useEffect(() => register(rowKey, () => listenItem(null)), [rowKey, listenItem]);

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

  // A SEQUENCE IS SPEAKABLE (his catch, 2026-10-29: "there's no play button at the bottom because
  // you didn't speak"). A reply that is ALL cues has empty prose — cues are silent in spoken form
  // because the segments perform them — but the press path plays every segment, so the button must
  // mount for it. Hiding it made a replayable sequence replayable only row by row.
  const performs = segments.some((g) => g.kind === "cue" || g.kind === "file");
  if ((!spoken && !performs) || !available() || !voices().length) return null;

  // Four words for four states. "Loading" is the one that earns the label: on a cold machine the
  // first press waits on an 86MB download, and a control that said "Reading" into forty seconds of
  // silence would be lying in exactly the way the engine contract exists to prevent.
  const word = failed ? "Voice failed" : warming ? "Loading" : speaking ? "Reading" : "Listen";

  const paused = !!(at && at.paused);
  const total = (at && at.total) || 0;
  const played = at ? at.index : 0;
  const buffered = (at && at.buffered) || 0;

  // BACK AND FORWARD, AND THE INTERVAL IS A SENTENCE because that is the engine's own unit. His:
  // *"a forward and backward button next to the listen button, to move back and forward specific
  // intervals — whatever intervals make sense."* Seconds would have been the obvious guess and the
  // wrong one: a reply is generated a sentence at a time, so its duration does not exist until the
  // whole thing has been made, while the sentence COUNT is known the instant the text is chunked.
  // Seeking is an assignment to that index, and every generated sentence is kept — so back is
  // instant and forward never re-generates anything already made.
  const step = (by) => (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (!handle.current || !handle.current.seek) return;
    const next = Math.max(0, Math.min(total - 1, played + by));
    if (next !== played) handle.current.seek(next);
  };

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
      {/* BACK AND FORWARD FLANK THE SLIDER, not the pause. His correction: *"shouldn't the forward
          and back button be on either side of the slider?"* — and they should, because all three
          are the same act at different grain: the slider moves you anywhere in the reply, these
          move you one sentence. Grouping them with pause made them read as a second kind of thing.
          TWO PLAIN TRIANGLES, TOUCHING. His design, and it solves both problems at once: *"the
          triangles could just be put touching each other to make that without the line."*
          THE LINE IS WHAT MADE ⏭ WRONG HERE — a bar-terminated triangle means "skip to the next
          THING", which is the queue line's job, not this one. This moves WITHIN the reply.
          AND THE PRE-COMPOSED DOUBLES ARE EMOJI. ⏪ ⏩ ⏮ ⏭ are emoji codepoints, so the font paints
          them as colour glyphs — which is exactly what he was reacting to when he called them
          "stupid bullshit emoji", a complaint I answered three times without once working out what
          was actually wrong. ⏴ and ⏵ are plain text triangles, so doubling them gets the
          fast-forward shape in the chat's own ink, with no bar and nothing coloured. */}
      <button
        type="button"
        className={`${CN}__step`}
        title="Back a sentence"
        aria-label="Back a sentence"
        disabled={played <= 0}
        onClick={step(-1)}
      >
        ⏴⏴
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
      <button
        type="button"
        className={`${CN}__step`}
        title="Forward a sentence"
        aria-label="Forward a sentence"
        disabled={played >= total - 1}
        onClick={step(1)}
      >
        ⏵⏵
      </button>
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
