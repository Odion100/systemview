// ONE CUE, PERFORMED — the single implementation behind every way a cue can play: a reply
// arriving (SpeakReply's segments), and the rendered block's own replay press. Two copies of
// "what a cue does" would drift the first time a verb changed; this is the one.
//
// The vocabulary (his, 2026-10-28): say · highlight · point · press · call · home.
//   say        ::cue[prose]                 — speak it, nothing moves
//   highlight  ::cue{highlight=".sel"}      — the box alone: no bot, no scroll
//   point      ::cue{at=".sel"}             — the full errand: bot walks over, box, scroll
//   press      ::cue{press=".sel"}          — click it, settle, then speak any body
//   call       ::cue{call="Ns.method"}      — a door; NOT WIRED YET and says so, never pretends
//   home       ::cue{home=true}             — the bot returns to its codebase card; a no-op when
//                                             already docked. A CHOICE, never automatic (his,
//                                             2026-10-29): full animation takes the bot out, and
//                                             nothing may quietly pull it back — going home is a
//                                             visible row. No memory of where it came from either
//                                             ("it doesn't need to be so sophisticated that it
//                                             knows where you were") — home IS the card.
//
// A selector cue with no body speaks the ELEMENT's text, read at perform time — a pointer like a
// file embed, never a copy, so what is spoken is what the page says at that moment. An element
// gone by its turn is a silent skip: speaking a cached ghost is the lie the live read refuses.
import { speak } from "./voice";
import { readVoicePref, readVoiceSettings } from "./voicePref";
import { spotlight, clearSpotlight } from "../spotlight";

const PRESS_SETTLE_MS = 700;

// WHAT AN ELEMENT SAYS when a cue reads it: its live text, minus what is excluded — by the PAGE
// (`data-voice-skip` on chrome like the hero links: "I don't like you reading the links in the
// header") and by the COMMAND (`exclude=".sel"` on the cue — his call, 2026-10-29: "make it an
// attribute of the command… configurable per command"). Both compose; splitting an element into
// two cues to carve around its chrome bought a pause between utterances, and this is what removes
// the reason to.
// NEVER textContent ACROSS BLOCKS: it glues them — the hero came out as
// "identityDocumentation as stateThe work here…" (measured in his window, 2026-10-29), which is
// why the title was never HEARD: it was welded into two nonsense words and the voice garbled
// through it. innerText keeps the line breaks; excluded nodes are hidden in place for the read
// (innerText honors display:none) and restored in the same synchronous breath — no paint between.
// Each line then gets a sentence stop, so a kicker, a title and a paragraph read as three things
// with a beat between them instead of one run-on.
export const voiceText = (el, exclude) => {
  if (!el) return "";
  const sels = ["[data-voice-skip]"].concat(exclude ? [exclude] : []);
  let nodes = [];
  try {
    nodes = el.querySelectorAll ? sels.flatMap((s) => Array.from(el.querySelectorAll(s))) : [];
  } catch {
    nodes = []; // a bad exclude selector never silences the cue
  }
  const prev = nodes.map((n) => n.style.display);
  nodes.forEach((n) => { n.style.display = "none"; });
  const text = el.innerText || el.textContent || "";
  nodes.forEach((n, i) => { n.style.display = prev[i]; });
  return text
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (/[.!?:;…]$/.test(s) ? s : `${s}.`))
    .join(" ");
};

export const cueVerb = (cue = {}) =>
  cue.home
    ? "home"
    : cue.call
      ? "call"
      : cue.at
        ? "point"
        : cue.highlight
          ? "highlight"
          : cue.press
            ? "press"
            : "say";

export const cueLabel = (cue = {}) => {
  if (cue.say) return cue.say;
  if (cue.body) return String(cue.body).replace(/\s+/g, " ").slice(0, 70);
  if (cue.home) return "back to the chat";
  return cue.at || cue.highlight || cue.press || cue.call || "";
};

/**
 * Perform one cue. Returns a handle `{ stop }`, or null when there is nothing this verb can do
 * yet (`call`, or a dead selector with no body) — the caller moves on.
 * `onend(err?)` fires exactly once when the cue is finished or stopped.
 */
