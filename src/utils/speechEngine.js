// THE PLAYER — one speech engine, two places the sound can be MADE.
//
// WHY THIS FILE EXISTS. Speech is now a HARNESS capability: the model runs once in the shell, in a
// node child process, for every app in the window (*"you should be getting the functionality from
// the harness"*). But the same window also has to work when there is no harness around it — a
// plain browser tab on localhost:3000 — where the model runs in the page instead.
//
// Those two differ in EXACTLY ONE FUNCTION: how a sentence becomes samples. Everything else — the
// audio context, the suspend-based pause, keeping generated buffers so a seek is instant, the
// index-driven loop, "a new utterance ends the one before it" — is identical, and it is the half
// with all the bugs in it. Two copies of that would be two places to fix the next one. So it lives
// here once and is handed a `generate`.
import { spokenChunks } from "./spokenForm";

let CTX = null;
const context = () => {
  if (!CTX) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    CTX = new C();
  }
  // A CONTEXT CREATED BEFORE A GESTURE STARTS SUSPENDED and plays nothing, silently. The press is
  // the gesture, so resuming here — every time, it is a no-op when already running — is what makes
  // the first press after a cold load audible.
  if (CTX.state === "suspended" && CTX.resume) CTX.resume();
  return CTX;
};

// SUSPEND IS THE PAUSE. Stopping a buffer source and starting a new one would restart the
// SENTENCE — suspending the context freezes the waveform where it is and resuming continues on the
// same syllable, which is the difference between a pause and a rewind. It is also why nothing has
// to be re-generated to resume.
//
// Both are no-ops when the context does not exist or is already in that state, because a control
// that calls pause twice is a control working correctly.
const suspendContext = () => {
  if (CTX && CTX.state === "running" && CTX.suspend) CTX.suspend();
};
const resumeContext = () => {
  if (CTX && CTX.state === "suspended" && CTX.resume) CTX.resume();
};

let PLAYING = null;

// THE ONE RUN THAT IS SPEAKING, AND WHY IT IS A MODULE-LEVEL THING. Measured by him, 2026-10-21:
// *"I press another one and multiple are playing at the same time… I can't stop it."* Two separate
// faults, one cause.
//
//   * A SECOND `speak()` DID NOT SILENCE THE FIRST. The engine this replaced called
//     `speechSynthesis.cancel()` on its way in — the queue was global to the page, so a second
//     press anywhere could not layer. Kokoro has no global queue to cancel, and porting the file
//     lost the behaviour rather than reimplementing it. Auditioning voices is PRECISELY the case
//     where you press one while another is talking, so the one control it broke is the control it
//     was built for.
//   * `stop()` ONLY KILLED THE CURRENT SENTENCE. The cancelled flag lived in a closure reachable
//     only through the returned handle, so `stop()` silenced the audio node while the generation
//     loop carried on — the reply went quiet and then STARTED AGAIN on the next sentence. Worse
//     than not stopping, because it looks like it worked.
//
// So the live run is held here, where both doors can reach it: starting one ends the one before,
// and stopping is `cancel()` on the run rather than on a buffer.
let CURRENT = null;

function cancelCurrent() {
  const run = CURRENT;
  CURRENT = null;
  if (run) run.cancel();
}

