// REPLIES WAIT THEIR TURN. His: *"if the voice starts talking and then you come with another
// response, it cuts off. Can it just chew and have them play in the line?"*
//
// THE BUG THIS FIXES IS ONE I INTRODUCED. `speak()` cancels whatever was talking, and that is
// right for a PRESS — press a second reply and the first must stop, or two voices overlap and
// neither can be stopped. But an arriving reply is not a press. Auto-speech went through the same
// door, so a reply that landed mid-sentence truncated the one being read, and the longer the
// answer the more reliably it was cut off. The thing being read was never finished and he had no
// way to get it back.
//
// WHAT THIS OWNS IS ORDER, AND NOTHING ELSE. The control still knows how to speak — it holds the
// settings, the voice, the position callbacks. An item carries a `start()` that does the talking
// and hands back a stop handle; the queue only decides WHEN. Two modules that both knew how to
// speak would drift the first time either changed, which is the same reason `speaker.js` exists.
//
// A PRESS STILL CUTS IN, and it empties the line. He said it plainly — *"I can always stop it and
// play whatever I want"* — so choosing a reply means choosing it INSTEAD of what was queued, not
// in front of it. Leaving the backlog to resume afterwards would start talking again a minute
// later about something he had moved on from.

const listeners = new Set();
let playing = null; // { key, label, stop, start, scope, warming, position }
let waiting = [];

// PAUSE BELONGS TO THE LINE, NOT TO THE UTTERANCE. His: *"it's in between cues — nothing is
// playing, but the pause button is there. So in between cues, if you press pause, it says pause,
// pause, but then it will just start talking… it should be reading the state of the pause button
// across the cues, that way you can pause it at any time, no matter what."*
//
// A flag on the playing item is a fact about ONE utterance, and the silences he presses in belong
// to no utterance at all: the seam between two items, and the seams INSIDE one sequence, where a
// press cue holds through its settle and a point cue waits on a scroll. A press in one of those had
// nothing to write to, or wrote to an object that was thrown away the moment the next beat started.
// Either way the pause he had asked for came back as sound. Held here, it survives every seam.
//
// SCOPED, because one queue serves every chat: an entry is the project code whose reading is held,
// and `""` is the hold of a surface that owns no project — the whole window. One flag for the window
// would let this chat's button silence another agent's reply, which is the fault measured on
// 2026-10-25 one level down.
let held = new Set();
// Beats parked mid-item. A reply plays its segments inside ONE item, so holding the line cannot stop
// the next segment — the reader asks before each beat and leaves the rest of its sequence here.
let holding = [];

const pausedFor = (scope) => held.has("") || held.has(String(scope || ""));

// A PRESS MEANS HE WANTS SOUND, so choosing something to hear takes off the holds that would have
// muted it instead of playing under a line that still says paused — which is the exact lie this
// change exists to remove. Both the window's hold and this reading's have to go, or the press is
// refused by something he cannot see.
const letGo = (scope) => {
  const before = held.size;
  held.delete("");
  held.delete(String(scope || ""));
  return held.size !== before;
};

const shout = () => {
  const snap = view();
  listeners.forEach((fn) => fn(snap));
};

/** What a surface draws: who is talking, who is in line, what is held. A copy, so nobody mutates
 * the queue. */
// `scope` is WHOSE reading it is — the project code of the chat that lined it up. One queue serves
// every chat in the window, and a surface that draws the queue without asking whose item it is draws
// another agent's reading beside its own bubble (measured 2026-10-25: pause on autobot's bubble
// paused systemview-test's reply). Items that were lined up without a scope stay visible everywhere.
//
// `paused` IS THE HALF THE BUTTON NEEDS MOST: the scopes being held, which is the only way a line
// with nothing playing can say it is paused. That is the state he presses in — no reading, no row,
// and a queue that will not move — and without this it had no account anywhere.
export const view = () => ({
  playing: playing
    ? {
        key: playing.key,
        label: playing.label,
        paused: pausedFor(playing.scope),
        warming: !!playing.warming,
        scope: playing.scope || "",
        position: playing.position || null,
      }
    : null,
  waiting: waiting.map((w) => ({ key: w.key, label: w.label, scope: w.scope || "" })),
  paused: [...held],
});

