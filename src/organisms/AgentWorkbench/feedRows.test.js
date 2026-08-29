import { foldEvents, foldState, pathsWritten, parseVisitorTurn, parseUsageReport, CTX_DUE, CTX_WARN } from "./feedRows";

const ev = (kind, rest = {}) => ({ kind, ts: 1, ...rest });

describe("foldEvents", () => {
  it("grows a streamed block and lets the settled event REPLACE it, never duplicate it", () => {
    const rows = foldEvents([
      ev("text-delta", { text: "Hel" }),
      ev("text-delta", { text: "lo" }),
      ev("text", { text: "Hello" }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "say", text: "Hello", settled: true });
  });

  it("keeps thinking and speech in separate rows even when they interleave", () => {
    const rows = foldEvents([
      ev("thinking-delta", { text: "hm" }),
      ev("text-delta", { text: "ok" }),
      ev("thinking-delta", { text: "more" }),
    ]);
    expect(rows.map((r) => r.kind)).toEqual(["think", "say", "think"]);
  });

  it("resolves a tool call in place instead of adding a second line", () => {
    const rows = foldEvents([
      ev("tool-start", { id: "t1", tool: "Edit", input: { file_path: "/a/b/x.js" } }),
      ev("tool-end", { id: "t1", ok: true, output: "done" }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "tool", summary: "edited b/x.js", state: "ok", path: "/a/b/x.js", wrote: true });
  });

  it("still shows a result whose call it never saw (a view that attached mid-turn)", () => {
    const rows = foldEvents([ev("tool-end", { id: "t9", ok: false, output: "boom" })]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "tool", state: "failed" });
  });

  it("marks a failed call failed", () => {
    const rows = foldEvents([
      ev("tool-start", { id: "t1", tool: "Bash", input: { command: "false" } }),
      ev("tool-end", { id: "t1", ok: false }),
    ]);
    expect(rows[0].state).toBe("failed");
  });
});

describe("foldState", () => {
  it("reads working, waiting and ready off the same stream", () => {
    expect(foldState([ev("status", { state: "ready", model: "m" })]).state).toBe("ready");
    expect(foldState([ev("tool-start", { id: "1", tool: "Read", input: {} })]).state).toBe("working");
    expect(foldState([ev("permission-request", { id: "p1" })]).state).toBe("waiting");
  });

  it("accumulates cost and turns across results", () => {
    const s = foldState([ev("result", { ok: true, turns: 2, costUsd: 0.5 }), ev("result", { ok: true, turns: 1, costUsd: 0.25 })]);
    expect(s.turns).toBe(3);
    expect(s.cost).toBeCloseTo(0.75);
  });
});

// His catch, watching his own panel: *"when you send a message, your whole message gets put into
// the cooking message. Cooking messages are really short."* A status announces; it does not recite.
describe("the cooking line is a label, not the payload", () => {
  const long = "Compaction leaves a stale context number in your emitter and here is the whole essay about why, at length, with citations";
  it("names who a message went to instead of quoting the message", () => {
    const s = foldState([
      ev("tool.call", { name: "Bash", input: { command: `systemview message-agent autobot "${long}" --as systemview-test` } }),
    ]);
    expect(s.doing).toBe("messaged → autobot");
  });

  it("keeps a title, because a title is short and is the point", () => {
    const s = foldState([
      ev("tool.call", { name: "Bash", input: { command: 'systemview show autobot --text "Release 2.39.0"' } }),
    ]);
    expect(s.doing).toBe("put on the TV Release 2.39.0");
  });

  it("clamps whatever the host called it, too — same bug, other doorway", () => {
    const s = foldState([ev("tool.call", { name: "SendMessage", summary: long })]);
    expect(s.doing.length).toBeLessThanOrEqual(61);
    expect(s.doing.endsWith("\u2026")).toBe(true);
  });

  it("clamps a settled thinking block, which is the whole reasoning", () => {
    const essay = "I need to work out whether the ceiling belongs at the held value or at preTokens, and the answer turns on which number describes the conversation that just died";
    const s = foldState([ev("assistant.thinking", { text: essay })]);
    expect(s.doing.length).toBeLessThanOrEqual(61);
  });

  // THE STRUCTURAL CLAIM, not a spot-check of the three doorways I happened to find. The status is
  // clamped once on the way out of the fold, so a branch nobody has written yet inherits the bound.
  // If someone later assigns the panel's status from somewhere else, this fails.
  it("bounds the status for EVERY event kind, including ones added later", () => {
    const flood = "x".repeat(500);
    const kinds = [
      "tool.call", "tool-start", "assistant.thinking", "thinking-delta", "assistant.text",
      "text-delta", "user.prompt", "permission.request", "permission-request", "status",
      "compaction", "compacting", "usage", "result", "session.ended", "interrupted",
      "tool.result", "file.changed", "something.nobody.has.written.yet",
    ];
    kinds.forEach((kind) => {
      const s = foldState([
        ev(kind, { summary: flood, text: flood, delta: flood, title: flood, tool: flood, name: flood, input: { command: flood } }),
      ]);
      expect(typeof s.doing === "string" || s.doing === null).toBe(true);
      if (s.doing) expect(s.doing.length).toBeLessThanOrEqual(61);
    });
  });

  it("leaves a short summary exactly as it was", () => {
    const s = foldState([ev("tool.call", { name: "Read", summary: "read AgentChat/AgentChat.js" })]);
    expect(s.doing).toBe("read AgentChat/AgentChat.js");
  });
});

describe("pathsWritten", () => {
  it("lists writes and NEVER a read — a read must not light up the diff", () => {
    const paths = pathsWritten([
      ev("tool-start", { id: "1", tool: "Read", input: { file_path: "/a/read.js" } }),
      ev("tool-start", { id: "2", tool: "Write", input: { file_path: "/a/new.js" } }),
      ev("tool-start", { id: "3", tool: "Edit", input: { file_path: "/a/new.js" } }),
      ev("tool-start", { id: "4", tool: "Bash", input: { command: "ls" } }),
    ]);
    expect(paths).toEqual(["/a/new.js"]);
  });
});

describe("a resumed conversation", () => {
  const ev = (kind, rest = {}) => ({ kind, ts: 1, ...rest });
  it("puts the transcript on screen, his turns and ours, then marks where the past ends", () => {
    const rows = foldEvents([
      ev("user.prompt", { text: "review previous conversation", replay: true }),
      ev("assistant.text", { text: "here is what we did", replay: true }),
      ev("status", { state: "ready" }),
      ev("text", { text: "and here is the new bit" }),
    ]);
    expect(rows.map((r) => r.kind)).toEqual(["mine", "say", "seam", "say"]);
    expect(rows[0].replay).toBe(true);
    expect(rows[2].text).toBe("resumed here");
  });

  it("draws the seam ONCE, not before every live event", () => {
    const rows = foldEvents([
      ev("assistant.text", { text: "old", replay: true }),
      ev("text", { text: "a" }),
      ev("text", { text: "b" }),
    ]);
    expect(rows.filter((r) => r.kind === "seam")).toHaveLength(1);
  });

  it("has no seam when nothing was replayed", () => {
    const rows = foldEvents([ev("text", { text: "fresh" })]);
    expect(rows.some((r) => r.kind === "seam")).toBe(false);
  });
});

describe("two views of one session", () => {
  const ev = (kind, rest = {}) => ({ kind, ts: 1, ...rest });
  it("shows his own turn as HIS, not as the agent's", () => {
    const rows = foldEvents([ev("text", { text: "hello", mine: true, local: true })]);
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe("mine");
  });

  it("replaces the local echo when the host reports the same turn — one sentence, not two", () => {
    const rows = foldEvents([
      ev("text", { text: "hello there", mine: true, local: true }),
      ev("user.prompt", { text: "hello there" }),
    ]);
    expect(rows.filter((r) => r.kind === "mine")).toHaveLength(1);
    expect(rows[0].local).toBeFalsy();
  });

  it("keeps a genuinely different turn typed in the other view", () => {
    const rows = foldEvents([
      ev("text", { text: "from here", mine: true, local: true }),
      ev("user.prompt", { text: "from the browser panel" }),
    ]);
    expect(rows.filter((r) => r.kind === "mine").map((r) => r.text)).toEqual([
      "from here",
      "from the browser panel",
    ]);
  });
});

describe("the host's actual event names", () => {
  const ev = (kind, rest = {}) => ({ kind, ts: 1, ...rest });
  it("renders a bash command and a file read from tool.call, using the host's own summary", () => {
    const rows = foldEvents([
      ev("tool.call", { id: "a", name: "Bash", summary: "run: yarn build", input: { command: "yarn build" } }),
      ev("tool.result", { id: "a", ok: true, output: "done" }),
      ev("tool.call", { id: "b", name: "Read", summary: "reading CodePane.js", input: { file_path: "/x/CodePane.js" } }),
    ]);
    expect(rows.map((r) => r.summary)).toEqual(["run: yarn build", "reading CodePane.js"]);
    expect(rows[0].state).toBe("ok");
    expect(rows[1].state).toBe("running");
  });

  it("still lights the diff only for writes, and takes the watcher's word for a shell write", () => {
    expect(
      pathsWritten([
        ev("tool.call", { name: "Read", input: { file_path: "a.js" } }),
        ev("tool.call", { name: "Edit", input: { file_path: "b.js" } }),
        ev("file.changed", { path: "c.js" }),
      ]),
    ).toEqual(["b.js", "c.js"]);
  });

  it("reads working/waiting/ready off the dotted names too", () => {
    expect(foldState([ev("tool.call", { name: "Bash" })]).state).toBe("working");
    expect(foldState([ev("permission.request", {})]).state).toBe("waiting");
    const s = foldState([ev("session.ended", { turns: 3, costUsd: 0.5 })]);
    expect(s.state).toBe("ready");
    expect(s.cost).toBe(0.5);
  });

  it("shows a compaction as its own receipt instead of a gap", () => {
    const rows = foldEvents([ev("compaction", { preTokens: 620054, postTokens: 40120 })]);
    expect(rows[0]).toMatchObject({ kind: "note", text: "compacted — 620k → 40k" });
  });
});

// His bug, twice reported: *"at the end it always says you're thinking no matter what, even when
// I'm sure you're done."* A status has to die when the state it describes does.
// His ask, twice: *"I need an event to show in the chat that the model is different."* The chip
// says what is true NOW; the receipt says WHERE it changed, which is the question you have when you
// read back and the answers start sounding different.
describe("a model change is a moment in the conversation", () => {
  it("draws a receipt when the model changes", () => {
    const rows = foldEvents([
      ev("session.started", { model: "claude-fable-5" }),
      ev("assistant.text", { text: "hi", done: true }),
      ev("session.started", { model: "claude-opus-5[1m]" }),
    ]);
    const note = rows.find((r) => r.model);
    expect(note).toMatchObject({ kind: "note", text: "model — fable-5 → opus-5[1m]" });
  });

  it("says nothing when the session re-inits on the SAME model", () => {
    const rows = foldEvents([
      ev("session.started", { model: "claude-opus-5" }),
      ev("session.started", { model: "claude-opus-5" }),
    ]);
    expect(rows.some((r) => r.model)).toBe(false);
  });

  it("does not announce the model the conversation opened on", () => {
    const rows = foldEvents([ev("session.started", { model: "claude-opus-5" })]);
    expect(rows.some((r) => r.model)).toBe(false);
  });

  it("keeps the [1m] marker — a long-context variant is a different thing to talk to", () => {
    const rows = foldEvents([
      ev("session.started", { model: "claude-opus-5-20260101" }),
      ev("session.started", { model: "claude-opus-5-20260101[1m]" }),
    ]);
    expect(rows.find((r) => r.model).text).toBe("model — opus-5 → opus-5[1m]");
  });
});

describe("the cooking line does not outlive the turn", () => {
  it("clears `thinking` when the answer finishes", () => {
    const s = foldState([
      ev("user.prompt", { text: "hi" }),
      ev("assistant.thinking", { summary: "weighing two options" }),
      ev("assistant.text", { delta: "here you go", done: true }),
    ]);
    expect(s.doing).toBe(null);
    expect(s.state).toBe("ready");
  });

  it("stays working while the answer streams, and KEEPS naming the last thing — his call: the other panel always shows it", () => {
    const s = foldState([ev("assistant.thinking", {}), ev("assistant.text", { delta: "par" })]);
    expect(s.state).toBe("working");
    expect(s.doing).toBe("thinking");
  });

  it("holds the last command through its result and the writing after it", () => {
    const s = foldState([
      ev("tool.call", { tool: "Bash", summary: "run the tests" }),
      ev("tool.result", { ts: 2 }),
      ev("assistant.text", { delta: "they pass", ts: 3 }),
    ]);
    expect(s.state).toBe("working");
    expect(s.doing).toBe("run the tests");
  });

  it("but the name never outlives the TURN — done clears it", () => {
    const s = foldState([
      ev("tool.call", { tool: "Bash", summary: "run the tests" }),
      ev("tool.result", { ts: 2 }),
      ev("assistant.text", { done: true, text: "they pass", ts: 3 }),
    ]);
    expect(s.state).toBe("ready");
    expect(s.doing).toBe(null);
  });

  it("and his next message starts a clean line — no yesterday's command on a fresh turn", () => {
    const s = foldState([
      ev("tool.call", { tool: "Bash", summary: "run the tests" }),
      ev("user.prompt", { text: "now do the build", ts: 2 }),
    ]);
    expect(s.doing).toBe(null);
    expect(s.state).toBe("working");
  });

  it("says what it is actually thinking about when the host tells it", () => {
    expect(foldState([ev("assistant.thinking", { summary: "reading the scroll effect" })]).doing).toBe(
      "reading the scroll effect",
    );
    // …and falls back to the bare word, which the UI turns into the cycling animation.
    expect(foldState([ev("assistant.thinking", {})]).doing).toBe("thinking");
  });
});

// Visiting, in the new world: another agent reaches into this conversation through the CLI.
// "You can always see who's jumping in whose chat" — so the row has to carry who.
describe("a visiting agent's turn", () => {
  it("keeps the identity on the row instead of passing as the human", () => {
    const rows = foldEvents([{ kind: "text", text: "picking this up", ts: 1, mine: true, local: true, as: "autobot" }]);
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe("mine");
    expect(rows[0].as).toBe("autobot");
  });

  it("leaves his own turns unattributed", () => {
    const rows = foldEvents([{ kind: "text", text: "mine", ts: 1, mine: true, local: true }]);
    expect(rows[0].as).toBe(null);
  });
});

// The compaction bar has to mean something. A room's record count does not describe how full a
// Claude conversation is — the last turn's input tokens do.
describe("context, not records", () => {
  it("takes the NEWEST turn's input rather than summing them", () => {
    const s = foldState([
      ev("usage", { inputTokens: 40000 }),
      ev("usage", { inputTokens: 52000 }),
    ]);
    expect(s.ctx).toBe(52000);
  });

  it("counts cached input as context, because it is", () => {
    const s = foldState([ev("usage", { inputTokens: 1000, cacheReadInputTokens: 90000 })]);
    expect(s.ctx).toBe(91000);
  });

  it("is zero until the host says otherwise", () => {
    expect(foldState([ev("session.started", {})]).ctx).toBe(0);
  });

  // The real shape off the wire: `compactMetadata` carries preTokens and NO postTokens, and the
  // host's snapshot variable is not reset at the boundary — so the next receipt re-emits the
  // pre-compaction number. Left alone the bar reads exactly what it read before compacting.
  it("refuses the pre-compaction number when it arrives after the compaction", () => {
    const s = foldState([
      ev("usage", { contextTokens: 776000 }),
      ev("compaction", { trigger: "manual", preTokens: 783332 }),
      ev("usage", { contextTokens: 776000, turns: 1, ok: true }),
    ]);
    expect(s.ctx).toBe(0);
  });

  it("takes the first honest reading after it and stops refusing", () => {
    const s = foldState([
      ev("compaction", { preTokens: 783332 }),
      ev("usage", { contextTokens: 776000 }), // stale
      ev("usage", { contextTokens: 61000 }), // the real one
      ev("usage", { contextTokens: 84000 }), // growing again — not stale, must land
    ]);
    expect(s.ctx).toBe(84000);
  });

  // Autobot's 81c6213 emits `usage{snapshot:true}` off every parent assistant message so the bar
  // moves during a turn. Two things must NOT come with that: a turn that ends early, and a bill.
  it("moves the bar mid-turn without ending the turn", () => {
    const s = foldState([
      ev("assistant.text", { delta: "still going" }),
      ev("usage", { contextTokens: 61000, snapshot: true }),
    ]);
    expect(s.ctx).toBe(61000);
    expect(s.state).toBe("working");
  });

  it("only the receipt pays — a ruler tick never adds to the ledger", () => {
    const s = foldState([
      ev("usage", { contextTokens: 61000, snapshot: true, costUsd: 0.5 }),
      ev("usage", { contextTokens: 64000, snapshot: true, costUsd: 0.5 }),
      ev("usage", { contextTokens: 66000, costUsd: 0.5, turns: 1, ok: true }),
    ]);
    expect(s.cost).toBe(0.5);
  });

  it("does not defend a boundary that told us where it landed", () => {
    const s = foldState([
      ev("compaction", { preTokens: 783332, postTokens: 52000 }),
      ev("usage", { contextTokens: 790000 }),
    ]);
    expect(s.ctx).toBe(790000);
  });
});

// Stopping and compacting are moments in the conversation, not silences.
describe("interrupt and compaction", () => {
  it("stops working when he stops it, and says so", () => {
    const rows = foldEvents([ev("tool.call", { id: "1", name: "Bash" }), ev("interrupted", {})]);
    expect(rows.some((r) => r.kind === "note" && r.text === "interrupted")).toBe(true);
    const s = foldState([ev("tool.call", { id: "1", name: "Bash" }), ev("interrupted", {})]);
    expect(s.state).toBe("ready");
    expect(s.doing).toBe(null);
  });

  it("names compaction instead of cycling cooking words", () => {
    const s = foldState([ev("compacting", {})]);
    expect(s.doing).toBe("compacting the conversation");
  });

  it("empties the context meter when the host confirms the compaction", () => {
    const s = foldState([ev("usage", { inputTokens: 180000 }), ev("compaction", { preTokens: 180000 })]);
    expect(s.ctx).toBe(0);
    expect(s.state).toBe("ready");
  });

  // His description of what the browser's panel does and what he wants here: *"at the end of the
  // compaction it shows compacted — how much it went from and went to."* Same event, same numbers,
  // so the two windows he watches side by side say the identical sentence.
  it("prints the harness's own before and after numbers", () => {
    const rows = foldEvents([ev("compaction", { trigger: "manual", preTokens: 908318, postTokens: 9200 })]);
    expect(rows[0].text).toBe("compacted — 908k → 9k");
  });

  it("says auto when the harness compacted on its own", () => {
    const rows = foldEvents([ev("compaction", { trigger: "auto", preTokens: 620054, postTokens: 40120 })]);
    expect(rows[0].text).toBe("auto-compacted — 620k → 40k");
  });

  // The SDK usually omits postTokens. Autobot prints "fresh" and leaves it; the honest second number
  // arrives one turn later on the next usage event, so the receipt finishes itself.
  it("fills the second number from the next turn when the harness omits it", () => {
    const rows = foldEvents([
      ev("compaction", { preTokens: 620054 }),
      ev("usage", { contextTokens: 41500 }),
    ]);
    expect(rows[0].text).toBe("compacted — 620k → 42k");
  });

  // The host emits `usage` off EVERY result record, and some turns close with input_tokens 0 and no
  // cache reads — a refused slash command is exactly that shape. A zero is not an answer.
  it("keeps waiting through a zero-token turn rather than finishing at 0k", () => {
    const rows = foldEvents([
      ev("compaction", { preTokens: 620054 }),
      ev("usage", { contextTokens: 0, inputTokens: 0 }),
      ev("usage", { contextTokens: 41500 }),
    ]);
    expect(rows[0].text).toBe("compacted — 620k → 42k");
  });

  it("does not let a zero-token turn empty the meter", () => {
    const s = foldState([ev("usage", { contextTokens: 512000 }), ev("usage", { contextTokens: 0 })]);
    expect(s.ctx).toBe(512000);
  });

  it("stays true while the second number is still missing", () => {
    const rows = foldEvents([ev("compaction", { preTokens: 620054 })]);
    expect(rows[0].text).toBe("compacted — from 620k");
  });

  // A slash command is not a sentence. Left alone it draws a bubble reading "/compact" as though he
  // had said it to the agent.
  it("draws /compact as the compaction starting, not as a message", () => {
    const rows = foldEvents([ev("user.prompt", { text: "/compact" })]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "note", text: "compacting…" });
  });

  it("does not stack a note when the button and the host both report it", () => {
    const rows = foldEvents([ev("compacting", {}), ev("user.prompt", { text: "/compact" })]);
    expect(rows).toHaveLength(1);
  });

  // `/compact` on a short conversation is answered with a sentence and NO boundary event. The line
  // that says a compaction is underway must not outlive the agent saying it isn't.
  it("takes the compacting… line down when the agent answers instead", () => {
    const rows = foldEvents([
      ev("user.prompt", { text: "/compact" }),
      ev("assistant.text", { text: "Not enough messages to compact.", done: true }),
    ]);
    expect(rows.some((r) => r.text === "compacting…")).toBe(false);
    expect(rows[0]).toMatchObject({ kind: "say", text: "Not enough messages to compact." });
  });

  // Announced by autobot, not yet crossing the bridge. Additive: the heuristic beside it works today.
  it("says why a compaction failed instead of dropping it silently", () => {
    const rows = foldEvents([
      ev("compacting", {}),
      ev("status", { compactResult: "failed", compactError: "context still too large" }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "error", text: "compaction failed — context still too large" });
  });

  it("ends the turn on a compaction verdict so the line cannot spin forever", () => {
    const s = foldState([ev("compacting", {}), ev("status", { compactResult: "failed" })]);
    expect(s.state).toBe("ready");
    expect(s.doing).toBe(null);
  });

  it("narrates an auto compaction, which no prompt text could reveal", () => {
    const s = foldState([ev("status", { status: "compacting" })]);
    expect(s.doing).toBe("compacting the conversation");
  });

  it("replaces its own compacting… line rather than stacking a second row", () => {
    const rows = foldEvents([ev("compacting", {}), ev("compaction", { preTokens: 300000, postTokens: 20000 })]);
    expect(rows.filter((r) => r.kind === "note")).toHaveLength(1);
    expect(rows[0].text).toBe("compacted — 300k → 20k");
  });

  // `/compact` goes in as an ordinary user turn and nothing else is heard for a minute or two. The
  // cooking line has to name it, or the whole wait reads as generic stirring.
  it("names the wait when he types the slash command himself", () => {
    const s = foldState([ev("user.prompt", { text: "/compact" })]);
    expect(s.doing).toBe("compacting the conversation");
    expect(s.state).toBe("working");
  });
});

// THE RULER UNDER THE BAR. A hardcoded 200k pinned the meter at 100% on a 1M-window model — his
// session measured 907,478 cached input tokens in a single turn. The rule is autobot's, verbatim,
// because he watches both panels at once and two rulers would disagree on screen.
describe("the context window is measured, not assumed", () => {
  it("gives the 5-family a million", () => {
    expect(foldState([ev("session.started", { model: "claude-opus-5" })]).ctxWindow).toBe(1000000);
  });

  it("keeps the older models at 200k", () => {
    expect(foldState([ev("session.started", { model: "claude-sonnet-4-5" })]).ctxWindow).toBe(200000);
    expect(foldState([ev("session.started", { model: "claude-haiku-4-5" })]).ctxWindow).toBe(200000);
  });

  it("grows past whatever an unknown model has already carried, so the bar never pegs", () => {
    const s = foldState([ev("usage", { contextTokens: 907478 })]);
    expect(s.ctxWindow).toBeGreaterThanOrEqual(907478);
    expect(s.ctx / s.ctxWindow).toBeLessThanOrEqual(1);
  });

  // His report: *"why is the bar at the top red as if I need a compaction?"* Two ways the ruler
  // could shrink underneath a conversation, both of which peg the bar at 100%.
  // He has reported twice that interrupting a turn flips the bar to "compact now". I could not
  // reproduce the trigger, so I closed the one path that can produce a FALSE red: sizing the window
  // from a model name we merely overheard. Guessing SMALL turns an ordinary conversation into an
  // emergency; the costs are not symmetric.
  it("never sizes the window from a model it only overheard on a usage line", () => {
    const s = foldState([
      ev("session.started", {}),
      ev("usage", { contextTokens: 190000, model: "claude-sonnet-4-5" }),
    ]);
    expect(s.ctx / s.ctxWindow).toBeLessThan(0.9); // not an emergency
  });

  it("still trusts the model the session declares about itself", () => {
    const s = foldState([
      ev("session.started", { model: "claude-sonnet-4-5" }),
      ev("usage", { contextTokens: 190000 }),
    ]);
    expect(s.ctxWindow).toBe(200000);
    expect(s.ctx / s.ctxWindow).toBeGreaterThan(0.9); // a real small window, genuinely full
  });

  it("does not let a subagent's model redefine the conversation's window", () => {
    const s = foldState([
      ev("session.started", { model: "claude-opus-5" }),
      ev("usage", { contextTokens: 700000, model: "claude-haiku-4-5" }),
    ]);
    expect(s.model).toBe("claude-opus-5");
    expect(s.ctxWindow).toBe(1000000);
  });

  it("believes what it has WATCHED over what the model table claims", () => {
    const s = foldState([
      ev("session.started", { model: "claude-sonnet-4-5" }),
      ev("usage", { contextTokens: 640000 }),
    ]);
    expect(s.ctxWindow).toBeGreaterThanOrEqual(640000);
    expect(s.ctx / s.ctxWindow).toBeLessThanOrEqual(1);
  });

  it("still reports a genuinely full small window as full", () => {
    const s = foldState([
      ev("session.started", { model: "claude-sonnet-4-5" }),
      ev("usage", { contextTokens: 190000 }),
    ]);
    expect(s.ctxWindow).toBe(200000);
    expect(s.ctx / s.ctxWindow).toBeGreaterThan(0.9);
  });

  // THE BAR THAT COULD NOT ALARM. My unknown-model fallback added 15% headroom over whatever had
  // been seen, so the ratio capped at 1/1.15 = 0.87 while the red line is 0.90 — a gauge
  // structurally incapable of raising its own alarm, which is exactly what made his two panels
  // disagree: autobot's said compaction needed, mine said healthy, about one conversation.
  it("can actually reach its own alarm when the model is unknown", () => {
    const s = foldState([ev("session.started", {}), ev("usage", { contextTokens: 900000 })]);
    expect(s.ctx / s.ctxWindow).toBeGreaterThanOrEqual(CTX_DUE);
  });

  it("still never reads over 100%, however much it has carried", () => {
    const s = foldState([ev("session.started", {}), ev("usage", { contextTokens: 1400000 })]);
    expect(s.ctx / s.ctxWindow).toBeLessThanOrEqual(1);
  });

  it("stays quiet at an ordinary size rather than crying wolf", () => {
    const s = foldState([ev("session.started", {}), ev("usage", { contextTokens: 300000 })]);
    expect(s.ctx / s.ctxWindow).toBeLessThan(CTX_WARN);
  });

  // The whole point of asking autobot for it: a window the host states wins outright, so the two
  // panels divide the same two numbers and cannot disagree.
  it("prefers a window the host states over anything it would infer", () => {
    const s = foldState([
      ev("session.started", { model: "claude-opus-5", contextWindow: 500000 }),
      ev("usage", { contextTokens: 460000 }),
    ]);
    expect(s.ctxWindow).toBe(500000);
    expect(s.ctx / s.ctxWindow).toBeGreaterThanOrEqual(CTX_DUE);
  });

  // Caught by a real model switch in a browser: 300k observed on a 1M model, then a switch to a
  // 200k one. `max(stated, seen)` inflated the new window to 300k and the bar read comfortable
  // about a conversation that no longer fits. A stated window is the truth; over 100% is honest.
  it("believes a window the host states, even when it is smaller than what was seen", () => {
    const s = foldState([
      ev("session.started", { model: "claude-opus-5", contextWindow: 1000000 }),
      ev("usage", { contextTokens: 300000 }),
      ev("session.started", { model: "claude-haiku-4-5", contextWindow: 200000 }),
    ]);
    expect(s.ctxWindow).toBe(200000);
    expect(s.ctx / s.ctxWindow).toBeGreaterThan(1);
  });

  it("forgets the old model's high-water mark when the model changes", () => {
    const s = foldState([
      ev("session.started", { model: "claude-opus-5" }),
      ev("usage", { contextTokens: 900000 }),
      ev("session.started", { model: "claude-sonnet-4-5" }),
      ev("usage", { contextTokens: 150000 }),
    ]);
    expect(s.ctxWindow).toBe(200000);
  });

  it("takes autobot's contextTokens verbatim so both bars agree", () => {
    expect(foldState([ev("usage", { contextTokens: 512000, inputTokens: 12 })]).ctx).toBe(512000);
  });
});

// HIS CATCH: *"I see that you guys are jumping in each other's chat… but they're not rendering
// properly. It just says another cloud session sent a message, cross session message from — that's
// not rendering nicely. Autobot, just like identity. Come on now."* A peer's message arrives down
// the same pipe he types into, wrapped in a machine envelope. The envelope is machinery; the name
// is the point.
describe("a peer agent's message is a visit, not a wall of XML", () => {
  const wrapped = [
    "Another Claude session sent a message:",
    '<cross-session-message from="uds:/tmp/cc-socks/51502.sock" from-name="autobot-1d" from-mode="bypass">',
    "Read fresh from the tree just now — exact names, no guessing.",
    "</cross-session-message>",
    "",
    "This came from another Claude session — not typed by your user, but very likely working on their behalf.",
  ].join("\n");

  it("names the identity, not the socket and not the session suffix", () => {
    expect(parseVisitorTurn(wrapped)).toMatchObject({ as: "autobot" });
  });

  it("keeps the message and throws the envelope away", () => {
    const v = parseVisitorTurn(wrapped);
    expect(v.text).toBe("Read fresh from the tree just now — exact names, no guessing.");
    expect(v.text).not.toMatch(/cross-session-message|Another Claude session|on their behalf/);
  });

  it("renders as a named visit rather than as his own turn", () => {
    const rows = foldEvents([ev("user.prompt", { text: wrapped })]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "mine", as: "autobot" });
  });

  it("leaves an ordinary sentence completely alone", () => {
    expect(parseVisitorTurn("finish the transition")).toBe(null);
    const rows = foldEvents([ev("user.prompt", { text: "finish the transition" })]);
    expect(rows[0]).toMatchObject({ kind: "mine", as: null });
  });

  it("keeps a roster of everyone who has spoken, since a session has no holds to read", () => {
    const other = wrapped.replace(/autobot-1d/, "buapi-38");
    const s = foldState([ev("user.prompt", { text: wrapped }), ev("user.prompt", { text: other }), ev("user.prompt", { text: wrapped })]);
    expect(s.visitors).toEqual(["autobot", "buapi"]);
  });

  it("does not count him as a visitor in his own chat", () => {
    expect(foldState([ev("user.prompt", { text: "hey" })]).visitors).toEqual([]);
  });

  it("falls back to the address when nobody named themselves", () => {
    const bare = '<cross-session-message from="uds:/tmp/x.sock">hi</cross-session-message>';
    expect(parseVisitorTurn(bare)).toMatchObject({ as: "uds:/tmp/x.sock", text: "hi" });
  });
});

