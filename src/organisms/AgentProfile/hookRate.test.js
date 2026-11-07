import { durOk, readRate, saysRate, writeRate } from "./hookRate";

// HIS ASK, 2026-11-07: *"I can pick once per session, at most every five minutes — what the fuck if
// I want four times an hour? I'll put it idle five minutes but only four times an hour. That is
// what we set up, but I cannot select it — I select from a dropdown."* Four times an hour is
// `cooldown:15m`, and 15m was not one of the eleven the dropdown offered.
describe("a cooldown is written, not chosen from a list", () => {
  it("composes any duration the harness accepts, including the one nobody listed", () => {
    expect(writeRate({ kind: "cooldown", n: "15", unit: "m" })).toBe("cooldown:15m");
    expect(writeRate({ kind: "cooldown", n: "7", unit: "m" })).toBe("cooldown:7m");
    expect(writeRate({ kind: "cooldown", n: "36", unit: "h" })).toBe("cooldown:36h");
    expect(writeRate({ kind: "once-per-rise" })).toBe("once-per-rise");
    expect(writeRate({ kind: "" })).toBe("");
  });

  it("reads a saved rate back into the two controls", () => {
    expect(readRate("cooldown:15m")).toEqual({ kind: "cooldown", n: "15", unit: "m", raw: "" });
    expect(readRate("once-per-session")).toEqual({ kind: "once-per-session", n: "", unit: "m", raw: "" });
    expect(readRate("")).toEqual({ kind: "", n: "", unit: "m", raw: "" });
    expect(readRate(undefined)).toEqual({ kind: "", n: "", unit: "m", raw: "" });
  });

  // A COMPOUND RATE MAY NOT BE QUIETLY REWRITTEN. `cooldown:3d12h` is legal to the harness and
  // cannot be held by one number and one unit, so it survives as raw text instead of becoming 3d.
  it("a duration the pair cannot hold survives as itself", () => {
    expect(readRate("cooldown:3d12h")).toEqual({ kind: "cooldown", n: "", unit: "m", raw: "3d12h" });
    expect(writeRate(readRate("cooldown:3d12h"))).toBe("cooldown:3d12h");
    expect(readRate("cooldown:90s").raw).toBe("90s");
    expect(writeRate(readRate("cooldown:90s"))).toBe("cooldown:90s");
    // the legacy bare-seconds form the harness still honours
    expect(writeRate(readRate("cooldown:120"))).toBe("cooldown:120");
  });

  // CLEARING THE BOX MAY NOT CHANGE THE KIND. "no rate — every match" is the one rate a hook must
  // never acquire by accident, and it is what the control snapped to if an empty duration collapsed
  // the whole string. `cooldown:` holds the kind and is refused by the harness at the save.
  it("an empty duration keeps the kind and is refused later, rather than becoming no rate", () => {
    expect(writeRate({ kind: "cooldown", n: "", unit: "m" })).toBe("cooldown:");
    expect(readRate("cooldown:")).toEqual({ kind: "cooldown", n: "", unit: "m", raw: "" });
    expect(saysRate("cooldown:")).toBe("name a duration — 15m is four times an hour");
  });

  // The same grammar `parseDur` enforces, checked while he types — a malformed rate used to save
  // and then mean "no limit": a hook firing forever wearing a limit it never had.
  it("says which durations the harness can read", () => {
    ["15m", "1h", "3d12h", "2w", "500ms", "120"].forEach((d) => expect(durOk(d)).toBe(true));
    ["", "15 m", "quarter hour", "m15", "1.5h", "fifteen"].forEach((d) => expect(durOk(d)).toBe(false));
  });

  // The arithmetic he said out loud, done on the surface instead of in his head.
  it("says what the rate means, in times-per-window where that is a whole number", () => {
    expect(saysRate("cooldown:15m")).toBe("at most once every 15 minutes — 4 times an hour");
    expect(saysRate("cooldown:30m")).toBe("at most once every 30 minutes — 2 times an hour");
    expect(saysRate("cooldown:1m")).toBe("at most once every 1 minute — 60 times an hour");
    expect(saysRate("cooldown:7m")).toBe("at most once every 7 minutes");
    expect(saysRate("cooldown:6h")).toBe("at most once every 6 hours — 4 times a day");
    expect(saysRate("cooldown:3d12h")).toBe("at most once every 3d12h");
    expect(saysRate("cooldown:nope")).toBe('"nope" is not a duration the harness can read');
    expect(saysRate("once-per-day")).toBe("");
  });
});