export const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

const begin = (item) => {
  // A new item takes the floor, so nothing parked by the last one can still be owed a turn.
  holding = [];
  // `start` is kept on `playing` so an interrupted item can be put BACK on the line — `playFirst`
  // needs to be able to restart what it interrupted, and a playing record that forgot how to speak
  // could only ever be dropped.
  playing = { key: item.key, label: item.label, stop: null, start: item.start, scope: item.scope || "" };
  shout();
  // `start()` may finish synchronously in a test, so the handle is attached after — and `done()`
  // clears `playing` either way.
  const handle = item.start();
  if (playing && playing.key === item.key) playing.stop = handle && handle.stop ? handle.stop : null;
};

const next = () => {
  const item = waiting[0];
  // HELD, NOT SKIPPED. The item stays at the head of the line, so letting go reads the thing he
  // paused rather than the one after it — a pause that dropped a beat would be a seek.
  // AND A HELD HEAD HOLDS WHAT IS BEHIND IT, because it is a line: another chat's reading waits its
  // turn rather than jumping it. The escapes are the ones a pause always had — skip, or stop.
  if (!item || pausedFor(item.scope)) {
    playing = null;
    shout();
    return;
  }
  waiting.shift();
  begin(item);
};

/**
 * Join the line. Speaks immediately when nothing is talking, otherwise waits.
 * The same key twice is ONE entry — a row that re-mounts must not queue itself again.
 */
export function enqueue(item, { hold = false } = {}) {
  if (!item || !item.key || typeof item.start !== "function") return false;
  if (playing && playing.key === item.key) return false;
  if (waiting.some((w) => w.key === item.key)) return false;
  // HELD: lined up but not started. It sits at the head of the line until `release()` or until
  // something else finishes and the line moves on its own. No elsewhere path feeds this — an
  // elsewhere reply is read popped-out or dropped, never lined up; the line is on-screen
  // turn-taking only.
  // A PAUSED LINE IS THE OTHER WAY TO NOT START: a reply arriving while his pause is on joins the
  // line and waits, which is the pause doing the one thing he asked of it.
  if (!playing && !hold && !pausedFor(item.scope)) begin(item);
  else {
    waiting.push(item);
    shout();
  }
  return true;
}

/** Start the line when it is standing still — the play on a "waiting" row. A play is a press, so it
 * lets go of whatever was holding the head of the line; otherwise it would do nothing at all. */
export function release() {
  if (playing || !waiting.length) return false;
  letGo(waiting[0].scope);
  next();
  return true;
}

/**
 * This one, now. Stops what is talking and DROPS the line — a press is a choice about what to
 * hear instead, not an interruption to be resumed.
 */
export function cutIn(item) {
  waiting = [];
  if (playing && playing.stop) {
    try {
      playing.stop();
    } catch {
      /* a stop that throws must not strand the queue */
    }
  }
  playing = null;
  // AND IT TAKES THE PAUSE WITH IT. A hold left standing over an empty line is a trap — the next
  // reply joins a line that will not move, and he pressed stop, not pause. Nothing parked survives
  // the item it belonged to either.
  held = new Set();
  holding = [];
  if (item) begin(item);
  else shout();
}

/**
 * THE FRONT OF THE LINE — *"it's not added to the back of the queue, it's added to the front."*
 *
 * NOTHING IS REMOVED AND NOTHING IS REPLACED. That is the whole difference from `cutIn`, which
 * empties the line because a press on a reply means "that one INSTEAD". This means "that one
 * FIRST": whatever was reading stops and goes back to the head of the line, so it picks up again
 * the moment this finishes, and everything already waiting stays exactly where it was.
 *
 * It exists for a selection — he grabbed a few lines because he wants to hear THOSE, now, without
 * losing the reply he was in the middle of.
 */
