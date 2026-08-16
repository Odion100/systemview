// THE SPOTLIGHT — an agent pointing at things on the page.
//
// His design, arrived at over a long conversation, and the two rules that matter most are his:
//
//   1. THE AGENT NEVER CHOREOGRAPHS. It says WHAT — a namespace, a file, a block — and the UI owns
//      where that is and how the motion looks. So the same message animates correctly at any window
//      size, and degrades to nothing when the thing isn't on screen instead of pointing at nowhere.
//   2. POINTING IS EPHEMERAL. "It should disappear on refresh." Decisions (his answers, verdicts,
//      replies) are written into records and persist. A gesture is not a decision: it never touches
//      disk, never edits a document, and dies with the page. If a highlight were saved, every "look
//      at this" would silently edit a file, two agents pointing at different things would fight over
//      it, and a later reader would think the document says something it doesn't.
//
// Deliberately a plain DOM module, not a React component: it is called from the chat, from the
// markdown renderer, and from command execution, and none of those should have to thread props to
// each other for a gesture that lasts two seconds.

const NS = "http://www.w3.org/2000/svg";
const LAYER_ID = "sv-spotlight";
// HIS NUMBER: "it should just point and stay there for at least 10 seconds." The original couple of
// seconds was tuned for a gesture you were already watching; in practice you arrive at the screen
// after it fired, so a short hold means you see the tail of something and not the thing. Ambient is
// shorter because nothing is being said — it's the page moving, not an agent talking.
const HOLD_MS = 10000;
const AMBIENT_MS = 5000;

let layer = null;
let clearTimer = null;
let watching = null; // rAF id — a target can move while lit (scrolling, resizing)

// ---- the setting -------------------------------------------------------------------------------
// Per project, and the AGENT IS NEVER TOLD which one is on (his rule): it says what it means, the
// human decides how loud that gets.
export const MODES = ["off", "subtle", "full"];
export function animationMode(projectCode) {
  try {
    const v = localStorage.getItem(`sv.anim.${projectCode}`);
    if (MODES.includes(v)) return v;
  } catch {}
  return "subtle"; // his default
}
export function setAnimationMode(projectCode, mode) {
  try {
    if (MODES.includes(mode)) localStorage.setItem(`sv.anim.${projectCode}`, mode);
  } catch {}
  return mode;
}

// ---- the layer ---------------------------------------------------------------------------------
function ensureLayer() {
  if (layer && document.body.contains(layer)) return layer;
  layer = document.createElementNS(NS, "svg");
  layer.setAttribute("id", LAYER_ID);
  layer.setAttribute("aria-hidden", "true"); // decoration — never announced, never focusable
  Object.assign(layer.style, {
    position: "fixed",
    inset: "0",
    width: "100%",
    height: "100%",
    // The whole point of an overlay: it must never eat a click meant for the page underneath.
    pointerEvents: "none",
    // UNDER THE CHAT (his rule: the chat holds the highest z-index). It has to sit over the page it
    // is pointing at, and under the panel doing the pointing — a gesture that covers the bot and its
    // dialogue box is pointing at the wrong thing.
    zIndex: "8400",
  });
  document.body.appendChild(layer);
  return layer;
}

export function clearSpotlight() {
  if (clearTimer) clearTimeout(clearTimer);
  clearTimer = null;
  if (watching) cancelAnimationFrame(watching);
  watching = null;
  if (layer) layer.innerHTML = "";
}

// A page-level refresh or navigation wipes any gesture in flight — pointing does not survive the
// thing it was pointing at.
if (typeof window !== "undefined") {
  window.addEventListener("sv:refresh", clearSpotlight);
  window.addEventListener("beforeunload", clearSpotlight);
}

const visible = (el) => {
  if (!el || !el.getBoundingClientRect) return false;
  const r = el.getBoundingClientRect();
  if (!r.width && !r.height) return false;
  // Off-screen counts as not visible: a line to something above the fold is a line to nowhere.
  return r.bottom > 0 && r.right > 0 && r.top < window.innerHeight && r.left < window.innerWidth;
};

