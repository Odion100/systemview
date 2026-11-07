// THE FIRE RATE, DECOMPOSED — out of the render so what the control can SAY is provable.
//
// The rule underneath is wide: the harness accepts `cooldown:<duration>` for any duration it can
// parse — `15m`, `7m`, `3d12h`. The control was eleven hand-picked ones in a dropdown, so a rate
// nobody had thought to list could not be set at all (his catch, 2026-11-07: *"I can pick once per
// session, at most every five minutes — what if I want four times an hour?"* — four times an hour
// is `cooldown:15m`, and 15m was not on the list).
//
// So the rate is TWO controls: a KIND, and — when the kind is a cooldown — a duration he writes.

/** The named rates. Everything else a hook can carry is a cooldown with a duration on it. */
export const NAMED = [
  { value: "once-per-session", label: "once per session" },
  { value: "once-per-rise", label: "once per crossing (re-arms when it drops)" },
  { value: "once-per-day", label: "once a day" },
  { value: "once-per-week", label: "once a week" },
  { value: "once-per-month", label: "once a month" },
  { value: "", label: "no rate — every match" },
];

export const UNITS = [
  { value: "m", label: "minutes" },
  { value: "h", label: "hours" },
  { value: "d", label: "days" },
  { value: "w", label: "weeks" },
];

const SIMPLE = /^(\d+)(m|h|d|w)$/;

/**
 * READ A SAVED RATE INTO THE TWO CONTROLS.
 *
 * `kind` is a named rate or "cooldown". A cooldown whose duration is one number and one unit fills
 * `n` and `unit`; anything compound (`3d12h`) or in seconds (`90s`, or the legacy bare `120`) comes
 * back as `raw` instead, because a number-and-unit pair cannot hold it and SILENTLY REWRITING a
 * saved rate while he edits the row above it is the failure this split exists to avoid.
 */
export function readRate(rate) {
  const s = String(rate == null ? "" : rate).trim();
  if (!s.startsWith("cooldown:")) return { kind: s, n: "", unit: "m", raw: "" };
  const dur = s.slice("cooldown:".length).trim();
  const m = SIMPLE.exec(dur);
  if (m) return { kind: "cooldown", n: m[1], unit: m[2], raw: "" };
  return { kind: "cooldown", n: "", unit: "m", raw: dur };
}

/**
 * Write the two controls back to one rate string.
 *
 * A cooldown with no duration yet stays `cooldown:` — the kind has to SURVIVE an empty box, or
 * clearing the number to type a new one silently snaps the control back to "no rate", which is the
 * one rate a hook must never acquire by accident. The harness refuses `cooldown:` by name at the
 * save, which is the honest place for it.
 */
export function writeRate({ kind, n, unit, raw } = {}) {
  if (kind !== "cooldown") return String(kind || "");
  const typed = String(raw || "").trim();
  const num = String(n == null ? "" : n).trim();
  return `cooldown:${typed || (num ? `${num}${unit || "m"}` : "")}`;
}

/**
 * IS THIS DURATION ONE THE HARNESS WILL TAKE — the same grammar `parseDur` enforces, checked while
 * he types rather than refused at the save. A malformed rate used to save and then mean "no limit",
 * which is a hook that fires forever wearing a limit it never had.
 */
export const durOk = (dur) => /^(\d+(ms|s|m|h|d|w))+$/.test(String(dur || "").trim().toLowerCase()) || /^\d+$/.test(String(dur || "").trim());

/** What the rate says in words, for the note under the control — his arithmetic, done for him. */
export function saysRate(rate) {
  const { kind, n, unit, raw } = readRate(rate);
  if (kind !== "cooldown") return "";
  if (raw) return durOk(raw) ? `at most once every ${raw}` : `"${raw}" is not a duration the harness can read`;
  const num = Number(n);
  if (!num) return "name a duration — 15m is four times an hour";
  const per = { m: 60, h: 24, d: 7, w: 0 }[unit];
  const word = { m: "minutes", h: "hours", d: "days", w: "weeks" }[unit];
  const each = { m: "an hour", h: "a day", d: "a week", w: "" }[unit];
  const times = per && num <= per && per % num === 0 ? ` — ${per / num} times ${each}` : "";
  return `at most once every ${num} ${num === 1 ? word.slice(0, -1) : word}${times}`;
}
