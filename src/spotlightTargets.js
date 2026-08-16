// WHAT AN AGENT CAN POINT AT — semantic targets only, never coordinates (his rule).
//
// The agent names a thing; this file is the only place that knows where things are. That is what
// lets the same message animate correctly at any window size, and do nothing — honestly — when the
// thing isn't on screen, instead of drawing a line into empty space.
//
// Regions are first-class here because of his teaching case: "this is this panel, this is the
// story, this is the scratch pad" has to be possible **on the fly**, without a built-in tour and
// without a special command. Naming the regions makes that a sentence with a reference in it.

// The names an agent may use, and what they resolve to in the DOM. `data-sv` is added at the source
// (see SystemView page + AgentChat); the fallbacks let this work on surfaces that haven't been
// tagged yet rather than failing outright.
const REGIONS = {
  nav: ['[data-sv="nav"]', ".system-navigator"],
  center: ['[data-sv="center"]', ".stage"],
  reports: ['[data-sv="reports"]', '[data-sv="center"]'],
  docs: ['[data-sv="docs"]', '[data-sv="center"]'],
  code: ['[data-sv="code"]', '[data-sv="center"]'],
  logs: ['[data-sv="logs"]', '[data-sv="center"]'],
  scratchpad: ['[data-sv="scratchpad"]', ".scratch-pad"],
  story: ['[data-sv="story"]', ".test-story"],
  stage: ['[data-sv="stage"]', ".stage"],
  chat: ['[data-sv="chat"]', ".agent-chat__panel"],
  tv: ['[data-sv="tv"]', ".agent-chat__tv"],
  links: ['[data-sv="links"]', ".agent-chat__links"],
  bot: ['[data-sv="bot"]', ".agent-chat__bubble"],
  tests: ['[data-sv="tests"]', ".test-panel"],
  header: ['[data-sv="header"]', ".page-header"],
};

export const REGION_NAMES = Object.keys(REGIONS);

const first = (selectors) => {
  for (const s of selectors) {
    const el = document.querySelector(s);
    if (el) return el;
  }
  return null;
};

// A namespace can be written loosely — `add`, `Math.add`, `TestService.Math.add` — the same fuzzy
// rule the CLI already validates against the live tree. Here we just match the deepest node whose
// own label ends with what was asked for.
function findNamespace(ns) {
  const segs = String(ns).split(/[./]+/).filter(Boolean);
  if (!segs.length) return null;
  const leaf = segs[segs.length - 1].toLowerCase();
  const nodes = document.querySelectorAll("[data-sv-ns]");
  let best = null;
  for (const el of nodes) {
    const val = String(el.getAttribute("data-sv-ns") || "").toLowerCase();
    if (!val) continue;
    const parts = val.split(/[./]+/);
    if (parts[parts.length - 1] !== leaf) continue;
    // Prefer a node that matches MORE of what was written — `Math.add` should beat a bare `add`
    // somewhere else in the tree.
    const score = segs.filter((s) => val.includes(s.toLowerCase())).length;
    if (!best || score > best.score) best = { el, score };
  }
  return best ? best.el : null;
}

function findFile(path) {
  const clean = String(path).split("#")[0];
  const exact = document.querySelector(`[data-sv-file="${CSS.escape(clean)}"]`);
  if (exact) return exact;
  // The tree may be showing a basename, or the open pane may be the file itself.
  const base = clean.split("/").pop();
  return (
    document.querySelector(`[data-sv-file$="${CSS.escape(base)}"]`) ||
    first(['[data-sv="code"]', '[data-sv="center"]'])
  );
}

// A block inside the open document. Markdown already stamps every block with its kind and name —
// this is the address his "lines in a document" case needs, and the only one namespaces and file
// paths genuinely cannot express.
function findBlock(id) {
  const key = String(id);
  return (
    // The block's OWN id first (`::question{id=pick}`) — the only address that distinguishes one
    // block from another of the same kind, and the case namespaces and file ranges can't reach.
    document.querySelector(`[data-md-id="${CSS.escape(key)}"]`) ||
    document.querySelector(`[data-md-name="${CSS.escape(key)}"]`) ||
    document.querySelector(`[data-md-kind="${CSS.escape(key)}"]`) ||
    // `#L40-60` on an open file — the code pane marks its own lines.
    document.querySelector(`[data-sv-line="${CSS.escape(key.replace(/^#?L?/, ""))}"]`)
  );
}

/**
 * Resolve a target to an element, or null. Accepted shapes:
 *   { region: "scratchpad" }   { namespace: "Math.add" }   { file: "api/Chats.js" }
 *   { block: "thread" }        { selector: ".foo" }
 * A bare string is treated as a region name first, then a namespace — the two an agent is most
 * likely to write.
 */
export function resolveTarget(target) {
  if (!target || typeof document === "undefined") return null;
  if (typeof target === "string") {
    const key = target.trim().toLowerCase();
    if (REGIONS[key]) return first(REGIONS[key]);
    return findNamespace(target) || findBlock(target);
  }
  if (target.selector) return document.querySelector(target.selector);
  if (target.region) return first(REGIONS[String(target.region).toLowerCase()] || []);
  if (target.block) return findBlock(target.block);
  if (target.file) return findFile(target.file);
  if (target.namespace) return findNamespace(target.namespace);
  return null;
}

export default resolveTarget;

// LINES INSIDE A RENDERED DOCUMENT. Preview has no lines — it has blocks — but every top-level
// block carries the source range it was rendered from (`data-md-start`/`data-md-end`), so a range
// resolves to the blocks it covers. Same address the code pane answers, answered by a different
// surface: `#L10-20` means the same thing in a report as it does in a file.
//
// Returns a live rect function rather than an element, because a range usually spans SEVERAL blocks
// and the thing being pointed at is the span, not any one of them.
export function docRectOf(a, b) {
  const hit = () =>
    [...document.querySelectorAll("[data-md-start]")].filter((el) => {
      const s = Number(el.getAttribute("data-md-start"));
      const e = Number(el.getAttribute("data-md-end"));
      return s && e && s <= b && e >= a;
    });
  if (!hit().length) return null;
  return () => {
    const els = hit();
    if (!els.length) return null;
    const rects = els.map((el) => el.getBoundingClientRect()).filter((r) => r.width || r.height);
    if (!rects.length) return null;
    const top = Math.min(...rects.map((r) => r.top));
    const bottom = Math.max(...rects.map((r) => r.bottom));
    const left = Math.min(...rects.map((r) => r.left));
    const right = Math.max(...rects.map((r) => r.right));
    // Clipped to the scroller it lives in — a block scrolled out of the pane must not draw a box
    // floating in the page, the same rule the code pane follows.
    const host = els[0].closest(".md-view, .doc-pane, .pane__body, [data-sv='center']");
    const box = host ? host.getBoundingClientRect() : { top: 0, bottom: window.innerHeight };
    const t = Math.max(box.top, top);
    const bo = Math.min(box.bottom, bottom);
    if (bo <= t) return null;
    return { left, top: t, width: Math.max(0, right - left), height: bo - t };
  };
}

// Bring the first block of a range into view before pointing at it — an off-screen block gets no
// gesture, and a document is usually longer than the pane.
export function revealDocLines(a, b) {
  const el = [...document.querySelectorAll("[data-md-start]")].find((n) => {
    const s = Number(n.getAttribute("data-md-start"));
    const e = Number(n.getAttribute("data-md-end"));
    return s && e && s <= b && e >= a;
  });
  if (el && el.scrollIntoView) el.scrollIntoView({ block: "center", behavior: "smooth" });
  return !!el;
}
