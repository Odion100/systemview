import React, { useEffect, useState } from "react";
import { subscribe, view, drop, clear, skip } from "./speechQueue";

// WHAT IS TALKING, AND WHAT IS NEXT. A queue you cannot see is a slower kind of surprise: replies
// start speaking minutes after they arrived and nothing says why, or how many more are coming.
//
// IT IS THERE WHEN THERE IS A LINE — and the fix for *"I want to move forward"* was NOT to show
// forward all the time. That was the wrong half: a forward button with nothing behind it moves to
// nothing. His correction: *"it's nice when you have a forward button, but there's nothing to move
// forward to… the problem was, there's no new queue."* Pressing a reply now fills the line behind
// it (`lineUp.js`), so forward has somewhere to go, and this draws when that line exists.
//
// AND WHEN IT DRAWS, THE ONE TALKING IS ON IT. *"One item on the queue is the item on the queue."*
// Listing only what WAITED meant the line could never say what it was reading.
const SpeechLine = ({ className = "", onGo = null }) => {
  const [q, setQ] = useState(view);
  useEffect(() => subscribe(setQ), []);

  // Nothing queued behind it is the ordinary case, and it draws nothing — EXCEPT while paused,
  // because a pause holds the line forever and silence with no explanation is the state he got
  // stuck in: replies arriving, nothing reading them, and no way to tell why.
  const stalled = !!(q.playing && q.playing.paused);
  if (!q.waiting.length && !stalled) return null;
  // Everything the line is holding, the one talking included — that IS the line.
  const inLine = (q.playing ? 1 : 0) + q.waiting.length;

  return (
    <div className={`speech-line ${className}`.trim()}>
      <div className="speech-line__head">
        {/* SKIP, and it is the escape from a pause. Resuming would carry on with something he has
            moved past; stop would throw away everything that arrived while he was stuck. */}
        <button type="button" className="speech-line__skip" title="Skip to the next one" onClick={() => skip()}>
          ⏭
        </button>
        <button
          type="button"
          className={`speech-line__stop${stalled ? " is-paused" : ""}`}
          title="Stop reading and empty the line"
          onClick={() => clear()}
        >
          ■ {stalled ? "paused" : ""} {inLine ? `${inLine} in line` : ""}
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
            className={`speech-line__row speech-line__row--reading${stalled ? " is-paused" : ""}`}
          >
            <span className="speech-line__mark" aria-hidden="true">
              {stalled ? "⏸" : "▶"}
            </span>
            {/* CLICK IT TO GO TO IT. His: *"the queue shows what's playing, so you need to be able
                to click on it and navigate to that… it was all the way up and it was playing, maybe
                I want to go right to it."* The line is the only place that knows what is reading, so
                it is the only place that can take him there — and a deliberate press beats a scroll
                that happens TO him, which is why this exists at all. */}
            <button
              type="button"
              className="speech-line__text speech-line__text--go"
              title="Go to this reply"
              onClick={() => onGo && onGo(q.playing.key)}
              disabled={!onGo}
            >
              {q.playing.label || "a reply"}
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
            <button
              type="button"
              className="speech-line__text speech-line__text--go"
              title="Go to this reply"
              onClick={() => onGo && onGo(w.key)}
              disabled={!onGo}
            >
              {w.label || "a reply"}
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