function drawBox(rect, tone) {
  const g = document.createElementNS(NS, "g");
  const pad = 4;
  const mk = (extra) => {
    const el = document.createElementNS(NS, "rect");
    el.setAttribute("x", rect.left - pad);
    el.setAttribute("y", rect.top - pad);
    el.setAttribute("width", Math.max(0, rect.width + pad * 2));
    el.setAttribute("height", Math.max(0, rect.height + pad * 2));
    el.setAttribute("rx", "7");
    el.setAttribute("fill", extra.fill || "none");
    if (extra.stroke) {
      el.setAttribute("stroke", extra.stroke);
      el.setAttribute("stroke-width", extra.width);
      if (extra.dash) el.setAttribute("stroke-dasharray", extra.dash);
    }
    return el;
  };
  // A soft wash + a wide faint stroke under the sharp one: it reads as something LIT by the agent
  // rather than a border the layout drew.
  g.appendChild(mk({ fill: tone.wash }));
  g.appendChild(mk({ stroke: tone.halo, width: String(Number(tone.width) + 5) }));
  g.appendChild(mk({ stroke: tone.stroke, width: tone.width, dash: tone.dash }));
  g.setAttribute("class", "sv-spot__box");
  return g;
}

function drawLine(from, to, tone) {
  // A gentle curve rather than a straight rule — it reads as a gesture instead of a border.
  const x1 = from.left + from.width / 2;
  const y1 = from.top + from.height / 2;
  const x2 = to.left + to.width / 2;
  const y2 = to.top + to.height / 2;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2 - Math.min(90, Math.abs(x2 - x1) / 3);
  const el = document.createElementNS(NS, "path");
  el.setAttribute("d", `M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`);
  el.setAttribute("fill", "none");
  el.setAttribute("stroke", tone.stroke);
  el.setAttribute("stroke-width", tone.width);
  el.setAttribute("stroke-linecap", "round");
  el.setAttribute("class", "sv-spot__line");
  return el;
}

// AMBIENT vs DELIBERATE — his distinction, and it is a hard rendering rule: the UI animating
// because a test is running must not look like an agent pointing and saying something. If they
// look the same you cannot tell what the agent MEANT from what the system DID.
const TONES = {
  ambient: {
    stroke: "rgba(110, 120, 200, 0.55)",
    halo: "rgba(110, 120, 200, 0.10)",
    wash: "rgba(110, 120, 200, 0.05)",
    width: "1.5",
    dash: "5 5",
  },
  deliberate: {
    stroke: "#6a74c4",
    halo: "rgba(106, 116, 196, 0.22)",
    wash: "rgba(106, 116, 196, 0.09)",
    width: "2.5",
    dash: null,
  },
};

/**
 * Light something up. `from` is optional — with it you get a line (an agent gesturing from its
 * bubble); without it, just the box.
 *
 * Returns false when there is nothing to point at, so callers can stay honest rather than
 * pretending the gesture happened.
 */
export function spotlight({ target, rectOf, from, tone = "deliberate", mode = "subtle", hold, box = true, line = false } = {}) {
  if (mode === "off") return false;
  // `rectOf` is for a target that ISN'T an element — a range of lines inside a code editor, which
  // is virtualised and has no stable node to hold on to. The UI supplies the geometry; the agent
  // still only ever named `path#L40-70`.
  const el = typeof target === "string" ? document.querySelector(target) : target;
  if (!rectOf && !visible(el)) return false;
  if (rectOf && !rectOf()) return false;
  const t = TONES[tone] || TONES.deliberate;
  clearSpotlight();
  const svg = ensureLayer();
  const fromEl = typeof from === "string" ? document.querySelector(from) : from;

  const paint = () => {
    const rect = rectOf ? rectOf() : el.getBoundingClientRect();
    if (!rect) {
      clearSpotlight();
      return;
    }
    svg.innerHTML = "";
    // `subtle` is the box alone; `full` adds the line back to the bot. NO LABEL — a floating caption
    // over the target was never asked for and read as a ghost sitting above the selection. What the
    // agent has to say goes in the bot's dialogue box, where a sentence belongs.
    if (fromEl && visible(fromEl) && (line || mode === "full")) svg.appendChild(drawLine(fromEl.getBoundingClientRect(), rect, t));
    // `box: false` — for lines inside a file the SELECTION already marks them, and a second outline
    // around the same thing was just noise (his call: "it is good enough to just select the thing the
    // way it is being selected"). The line from the bot is the pointing.
    if (box) svg.appendChild(drawBox(rect, t));
    watching = requestAnimationFrame(paint); // the target can scroll or resize while lit
  };
  paint();

  // `hold: 0` means THE CALLER OWNS THE ENDING — no clock in here at all. Two layers each running
  // their own timer was the bug he saw as a blink: the box expired on its own schedule while the bot
  // was still standing there, so the gesture came apart in the middle.
  const ms = hold === 0 ? 0 : hold || (tone === "ambient" ? AMBIENT_MS : HOLD_MS);
  if (ms) clearTimer = setTimeout(clearSpotlight, ms);
  return true;
}

export default spotlight;
