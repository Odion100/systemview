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
let playing = null; // { key, label, stop, paused }
let waiting = [];

const shout = () => {
  const snap = view();
  listeners.forEach((fn) => fn(snap));
};

/** What a surface draws: who is talking and who is in line. A copy, so nobody mutates the queue. */
export const view = () => ({
  playing: playing
    ? { key: playing.key, label: playing.label, paused: !!playing.paused, warming: !!playing.warming }
    : null,
  waiting: waiting.map((w) => ({ key: w.key, label: w.label })),
});

export const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

const begin = (item) => {
  // `start` is kept on `playing` so an interrupted item can be put BACK on the line — `playFirst`
  // needs to be able to restart what it interrupted, and a playing record that forgot how to speak
  // could only ever be dropped.
  playing = { key: item.key, label: item.label, stop: null, start: item.start };
  shout();
  // `start()` may finish synchronously in a test, so the handle is attached after — and `done()`
  // clears `playing` either way.
  const handle = item.start();
  if (playing && playing.key === item.key) playing.stop = handle && handle.stop ? handle.stop : null;
};

const next = () => {
  const item = waiting.shift();
  if (!item) {
    playing = null;
    shout();
    return;
  }
  begin(item);
};

/**
 * Join the line. Speaks immediately when nothing is talking, otherwise waits.
 * The same key twice is ONE entry — a row that re-mounts must not queue itself again.
 */
export function enqueue(item) {
  if (!item || !item.key || typeof item.start !== "function") return false;
  if (playing && playing.key === item.key) return false;
  if (waiting.some((w) => w.key === item.key)) return false;
  if (!playing) begin(item);
  else {
    waiting.push(item);
    shout();
  }
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
 * THE LINE HAS TO SAY WHY IT IS NOT MOVING. A pause holds the current item forever — that is what
 * a pause is — so a stalled queue and a working queue look identical from outside, and the reader
 * is left to work out that they pressed something. The control that pauses says so here.
 */
/**
 * STILL LOADING — and the LINE has to be able to say it, not just the row.
 *
 * On a cold machine the first utterance waits on an 86MB model, and the row that was pressed says
 * "Loading" for it. That is no help in the two cases he named: a selection has no row of its own to
 * speak for it, and a reply he has scrolled away from is saying it somewhere he cannot see. Either
 * way the result is silence with no account, which is the one thing the line exists to prevent.
 *
 * Same shape as `setPaused` on purpose — the line already knows how to render a state the playing
 * item reports about itself.
 */
export function setWarming(key, on) {
  if (!playing || playing.key !== String(key)) return false;
  const was = !!playing.warming;
  playing.warming = !!on;
  if (was !== playing.warming) shout();
  return true;
}

export function setPaused(key, on) {
  if (!playing || playing.key !== String(key)) return false;
  const was = !!playing.paused;
  playing.paused = !!on;
  if (was !== playing.paused) shout();
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
  listeners.clear();
}

const queue = { view, subscribe, enqueue, cutIn, done, drop, clear, skip, setPaused };
export default queue;
