// RFC-045's second capability — DICTATION THROUGH THE HOST.
//
// The Web Speech API is a Chrome service, not a Chromium feature: inside Electron
// `webkitSpeechRecognition` CONSTRUCTS and then never produces a result, so every `supported` check
// in this app returns a false positive there and the mic reads as broken rather than absent
// (autobot, who hit it while wiring the shell).
//
// So the host takes the job it can actually do: the page records — getUserMedia + MediaRecorder,
// which are ordinary Chromium — and hands the bytes over for transcription.
//
//   window.systemview.dictation.transcribe(bytes: Uint8Array, mimeType: string) -> { text }
//
// The one thing this shape cost at first was INTERIM text — speech recognition streams words as you
// talk, and a recorder has nothing to show until it stops. His words, immediately: "the previous one
// used to show my text as I talk". So the recorder now takes a timeslice and re-transcribes the
// buffer so far on a beat through a fast draft pass:
//
//   window.systemview.dictation.transcribe(bytes, mimeType, { draft: true }) -> { text }
//
// Draft text is ROUGH and whole-buffer: it REPLACES the interim line rather than appending to it,
// and it is never what gets committed — `stop()` always does a final, clean pass.
// TWO SHAPES OF HOST, and the newer one is the point of the whole seam.
//
// `listen()` is the host owning DICTATION as a capability: mic capture, pause detection, segment
// cadence, tuning — all of it behind one call, so every local app gets live-preview dictation
// instead of each one re-implementing a VAD state machine in its own repo. His rule, and it is the
// right one: capabilities belong to the browser, surfaces belong to the app.
//
// `transcribe()` is the older, thinner host: it turns bytes into text and nothing else, so the
// recorder below has to do the rest. That path is kept because it is also what a host with only a
// transcriber can offer — and because it is what shipped first.
export const hostListens = () => {
  const d = typeof window !== "undefined" && window.systemview && window.systemview.dictation;
  return !!(d && typeof d.listen === "function");
};

// EITHER shape counts as "this host does dictation" — a host that only implements `listen()` is the
// end state, and testing for `transcribe` alone would hide every mic in the app the day the older
// call goes away.
export const hasHostDictation = () => {
  const d = typeof window !== "undefined" && window.systemview && window.systemview.dictation;
  return !!(d && (typeof d.listen === "function" || typeof d.transcribe === "function"));
};

const pickMime = () => {
  if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) return "";
  const wanted = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  return wanted.find((m) => MediaRecorder.isTypeSupported(m)) || "";
};