export function performCue(cue = {}, { projectCode = "", onstart, onend, onposition } = {}) {
  const verb = cueVerb(cue);
  if (verb === "call") return null; // honest: the door is designed, not wired — the block says so

  const sel = cue.at || cue.highlight || cue.press;
  const el = sel ? document.querySelector(sel) : null;
  let finished = false;
  const finish = (err) => {
    if (finished) return;
    finished = true;
    if (verb === "highlight" || verb === "point" || verb === "press") clearSpotlight();
    if (onend) onend(err);
  };

  const say = (text) => {
    const body = String(text || "").replace(/\s+/g, " ").trim();
    if (!body) {
      // nothing to speak — a pressed button or a silent highlight still deserves a beat of hold
      const t = setTimeout(finish, verb === "say" ? 0 : 1600);
      return { stop: () => { clearTimeout(t); finish(); } };
    }
    const s = readVoiceSettings(projectCode);
    return speak(body, {
      preferId: readVoicePref(projectCode),
      rate: s.speed,
      onstart,
      onposition,
      onend: finish,
    });
  };

  if (verb === "say") return say(cue.body);

  if (verb === "home") {
    // The chat's bot answers the event and no-ops if it is already docked — this side only asks.
    window.dispatchEvent(new CustomEvent("sv:agentHome", { detail: { projectCode } }));
    return say(cue.body);
  }

  if (verb === "point") {
    if (!el && !cue.body) return null; // the page moved on — skip, never speak a ghost
    // SELECT FIRST, THEN SPEAK (his catch, 2026-10-29: "how did you start speaking before the
    // selection?"). The scroll fires, we WAIT until the element is actually in view (capped, so a
    // stuck scroll never silences the cue), the errand draws the box with the bot hovering close —
    // and only then does the voice start. say: null on the errand — no title card on the page;
    // the voice box at the bottom is the only speech surface.
    if (el && el.scrollIntoView) el.scrollIntoView({ behavior: "smooth", block: "center" });
    let h = null;
    let waiting = true;
    const begin = () => {
      waiting = false;
      if (finished) return;
      window.dispatchEvent(
        new CustomEvent("sv:agentPoint", {
          detail: { projectCode, target: { selector: sel }, say: null, force: true },
        })
      );
      h = say(cue.body || voiceText(el, cue.exclude));
    };
    const t0 = Date.now();
    const settled = () => {
      if (!el) return true;
      const r = el.getBoundingClientRect();
      const mid = r.top + r.height / 2;
      return mid > 0 && mid < window.innerHeight;
    };
    const tick = () => {
      if (finished || !waiting) return;
      if (settled() || Date.now() - t0 > 1200) return begin();
      requestAnimationFrame(tick);
    };
    tick();
    return {
      stop: () => {
        waiting = false;
        if (h && h.stop) h.stop();
        finish();
      },
    };
  }

  if (verb === "highlight") {
    if (!el && !cue.body) return null;
    // the box alone — full mode so it draws whatever his ambient setting is; cleared on finish
    if (el) spotlight({ target: el, mode: "full", tone: "deliberate", hold: 10 * 60 * 1000 });
    const h = say(cue.body || voiceText(el, cue.exclude));
    return { stop: () => { if (h && h.stop) h.stop(); finish(); } };
  }

  // press — SEEN, never slowed (his, 2026-10-29: "I just wanted it to be seen… even if it was
  // quick"): the box lands, the click fires on the NEXT FRAME — one paint, so the selection
  // exists before the click, at no cost in pace — and the box then LINGERS through the settle,
  // which is where the visibility actually comes from. It clears when the cue ends.
  if (!el) return null;
  if (el.scrollIntoView) el.scrollIntoView({ behavior: "smooth", block: "center" });
  spotlight({ target: el, mode: "full", tone: "deliberate", hold: 10 * 60 * 1000 });
  let h = null;
  const raf = requestAnimationFrame(() => {
    try { el.click(); } catch { /* a dead button must not strand the sequence */ }
  });
  const t = setTimeout(() => {
    h = say(cue.body);
  }, PRESS_SETTLE_MS);
  return {
    stop: () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
      if (h && h.stop) h.stop();
      finish();
    },
  };
}

export default performCue;
