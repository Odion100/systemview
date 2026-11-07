import { CATEGORIES, durOk, isCrossing, readRate, saysRate, writeRate } from "./hookRate";

// HIS DESIGN, 2026-11-07: *"a number per a… and a selector for a time category — session, crossing,
// whatever. What if I said twice per day? And you can pick every match, which is a completely
// separate selector."* Fourteen hand-written sentences in one dropdown hid that there are only two
// choices to make, and welded the count to one.
describe("a rate is a count and a category", () => {
  it("composes the sentence he said — and twice per day had no spelling before", () => {
    expect(writeRate({ mode: "budget", n: "2", cat: "day" })).toBe("2-per-day");
    expect(writeRate({ mode: "budget", n: "4", cat: "hour" })).toBe("4-per-hour");
    expect(writeRate({ mode: "budget", n: "3", cat: "week" })).toBe("3-per-week");
    expect(writeRate({ mode: "budget", n: "2", cat: "session" })).toBe("2-per-session");
  });

  // n=1 keeps the spelling every hook, skill and document already uses — the harness reads the two
  // as one rate, so the only question is which one a reader meets.
  it("one is written `once-per-X`, not `1-per-X`", () => {
    expect(writeRate({ mode: "budget", n: "1", cat: "day" })).toBe("once-per-day");
    expect(writeRate({ mode: "budget", n: "1", cat: "session" })).toBe("once-per-session");
  });

  it("reads every family back into the controls", () => {
    expect(readRate("2-per-day")).toMatchObject({ mode: "budget", n: "2", cat: "day" });
    expect(readRate("once-per-session")).toMatchObject({ mode: "budget", n: "1", cat: "session" });
    expect(readRate("once-per-rise")).toMatchObject({ mode: "budget", n: "1", cat: "rise" });
    expect(readRate("cooldown:15m")).toMatchObject({ mode: "gap", durN: "15", durUnit: "m" });
    expect(readRate("")).toMatchObject({ mode: "every" });
    expect(readRate(undefined)).toMatchObject({ mode: "every" });
  });

  // THE CATEGORIES ARE NOT ALL CLOCK (his correction): the two that are not go first, because they
  // are the two a threshold hook actually wants.
  it("session and crossing stand in the category list, ahead of the clock", () => {
    expect(CATEGORIES.map((c) => c.value)).toEqual(["session", "compaction", "hour", "day", "week", "month"]);
    expect(isCrossing("compaction")).toBe(true);
    expect(isCrossing("rise")).toBe(true);
    expect(isCrossing("day")).toBe(false);
  });

  // "EVERY MATCH" IS ITS OWN SELECTOR — it is not a count, so it cannot live in the number.
  it("every match is a mode, never a value inside the pair", () => {
    expect(writeRate({ mode: "every", n: "2", cat: "day" })).toBe("");
    expect(saysRate("")).toBe("no limit — it fires on every match");
  });

  it("a sliding gap stays reachable, and a compound one is not rounded", () => {
    expect(writeRate({ mode: "gap", durN: "15", durUnit: "m" })).toBe("cooldown:15m");
    expect(writeRate(readRate("cooldown:3d12h"))).toBe("cooldown:3d12h");
    expect(writeRate(readRate("cooldown:120"))).toBe("cooldown:120");
    ["15m", "3d12h", "2w", "120"].forEach((d) => expect(durOk(d)).toBe(true));
    ["", "15 m", "1.5h", "quarter hour"].forEach((d) => expect(durOk(d)).toBe(false));
  });

  // A RATE NOBODY CAN READ IS A HOOK THAT NEVER FIRES. Showing it as itself is how it gets fixed;
  // replacing it with a default hides it.
  it("an unreadable rate already on disk survives as itself and says so", () => {
    expect(readRate("once-per-fortnight")).toMatchObject({ mode: "other", text: "once-per-fortnight" });
    expect(writeRate(readRate("once-per-fortnight"))).toBe("once-per-fortnight");
    expect(saysRate("once-per-fortnight")).toBe('"once-per-fortnight" is not a rate the harness can read');
  });

  it("says the sentence back, in his words", () => {
    expect(saysRate("once-per-day")).toBe("once per day");
    expect(saysRate("2-per-day")).toBe("twice per day");
    expect(saysRate("4-per-hour")).toBe("4 times per hour");
    expect(saysRate("once-per-compaction")).toBe("once per crossing");
    expect(saysRate("2-per-rise")).toBe("twice per crossing");
    expect(saysRate("cooldown:15m")).toBe("no sooner than 15m after the last fire");
    expect(saysRate("cooldown:")).toBe("name a gap");
    expect(saysRate("cooldown:nope")).toBe('"nope" is not a duration the harness can read');
  });
});