// Starts recording immediately.
//
// THE SHAPE HE ASKED FOR, in his words: "it used to populate the input as I spoke… for those slight
// pauses, it would populate the input and the send button would be ready", and "I used to be able to
// just send and not have to stop the recorder". So a recording is not one long take that pays out at
// the end — it is a run of SEGMENTS split on the pauses you already make when you talk:
//
//   • `onDraft`   rough text WHILE a segment is running (whole-buffer, replaces the line)
//   • `onSegment` clean text COMMITTED at a pause — this is what lands in the input, mid-recording
//   • `flush()`   force the in-progress segment to commit now, and keep the mic hot (this is SEND)
//   • `stop()`    commit whatever is left and release the mic
//
// Every committed word goes through `onSegment`; `stop()` returns nothing to append. One path in,
// so a caller can never double-commit the tail.
// THE TWO NUMBERS THAT DECIDE HOW IT FEELS, and they are related in a way that bit immediately:
// a draft tick SLOWER than the pause threshold means a short sentence commits before its first
// draft ever paints — you never see the words, they just appear in the input. His report, exactly:
// "I want to see the words up before it populates the input… it goes so quick that I don't see my
// words populating." So drafts tick roughly twice per pause window. Cheap, because the host skips
// the model entirely on a silent tick.
//
// Overridable at runtime without a rebuild — `localStorage.setItem("sv.dictation.pauseMs", 1400)` —
// because the right number depends on how fast you talk, and that is his ear, not my guess.
const num = (key, fallback) => {
  try {
    const v = Number(localStorage.getItem(`sv.dictation.${key}`));
    return Number.isFinite(v) && v > 0 ? v : fallback;
  } catch {
    return fallback;
  }
};
// `raw` returns ONLY an explicit override, so the host's own defaults win when he hasn't set one —
// the tuning belongs to the browser now (his rule), and passing my numbers every time would quietly
// override the setting he tunes there.
const raw = (key) => {
  try {
    const v = Number(localStorage.getItem(`sv.dictation.${key}`));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
};
const DRAFT_EVERY = () => num("draftMs", 600);
const PAUSE_MS = () => num("pauseMs", 1500); // his "slight pauses" — long enough not to split mid-sentence
const SILENCE = () => num("silence", 0.012); // RMS below this is not speech
const WATCH_EVERY = 100;

export async function startHostRecording({ onDraft = null, onSegment = null, pauseMs = null } = {}) {
  // THE HOST DOES ALL OF IT when it can. Everything below this branch — capture, the analyser, the
  // segment machine, the draft loop — is the fallback for a host that only transcribes.
  if (hostListens()) {
    // `flush()` has to hand the text back, because SEND composes it with whatever is already in the
    // input and then clears the box. The host's contract delivers segments through `onSegment`, so
    // catch what arrives while a flush is in flight and return that.
    let catching = null;
    // A DRAFT THAT ARRIVES AFTER ITS OWN SEGMENT IS STALE, and it looks like the words refusing to
    // leave: the sentence lands in the input, and then a draft that was already in flight repaints
    // the live line with the same words underneath it. His report exactly — "the words take much
    // longer to clear than to populate". Drafts belong to the segment that was running when they
    // started, so anything landing in the beat after a commit is thrown away.
    const STALE_AFTER_COMMIT = 700;
    let lastCommit = 0;
    const session = await window.systemview.dictation.listen({
      onDraft: onDraft
        ? (text) => {
            if (Date.now() - lastCommit < STALE_AFTER_COMMIT) return;
            onDraft(text);
          }
        : null,
      onSegment: (text) => {
        lastCommit = Date.now();
        const t = String(text || "").trim();
        if (!t) return;
        if (catching) catching.push(t);
        if (onSegment) onSegment(t);
      },
      // Only what he explicitly overrode; otherwise the host's defaults stand.
      ...(pauseMs || raw("pauseMs") ? { pauseMs: pauseMs || raw("pauseMs") } : {}),
      ...(raw("draftMs") ? { draftMs: raw("draftMs") } : {}),
    });
    return {
      async flush() {
        catching = [];
        try {
          await session.flush();
        } catch {}
        // A TRAILING SEGMENT MUST NOT ESCAPE. If the host resolves flush() a hair before its
        // onSegment callback crosses the bridge, this would return empty — and the sentence would
        // land in the input a moment AFTER send cleared it, sitting there as orphaned text. A short
        // grace closes that window; it costs nothing when the callback already arrived.
        if (!catching.length) await new Promise((r) => setTimeout(r, 250));
        const got = catching.join(" ").trim();
        catching = null;
        return got;
      },
      async stop() {
        try {
          await session.stop();
        } catch {}
        return ""; // everything committed through onSegment
      },
      cancel() {
        try {
          session.cancel();
        } catch {}
      },
    };
  }

  const pause = pauseMs || PAUSE_MS();
  const silence = SILENCE();
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mime = pickMime();
  const release = () => stream.getTracks().forEach((t) => t.stop());

  let rec = null;
  let chunks = [];
  let stopped = null;
  let finished = false;
  let inFlight = false; // a draft is out
  let committing = false; // a segment is being finalised
  let heardSpeech = false;
  let quietSince = 0;
  let lastCommit = 0;
  let draftTimer = null;
  let watchTimer = null;
  let audio = null;

  const newRecorder = () => {
    rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    chunks = [];
    rec.ondataavailable = (e) => e.data && e.data.size && chunks.push(e.data);
    stopped = new Promise((resolve) => {
      rec.onstop = resolve;
    });
    // A TIMESLICE is what makes a draft possible at all: without it MediaRecorder holds everything
    // until stop and there is nothing to look at mid-sentence.
    rec.start(1000);
  };

  const bytesSoFar = async () => {
    const blob = new Blob(chunks, { type: mime || "audio/webm" });
    return { bytes: new Uint8Array(await blob.arrayBuffer()), type: blob.type };
  };

  // Commit the current segment: stop the recorder (which flushes the last chunk), transcribe at FULL
  // quality, hand the text over, and — unless we are finishing — start a fresh recorder on the same
  // stream. The stream stays open throughout, so the mic light never blinks and nothing is missed
  // between segments beyond the pause itself.
  const commit = async ({ last = false } = {}) => {
    if (committing) return "";
    if (!rec || rec.state === "inactive" || !heardSpeech) {
      if (last) return "";
      return "";
    }
    committing = true;
    const mine = rec;
    const waitFor = stopped;
    try {
      mine.stop();
    } catch {}
    await waitFor;
    let text = "";
    try {
      if (chunks.length) {
        const { bytes, type } = await bytesSoFar();
        const res = await window.systemview.dictation.transcribe(bytes, type);
        text = ((res && res.text) || "").trim();
      }
    } catch {
      /* a lost segment is bad, but throwing here would also cost the rest of the recording */
    }
    heardSpeech = false;
    quietSince = 0;
    lastCommit = Date.now();
    if (!finished && !last) newRecorder();
    committing = false;
    if (text && onSegment) onSegment(text);
    return text;
  };

  // The pause watcher. Speech raises `heardSpeech`; a stretch of quiet AFTER speech is the seam.
  const startWatching = async () => {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return; // no analyser → no pause splitting; drafts and flush still work
    audio = new Ctx();
    const src = audio.createMediaStreamSource(stream);
    const analyser = audio.createAnalyser();
    analyser.fftSize = 1024;
    src.connect(analyser);
    const buf = new Float32Array(analyser.fftSize);
    watchTimer = setInterval(() => {
      if (finished || committing) return;
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      const rms = Math.sqrt(sum / buf.length);
      if (rms > silence) {
        heardSpeech = true;
        quietSince = 0;
        return;
      }
      if (!heardSpeech) return;
      const now = Date.now();
      if (!quietSince) quietSince = now;
      else if (now - quietSince >= pause) commit();
    }, WATCH_EVERY);
  };

  newRecorder();
  startWatching();

  if (onDraft) {
    draftTimer = setInterval(async () => {
      // ONE IN FLIGHT AT A TIME. Ticks are faster than the model on a long buffer, and overlapping
      // calls would land out of order — a later draft overwritten by an earlier one reads as the
      // text going backwards while you talk.
      if (inFlight || finished || committing || !chunks.length) return;
      inFlight = true;
      try {
        const { bytes, type } = await bytesSoFar();
        const res = await window.systemview.dictation.transcribe(bytes, type, { draft: true });
        const text = (res && res.text) || "";
        // Same staleness rule as the listen() path: this draft describes audio that has since been
        // committed, so painting it now shows the words a second time under the input.
        if (!finished && !committing && text && Date.now() - lastCommit >= 700) onDraft(text);
      } catch {
        /* a failed draft is not worth telling anyone about — the segment pass is what counts */
      } finally {
        inFlight = false;
      }
    }, DRAFT_EVERY());
  }

  const clearTimers = () => {
    if (draftTimer) clearInterval(draftTimer);
    if (watchTimer) clearInterval(watchTimer);
    draftTimer = null;
    watchTimer = null;
  };

  return {
    // SEND WITHOUT STOPPING. Commits what has been said so far and leaves the mic hot, so the next
    // sentence starts a new segment instead of a new recording.
    async flush() {
      heardSpeech = heardSpeech || chunks.length > 0; // forced: whatever is in the buffer counts
      return commit();
    },
    async stop() {
      finished = true;
      clearTimers();
      await commit({ last: true });
      try {
        if (rec && rec.state !== "inactive") rec.stop();
      } catch {}
      if (audio) {
        try {
          await audio.close();
        } catch {}
      }
      release();
      return ""; // everything committed through onSegment — never append this
    },
    cancel() {
      finished = true;
      clearTimers();
      try {
        if (rec && rec.state !== "inactive") rec.stop();
      } catch {}
      if (audio) audio.close().catch(() => {});
      release();
    },
  };
}