export function playFirst(item) {
  if (!item || !item.key || typeof item.start !== "function") return false;
  letGo(item.scope);
  if (playing) {
    const back = playing;
    if (back.stop) {
      try {
        back.stop();
      } catch {
        /* a stop that throws must not strand the line */
      }
    }
    playing = null;
    // The interrupted one goes to the HEAD, not the back — it was mid-sentence, not finished.
    waiting = [{ key: back.key, label: back.label, start: back.start }, ...waiting].filter((w) => w.start);
  }
  begin(item);
  return true;
}

/**
 * JUMP THE LINE TO ONE OF ITS OWN ITEMS — *"clicking a queue item… jump to it, forward to it."*
 *
 * DISTINCT FROM GOING TO THE REPLY, and he said so in those words after I conflated them: going to
 * a reply moves the VIEW and leaves the reading alone; this moves the READING and leaves the view
 * alone. One is about where he is looking, the other about what he is hearing.
 *
 * It is FORWARD, so everything ahead of the chosen item is dropped rather than held. Keeping them
 * would mean the line silently rewinds to things he just skipped past the moment this one ends —
 * which is the same failure `cutIn` exists to prevent, one level down.
 */
export function jumpTo(key) {
  const want = String(key || "");
  if (playing && playing.key === want) return false; // already the one talking
  const at = waiting.findIndex((w) => w.key === want);
  if (at === -1) return false;
  const item = waiting[at];
  waiting = waiting.slice(at + 1);
  letGo(item.scope);
  if (playing && playing.stop) {
    try {
      playing.stop();
    } catch {
      /* a stop that throws must not strand the line */
    }
  }
  playing = null;
  begin(item);
  return true;
}

/**
 * SKIP — abandon what is reading and start the next one.
 *
 * The case that demanded it: he paused by accident, replies kept arriving and queueing, and the
 * line could not move because a pause is indefinite by design. He did not want to resume from
 * where he was — he wanted the new things. Without this the only escape was stop, which throws
 * away everything that had arrived while he was stuck.
 */
export function skip() {
  if (!playing) return false;
  // AND IT ONLY ESCAPES IF IT LETS GO. A skip under a standing hold would stop this one and then
  // hold the next one too — the stall again, one item along.
  letGo(playing.scope);
  if (playing.stop) {
    try {
      playing.stop();
    } catch {
      /* a stop that throws must not strand the line */
    }
  }
  next();
  return true;
}

/**
 * STILL LOADING — and the LINE has to be able to say it, not just the row.
 *
 * On a cold machine the first utterance waits on an 86MB model, and the row that was pressed says
 * "Loading" for it. That is no help in the two cases he named: a selection has no row of its own to
 * speak for it, and a reply he has scrolled away from is saying it somewhere he cannot see. Either
 * way the result is silence with no account, which is the one thing the line exists to prevent.
 *
 * A state the playing ITEM reports about itself, which is why it is keyed and `setPaused` is not:
 * only the thing that is loading can be loading, while a pause is the line's and can be pressed
 * when there is no item at all.
 */
export function setWarming(key, on) {
  if (!playing || playing.key !== String(key)) return false;
  const was = !!playing.warming;
  playing.warming = !!on;
  if (was !== playing.warming) shout();
  return true;
}

/**
 * WHERE THE VOICE IS, for anyone drawing the line (RFC-074). The engine reports a sentence index;
 * the caller — the one that has the markdown — turns it into `{ index, total, text, lines }` and
 * puts it here, so the compact row can show the sentence as a subtitle and the chat can light the
 * paragraph it came from, neither of them needing the reply in hand. `null` clears it.
 */