// A TERMINAL SLASH COMMAND'S RECEIPT — his ask, off /usage rendering as XML soup in a "mine"
// bubble: "make a nice display for commands like that that return." Two consecutive user records
// (command tags, then the printout) fold into ONE cmdret row; his own prose sharing a record with
// the tags keeps its row; and none of it may flip the panel to "working" — the HOST ran the
// command, the session never worked.
describe("slash-command receipts", () => {
  const nameRec =
    "<command-name>/usage</command-name>\n<command-message>usage</command-message>\n<command-args></command-args>";
  const outRec =
    "<local-command-stdout>Current session: 46% used\nCurrent week (Fable): 80% used</local-command-stdout>";

  it("folds the command record and its printout into one receipt", () => {
    const rows = foldEvents([ev("user.prompt", { text: nameRec }), ev("user.prompt", { text: outRec, ts: 2 })]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "cmdret", name: "/usage" });
    expect(rows[0].out).toMatch(/46% used/);
    expect(rows[0].out).toMatch(/80% used/);
    expect(rows[0].out).not.toMatch(/local-command-stdout/);
  });

  it("keeps the args when the command had them", () => {
    const rows = foldEvents([
      ev("user.prompt", {
        text: "<command-name>/model</command-name>\n<command-message>model</command-message>\n<command-args>claude-fable-5[1m]</command-args>",
      }),
    ]);
    expect(rows[0]).toMatchObject({ kind: "cmdret", name: "/model", args: "claude-fable-5[1m]" });
  });

  it("lets a printout with no command of its own stand alone — a mistyped command answers this way", () => {
    const rows = foldEvents([
      ev("user.prompt", { text: "<local-command-stdout>Unknown command: /usaage. Did you mean /usage?</local-command-stdout>" }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "cmdret", name: "" });
    expect(rows[0].out).toMatch(/Did you mean/);
  });

  it("keeps his prose when it shares a record with the tags — that part is still HIS turn", () => {
    const rows = foldEvents([
      ev("user.prompt", {
        text: `<local-command-caveat>generated by local commands</local-command-caveat>\n${nameRec}\n${outRec}\nso you get me?`,
      }),
    ]);
    const mine = rows.find((r) => r.kind === "mine");
    expect(mine).toBeTruthy();
    expect(mine.text).toBe("so you get me?");
    expect(mine.text).not.toMatch(/command-name|caveat|stdout/);
    expect(rows.find((r) => r.kind === "cmdret").out).toMatch(/46% used/);
  });

  it("does not flip the panel to working — the host ran it, the session did not", () => {
    const s = foldState([
      ev("assistant.text", { text: "done.", done: true }),
      ev("user.prompt", { text: nameRec, ts: 2 }),
      ev("user.prompt", { text: outRec, ts: 3 }),
    ]);
    expect(s.state).toBe("ready");
  });

  it("but prose riding along with a command IS him speaking, and the turn starts", () => {
    const s = foldState([
      ev("assistant.text", { text: "done.", done: true }),
      ev("user.prompt", { text: `${nameRec}\nnow fix the picker`, ts: 2 }),
    ]);
    expect(s.state).toBe("working");
  });
});

