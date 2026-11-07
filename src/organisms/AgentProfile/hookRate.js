// THE FIRE RATE, DECOMPOSED — his design, 2026-11-07: *"you can hear the components: a number per
// a… and a selector for a time category — session, crossing, whatever. What if I said twice per
// day? And you can pick every match, which is a completely separate selector."*
//
// It was one dropdown of fourteen hand-written sentences, and the shape of the thing was invisible
// in it: the COUNT was welded into the word `once`, so "twice per day" had no option and no
// spelling, while fourteen rows hid that there are only ever two choices to make.
//
// THE CATEGORIES ARE NOT ALL CLOCK (his correction, same evening) — `session` and `crossing` sit in
// the same list and are different mechanisms underneath: a session budget is counted in the
// session, a crossing budget is re-armed when the condition goes false, and hour/day/week/month
// reset on the calendar. One control, because to him they are one question: per WHAT.
//
// A sliding GAP is kept as its own mode because the harness has it and hooks on disk carry it, and
// it is a different promise from a budget: `cooldown:12h` forbids 9am and 10am, which twice-per-day
// allows.

/** Per WHAT — in the order he said them: the two that are not clock, then the clock. */
export const CATEGORIES = [
  { value: "session", label: "session" },
  { value: "compaction", label: "crossing (re-arms when it drops)" },
  { value: "hour", label: "hour" },
  { value: "day", label: "day" },
  { value: "week", label: "week" },
  { value: "month", label: "month" },
];

/** How many. A selection, not a free box — "one, two, three", plus the few larger ones worth having. */
export const COUNTS = [1, 2, 3, 4, 5, 6, 8, 10, 12, 24].map((n) => ({ value: String(n), label: String(n) }));

export const GAP_UNITS = [
  { value: "m", label: "minutes" },
  { value: "h", label: "hours" },
  { value: "d", label: "days" },
  { value: "w", label: "weeks" },
];

export const MODES = [
  { value: "budget", label: "at most…" },
  { value: "gap", label: "no sooner than…" },
  { value: "every", label: "every match — no limit" },
];

const PER = /^(once|[1-9]\d*)-per-(session|rise|compaction|hour|day|week|month)$/;
const SIMPLE_DUR = /^(\d+)(m|h|d|w)$/;
const EDGE = new Set(["rise", "compaction"]);

/** Is this category a crossing — the one the harness refuses without a `when` to cross. */
export const isCrossing = (cat) => EDGE.has(String(cat || ""));

/**
 * READ A SAVED RATE INTO THE CONTROLS. `mode` is budget | gap | every | other.
 *
 * `other` exists so an unreadable rate already on disk is shown as itself and can be corrected,
 * rather than being silently replaced by whatever the controls happen to default to. A rate nobody
 * can read is a hook that never fires, and overwriting it hides that instead of fixing it.
 */
export function readRate(rate) {
  const s = String(rate == null ? "" : rate).trim();
  const base = { mode: "every", n: "1", cat: "day", durN: "", durUnit: "m", raw: "", text: s };
  if (!s) return base;
  const per = PER.exec(s);
  if (per) return { ...base, mode: "budget", n: per[1] === "once" ? "1" : per[1], cat: per[2] };
  if (s.startsWith("cooldown:")) {
    const dur = s.slice("cooldown:".length).trim();
    const m = SIMPLE_DUR.exec(dur);
    // A compound duration (`3d12h`, `90s`) cannot be held by a number and a unit, so it stays text.
    return m ? { ...base, mode: "gap", durN: m[1], durUnit: m[2] } : { ...base, mode: "gap", raw: dur };
  }
  return { ...base, mode: "other" };
}

/**
 * Write the controls back to one rate string.
 *
 * n=1 is written as `once-per-X`, which is the same rate — the harness reads them identically —
 * in the spelling every hook, document and skill already uses.
 */
export function writeRate(p = {}) {
  const { mode, n, cat, durN, durUnit, raw, text } = p;
  if (mode === "every") return "";
  if (mode === "other") return String(text || "");
  if (mode === "gap") {
    const typed = String(raw || "").trim();
    const num = String(durN == null ? "" : durN).trim();
    return `cooldown:${typed || (num ? `${num}${durUnit || "m"}` : "")}`;
  }
  const count = String(n || "1").trim() || "1";
  return `${count === "1" ? "once" : count}-per-${cat || "day"}`;
}

/** The same grammar the harness enforces, so a gap is checked while he types, not at the save. */
export const durOk = (d) => {
  const t = String(d || "").trim().toLowerCase();
  return /^(\d+(ms|s|m|h|d|w))+$/.test(t) || /^\d+$/.test(t);
};

/** What the rate says, in words — the sentence he would have said. */
export function saysRate(rate) {
  const p = readRate(rate);
  if (p.mode === "every") return "no limit — it fires on every match";
  if (p.mode === "other") return `"${p.text}" is not a rate the harness can read`;
  if (p.mode === "gap") {
    const dur = p.raw || (p.durN ? `${p.durN}${p.durUnit}` : "");
    if (!dur) return "name a gap";
    return durOk(dur) ? `no sooner than ${dur} after the last fire` : `"${dur}" is not a duration the harness can read`;
  }
  const n = Number(p.n) || 1;
  const cat = isCrossing(p.cat) ? "crossing" : p.cat;
  const times = n === 1 ? "once" : n === 2 ? "twice" : `${n} times`;
  return `${times} per ${cat}`;
}
