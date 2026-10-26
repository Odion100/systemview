// THE WORKLIST SETTINGS — the knobs, away from the render.
//
// His ask, 2026-10-19: *"when you open this section, on the right side of the tabs all the way at
// the end, could be a cog that allows me to configure things like that — like the overall cooldown
// before a worklist would nudge you if it's not complete."*
//
// WHY THE FIELDS ARE DATA AND NOT JSX. Everything that decides what a knob IS — its bounds, its
// unit, what it means when you set it to zero — lives here so it can be tested, because the
// component that renders it cannot be: anything mounting AgentChat pulls in the markdown renderer,
// which is ESM and untransformed, so the test dies before it runs. The lesson is already written
// down (a block that imports no renderer CAN be tested); this is the same shape applied to a panel.
//
// THE HARNESS OWNS THE VALUES. This module holds no state and no defaults of its own worth
// trusting — `window.systemview.nudge.read()` answers with the harness's own, because a setting the
// window believes and the harness cannot see is a setting that does nothing.

// SOURCES ARE PREFIXES, not a free-text list, because that is what the harness matches on. Offering
// a text box here would let him type `jobs:` and watch nothing happen forever.
export const SOURCE_CHOICES = [
  { key: "job:", label: "jobs" },
  { key: "skill:", label: "skills" },
  { key: "lane:", label: "lanes" },
];

export const FIELDS = [
  {
    key: "on",
    kind: "toggle",
    label: "nudge unfinished runs",
    help: "when a run with a source goes quiet with items left, tell its agent",
  },
  {
    key: "idleMin",
    kind: "minutes",
    label: "quiet first",
    min: 1,
    max: 1440,
    help: "how long nobody comes back before the first nudge",
  },
  {
    key: "cooldownMin",
    kind: "minutes",
    label: "cooldown",
    min: 1,
    max: 1440,
    help: "between nudges for the same run",
  },
  {
    key: "giveUpAfter",
    kind: "count",
    label: "cycle length",
    min: 0,
    max: 100,
    // 0 IS A REAL SETTING and the panel has to say so, or it reads as a broken field.
    // (The key keeps its old spelling — his nudge.json already carries it; only the MEANING moved:
    // the last nudge of a cycle is the final notice, then the count wraps and nudging continues
    // until the run closes or is declared abandoned with its account attached.)
    help: "nudges per cycle — the last is the final notice, then it wraps and continues; nudging only stops when the run closes or is abandoned with a report attached. 0 never nudges",
  },
  {
    key: "ctxCeilingPct",
    kind: "percent",
    label: "never above",
    min: 1,
    max: 100,
    help: "context fill past which a nudge would spend what the agent needs to finish",
  },
  { key: "sources", kind: "sources", label: "which runs count", help: "the session's own plan has no source and is never nudged" },
];

const clampInt = (v, lo, hi, fallback) => {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, n));
};

/**
 * One changed field, ready to send. Returns `null` when the edit would change nothing — which is
 * what stops a slider's every intermediate value from becoming a write to disk.
 */
export function patchFor(settings, key, raw) {
  const cur = settings || {};
  const field = FIELDS.find((f) => f.key === key);
  if (!field) return null;
  let next;
  if (field.kind === "toggle") next = !!raw;
  else if (field.kind === "sources") {
    const want = Array.isArray(raw) ? raw.filter((s) => SOURCE_CHOICES.some((c) => c.key === s)) : [];
    const same = want.length === (cur.sources || []).length && want.every((s) => (cur.sources || []).includes(s));
    return same ? null : { sources: want };
  } else next = clampInt(raw, field.min, field.max, cur[key]);
  if (next === cur[key]) return null;
  return { [key]: next };
}

/** Flip one source on or off, returning the whole list the way the harness stores it. */
export function toggleSource(settings, key) {
  const cur = Array.isArray((settings || {}).sources) ? (settings || {}).sources : [];
  return cur.includes(key) ? cur.filter((s) => s !== key) : [...cur, key];
}

/**
 * The one line the cog shows when the panel is shut — so the state is readable without opening it.
 * It reads the SETTINGS, never a cached belief about them.
 */
export function summaryOf(settings) {
  const s = settings || null;
  if (!s) return "nudge — not available in this shell";
  if (!s.on) return "nudge — off";
  if (!s.giveUpAfter) return "nudge — off (cycle length 0)";
  const which = (s.sources || []).length
    ? (s.sources || []).map((k) => (SOURCE_CHOICES.find((c) => c.key === k) || { label: k }).label).join(" + ")
    : "nothing";
  // "nothing" is said out loud rather than hidden: an empty source list is a real way to turn this
  // off, and a panel that renders it as "on" would be lying about a configuration he set.
  return `nudge — ${which} after ${s.idleMin}m quiet, every ${s.cooldownMin}m, cycles of ${s.giveUpAfter}`;
}

/** Is this settings object one the panel can render at all? Absence is a state, not an error. */
export const usable = (s) => !!s && typeof s === "object" && typeof s.on === "boolean";
