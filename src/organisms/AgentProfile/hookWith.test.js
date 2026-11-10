import { hookWithFields, hookWithNote, hookWithHint } from "./hookWith";

// THE DEFECT THIS LOCKS DOWN, measured in his window 2026-11-10: "I see those options went away."
//
// The `with:` form built its rows from `(hookJob.requires || [])` alone, so `requires:` was one
// list doing two jobs — making a field APPEAR meant making it MANDATORY. The moment the arc job
// stopped demanding `project` and `arc`, his two controls vanished and the only way to focus a run
// on one arc was hand-editing a hook file.
describe("hookWithFields — the form asks the job, and asks for both kinds", () => {
  it("draws a required field", () => {
    expect(hookWithFields({ requires: ["period"] })).toEqual([{ key: "period", required: true }]);
  });

  it("draws an OFFERABLE field for a job that requires nothing", () => {
    // arc-development's real shape. Under the old reading this returned [] and the form said there
    // was nothing to supply.
    expect(hookWithFields({ requires: [], optional: ["project", "arc"] })).toEqual([
      { key: "project", required: false },
      { key: "arc", required: false },
    ]);
  });

  it("required first, then offerable — the order the form draws them in", () => {
    expect(hookWithFields({ requires: ["period"], optional: ["project"] }).map((f) => f.key)).toEqual([
      "period",
      "project",
    ]);
  });

  it("a name in BOTH lists is required — the stricter reading, because the gate will demand it anyway", () => {
    const f = hookWithFields({ requires: ["arc"], optional: ["arc", "project"] });
    expect(f).toEqual([
      { key: "arc", required: true },
      { key: "project", required: false },
    ]);
    // and it is drawn ONCE — a duplicated field is two inputs writing one key
    expect(f.filter((x) => x.key === "arc")).toHaveLength(1);
  });

  it("deduplicates within a list, and drops blanks and junk", () => {
    expect(hookWithFields({ requires: ["a", "a", "", "  ", null], optional: ["b", "b"] })).toEqual([
      { key: "a", required: true },
      { key: "b", required: false },
    ]);
  });

  it("a job declaring nothing, or a missing job, draws nothing — never throws", () => {
    expect(hookWithFields({ requires: [], optional: [] })).toEqual([]);
    expect(hookWithFields({})).toEqual([]);
    expect(hookWithFields(null)).toEqual([]);
    expect(hookWithFields(undefined)).toEqual([]);
    // AN OLDER SHELL sends no `optional` at all. It must behave exactly as it did before.
    expect(hookWithFields({ requires: ["period"] })).toEqual([{ key: "period", required: true }]);
  });

  it("junk in place of a list is not a crash and not a field", () => {
    expect(hookWithFields({ requires: "period", optional: 7 })).toEqual([]);
  });
});

describe("hookWithNote — the empty state stopped being true", () => {
  it("says nothing when there is something to draw", () => {
    expect(hookWithNote({ requires: [], optional: ["arc"] })).toBe("");
    expect(hookWithNote({ requires: ["period"] })).toBe("");
  });

  it("…and only claims 'no inputs' when BOTH lists are empty", () => {
    // The old sentence read off `requires` alone, so a job requiring nothing and offering two
    // announced that it declared no inputs — beside a form that should have had two fields in it.
    expect(hookWithNote({ requires: [], optional: [] })).toMatch(/no inputs/);
    expect(hookWithNote(null)).toMatch(/no inputs/);
  });
});

describe("hookWithHint — a blank being allowed is said where the decision is made", () => {
  it("an optional field says so, because a text input cannot show it", () => {
    expect(hookWithHint({ key: "arc", required: false })).toMatch(/optional/);
    expect(hookWithHint({ key: "arc", required: false })).toMatch(/blank/);
  });

  it("a required field reads as the instruction it is", () => {
    const h = hookWithHint({ key: "period", required: true });
    expect(h).toContain("period");
    expect(h).not.toMatch(/optional|blank/);
  });

  it("never throws on a missing field", () => {
    expect(typeof hookWithHint(null)).toBe("string");
  });
});
