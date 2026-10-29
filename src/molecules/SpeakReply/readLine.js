// THE READ LINE — anything on the page, spoken through the ONE speech queue (his design,
// 2026-10-28, built for the how-we-work tour and deliberately not scoped to it).
//
// `sv:read` is the door. Its detail:
//   { projectCode?, items: [ {selector, say?} | {text} | "selector" ], follow?: { scroll, avatar } }
//
// Each item joins the same line his replies wait in — so reads, replies and selections share one
// order, one transport, one forward-click. THE NOW-PLAYING ITEM IS THE CURSOR AND EVERYTHING ELSE
// FOLLOWS IT: when a selector item starts speaking, the page scrolls to it and the bot walks over
// and stands beside it (the errand — sv:agentPoint — which brings its own spotlight box). Clicking
// forward in the line advances the queue, and because the followers fire from the item STARTING
// rather than from whoever enqueued it, the spotlight and the bot move with the skip for free.
//
// THE TEXT IS READ AT START TIME, NOT ENQUEUE TIME. The enqueuer hands over a pointer, never a
// copy — so what is spoken is what the page says at the moment it is spoken, and a queue built
// before an edit still reads the edit. An element gone by its turn is skipped, silently honest:
// speaking a cached copy of a dead element is the exact lie the live read exists to prevent.
//
// `follow` is per-batch and each follower declines separately: a tour wants both; a quiet
// "read me this while I work" wants neither yanking the scroll nor a bot photobombing the pane.
import { enqueue, done as queueDone, view, clear } from "./speechQueue";
import { speak } from "../../utils/voice";
import { readVoicePref, readVoiceSettings } from "../../utils/voicePref";
import { resolveTarget } from "../../spotlightTargets";

let seq = 0;

function onRead(e) {
  const d = (e && e.detail) || {};
  const items = Array.isArray(d.items) ? d.items : [];
  const follow = { scroll: true, avatar: true, ...(d.follow || {}) };
  items.forEach((raw) => {
    const it = typeof raw === "string" ? { selector: raw } : raw || {};
    if (!it.selector && !it.text) return;
    const key = `read:${(seq += 1)}`;
    enqueue({
      key,
      scope: d.projectCode || "",
      label: it.text
        ? String(it.text).replace(/\s+/g, " ").slice(0, 70)
        : `reading ${it.selector}`,
      start: () => {
        let text = String(it.text || "");
        if (it.selector) {
          const el = resolveTarget({ selector: it.selector });
          if (!el) {
            // the page moved on since this was lined up — skip it rather than speak a ghost
            queueDone(key);
            return null;
          }
          text = (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();
          if (follow.scroll && el.scrollIntoView) el.scrollIntoView({ behavior: "smooth", block: "center" });
          if (follow.avatar)
            window.dispatchEvent(
              new CustomEvent("sv:agentPoint", {
                // force: an explicit read-errand is a direct instruction, not ambience — it walks
                // even when his ambient animation mode is off (that setting still governs the
                // passive pointing my replies trigger)
                // say: null — no title card on the page; the voice box at the bottom is the only
                // speech surface (his ruling, 2026-10-29)
                detail: { projectCode: d.projectCode, target: { selector: it.selector }, say: null, force: true },
              })
            );
        }
        if (!text) {
          queueDone(key);
          return null;
        }
        const s = readVoiceSettings(d.projectCode);
        return speak(text, {
          preferId: readVoicePref(d.projectCode),
          rate: s.speed,
          onend: () => queueDone(key),
        });
      },
    });
  });
}

/** Mounted once by the app. The globals are the shell's stat door — read-only, and `clear` so a
 *  tour can be stopped from outside the window the moment he speaks. */
export function installReadLine() {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("sv:read", onRead);
  window.__svReadLine = { view, clear };
  return () => {
    window.removeEventListener("sv:read", onRead);
    delete window.__svReadLine;
  };
}

export default installReadLine;
