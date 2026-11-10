import { FIELDS, RENDERABLE, SOURCE_CHOICES, UNITS, patchFor, summaryOf, toggleSource, usable, sourceChoices, FALLBACK_SOURCES, toggleMember } from "./nudgeSettings";

// THE WORKLIST SETTINGS — the knobs, proven without mounting anything.
//
// WHY THERE IS NO RENDER TEST HERE: AgentChat imports the markdown renderer, which is ESM and sits
// in untransformed node_modules, so any test that mounts it dies before it runs — that is how two
// render-time crashes once shipped alongside 543 green claims. So the panel is thin on purpose and
// everything that can be WRONG lives in this module, where it is reachable.

// THE HARNESS'S OWN SHAPE, MIRRORED — every key in `nudge.cjs` DEFAULTS, and nothing that is not
// one. It is a hand-kept copy because this suite cannot reach across into the shell's .cjs, which
// means the guard below is ONE-DIRECTIONAL: it catches a panel field naming a key the harness does
// not store (an input wired to nothing), and it cannot catch the harness growing a key the panel
// never offers. So when a setting is added over there, it is added here in the same motion.
const S = { on: true, idleMin: 20, cooldownMin: 30, giveUpAfter: 3, ctxCeilingPct: 70, subagentIdleMin: 10, sources: ["job:", "skill:", "correction:"], keepHours: 12, managers: [] };

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
    expect(patchFor(S, "sources", ["job:", "skill:", "correction:"])).toBe(null);
    expect(patchFor(S, "sources", ["correction:", "skill:", "job:"])).toBe(null); // order is not a change
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
    expect(toggleSource(S, "lane:")).toEqual(["job:", "skill:", "correction:", "lane:"]);
    expect(toggleSource(S, "job:")).toEqual(["skill:", "correction:"]);
    // unticking corrections is the whole of "stop nudging me about those"
    expect(toggleSource(S, "correction:")).toEqual(["job:", "skill:"]);
  });

  // A TEXT BOX WOULD LET HIM TYPE `jobs:` AND WATCH NOTHING HAPPEN FOREVER. The choices are the
  // prefixes the harness compares against, so an unknown one cannot be stored.
  it("drops a source that is not one of the offered prefixes", () => {
    expect(patchFor(S, "sources", ["job:", "jobs:", "nonsense"])).toEqual({ sources: ["job:"] });
    expect(patchFor(S, "sources", ["corrections:"])).toEqual({ sources: [] }); // the plural is not the prefix
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
    expect(summaryOf(S)).toBe(
      "nudge — jobs + skills + corrections after 20m quiet, every 30m, cycles of 3 · keeps closed runs 12h",
    );
  });

  it("says off when off", () => {
    expect(summaryOf({ ...S, on: false })).toMatch(/^nudge — off/);
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

// The kinds that are NOT numbers. Listed once so the two guards below cannot drift apart about
// which shape a field is — the bug that would hide is a number field losing its unit while a guard
// that had quietly stopped covering numbers stayed green.
// THE KINDS THAT DRAW THEMSELVES — everything else is a number and owes a min, a max and a unit.
// `slots` joins them: a set of switches has no bounds to clamp, the same way `sources` does not.
// Leaving it off is not a silent miss — the two guards below immediately demand a min and a unit
// for it, which is exactly how this list earns its place.
const SELF_RENDERING = ["toggle", "sources", "slots", "slot"];

describe("every field can be rendered by the panel that exists", () => {
  it("declares a kind the panel knows, and a help line", () => {
    // THE REAL LIST, imported — a hard-coded copy here would pass while the panel rendered an
    // empty row, which is the one failure this claim exists to catch.
    FIELDS.forEach((f) => {
      expect(RENDERABLE).toContain(f.kind);
      expect(typeof f.help).toBe("string");
      expect(f.help.length).toBeGreaterThan(0);
      // THREE SHAPES, NOT TWO — and naming the third is the point rather than loosening the
      // guard: `toggle` and `sources` render themselves, `slot` is a free name with no bounds to
      // clamp, and EVERYTHING ELSE is a number that owes a min, a max and a unit.
      if (!SELF_RENDERING.includes(f.kind)) {
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

  // AND EVERY NUMBER KIND HAS A UNIT. The guard above proves a kind is renderable; this proves the
  // render has something to print beside the box, which is the half that makes "12" mean hours.
  it("every number kind carries its unit", () => {
    FIELDS.filter((f) => !SELF_RENDERING.includes(f.kind)).forEach((f) =>
      expect(typeof UNITS[f.kind]).toBe("string"),
    );
  });
});

describe("retention is a worklist setting, and the panel says so", () => {
  // HIS ASK: "how quickly the worklist gets deleted should be added to the worklist settings."
  it("keepHours is a field with an hour floor", () => {
    const f = FIELDS.find((x) => x.key === "keepHours");
    expect(f.kind).toBe("hours");
    expect(f.min).toBe(1);
  });

  // THE ONLY DESTRUCTIVE KNOB IN THE PANEL, so the shut-panel summary must not go quiet about it
  // the moment nudging is switched off — the janitor does not care whether anything nudges.
  it("the summary says the retention window even when the nudge is off", () => {
    expect(summaryOf({ ...S, on: false })).toBe("nudge — off · keeps closed runs 12h");
    expect(summaryOf({ ...S, giveUpAfter: 0 })).toBe("nudge — off (cycle length 0) · keeps closed runs 12h");
    expect(summaryOf(S)).toContain("keeps closed runs 12h");
  });

  it("zero is not a value the panel can send — the floor clamps it", () => {
    expect(patchFor(S, "keepHours", 0)).toEqual({ keepHours: 1 });
    expect(patchFor(S, "keepHours", 24)).toEqual({ keepHours: 24 });
    expect(patchFor(S, "keepHours", 12)).toBe(null);
  });
});

// ── THE SWITCHES ARE THE HARNESS'S KINDS ───────────────────────────────────────────────────────
// His ask, 2026-11-09: a kind of run should arrive with its own switch — "that could go to the
// worklist settings as well, as which one counts". The list used to be typed here, which is one
// more place a new kind goes missing: `correction:` landed in the harness, drew no switch, and he
// could neither turn it on nor off from the panel built to control exactly that.
describe("which sources count — drawn from the harness, not from a copy", () => {
  it("offers a switch per kind the harness sent, in the harness's order", () => {
    const kinds = [
      { prefix: "job:", label: "jobs" },
      { prefix: "lane:", label: "lanes" },
      { prefix: "skill:", label: "skills" },
      { prefix: "assignment:", label: "assignment" },
      { prefix: "correction:", label: "corrections" },
    ];
    expect(sourceChoices(kinds).map((c) => c.key)).toEqual([
      "job:", "lane:", "skill:", "assignment:", "correction:",
    ]);
    expect(sourceChoices(kinds).map((c) => c.label)).toEqual([
      "jobs", "lanes", "skills", "assignment", "corrections",
    ]);
  });

  it("falls back to what it knew rather than drawing an empty panel", () => {
    // A switchless settings pane reads as "there is nothing to configure", which is a claim about
    // the harness the window is in no position to make.
    expect(sourceChoices(null)).toBe(FALLBACK_SOURCES);
    expect(sourceChoices([])).toBe(FALLBACK_SOURCES);
    expect(sourceChoices("nonsense")).toBe(FALLBACK_SOURCES);
    expect(FALLBACK_SOURCES.length).toBeGreaterThan(0);
  });

  it("skips a malformed kind instead of drawing a switch that writes nothing", () => {
    const got = sourceChoices([{ prefix: "job:", label: "jobs" }, { label: "no prefix" }, null]);
    expect(got.map((c) => c.key)).toEqual(["job:"]);
  });

  it("labels a kind by its prefix when the harness sent no label", () => {
    expect(sourceChoices([{ prefix: "newkind:" }])[0].label).toBe("newkind:");
  });
});

// ---- A KIND THE HARNESS SENDS CAN ACTUALLY BE TURNED ON (2026-11-09) -------------------------
// THE DEFECT THIS LOCKS DOWN, measured in his window — "I still can't click assignment."
//
// The RENDER started deriving its switches from the harness's `kinds` while patchFor went on
// validating writes against the four-item FALLBACK. So the assignment switch drew, he pressed it,
// the filter dropped the prefix it had never heard of, `same` came out true, and the patch was
// null. A control that renders, responds to nothing, and reports no error — the worst of the three
// outcomes, because the surface looks like it works.
//
// Every assertion here is about the WRITE agreeing with what was DRAWN. The render half already
// had coverage, which is exactly why this got through: both halves were tested, separately, and
// nothing tested that they were reading one list.
describe("the write accepts every kind the render offers", () => {
  const KINDS = [
    { prefix: "job:", label: "jobs" },
    { prefix: "lane:", label: "lanes" },
    { prefix: "skill:", label: "skills" },
    { prefix: "assignment:", label: "assignment" },
    { prefix: "correction:", label: "corrections" },
  ];
  const live = sourceChoices(KINDS);
  const cur = { ...S, sources: ["skill:", "lane:", "correction:", "job:"] };

  it("a kind absent from the fallback can be toggled ON", () => {
    const patch = patchFor(cur, "sources", toggleSource(cur, "assignment:"), live);
    expect(patch).not.toBe(null);
    expect(patch.sources).toContain("assignment:");
  });

  it("…and back OFF again", () => {
    const on = { ...cur, sources: [...cur.sources, "assignment:"] };
    const patch = patchFor(on, "sources", toggleSource(on, "assignment:"), live);
    expect(patch).not.toBe(null);
    expect(patch.sources).not.toContain("assignment:");
  });

  it("EVERY kind the render draws survives the write — the guard that generalises", () => {
    // Not just assignment. Whatever the harness sends, drawing it and being unable to set it is
    // the same bug wearing a different prefix, so this walks the whole list.
    for (const c of live) {
      const from = { ...cur, sources: [] };
      const patch = patchFor(from, "sources", toggleSource(from, c.key), live);
      expect(patch).not.toBe(null);
      expect(patch.sources).toEqual([c.key]);
    }
  });

  it("WITHOUT the live list it still drops the unknown kind — which is the bug, pinned", () => {
    // Kept as a test rather than deleted, because it is the one line that explains why the
    // parameter exists. Omit the choices and the old behaviour is exactly reproduced.
    expect(patchFor(cur, "sources", toggleSource(cur, "assignment:"))).toBe(null);
  });

  it("junk is still refused — the filter was not simply removed", () => {
    // A stale filter is worse than none, but none is not the fix either: the write still only
    // accepts prefixes something actually offered.
    const patch = patchFor(cur, "sources", [...cur.sources, "nonsense:"], live);
    expect(patch).toBe(null); // nothing real changed, so nothing is written
    const empty = patchFor(cur, "sources", ["made-up:"], live);
    expect(empty).toEqual({ sources: [] });
  });

  it("the summary names a live kind by its LABEL, not its raw prefix", () => {
    const on = { ...cur, sources: ["assignment:"] };
    expect(summaryOf(on, live)).toContain("assignment");
    expect(summaryOf(on, live)).not.toContain("assignment:");
  });
});

// ---- THE MANAGER ABILITY IS A LIST, NOT A NAME (2026-11-10) ----------------------------------
// His ask: "we should be able to assign more than one manager." It was one name compared with
// `===`, so exactly one agent on the machine could put work in anybody's place. The ability is not
// a role — one agent reading finished work against the doctrine, another sitting above an arc, and
// an agent handed it for an afternoon and taken back off it after — so it is a SET.
describe("managers — a set field, switched rather than picked", () => {
  const ROSTER = ["manager", "systemview-test", "buapi"];
  const cur = { ...S, managers: ["manager"] };

  it("adding a second name KEEPS the first — the whole reason it is not a picker", () => {
    const patch = patchFor(cur, "managers", toggleMember(cur, "managers", "systemview-test"), ROSTER);
    expect(patch).toEqual({ managers: ["manager", "systemview-test"] });
  });

  it("…and taking one back is one press", () => {
    const two = { ...S, managers: ["manager", "systemview-test"] };
    expect(patchFor(two, "managers", toggleMember(two, "managers", "manager"), ROSTER)).toEqual({
      managers: ["systemview-test"],
    });
  });

  it("emptying it is a real write — nobody is a setting, not an unset", () => {
    // The harness reads an empty list as REFUSED, never as "anyone", so he has to be able to get
    // back to it and the patch must actually be sent.
    expect(patchFor(cur, "managers", toggleMember(cur, "managers", "manager"), ROSTER)).toEqual({ managers: [] });
  });

  it("order is not a change, so re-pressing the same set writes nothing", () => {
    const two = { ...S, managers: ["manager", "systemview-test"] };
    expect(patchFor(two, "managers", ["systemview-test", "manager"], ROSTER)).toBe(null);
  });

  it("filters to the roster when one is given", () => {
    expect(patchFor(cur, "managers", ["manager", "ghost"], ROSTER)).toBe(null); // only `manager` survives == no change
    expect(patchFor(cur, "managers", ["ghost"], ROSTER)).toEqual({ managers: [] });
  });

  it("WITH NO ROSTER IT DOES NOT FILTER — and that asymmetry with `sources` is deliberate", () => {
    // The roster arrives from a different door and can legitimately be unavailable. Filtering
    // against an empty roster would silently discard every name he picked — the same shape as the
    // bug where the sources write validated against a stale list and a press did nothing.
    expect(patchFor(cur, "managers", ["manager", "someone-else"], null)).toEqual({
      managers: ["manager", "someone-else"],
    });
    // `sources` still falls back to its own shipped list, because that list is real.
    expect(patchFor({ ...S, sources: [] }, "sources", ["made-up:"], null)).toBe(null);
  });

  it("dedupes and drops blanks", () => {
    expect(patchFor({ ...S, managers: [] }, "managers", ["a", "a", "", "  "], null)).toEqual({ managers: ["a"] });
  });

  it("`slots` is renderable, or the field draws a label and no control", () => {
    const f = FIELDS.find((x) => x.key === "managers");
    expect(f).toBeTruthy();
    expect(f.kind).toBe("slots");
    expect(RENDERABLE).toContain("slots");
  });

  it("toggleSource still works — its callers and its claims name it", () => {
    expect(toggleSource({ sources: ["job:"] }, "skill:")).toEqual(["job:", "skill:"]);
    expect(toggleSource({ sources: ["job:"] }, "job:")).toEqual([]);
  });
});