export function setPosition(key, pos) {
  if (!playing || playing.key !== String(key)) return false;
  playing.position = pos
    ? {
        index: pos.index,
        total: pos.total,
        text: pos.text || "",
        lines: pos.lines || null,
        // WHICH FILE is being spoken, when the utterance is a reply replaying its voiced chip —
        // the embed's only way to recognise a passage playing under the reply's key. This
        // whitelist silently dropping it was measured: the replay read the passage and the
        // document never lit (2026-10-26).
        file: pos.file || null,
      }
    : null;
  shout();
  return true;
}

/**
 * THE LINE HAS TO SAY WHY IT IS NOT MOVING. A pause holds the line indefinitely — that is what a
 * pause is — so a held queue and a working queue look identical from outside, and the reader is
 * left to work out that they pressed something. The control that pauses says so here.
 *
 * NO KEY, AND THAT IS THE FIX. It used to name the item being paused, so a press in a silence was
 * refused outright and recorded nowhere — which is precisely the moment he was pressing in. A pause
 * is about the LINE: it can be set with nothing speaking, and it holds until he lets go.
 *
 * `scope` is WHOSE reading is held — the chat's project code, or `""` from a surface that owns no
 * project, which holds the window. Letting go releases both, because a surface showing ▶ has to be
 * able to deliver sound when it is pressed.
 */
export function setPaused(on, scope = "") {
  const s = String(scope || "");
  let changed;
  if (on) {
    changed = !held.has(s);
    held.add(s);
  } else changed = letGo(s);
  if (!changed) return false;
  shout();
  if (on) return true;
  // LETTING GO HAS TO MOVE THE LINE, because nothing else will: `done()` has already fired for
  // whatever was reading, and a beat parked inside a reply is waiting on this and nothing else.
  // Parked beats first — they belong to the item that still has the floor, and running one is how a
  // held sequence picks up on the beat it stopped at. The line itself only moves when nothing is on
  // it, which is the other half of the same release.
  const key = playing ? playing.key : "";
  const freed = holding.filter((h) => h.key === key && !pausedFor(h.scope));
  holding = holding.filter((h) => h.key === key && pausedFor(h.scope));
  freed.forEach((h) => {
    try {
      h.go();
    } catch {
      /* a beat that throws must not strand the line */
    }
  });
  if (!playing) next();
  return true;
}

/** Is the line holding its voice for this reading? What a player asks before it makes a sound. */
export const isPaused = (scope = "") => pausedFor(scope);

/**
 * PARK THE REST OF A SEQUENCE UNTIL HE LETS GO.
 *
 * A reply's beats — prose, a passage, a cue — play inside ONE item, so the queue never sees the
 * seams between them and holding the LINE cannot stop the next beat from speaking. That is the gap
 * his pause fell through: the hold was recorded, nothing read it, and the sequence talked on. So the
 * player asks `isPaused` before each beat and leaves the rest of the sequence here instead.
 *
 * It dies with the item that parked it — a continuation whose turn has passed is dropped, never run.
 */
export function whenResumed(scope, go) {
  if (typeof go !== "function") return false;
  holding.push({ key: playing ? playing.key : "", scope: String(scope || ""), go });
  return true;
}

/** The item finished (or failed). Only the one that IS playing can end the turn. */
export function done(key) {
  if (!playing || playing.key !== String(key)) return false;
  next();
  return true;
}

/** Take one out of the line. The thing being read is not in the line — stop it instead. */
export function drop(key) {
  const before = waiting.length;
  waiting = waiting.filter((w) => w.key !== String(key));
  if (waiting.length !== before) shout();
  return waiting.length !== before;
}

/** Stop everything and empty the line. */
export function clear() {
  cutIn(null);
}

/** Testing seam — a module-level queue cannot otherwise be exercised twice. */
export function _reset() {
  waiting = [];
  playing = null;
  held = new Set();
  holding = [];
  listeners.clear();
}

const queue = { view, subscribe, enqueue, cutIn, done, drop, clear, skip, setPaused, isPaused };
export default queue;
