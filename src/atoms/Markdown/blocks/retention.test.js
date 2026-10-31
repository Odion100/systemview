import { parseRetain, spanWords, retainLine, tickFor } from "./retention";

// RFC-076 §4.6 — the clock face's one rule set (c44 pins the behaviour in the window; this pins
// the arithmetic the face and the drawer both read).
describe("retention", () => {
  it("parses windows, permanent, and refuses junk as undeclared", () => {
    expect(parseRetain("14d")).toBe(14 * 86400000);
    expect(parseRetain("36h")).toBe(36 * 3600000);
    expect(parseRetain("2w")).toBe(2 * 604800000);
    expect(parseRetain("permanent")).toBeNull();
    expect(parseRetain("")).toBeUndefined();
    expect(parseRetain("fortnight")).toBeUndefined();
  });

  it("the face: unread waits, read counts down, permanent says so, undeclared says nothing", () => {
    const d = 86400000;
    // unread — the clock has not started, because an unread report is still owed to you
    const unread = retainLine({ retired: false, retain: "14d", windowMs: 14 * d, openedAt: null });
    expect(unread.text).toMatch(/after first read/);
    expect(unread.counting).toBe(false);
    // read — counts from the first open, not from filing
    const t0 = 1000000;
    const counting = retainLine({ retired: false, retain: "14d", windowMs: 14 * d, openedAt: t0, now: t0 + 11 * d });
    expect(counting.text).toBe("retires in 3 days");
    expect(counting.counting).toBe(true);
    expect(counting.urgent).toBe(false);
    const soon = retainLine({ retired: false, retain: "14d", windowMs: 14 * d, openedAt: t0, now: t0 + 12 * d });
    expect(soon.urgent).toBe(true);
    // ran out — still honest, still divertable until the sweep writes the fact
    const out = retainLine({ retired: false, retain: "3d", windowMs: 3 * d, openedAt: t0, now: t0 + 9 * d });
    expect(out.text).toMatch(/clock ran out/);
    // permanent — the explicit forever reads as a word, not a countdown
    expect(retainLine({ retired: false, retain: "permanent", windowMs: null, openedAt: t0 }).text).toBe("permanent");
    // undeclared — the invalid chip carries the message; the clock stays silent
    expect(retainLine({ retired: false, retain: "", windowMs: undefined, openedAt: t0 })).toBeNull();
    // retired — the clock already spoke
    expect(retainLine({ retired: true, retain: "14d", windowMs: 14 * d, openedAt: t0 })).toBeNull();
  });

  it("span words read aloud cleanly", () => {
    expect(spanWords(86400000 * 5)).toBe("5 days");
    expect(spanWords(3600000 * 2)).toBe("2 hours");
    // Fifty seconds is fifty seconds. Rounding it up to "a minute" read cleanly and said something
    // slightly untrue at the exact moment the number matters most.
    expect(spanWords(50000)).toBe("50s");
  });
});

// THE CLOCK HAS TO BE FELT, which means the number has to be able to move. It was a snapshot taken
// at render with nothing re-rendering: *"it should be making me feel like, oh, this shit's going
// away. That's the point."*
describe("a countdown that actually counts", () => {
  const S = 1000, M = 60000, H = 3600000, D = 86400000;

  it("carries the finer unit as it closes, so a minute's passing is visible", () => {
    expect(spanWords(3 * D)).toBe("3 days");
    expect(spanWords(5 * H + 12 * M)).toBe("5h 12m");
    expect(spanWords(4 * M + 58 * S)).toBe("4m 58s");
    expect(spanWords(9 * S)).toBe("9s");
  });

  it("an exact hour stays words — the finer unit would say nothing", () => {
    expect(spanWords(H)).toBe("an hour");
    expect(spanWords(3 * H)).toBe("3 hours");
  });

  it("the tick is the granularity the WORDS have, never one second for a fortnight", () => {
    expect(tickFor(14 * D)).toBe(H); // "14 days" — a second's tick would redraw 86,400 times for one digit
    expect(tickFor(5 * H)).toBe(M);
    expect(tickFor(4 * M)).toBe(S);
    expect(tickFor(9 * S)).toBe(S);
  });

  it("nothing left to count means no ticker at all", () => {
    expect(tickFor(null)).toBe(null);
    expect(tickFor(0)).toBe(null);
    expect(tickFor(-1)).toBe(null);
  });

  it("the face moves between two reads of the same window — the thing a snapshot could not do", () => {
    const openedAt = 1_000_000;
    const win = { retain: "12h", windowMs: 12 * H, openedAt };
    const a = retainLine({ ...win, now: openedAt + 11 * H });
    const b = retainLine({ ...win, now: openedAt + 11 * H + 30 * M });
    expect(a.text).not.toBe(b.text);
    expect(a.text).toBe("retires in an hour");
    expect(b.text).toBe("retires in 30m");
  });
});
