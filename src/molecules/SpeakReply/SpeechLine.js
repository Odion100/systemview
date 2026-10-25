import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { subscribe, view, drop, clear, skip, setPaused, jumpTo, release } from "./speechQueue";
import { pause as voicePause, resume as voiceResume } from "../../utils/voice";

// THE SUBTITLE SCROLLS, ONCE PER SENTENCE (RFC-074). The compact row under a hovering bot is
// narrow and a sentence rarely fits; cutting it with an ellipsis would show the first four words
// of every sentence, which is not a subtitle. So a sentence that overflows slides through its box
// one time — left, at reading pace — and the next sentence starts from the left again. Measured,
// not assumed: the slide only runs when `scrollWidth` beats the box, and `tick` (the sentence
// index) restarts it so the same text read twice slides twice. Reduced-motion keeps the ellipsis.
const Ticker = ({ className = "", title = "", text = "", tick = -1 }) => {
  const box = useRef(null);
  const inner = useRef(null);
  const [over, setOver] = useState(0);
  useLayoutEffect(() => {
    const b = box.current;
    const s = inner.current;
    if (!b || !s) return;
    const extra = Math.max(0, s.scrollWidth - b.clientWidth);
    setOver(extra);
  }, [text, tick]);
  const dur = over ? `${Math.max(2, over / 40)}s` : "0s"; // ~40px per second
  return (
    <span ref={box} className={`${className}${over ? " is-ticking" : ""}`} title={title}>
      <span
        key={`${tick}:${text}`}
        ref={inner}
        className="speech-line__tick"
        style={over ? { "--tick-over": `-${over}px`, animationDuration: dur } : undefined}
      >
        {text}
      </span>
    </span>
  );
};

