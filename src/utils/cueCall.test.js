import { callCommand, labelFor, CALL_KEYS } from "./cueCall";

// WHAT EACH SPEC IS DOING. The claim worth protecting is the one that made this verb necessary: a
// walk must be able to NAVIGATE from inside its own sequence, so replaying it tomorrow opens the
// thing it is about instead of narrating whatever document happens to be on screen. The rest are
// about refusing rather than guessing — a cue that silently performs nothing keeps the sequence
// going and narrates thin air with full confidence, which is the failure this exists against.

describe("navigation, from inside the sequence", () => {
  it("opens a report — the beat a walk has to be able to play first", () => {
    expect(callCommand("nav report=meetings/2026-10-31-x.md")).toEqual({
      cmd: "nav",
      args: { report: "meetings/2026-10-31-x.md" },
      label: "opened report 2026-10-31-x.md",
    });
  });

  it("carries a line range in its own field, never welded to the path", () => {
    // Which is what tells "point at the file" apart from "point at these lines in it" everywhere
    // downstream — a range left inside the path once drew a box around the whole centre panel.
    expect(callCommand("nav file=api/index.js#L40-55").args).toEqual({ file: "api/index.js", lines: [40, 55] });
    expect(callCommand("nav file=api/index.js#L40-L55").args).toEqual({ file: "api/index.js", lines: [40, 55] });
    expect(callCommand("nav file=api/index.js#L40").args).toEqual({ file: "api/index.js", lines: [40, 40] });
    expect(callCommand("nav file=api/index.js").args).toEqual({ file: "api/index.js" });
  });

  it("reaches the rest of the window too — stats with a range, a tab, a namespace, the agents page", () => {
    expect(callCommand("nav stats=coverage range=24h").args).toEqual({ stats: "coverage", range: "24h" });
    expect(callCommand("nav tab=docs").args).toEqual({ tab: "docs" });
    expect(callCommand("nav namespace=TestService.Math.add").args).toEqual({ namespace: "TestService.Math.add" });
    expect(callCommand("nav agents=true").args).toEqual({ agents: true });
  });
});

describe("the other commands, through the same door", () => {
  it("act and refresh — one vocabulary, not a second one to learn", () => {
    expect(callCommand('act run="yarn test"').args).toEqual({ run: "yarn test" });
    expect(callCommand("act test=Math.add").args).toEqual({ test: "Math.add" });
  });

  // ONE WAY TO PUT A DOCUMENT IN FRONT OF HIM. A cue cannot reach the TV: `nav report=…` opens the
  // file in the centre, and a second verb for the same destination makes the author pick between
  // two words for one thing.
  it("a cue has no verb for the TV — a document is opened, not broadcast", () => {
    const r = callCommand("show report=audit.md");
    expect(r.error).toMatch(/"show" is not a command/);
    expect(callCommand("nav report=audit.md").args).toEqual({ report: "audit.md" });
  });

  it("refresh is the one verb that means something bare, because it names a chore", () => {
    expect(callCommand("refresh")).toEqual({ cmd: "refresh", args: { scope: "all" }, label: "refreshed everything" });
    expect(callCommand("refresh scope=docs").label).toBe("refreshed docs");
  });
});

describe("it refuses rather than guesses", () => {
  it("an unknown verb is named, with what the verbs actually are", () => {
    const r = callCommand("navigate report=x.md");
    expect(r.error).toMatch(/"navigate" is not a command/);
    expect(r.error).toMatch(/nav, act, refresh/);
  });

  it("an unknown key is named, with the keys that verb takes", () => {
    expect(callCommand("nav document=x.md").error).toMatch(/"document" is not one of/);
    expect(callCommand("act scope=docs").error).toMatch(/"scope" is not one of test, run/);
  });

  it("a verb with nothing to act on is a refusal, not a silent beat", () => {
    // THE WHOLE POINT. A cue that performs nothing lets the sequence carry on as though it had —
    // so there has to be something to render on the row instead.
    expect(callCommand("nav").error).toMatch(/nothing to act on/);
    expect(callCommand("act").error).toMatch(/nothing to act on/);
    expect(callCommand("").error).toMatch(/needs a command/);
    expect(callCommand(null).error).toMatch(/needs a command/);
  });

  it("every verb's key list is the hub's, so a cue and a command cannot drift", () => {
    expect(Object.keys(CALL_KEYS)).toEqual(["nav", "act", "refresh"]);
    expect(CALL_KEYS.nav).toContain("report");
    expect(CALL_KEYS.nav).toContain("stats");
  });
});

describe("what the row says and the voice reads", () => {
  it("the command's own sentence — the honest narration of a beat that moves the window", () => {
    expect(labelFor("nav", { file: "a/b.js", lines: [3, 9] })).toBe("pulled up a/b.js#L3-9");
    expect(labelFor("nav", { file: "a/b.js", lines: [3, 3] })).toBe("pulled up a/b.js#L3");
    expect(labelFor("nav", { stats: "coverage" })).toBe("opened stats — coverage");
    expect(labelFor("nav", { agents: true })).toBe("opened the agents page");
    expect(labelFor("act", { run: "yarn test" })).toBe('pressed play on "yarn test"');
  });
});