function playSamples(audio, rate) {
  const ctx = context();
  if (!ctx) return Promise.reject(new Error("this browser has no Web Audio"));
  return new Promise((resolve, reject) => {
    let buf;
    try {
      buf = ctx.createBuffer(1, audio.length, rate);
      buf.copyToChannel ? buf.copyToChannel(audio, 0) : buf.getChannelData(0).set(audio);
    } catch (e) {
      return reject(e);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    // `onended` FIRES FOR A STOP AS WELL AS A FINISH, which is what makes one resolve path correct
    // for both: the caller above decides whether to continue by checking its own cancelled flag,
    // never by guessing why the node ended.
    src.onended = () => {
      if (PLAYING === src) PLAYING = null;
      resolve();
    };
    PLAYING = src;
    src.start();
  });
}

function silence() {
  const src = PLAYING;
  PLAYING = null;
  if (src) {
    try {
      // `onended` IS LEFT ATTACHED on purpose. It is the promise's only resolve path, so nulling
      // it meant a stopped sentence never settled and the loop above awaited it forever — the
      // run could never reach `finish()`, so `onend` never fired and the button stayed lit over
      // silence. Stopping fires it, which is exactly the behaviour the resolve path wants.
      src.stop();
    } catch {
      /* already finished — stopping twice is not an error worth raising */
    }
  }
}

// ── the engine ─────────────────────────────────────────────────────────────────────────────────


// ── THE FACTORY ────────────────────────────────────────────────────────────────────────────────
//
// `generate(text, { voice, speed })` → `{ audio: Float32Array, sampleRate }`. That is the entire
// difference between running the model in this page and asking the harness to run it.
export function makeSpeechEngine({ name, generate, voices, available, ready, loading, lastError, progress, prewarm, defaultVoice }) {
  const engine = {
    name,
    voices,
    available,
    ready,
    loading,
    lastError,
    progress,
    prewarm,

    stop() {
      cancelCurrent();
    },

    // THE LIVE RUN'S TRANSPORT, reachable without holding its handle — a surface that did not
    // start the utterance still has to be able to stop or pause it. `speaking()` is what a control
    // reads to know there is anything to show at all, which is the whole of "the transport appears
    // only while it is playing".
    pause: () => CURRENT && CURRENT.pause(),
    resume: () => CURRENT && CURRENT.resume(),
    seek: (to) => CURRENT && CURRENT.seek(to),
    speaking: () => !!CURRENT,
    position: () => (CURRENT ? CURRENT.position() : null),

  // ── SPEAKING, AND BEING ABLE TO MOVE AROUND INSIDE IT ────────────────────────────────────────
  //
  // THE LOOP IS INDEX-DRIVEN, NOT SEQUENTIAL, AND THAT IS THE WHOLE REASON THIS WAS REWRITTEN. The
  // first version walked the sentences with a `for`, which can only ever move forward — there was
  // no "where am I" to read and nowhere to jump to. Position is now a NUMBER the run owns, so
  // seeking is an assignment and the loop picks up wherever it points.
  //
  // THE TIMELINE IS SENTENCES, NOT SECONDS, and that is an honest choice rather than a shortcut. A
  // reply is generated a sentence at a time, one ahead, which is what makes the first word arrive
  // in two seconds instead of forty — so a duration in seconds does not exist until the whole
  // thing has been generated, and waiting for that would destroy the only property that makes this
  // usable. The sentence COUNT is known the instant the text is chunked, so a scrubber over
  // sentences is real and full-width from the first moment, with the generated ones as the filled
  // part. A seconds-based bar would have to lie about its own length until the end.
  //
  // EVERY GENERATED SENTENCE IS KEPT, which is what makes seeking backwards instant — a buffer
  // source is one-shot, so replaying means building a new one from the same samples. The cache
  // dies with the run; roughly 20MB for a four-minute reply, and nothing outlives the utterance.
  speak(text, opts = {}) {
    const body = String(text || "").trim();
    let done = false;
    let started = false;
    let cancelled = false;
    // Declared before `finish` so it can check ownership, assigned below once there is a body to
    // speak — an empty utterance never becomes the current run at all.
    let run = null;

    const finish = (err) => {
      if (done) return;
      done = true;
      // ONLY CLEAR THE SLOT IF THIS RUN STILL OWNS IT. A run being cancelled BY a newer one is
      // finishing after that newer one already claimed the slot, and wiping it there would leave
      // the live utterance unstoppable — the original bug, one layer further in.
      if (CURRENT === run) CURRENT = null;
      if (err && opts.onerror) opts.onerror(err);
      if (opts.onend) opts.onend(err);
    };

    if (!body) {
      finish();
      return { stop() {}, pause() {}, resume() {}, seek() {}, total: 0 };
    }

    // ENDING WHATEVER IS SPEAKING IS THE FIRST THING A NEW UTTERANCE DOES. Before any model is
    // touched, so pressing a second voice is silent-then-new rather than two at once even while
    // the next one is still generating.
    cancelCurrent();

    const voice =
      (opts.voice && (opts.voice.id || opts.voice)) || opts.preferId || defaultVoice();
    const chunks = spokenChunks(body);
    const speed = opts.rate || 1;
    const cache = new Map();

    let index = 0;
    let paused = false;
    // BUMPED ON EVERY SEEK. An in-flight play or generation belongs to the position it was started
    // from; after a jump it must abandon rather than advance the index it no longer describes.
    let pass = 0;

    const report = () => {
      if (opts.onposition)
        opts.onposition({ index, total: chunks.length, buffered: cache.size, paused });
    };

    run = {
      cancel() {
        if (done) return;
        cancelled = true;
        pass += 1;
        silence();
        resumeContext();
        cache.clear();
        // `onend` STILL FIRES. The control that was reading is driven by it, and a run cancelled
        // from outside leaves a lit button over silence if it is skipped.
        finish();
      },
      pause() {
        if (done || paused) return;
        paused = true;
        // SUSPENDING THE CONTEXT IS AN EXACT PAUSE — it freezes mid-word and resumes on the same
        // syllable, where stopping the source and replaying the sentence would restart it. The
        // playing source never ends while suspended, so the loop simply waits; generation carries
        // on, which means a pause actually lets the buffer get ahead.
        suspendContext();
        report();
      },
      resume() {
        if (done || !paused) return;
        paused = false;
        resumeContext();
        report();
      },
      seek(to) {
        if (done) return;
        const next = Math.max(0, Math.min(chunks.length - 1, Math.floor(Number(to) || 0)));
        index = next;
        pass += 1;
        silence();
        if (paused) {
          paused = false;
          resumeContext();
        }
        report();
        loop();
      },
      position: () => ({ index, total: chunks.length, buffered: cache.size, paused }),
    };
    CURRENT = run;

    const madeAt = async (i) => {
      if (i < 0 || i >= chunks.length) return null;
      if (cache.has(i)) return cache.get(i);
      const made = await generate(chunks[i], { voice, speed });
      cache.set(i, made);
      return made;
    };

    async function loop() {
      const mine = ++pass;
      try {
        while (index < chunks.length) {
          if (cancelled || pass !== mine) return;
          const at = index;
          const sound = await madeAt(at);
          if (cancelled || pass !== mine || index !== at) return;
          // QUEUED, NOT AWAITED — the model works on the next sentence for the whole duration of
          // this one, so the gap between sentences is hidden rather than merely short. A failure
          // here is not fatal: the sentence is generated again when the loop reaches it.
          madeAt(at + 1).catch(() => {});
          if (!started) {
            started = true;
            if (opts.onstart) opts.onstart();
          }
          report();
          await playSamples(sound.audio, sound.sampleRate);
          if (cancelled || pass !== mine || index !== at) return;
          index = at + 1;
        }
        report();
        finish();
      } catch (e) {
        if (cancelled || pass !== mine) return;
        finish(e);
      }
    }

    (async () => {
      // READY BEFORE THE FIRST SENTENCE. For the in-page engine this is the 86MB model load; for
      // the harness it is a handshake that costs nothing. Either way a failure here is the whole
      // utterance failing, and it is SAID rather than swallowed — there is no second voice to
      // quietly stand in.
      try {
        if (prewarm) await prewarm(opts.onprogress);
      } catch (e) {
        return finish(e);
      }
      if (cancelled) return finish();
      loop();
    })();

    return {
      stop() {
        if (CURRENT === run) CURRENT = null;
        run.cancel();
      },
      pause: () => run.pause(),
      resume: () => run.resume(),
      seek: (to) => run.seek(to),
      position: () => run.position(),
      total: chunks.length,
    };
  }
  };

  return engine;
}
