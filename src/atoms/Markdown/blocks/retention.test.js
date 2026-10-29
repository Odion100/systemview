import { parseRetain, spanWords, retainLine } from "./retention";

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
    expect(spanWords(50000)).toBe("a minute");
  });
});