// WHAT IS TALKING, AND WHAT IS NEXT. A queue you cannot see is a slower kind of surprise: replies
// start speaking minutes after they arrived and nothing says why, or how many more are coming.
//
// TWO RULES, AND THEY ARE ABOUT DIFFERENT THINGS. Collapsing them into one is a mistake already
// made twice here:
//
//   1. THE LINE DRAWS WHENEVER SOMETHING IS TALKING. *"One item in the job queue — one person
//      speaking with nothing else behind — shows up in the queue."* The thing being read IS an item
//      on the queue, so a line holding exactly one is a line, and listing only what WAITED meant it
//      could never say what it was reading.
//   2. FORWARD IS CONDITIONAL, not the line. *"It's nice when you have a forward button, but there's
//      nothing to move forward to."* A skip with an empty line behind it moves to nothing.
//
// So: draw on `playing || waiting`, and render forward only when something is actually behind it.
// `scope` — draw only this project's readings. The queue is one for the whole window; without a
// scope the line shows everyone's, which is right for a surface that owns no project and wrong for
// a chat's own bubble. An item lined up with no scope is nobody's in particular and shows everywhere.
const SpeechLine = ({ className = "", onGo = null, scope = "", compact = false }) => {
  const [raw, setRaw] = useState(view);
  useEffect(() => subscribe(setRaw), []);
  // EXACT when scoped: a chat's line draws its own project's readings and nothing else — an
  // unlabelled item is not "anyone's", it is simply not this chat's.
  const q = scope
    ? {
        playing: raw.playing && raw.playing.scope === scope ? raw.playing : null,
        waiting: raw.waiting.filter((w) => w.scope === scope),
      }
    : raw;

  // Nothing queued behind it is the ordinary case, and it draws nothing — EXCEPT while paused,
  // because a pause holds the line forever and silence with no explanation is the state he got
  // stuck in: replies arriving, nothing reading them, and no way to tell why.
  const stalled = !!(q.playing && q.playing.paused);
  // LOADING BELONGS HERE TOO. *"Sometimes you're not… you press the button or you highlight and you
  // press the button. They're just waiting."* On a cold machine the first utterance waits on an
  // 86MB model, and the ROW that was pressed is the only thing that says so — useless for a box
  // selection, which has no row, and for a reply he has scrolled away from. Silence with no account
  // is the exact state this line exists to end.
  const warming = !!(q.playing && q.playing.warming && !stalled);
  if (!q.playing && !q.waiting.length) return null;
  // Everything the line is holding, the one talking included — that IS the line.
  const inLine = (q.playing ? 1 : 0) + q.waiting.length;

  const togglePause = () => {
    if (!q.playing) return;
    if (stalled) {
      voiceResume();
      setPaused(q.playing.key, false);
    } else {
      voicePause();
      setPaused(q.playing.key, true);
    }
  };

  // THE COMPACT FORM — for the minimised chat (his call: *"the line that plays and stops doesn't
  // need to sit the same way; it's off and awkward"*). One row: the pulsing mark, the state word,
  // the first words of what is being read, pause, stop — and "+N" only when more are waiting. No
  // list, no go-to: there is no conversation on screen to go to.
  if (compact) {
    const word = stalled ? "paused" : warming ? "loading" : q.playing ? "reading" : "waiting";
    const label = q.playing ? q.playing.label : q.waiting[0] ? q.waiting[0].label : "";
    // THE SUBTITLE (RFC-074): while reading, the sentence being spoken; loading or waiting there
    // is no sentence yet, so the reply's first words stand in.
    const pos = q.playing && !warming ? q.playing.position : null;
    const said = pos && pos.text ? pos.text : label;
    const more = q.playing ? q.waiting.length : Math.max(0, q.waiting.length - 1);
    return (
      <div
        className={`speech-line speech-line--compact${stalled ? " is-paused" : ""}${warming ? " is-warming" : ""} ${className}`.trim()}
        role="group"
        aria-label="What is being read"
      >
        <span className={`speech-line__mark${q.playing && !stalled && !warming ? " speech-line__mark--live" : ""}`} aria-hidden="true">
          {stalled ? "⏸" : warming ? "◌" : "▶"}
        </span>
        <span className="speech-line__word">{word}</span>
        <Ticker className="speech-line__clabel" title={label} text={said} tick={pos ? pos.index : -1} />
        {more > 0 && <span className="speech-line__more">+{more}</span>}
        {/* THE SAME TRANSPORT AS THE FULL LINE — its pause, its skip, its stop. Not a second set of
            buttons (his catch): one transport, learned once, wherever the line is drawn. */}
        {/* WAITING: lined up while he was elsewhere and this agent is set to wait — the play starts it */}
        {!q.playing && q.waiting.length > 0 && (
          <button type="button" className="speech-line__pause" title="Read it now" aria-label="Start reading" onClick={() => release()}>
            ▶
          </button>
        )}
        {q.playing && (
          <button
            type="button"
            className={`speech-line__pause${stalled ? " is-paused" : ""}`}
            title={stalled ? "Resume" : "Pause"}
            aria-label={stalled ? "Resume reading" : "Pause reading"}
            onClick={togglePause}
          >
            {stalled ? "▶" : "❙❙"}
          </button>
        )}
        {q.waiting.length > 0 && (
          <button type="button" className="speech-line__skip" title="Skip to the next one" onClick={() => skip()}>
            ⏭
          </button>
        )}
        <button
          type="button"
          className={`speech-line__stop${stalled ? " is-paused" : ""}`}
          title="Stop reading and empty the line"
          onClick={() => clear()}
        >
          ■
        </button>
      </div>
    );
  }

  return (
    <div className={`speech-line ${className}`.trim()}>
      <div className="speech-line__head">
        {/* PAUSE LIVES HERE TOO, and that is the point of the line. The transport is on the ROW, so
            scrolling away from the reply being read took pause with it — his words: *"there's
            definitely times you scroll away from the play button… you can't pause it, you could
            only stop it. The queue should have the full functionality of whatever is playing so
            that you don't have to have it in view."*
            It does not need the row's handle: `voice.pause()` acts on whatever is currently
            speaking, which is exactly what the line is about. */}
        {q.playing && (
          <button
            type="button"
            className={`speech-line__pause${stalled ? " is-paused" : ""}`}
            title={stalled ? "Resume" : "Pause"}
            aria-label={stalled ? "Resume reading" : "Pause reading"}
            onClick={() => {
              if (stalled) {
                voiceResume();
                setPaused(q.playing.key, false);
              } else {
                voicePause();
                setPaused(q.playing.key, true);
              }
            }}
          >
            {stalled ? "▶" : "❙❙"}
          </button>
        )}
        {/* SKIP, and it is the escape from a pause. Resuming would carry on with something he has
            moved past; stop would throw away everything that arrived while he was stuck. Drawn only
            when there is a next one — forward to nothing is a control that lies. */}
        {q.waiting.length > 0 && (
          <button type="button" className="speech-line__skip" title="Skip to the next one" onClick={() => skip()}>
            ⏭
          </button>
        )}
        <button
          type="button"
          className={`speech-line__stop${stalled ? " is-paused" : ""}`}
          title="Stop reading and empty the line"
          onClick={() => clear()}
        >
          {/* THE LINE SAYS SOMETHING IS HAPPENING. A static queue reads as nothing going on, and
              then a voice starts "out of nowhere" (his words) — so while one is being read the
              head says so, and the playing row's mark pulses. */}
          ■ {stalled ? "paused" : warming ? "loading" : q.playing ? "reading" : ""} {inLine ? `${inLine} in line` : ""}
        </button>
      </div>
      <ul className="speech-line__list">
        {/* THE ONE TALKING IS ON THE QUEUE TOO. His: *"one item on the queue is the item on the
            queue. If you're speaking, it should show item on the queue."* It used to list only
            what was WAITING, so a reply reading alone showed a transport over an empty list and
            the count said nothing — the line could not tell you what it was reading. It leads the
            list, marked, and it is counted. */}
        {q.playing && (
          <li
            key={q.playing.key}
            className={`speech-line__row speech-line__row--reading${stalled ? " is-paused" : ""}${
              warming ? " is-warming" : ""
            }`}
          >
            <span className="speech-line__mark" aria-hidden="true">
              {stalled ? "⏸" : warming ? "◌" : "▶"}
            </span>
            {/* CLICK IT TO GO TO IT. His: *"the queue shows what's playing, so you need to be able
                to click on it and navigate to that… it was all the way up and it was playing, maybe
                I want to go right to it."* The line is the only place that knows what is reading, so
                it is the only place that can take him there — and a deliberate press beats a scroll
                that happens TO him, which is why this exists at all. */}
            {/* The one TALKING has nowhere to jump to, so its label keeps the go-to door — the
                reading is already here, only the view can move. */}
            <button
              type="button"
              className="speech-line__text speech-line__text--go"
              title="Go to this reply in the conversation"
              onClick={() => onGo && onGo(q.playing.key)}
              disabled={!onGo}
            >
              {/* The sentence being spoken while it reads (RFC-074); the reply's first words
                  until the engine has started on one. */}
              {(q.playing.position && q.playing.position.text) || q.playing.label || "a reply"}
            </button>
            {/* AND IT TAKES AN × LIKE EVERY OTHER ROW. His: *"the queue needs to make sure that
                there are × buttons all, to the end."* It was the one row without one, on the
                reasoning that you cannot remove what is already talking — but you can: removing
                the one being read means being done with it and moving on, which is the same act
                as forward, said on the row it applies to. Every row in the line answers to ×. */}
            <button
              type="button"
              className="speech-line__drop"
              title="Done with this one — move on"
              onClick={() => skip()}
            >
              ×
            </button>
          </li>
        )}
        {q.waiting.map((w) => (
          <li key={w.key} className="speech-line__row">
            {/* THE LABEL MOVES THE READING. *"Clicking a queue item — jump to it, forward to it."*
                He was explicit that this is DISTINCT from going to the reply, and I had collapsed
                the two: pressing a row used to only scroll the view. A press on a queue row means
                "read this one now", the way it does in any line of things waiting to play. */}
            <button
              type="button"
              className="speech-line__text speech-line__text--jump"
              title="Read this one now"
              onClick={() => jumpTo(w.key)}
            >
              {w.label || "a reply"}
            </button>
            {/* AND GOING TO IT KEEPS ITS OWN DOOR, because it is its own act: this moves the VIEW
                and leaves the reading alone, where the label moves the reading and leaves the view
                alone. One click cannot mean both. */}
            <button
              type="button"
              className="speech-line__goto"
              title="Go to this reply in the conversation"
              onClick={() => onGo && onGo(w.key)}
              disabled={!onGo}
            >
              ⤴
            </button>
            {/* Taking one OUT of the line is not stopping — what is being read keeps reading. */}
            <button
              type="button"
              className="speech-line__drop"
              title="Take this one out of the line"
              onClick={() => drop(w.key)}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default SpeechLine;