// THE STREAM, in the bridge's real shape (read from the emitter, not guessed): chunks are
// {kind:"assistant.text", delta, done:false}, the settle carries full `text` with done:true.
// His catch: "the agent panel is streaming the chat in and yours I don't see it until it fully
// comes in." The row must GROW, and the settle must REPLACE it — never print the answer twice.
describe("streaming assistant.text", () => {
  it("grows ONE row from delta chunks instead of dropping them", () => {
    const rows = foldEvents([
      ev("assistant.text", { delta: "Hel", done: false }),
      ev("assistant.text", { delta: "lo the", done: false, ts: 2 }),
      ev("assistant.text", { delta: "re", done: false, ts: 3 }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "say", text: "Hello there", settled: false });
  });

  it("lets the settled event REPLACE the grown row — one row, never a duplicate", () => {
    const rows = foldEvents([
      ev("assistant.text", { delta: "Hel", done: false }),
      ev("assistant.text", { delta: "lo", done: false, ts: 2 }),
      ev("assistant.text", { delta: "", done: true, text: "Hello", ts: 3 }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "say", text: "Hello", settled: true });
  });

  it("a second message in the same turn starts its own row after the first settles", () => {
    const rows = foldEvents([
      ev("assistant.text", { delta: "one", done: false }),
      ev("assistant.text", { delta: "", done: true, text: "one", ts: 2 }),
      ev("assistant.text", { delta: "two", done: false, ts: 3 }),
      ev("assistant.text", { delta: "", done: true, text: "two", ts: 4 }),
    ]);
    expect(rows.map((r) => r.text)).toEqual(["one", "two"]);
    expect(rows.every((r) => r.settled)).toBe(true);
  });

  it("streams thinking the same way, settled by its own event", () => {
    const rows = foldEvents([
      ev("assistant.thinking", { delta: "hm", done: false }),
      ev("assistant.thinking", { delta: "m", done: false, ts: 2 }),
      ev("assistant.thinking", { delta: "", done: true, text: "hmm", ts: 3 }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "think", text: "hmm", settled: true });
  });

  it("a replayed settled answer with no chunks still lands as before", () => {
    const rows = foldEvents([ev("assistant.text", { replay: true, text: "old answer", done: true })]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "say", text: "old answer", replay: true });
  });

  it("keeps the panel 'working' while chunks flow and 'ready' at the settle", () => {
    expect(foldState([ev("assistant.text", { delta: "Hel", done: false })]).state).toBe("working");
    expect(foldState([
      ev("assistant.text", { delta: "Hel", done: false }),
      ev("assistant.text", { delta: "", done: true, text: "Hello", ts: 2 }),
    ]).state).toBe("ready");
  });
});

// THE SEND IS THE TURN STARTING. The panel's local echo (kind "text", mine) had no foldState
// branch, so his own send left the panel "idle" until the round-trip — a second-plus in which the
// message looked like it hadn't gone through, while the host's panel showed cooking immediately.
describe("instant cooking on his own send", () => {
  it("flips to working the moment the local echo lands", () => {
    const s = foldState([
      ev("assistant.text", { text: "done.", done: true }),
      ev("text", { text: "run the tests", mine: true, local: true, ts: 2 }),
    ]);
    expect(s.state).toBe("working");
  });

  it("leaves an ASSISTANT settle of kind text alone — that still ends a turn, not starts one", () => {
    const s = foldState([ev("text", { text: "the answer" })]);
    expect(s.state).toBe("idle");
  });
});

// THE RECEIPT SAGA, both acts (see the fold's comment). Act one: the bridge's turn-end usage
// carried the SDK result's CUMULATIVE numbers — "2M / 1M · fable" on a 177k conversation — and a
// guard here refused any usage carrying turns/ok. Act two: autobot fixed the emitter (92dff33,
// crediting the find) — the receipt now carries lastCtxSnapshot, the honest per-assistant number,
// and since live sessions emit usage ONLY at turn boundaries, the guard froze this panel's ruler
// while autobot's moved: his catch, "agentci's context used to be aligned, now it's misaligned."
// The contract now: the receipt IS trusted; `contextTokens: null` is the bridge's explicit
// "no snapshot yet" and must not fall back to the cumulative inputTokens beside it.
describe("the turn-end usage receipt", () => {
  it("moves the ruler — it carries the bridge's honest snapshot since their fix", () => {
    const s = foldState([
      ev("usage", { contextTokens: 177000 }),
      ev("usage", { contextTokens: 191000, turns: 12, ok: true, costUsd: 1.5, ts: 2 }),
    ]);
    expect(s.ctx).toBe(191000);
    expect(s.cost).toBe(1.5);
  });

  it("but an explicit null snapshot moves nothing — and NEVER falls back to cumulative inputTokens", () => {
    const s = foldState([
      ev("usage", { contextTokens: 177000 }),
      ev("usage", { contextTokens: null, inputTokens: 2000000, turns: 3, ok: true, ts: 2 }),
    ]);
    expect(s.ctx).toBe(177000);
  });

  it("still believes a plain snapshot with no receipt fields at all", () => {
    expect(foldState([ev("usage", { contextTokens: 177000 })]).ctx).toBe(177000);
  });
});

// INTER-AGENT TRAFFIC IS FOLLOWABLE — his rule, and the app's name: whatever mechanism carries a
// message between agents, the RECORD must read in the chat as conversation you can follow back:
// who we messaged, what we said, and their reply as a named visitor turn. No workarounds, no
// mirror log — the transcript is the one pipeline and these rows are it rendered.
describe("messages to other agents", () => {
  it("folds a SendMessage call into a followable message row — recipient and words, not plumbing", () => {
    const rows = foldEvents([
      ev("tool.call", { id: "m1", name: "SendMessage", summary: "SendMessage",
        input: { to: "autobot-08", summary: "red-bar root cause", message: "your result usage is cumulative" } }),
      ev("tool.result", { id: "m1", ok: true, ts: 2 }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].xsend).toMatchObject({ to: "autobot-08", msg: "your result usage is cumulative" });
    expect(rows[0].summary).toBe("message → autobot-08 — red-bar root cause");
    expect(rows[0].state).toBe("ok");
  });

  it("leaves every other tool exactly as it was", () => {
    const rows = foldEvents([ev("tool.call", { id: "b", name: "Bash", summary: "run: ls", input: { command: "ls" } })]);
    expect(rows[0].xsend).toBeFalsy();
    expect(rows[0].summary).toBe("run: ls");
  });
});

// THE FOUR-BLOCKS BUG (his catch: "you're getting four blocks, two of each, every time you send a
// message"). A visitor message forwarded into the session goes out as "[identity]: text"; the host
// echoes that turn back wearing the raw prefix, which failed the visitor parse AND the dedupe —
// so it drew as HIS turn with "[systemview-test]:" in the text, beside the local echo. The wrap is
// our own protocol, so reading it back is the other half of it.
describe("the forwarded visitor's round trip", () => {
  it("parses the [identity]: wrap into a named visitor turn — never raw prefix soup", () => {
    expect(parseVisitorTurn("[systemview-test]: the hub is back up")).toMatchObject({
      as: "systemview-test",
      text: "the hub is back up",
    });
  });

  it("replaces the local echo when the host echoes the same forward — one block, attributed", () => {
    const rows = foldEvents([
      ev("text", { text: "the hub is back up", mine: true, local: true, as: "systemview-test" }),
      ev("user.prompt", { text: "[systemview-test]: the hub is back up", ts: 2 }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "mine", as: "systemview-test", text: "the hub is back up" });
    expect(rows[0].local).toBeFalsy();
  });

  it("leaves a plain sentence with no wrap exactly alone", () => {
    expect(parseVisitorTurn("just words [not a prefix] here")).toBe(null);
  });
});

// THE SANCTIONED CHANNEL DRAWS LIKE A MESSAGE TOO — his catch, right after the socket got its row:
// "now that you're using the right mechanism, I don't see a command when you actually sent those
// messages." A `systemview message-agent` was invisible twice over: the sandbox's `export PATH=… &&` prefix
// made the parser cut at the first && and see only the export, and even parsed it drew as a folded
// tool line. Now: leading env setup is skipped (trailing segments must be read-only filters or the
// line renders plain), and a parsed message-agent folds into the same MESSAGE row the socket sends get.
describe("systemview message-agent in the feed", () => {
  const line = 'export PATH="/x/bin:$PATH" && node cli/index.js message-agent autobot "the hub is back" --as systemview-test 2>&1 | tail -1';

  it("sees through the export prefix and the tail filter", () => {
    const rows = foldEvents([ev("tool.call", { name: "Bash", input: { command: line } })]);
    expect(rows[0].xsend).toMatchObject({ to: "autobot", msg: "the hub is back", about: "as systemview-test" });
    expect(rows[0].summary).toMatch(/^message → autobot/);
  });

  it("refuses a friendly row when something other than a filter rides behind the message", () => {
    const rows = foldEvents([
      ev("tool.call", { name: "Bash", input: { command: 'node cli/index.js message-agent autobot "hi" && rm -rf /tmp/x' } }),
    ]);
    expect(rows[0].xsend).toBeFalsy();
  });

  it("leaves every other sv verb rendering exactly as before", () => {
    const rows = foldEvents([
      ev("tool.call", { name: "Bash", input: { command: "export A=1 && systemview nav BUApp Users" } }),
    ]);
    expect(rows[0].xsend).toBeFalsy();
    expect(rows[0].sv).toMatchObject({ verb: "nav" });
  });
});

// TWO BUGS IN ONE LINE, both caught by him on autobot's FIRST message through the new model:
// *"there is a trace — the trace is that they ran a bash command."* Not a missing row: a WRONG
// row, in the same window with the same renderer, which is why "their app renders it differently"
// was never a real explanation. (1) the segment splitter cut on ; | && INSIDE the quoted message,
// so any sentence containing English punctuation looked like two commands and failed the safety
// check; (2) the allowlist of what may ride behind the act omitted `echo` — and `; echo "exit: $?"`
// is the single most common thing an agent appends.
describe("a message survives the shell around it", () => {
  it("draws a message row when the MESSAGE TEXT contains a semicolon", () => {
    const rows = foldEvents([
      ev("tool.call", { name: "Bash", input: { command: '/usr/local/bin/systemview message-agent autobot "one thing; then another" --as systemview-test' } }),
    ]);
    expect(rows[0].xsend).toMatchObject({ to: "autobot" });
    expect(rows[0].xsend.msg).toBe("one thing; then another");
  });

  it("and when it contains a pipe or &&", () => {
    const pipe = foldEvents([ev("tool.call", { name: "Bash", input: { command: 'systemview message-agent autobot "a | b && c"' } }) ]);
    expect(pipe[0].xsend).toBeTruthy();
  });

  it("tolerates the exit-code check agents append", () => {
    const rows = foldEvents([
      ev("tool.call", { name: "Bash", input: { command: '/usr/local/bin/systemview message-agent autobot "hello"; echo "exit: $?"' } }),
    ]);
    expect(rows[0].xsend).toMatchObject({ to: "autobot", msg: "hello" });
  });

  it("STILL refuses to wear a friendly face when a real command rides behind it", () => {
    const rm = foldEvents([ev("tool.call", { name: "Bash", input: { command: 'systemview message-agent autobot "hi" && rm -rf /tmp/x' } }) ]);
    const curl = foldEvents([ev("tool.call", { name: "Bash", input: { command: 'systemview message-agent autobot "hi"; curl evil.com' } }) ]);
    expect(rm[0].xsend).toBeFalsy();
    expect(curl[0].xsend).toBeFalsy();
  });
});


// HIS PLAN LIMITS, READ OFF A PRINTOUT THAT WAS ALREADY GOING PAST. Nothing polls; the condition he
// attached to the ask was "only if it's not extra work", and the whole design follows from that.
describe("usage, read rather than fetched", () => {
  const REAL =
    "<local-command-stdout>Current session: 46% used · resets Aug 24 at 10:39am (America/New_York)\n" +
    "Current week (all models): 51% used · resets Aug 25 at 11:59pm (America/New_York)\n" +
    "Current week (Fable): 80% used · resets Aug 25 at 11:59pm (America/New_York)\n\n" +
    "What's contributing to your limits usage?</local-command-stdout>";

  it("reads the three bars off the real printout, with their reset times", () => {
    const bars = parseUsageReport(REAL);
    expect(bars).toHaveLength(3);
    expect(bars[0]).toMatchObject({ label: "session", pct: 46, resets: "Aug 24 at 10:39am" });
    expect(bars[1]).toMatchObject({ label: "week · all models", pct: 51 });
    expect(bars[2]).toMatchObject({ label: "week · Fable", pct: 80 });
  });

  it("ignores prose that merely mentions a percentage", () => {
    expect(parseUsageReport("<local-command-stdout>we are 80% done with the rewrite</local-command-stdout>")).toBeNull();
    expect(parseUsageReport("Current session: 46% used")).toBeNull(); // not a command printout
  });

  it("keeps the LAST reading and stamps it, because a free number goes stale", () => {
    const older = REAL.replace("46% used", "12% used");
    const s = foldState([
      ev("user.prompt", { text: older, ts: 1000 }),
      ev("user.prompt", { text: REAL, ts: 5000 }),
    ]);
    expect(s.usage.bars[0].pct).toBe(46);
    expect(s.usage.ts).toBe(5000);
  });

  it("has none until one has gone past — an empty bar would be a claim", () => {
    expect(foldState([ev("session.started", {})]).usage).toBe(null);
  });

  it("still does not flip the panel to working — the host ran /usage, the session did not", () => {
    const s = foldState([
      ev("assistant.text", { text: "done.", done: true }),
      ev("user.prompt", { text: `<command-name>/usage</command-name><command-args></command-args>`, ts: 2 }),
      ev("user.prompt", { text: REAL, ts: 3 }),
    ]);
    expect(s.state).toBe("ready");
  });
});


// Autobot's find, run against my own file rather than assumed away: every file-path branch of a
// summariser bounds nothing when the path has no separators, and the row's headline is a LABEL.
describe("a card headline is a label too", () => {
  it("bounds the row summary however long the host's line or the path is", () => {
    const flood = "y".repeat(4000);
    const rows = foldEvents([
      ev("tool.call", { id: "a", name: "Edit", input: { file_path: flood } }),
      ev("tool.call", { id: "b", name: "Bash", summary: flood, input: { command: "ls" } }),
    ]);
    rows.forEach((r) => expect(r.summary.length).toBeLessThanOrEqual(141));
  });

  it("leaves the RECORD whole — the card unfolds the input, and that is the part that must not shrink", () => {
    const flood = "y".repeat(4000);
    const rows = foldEvents([ev("tool.call", { id: "a", name: "Bash", input: { command: flood } })]);
    expect(rows[0].input.command).toHaveLength(4000);
  });
});
