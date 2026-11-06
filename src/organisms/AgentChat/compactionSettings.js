// AUTO-COMPACTION SETTINGS — the knobs, away from the render, exactly the shape nudgeSettings.js
// keeps and for the same reason: everything that decides what a knob IS lives here so it can be
// tested, because the component that renders it pulls in the markdown renderer and cannot be.
//
// THE HARNESS OWNS THE VALUES — `window.systemview.compaction.read()` answers with its own, because
// these are read on every usage tick in the main process; a copy the window believed would be a
// setting that changes nothing.
//
// The numbers are his and arbitrary (soft 60 · hard 85 · countdown 15s · snooze 70s): the point of
// this panel is that they are HIS to change, not baked anywhere.

export const UNITS = { percent: "%", seconds: "s" };

export const FIELDS = [
  {
    key: "on",
    kind: "toggle",
    label: "auto-compact",
    help: "past the soft line, once the maintenance pass is done, compaction counts down and proceeds on its own",
  },
  {
    key: "softPct",
    kind: "percent",
    label: "soft line",
    min: 1,
    max: 100,
    help: "context fill past which the stoppable countdown arms — after the pass your usage hook points at finishes",
  },
  {
    key: "hardPct",
    kind: "percent",
    label: "hard ceiling",
    min: 1,
    max: 100,
    // THE VALVE, so the help says what it refuses: the harness floors this at the soft line, and a
    // countdown here cannot be stopped — by anyone, which is what makes it an emergency release.
    help: "the release valve — forces the compaction, ignores the pass and any stop. Never sits below the soft line; the harness floors it there",
  },
  {
    key: "countdownSec",
    kind: "seconds",
    label: "countdown",
    min: 1,
    max: 600,
    help: "how long the chip counts before the compaction fires — the window to press stop in",
  },
  {
    key: "snoozeSec",
    kind: "seconds",
    label: "stop defers",
    min: 0,
    max: 24 * 3600,
    // 0 IS A REAL SETTING: stop just cancels this one countdown, and the next usage reading past
    // the soft line starts another.
    help: "how long a stop holds the next countdown off. It defers toward the hard ceiling, never past it. 0 means stop only cancels the one counting",
  },
];

const clampInt = (v, lo, hi, fallback) => {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, n));
};

/** One changed field, ready to send — null when the edit would change nothing. */
export function patchFor(settings, key, raw) {
  const cur = settings || {};
  const field = FIELDS.find((f) => f.key === key);
  if (!field) return null;
  let next;
  if (field.kind === "toggle") next = !!raw;
  else next = clampInt(raw, field.min, field.max, cur[key]);
  if (next === cur[key]) return null;
  return { [key]: next };
}

/** The one line shown when the panel is shut — reads the SETTINGS, never a cached belief. */
export function summaryOf(settings) {
  const s = settings || null;
  if (!s) return "auto-compaction — not available in this shell";
  if (!s.on) return "auto-compaction — off";
  return `auto-compaction — counts ${s.countdownSec}s past ${s.softPct}%, forced at ${s.hardPct}%, stop defers ${s.snoozeSec}s`;
}

/** Is this settings object one the panel can render at all? Absence is a state, not an error. */
export const usable = (s) => !!s && typeof s === "object" && typeof s.on === "boolean";
