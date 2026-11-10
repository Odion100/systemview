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

// THE SWITCHES ARE THE HARNESS'S KINDS, not a list kept here — his ask, 2026-11-09: a kind should
// arrive with its own switch, and "that could go to the worklist settings as well, as which one
// counts". This used to be four typed rows, which is one more place a new kind goes missing: it
// landed in the harness, drew no switch, and he could neither turn it on nor off.
//
// THE FALLBACK IS THE ABSENCE LINE IN LIST FORM. An older shell sends no `kinds`, so the panel
// draws what it knew rather than nothing — a switchless settings pane would read as "there is
// nothing to configure", which is a claim about the harness the window cannot make.
export const FALLBACK_SOURCES = [
  { key: "job:", label: "jobs" },
  { key: "skill:", label: "skills" },
  { key: "lane:", label: "lanes" },
  { key: "correction:", label: "corrections" },
];

export const sourceChoices = (kinds) =>
  Array.isArray(kinds) && kinds.length
    ? kinds
        .filter((k) => k && k.prefix)
        .map((k) => ({ key: String(k.prefix), label: String(k.label || k.prefix) }))
    : FALLBACK_SOURCES;

// Kept as the name the panel already imports; it is the fallback, and the panel prefers the live
// list whenever the door sends one.
export const SOURCE_CHOICES = FALLBACK_SOURCES;

// THE NUMBER KINDS AND THEIR UNIT. Here rather than in the component, so a field declaring a kind
// nothing can render FAILS A TEST instead of drawing a label, a help line and no input — which is
// what `keepHours` did the moment it was added to FIELDS, because the render listed the three kinds
// it knew about and the fourth fell through every branch. `toggle` and `sources` render themselves;
// everything else is a number and needs a unit, even when the unit is empty.
export const UNITS = { minutes: "min", hours: "hrs", count: "", percent: "%" };
// `slots` IS A SET OF NAMES, where `slot` was one. Both stay renderable: `slot` is still the right
// shape for a field that genuinely holds one thing, and deleting it would make this list the only
// way to express either.
export const RENDERABLE = ["toggle", "sources", "slots", "slot", ...Object.keys(UNITS)];

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
  // A SUBAGENT'S OWN CLOCK, AND IT IS A SECOND NUMBER ON PURPOSE — his ask, 2026-11-09: "the lanes
  // is where the subagents go. You could see when they're quiet or when they're idle and there's a
  // countdown right there. of control how long they can be idle before they update you."
  //
  // NOT FOLDED INTO `quiet first`, because the two measure different things. `idleMin` is how long
  // THIS agent may sit before being pointed back at its own list — a conversation's pace. This is
  // how long a SUBAGENT may emit nothing before the agent that spawned it is told to look. One
  // slider governing both would leave neither set where he wants it.
  //
  // IT IS ALSO THE ROW'S AMBER. `laneLiveness` warned at a hardcoded ten minutes with nothing able
  // to change it, so the row's one judgement was the only thing on that surface he could not set —
  // and the countdown beside it now runs to this number too, which is what keeps the colour on the
  // row and the nudge in the chat from firing at two thresholds that drift apart.
  {
    key: "subagentIdleMin",
    kind: "minutes",
    label: "subagent quiet",
    min: 1,
    max: 1440,
    help: "how long a subagent may emit nothing before its owner is told to look — and when the row turns amber. Silence is not a diagnosis: a subagent thinking is quiet and alive, so the nudge reports the elapsed time and never calls it stuck",
  },
  // WHO MAY ASSIGN WORK TO ANOTHER AGENT — his control, and it lives here rather than on every
  // agent's definition because the profile's lever is allow/deny per agent: gating it there would
  // mean unchecking a tool on every agent that must not have it. EMPTY MEANS NOBODY, never anyone.
  //
  // SEVERAL, NOT ONE (his ask, 2026-11-10: "we should be able to assign more than one manager").
  // The ability is not a role: one agent reading finished work against the doctrine and another
  // sitting above an arc want the same verb pointed at different subjects, and an agent handed it
  // for an afternoon wants it taken back after. All of that is this list changing, which is why it
  // is a set of switches rather than a picker — adding a second name must not mean replacing the
  // first, and taking one back must be one press.
  {
    key: "managers",
    kind: "slots",
    label: "managers",
    help: "the agents that may assign work to another — a correction, or an assignment. Any of them can assign either kind to anybody. None selected means nobody can",
  },
  {
    key: "keepHours",
    kind: "hours",
    label: "keep closed runs",
    min: 1,
    max: 24 * 14,
    // THE ONLY DESTRUCTIVE KNOB HERE, so the help says what it deletes and what it cannot touch.
    help: "how long a FINISHED run stays in the drawer before the janitor sweeps it. A run that died mid-list is never swept at any setting — where a procedure stopped is the record",
  },
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
// `choices` IS THE LIVE LIST THE HARNESS SENT, and passing it is not optional dressing — it is the
// half that was missing. The RENDER started deriving its switches from the harness's kinds while
// THIS function went on validating writes against the four-item fallback, so the assignment switch
// drew, he clicked it, `want` filtered it straight back out, `same` came out true, and the patch
// was null: a control that renders, responds to nothing, and reports no error. Measured 2026-11-09
// in his window — "I still can't click assignment."
//
// Both halves read one list now. The default keeps the old behaviour for a caller that has no
// kinds to hand over, which is the only honest fallback: a filter driven by a STALE list is worse
// than no filter, because it silently discards a value the harness would have accepted.
export function patchFor(settings, key, raw, choices = SOURCE_CHOICES) {
  const cur = settings || {};
  const field = FIELDS.find((f) => f.key === key);
  if (!field) return null;
  let next;
  if (field.kind === "toggle") next = !!raw;
  else if (field.kind === "sources" || field.kind === "slots") {
    // A SET FIELD, and both kinds are one: an array in, an order-insensitive compare, and no write
    // when nothing actually changed. `sources` validates against the harness's kinds; `slots`
    // against the agent roster when the caller hands one over.
    //
    // AN ABSENT `choices` MEANS DO NOT FILTER, which matters for `slots` in a way it did not for
    // `sources`: the roster comes from a different door and can legitimately be unavailable, and a
    // filter against an empty roster would silently discard every name he picked. For `sources` the
    // fallback list is still used, because that list is a real one this module ships.
    const allowed = Array.isArray(choices) && choices.length
      ? choices.map((c) => (typeof c === "string" ? c : c && c.key)).filter(Boolean)
      : field.kind === "sources"
        ? SOURCE_CHOICES.map((c) => c.key)
        : null;
    const asked = Array.isArray(raw) ? raw.map((x) => String(x || "").trim()).filter(Boolean) : [];
    const want = [...new Set(allowed ? asked.filter((x) => allowed.includes(x)) : asked)];
    const now = Array.isArray(cur[field.key]) ? cur[field.key] : [];
    const same = want.length === now.length && want.every((x) => now.includes(x));
    return same ? null : { [field.key]: want };
  } else if (field.kind === "slot") next = String(raw == null ? "" : raw).trim();
  else next = clampInt(raw, field.min, field.max, cur[key]);
  if (next === cur[key]) return null;
  return { [key]: next };
}

