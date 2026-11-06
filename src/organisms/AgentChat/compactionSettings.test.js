import { FIELDS, UNITS, patchFor, summaryOf, usable } from "./compactionSettings";

// AUTO-COMPACTION SETTINGS — the knobs, proven without mounting anything, for the same reason the
// nudge's are: AgentChat imports the markdown renderer (ESM, untransformed), so a render test dies
// before it runs. Everything that can be WRONG lives in the module, where it is reachable.

const S = { on: true, softPct: 60, hardPct: 85, countdownSec: 15, snoozeSec: 70 };

describe("a patch is one changed field, or nothing at all", () => {
  it("sends only what actually changed", () => {
    expect(patchFor(S, "softPct", 50)).toEqual({ softPct: 50 });
    expect(patchFor(S, "on", false)).toEqual({ on: false });
  });

  // THE RULE THAT KEEPS A NUMBER FIELD FROM WRITING ON EVERY KEYSTROKE — typing "45" must not
  // write 4 first.
  it("returns null when the edit changes nothing, so no write happens", () => {
    expect(patchFor(S, "softPct", 60)).toBe(null);
    expect(patchFor(S, "softPct", "60")).toBe(null);
    expect(patchFor(S, "on", true)).toBe(null);
  });

  it("clamps rather than trusting, and falls back on junk", () => {
    expect(patchFor(S, "countdownSec", 99999)).toEqual({ countdownSec: 600 });
    expect(patchFor(S, "countdownSec", 0)).toEqual({ countdownSec: 1 });
    expect(patchFor(S, "softPct", "nonsense")).toBe(null); // falls back to current → no change
  });

  // 0 IS A REAL SETTING for the snooze — stop only cancels the one counting — so it must be
  // sendable rather than clamped away. The countdown's floor is 1 by the same coin: a zero-second
  // countdown is a compaction with no chance to stop it.
  it("lets the snooze go to zero, and keeps the countdown off it", () => {
    expect(patchFor(S, "snoozeSec", 0)).toEqual({ snoozeSec: 0 });
    expect(patchFor(S, "countdownSec", 0)).toEqual({ countdownSec: 1 });
  });

  it("refuses a field it does not have", () => {
    expect(patchFor(S, "invented", 3)).toBe(null);
  });
});

// The hard-under-soft defence is the HARNESS's (compaction.cjs floors hard at soft on every write,
// so even a window that sends hardPct=30 gets back a corrected object and shows it). The panel's
// own job is only to send the edit and render what came back — asserted here so nobody adds a
// second copy of the floor in the window that could drift from the engine's.
describe("the window holds no copy of the engine's floor", () => {
  it("passes a hard below soft through — the harness answers with the corrected value", () => {
    expect(patchFor(S, "hardPct", 30)).toEqual({ hardPct: 30 });
  });
});

describe("every field can render", () => {
  it("declares a kind the panel has an input for", () => {
    for (const f of FIELDS) {
      expect(f.kind === "toggle" || UNITS[f.kind] !== undefined).toBe(true);
    }
  });

  it("numbers carry bounds, so the input can clamp where the engine would", () => {
    for (const f of FIELDS.filter((x) => x.kind !== "toggle")) {
      expect(typeof f.min).toBe("number");
      expect(typeof f.max).toBe("number");
    }
  });
});

describe("the closed-cog line", () => {
  it("states absence rather than defaults when there is no door", () => {
    expect(summaryOf(null)).toMatch(/not available/);
  });
  it("says off when it is off, and the numbers when it is on", () => {
    expect(summaryOf({ ...S, on: false })).toBe("auto-compaction — off");
    expect(summaryOf(S)).toBe("auto-compaction — counts 15s past 60%, forced at 85%, stop defers 70s");
  });
});

describe("usable", () => {
  it("accepts the harness's shape and rejects everything else", () => {
    expect(usable(S)).toBe(true);
    expect(usable(null)).toBe(false);
    expect(usable({})).toBe(false);
  });
});
