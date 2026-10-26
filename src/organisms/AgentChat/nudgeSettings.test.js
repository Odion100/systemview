import { FIELDS, SOURCE_CHOICES, patchFor, summaryOf, toggleSource, usable } from "./nudgeSettings";

// THE WORKLIST SETTINGS — the knobs, proven without mounting anything.
//
// WHY THERE IS NO RENDER TEST HERE: AgentChat imports the markdown renderer, which is ESM and sits
// in untransformed node_modules, so any test that mounts it dies before it runs — that is how two
// render-time crashes once shipped alongside 543 green claims. So the panel is thin on purpose and
// everything that can be WRONG lives in this module, where it is reachable.

const S = { on: true, idleMin: 20, cooldownMin: 30, giveUpAfter: 3, ctxCeilingPct: 70, sources: ["job:", "skill:"] };

describe("a patch is one changed field, or nothing at all", () => {
  it("sends only what actually changed", () => {
    expect(patchFor(S, "idleMin", 45)).toEqual({ idleMin: 45 });
    expect(patchFor(S, "on", false)).toEqual({ on: false });
  });

  // THE RULE THAT KEEPS A NUMBER FIELD FROM WRITING ON EVERY KEYSTROKE. Without it, typing "45"
  // writes 4 and then 45, and the first write is a value he never chose.
  it("returns null when the edit changes nothing, so no write happens", () => {
    expect(patchFor(S, "idleMin", 20)).toBe(null);
    expect(patchFor(S, "idleMin", "20")).toBe(null);
    expect(patchFor(S, "on", true)).toBe(null);
    expect(patchFor(S, "sources", ["job:", "skill:"])).toBe(null);
    expect(patchFor(S, "sources", ["skill:", "job:"])).toBe(null); // order is not a change
  });

  it("clamps rather than trusting, and falls back on junk", () => {
    expect(patchFor(S, "idleMin", 99999)).toEqual({ idleMin: 1440 });
    expect(patchFor(S, "idleMin", 0)).toEqual({ idleMin: 1 });
    expect(patchFor(S, "idleMin", "nonsense")).toBe(null); // falls back to current → no change
  });

  // 0 IS A REAL SETTING — "never nudge" — so it must be sendable rather than clamped away.
  it("lets give-up go to zero, because zero is how you turn it off and keep the rest", () => {
    expect(patchFor(S, "giveUpAfter", 0)).toEqual({ giveUpAfter: 0 });
  });

  it("refuses a field it does not have", () => {
    expect(patchFor(S, "invented", 3)).toBe(null);
  });
});

describe("sources are prefixes the harness actually matches", () => {
  it("toggles one without disturbing the others", () => {
    expect(toggleSource(S, "lane:")).toEqual(["job:", "skill:", "lane:"]);
    expect(toggleSource(S, "job:")).toEqual(["skill:"]);
  });

  // A TEXT BOX WOULD LET HIM TYPE `jobs:` AND WATCH NOTHING HAPPEN FOREVER. The choices are the
  // prefixes the harness compares against, so an unknown one cannot be stored.
  it("drops a source that is not one of the offered prefixes", () => {
    expect(patchFor(S, "sources", ["job:", "jobs:", "nonsense"])).toEqual({ sources: ["job:"] });
  });

  it("every offered choice is a prefix, never a bare word", () => {
    SOURCE_CHOICES.forEach((c) => expect(c.key.endsWith(":")).toBe(true));
  });
});

describe("the summary says the real state, including the states that read as broken", () => {
  it("names what counts, the wait, the cadence and the limit", () => {
    // "cycles of 3", not "3×" — the limit stopped being a limit (his redesign): the third nudge is
    // the cycle's final notice, then the count wraps and nudging continues until the run earns an
    // ending. A summary still reading "3×" would describe the retired silent-timeout behaviour.
    expect(summaryOf(S)).toBe("nudge — jobs + skills after 20m quiet, every 30m, cycles of 3");
  });

  it("says off when off", () => {
    expect(summaryOf({ ...S, on: false })).toBe("nudge — off");
  });

  // TWO WAYS TO BE OFF WHILE `on` IS TRUE, and a summary that hid either would be lying about a
  // configuration he set himself.
  it("says off when give-up is zero, and says 'nothing' when no source counts", () => {
    expect(summaryOf({ ...S, giveUpAfter: 0 })).toMatch(/off/);
    expect(summaryOf({ ...S, sources: [] })).toMatch(/nothing/);
  });

  // ABSENCE STATED. A shell with no nudge door gets told so, not shown defaults that write nowhere.
  it("says plainly when there is no door, rather than inventing a state", () => {
    expect(summaryOf(null)).toMatch(/not available/);
    expect(usable(null)).toBe(false);
    expect(usable({})).toBe(false);
    expect(usable(S)).toBe(true);
  });
});

describe("every field can be rendered by the panel that exists", () => {
  it("declares a kind the panel knows, and a help line", () => {
    const kinds = ["toggle", "minutes", "count", "percent", "sources"];
    FIELDS.forEach((f) => {
      expect(kinds).toContain(f.kind);
      expect(typeof f.help).toBe("string");
      expect(f.help.length).toBeGreaterThan(0);
      if (f.kind !== "toggle" && f.kind !== "sources") {
        expect(typeof f.min).toBe("number");
        expect(typeof f.max).toBe("number");
      }
    });
  });

  // THE PANEL READS `settings[f.key]`, so a field naming something the harness does not store
  // renders an empty input forever — the exact shape of a knob that looks wired and is not.
  it("names only keys the harness actually stores", () => {
    FIELDS.forEach((f) => expect(Object.keys(S)).toContain(f.key));
  });
});