/**
 * Flip one member of a set field on or off, returning the whole list the way the harness stores it.
 *
 * Generic over the FIELD, because `managers` needs exactly what `sources` needed and a second copy
 * of four lines is a second place for the add/remove asymmetry to drift.
 */
export function toggleMember(settings, field, key) {
  const cur = Array.isArray((settings || {})[field]) ? (settings || {})[field] : [];
  return cur.includes(key) ? cur.filter((s) => s !== key) : [...cur, key];
}

/** The source switches' own door — kept because its callers and its claims already name it. */
export const toggleSource = (settings, key) => toggleMember(settings, "sources", key);

/**
 * The one line the cog shows when the panel is shut — so the state is readable without opening it.
 * It reads the SETTINGS, never a cached belief about them.
 */
export function summaryOf(settings, choices = SOURCE_CHOICES) {
  const s = settings || null;
  if (!s) return "nudge — not available in this shell";
  // RETENTION IS SAID EVEN WHEN NUDGING IS OFF, because the janitor does not care whether anything
  // nudges — a panel that goes quiet about what is being deleted the moment you turn the nudge off
  // hides the one setting here that destroys something.
  const keep = s.keepHours ? ` · keeps closed runs ${s.keepHours}h` : "";
  if (!s.on) return `nudge — off${keep}`;
  if (!s.giveUpAfter) return `nudge — off (cycle length 0)${keep}`;
  const which = (s.sources || []).length
    ? (s.sources || []).map((k) => ((Array.isArray(choices) && choices.length ? choices : SOURCE_CHOICES).find((c) => c.key === k) || { label: k }).label).join(" + ")
    : "nothing";
  // "nothing" is said out loud rather than hidden: an empty source list is a real way to turn this
  // off, and a panel that renders it as "on" would be lying about a configuration he set.
  return `nudge — ${which} after ${s.idleMin}m quiet, every ${s.cooldownMin}m, cycles of ${s.giveUpAfter}${keep}`;
}

/** Is this settings object one the panel can render at all? Absence is a state, not an error. */
export const usable = (s) => !!s && typeof s === "object" && typeof s.on === "boolean";
