import { briefLine, unseenCount, unseenSubagents } from "./unseenSubagents";

// NO SUBAGENT RUNS UNSEEN — his standing rule, proven against the shape the split actually produces.

const lane = (over = {}) => ({ source: "", brief: "", events: [], ...over });
const ev = (over = {}) => ({ kind: "tool.call", ts: 1, summary: "Bash", ...over });

describe("a subagent with no row is named", () => {
  // THE LIVE CASE. Two research subagents were spawned for a behaviour eval 2026-10-20; neither
  // called `worklist set`, so neither had a source, a run record, or a row. They ran, spent tokens,
  // read files, and no surface said so.
  it("names a subagent that never registered a lane", () => {
    const m = new Map([["toolu_1", lane({ brief: "Behaviour eval arm A\nuse the skill", events: [ev()] })]]);
    const rows = unseenSubagents(m, []);
    expect(rows).toHaveLength(1);
    expect(rows[0].parent).toBe("toolu_1");
    expect(rows[0].why).toBe("never registered a lane");
    expect(rows[0].brief).toBe("Behaviour eval arm A");
  });

  it("does NOT name one that registered and already has a row", () => {
    const m = new Map([["toolu_1", lane({ source: "lane:lane/x", events: [ev()] })]]);
    expect(unseenSubagents(m, ["lane:lane/x"])).toEqual([]);
  });

  // THE SECOND CAUSE, which needs a different answer from him: it DID register, and the row is still
  // missing — which means the run record went away. Saying "never registered" there would send him
  // looking for the wrong thing.
  it("names one that registered but whose row is gone, and says which fault it is", () => {
    const m = new Map([["toolu_1", lane({ source: "lane:lane/x", events: [ev()] })]]);
    const rows = unseenSubagents(m, ["lane:lane/other"]);
    expect(rows).toHaveLength(1);
    expect(rows[0].why).toMatch(/run record is missing/);
    expect(rows[0].source).toBe("lane:lane/x");
  });

  it("counts them, for a band that has to say a number", () => {
    const m = new Map([["a", lane({ events: [ev()] })], ["b", lane({ events: [ev()] })], ["c", lane({ source: "lane:lane/k" })]]);
    expect(unseenCount(m, ["lane:lane/k"])).toBe(2);
  });
});

describe("the row is legible, not just present", () => {
  it("shows the most recent tool call — what it is spending", () => {
    const m = new Map([["a", lane({ events: [ev({ summary: "Read" }), ev({ ts: 2, summary: "Grep docMembers" })] })]]);
    expect(unseenSubagents(m, [])[0].last).toBe("Grep docMembers");
  });

  it("falls back to what it last said when it has made no tool call", () => {
    const m = new Map([["a", lane({ events: [{ kind: "assistant.text", ts: 1, text: "  I looked at\nthe registry " }] })]]);
    expect(unseenSubagents(m, [])[0].last).toBe("I looked at the registry");
  });

  it("is empty-but-present when there is nothing to say, rather than inventing a label", () => {
    const m = new Map([["a", lane({ events: [{ kind: "assistant.thinking", ts: 1, text: "hm" }] })]]);
    const r = unseenSubagents(m, [])[0];
    expect(r.last).toBe("");
    expect(r.parent).toBe("a");
  });

  // A BRIEF IS A WHOLE PROMPT. A row that renders one is a row that has eaten the panel.
  it("takes the first non-blank line of the brief and truncates it", () => {
    expect(briefLine("\n\n  the first real line  \nand more")).toBe("the first real line");
    expect(briefLine("x".repeat(100))).toHaveLength(72);
    expect(briefLine("x".repeat(100)).endsWith("…")).toBe(true);
    expect(briefLine("")).toBe("");
    expect(briefLine(null)).toBe("");
  });

  it("keeps the full brief too, so the row can open to what scoped it", () => {
    const m = new Map([["a", lane({ brief: "line one\nline two" })]]);
    expect(unseenSubagents(m, [])[0].fullBrief).toBe("line one\nline two");
  });
});

describe("ordering and shapes it must survive", () => {
  // THE ONE STILL RUNNING is the one worth seeing, and activity is the only signal available.
  it("puts the most recently active first", () => {
    const m = new Map([
      ["old", lane({ events: [ev({ ts: 10 })] })],
      ["new", lane({ events: [ev({ ts: 99 })] })],
    ]);
    expect(unseenSubagents(m, []).map((r) => r.parent)).toEqual(["new", "old"]);
  });

  it("takes entries as an array as well as a Map, since the split may hand either", () => {
    expect(unseenSubagents([["a", lane({ events: [ev()] })]], [])).toHaveLength(1);
  });

  it("survives junk rather than taking the panel down with it", () => {
    expect(unseenSubagents(null, [])).toEqual([]);
    expect(unseenSubagents(undefined)).toEqual([]);
    expect(unseenSubagents(new Map([["a", null], [null, lane()]]), [])).toEqual([]);
    expect(unseenSubagents(new Map([["a", lane({ events: null })]]), [])[0].events).toBe(0);
  });

  it("ignores empty strings in the known-sources list rather than matching on them", () => {
    const m = new Map([["a", lane({ events: [ev()] })]]);
    expect(unseenSubagents(m, ["", null, undefined])).toHaveLength(1);
  });
});

describe("running or finished — the difference that makes the row worth seeing", () => {
  it("reads running when the spawning call has not returned", () => {
    const m = new Map([["a", lane({ events: [ev()] })]]);
    const r = unseenSubagents(m, [])[0];
    expect(r.state).toBe("running");
    expect(r.ended).toBe(false);
  });

  it("reads finished once the spawning call returned", () => {
    const m = new Map([["a", lane({ events: [ev()], ended: { ok: true, ts: 50 } })]]);
    const r = unseenSubagents(m, [])[0];
    expect(r.state).toBe("finished");
    expect(r.ended).toBe(true);
    expect(r.failed).toBe(false);
    expect(r.endedTs).toBe(50);
  });

  it("reads failed when it returned an error, because that is a different thing to look at", () => {
    const m = new Map([["a", lane({ events: [ev()], ended: { ok: false, ts: 9 } })]]);
    expect(unseenSubagents(m, [])[0].state).toBe("failed");
    expect(unseenSubagents(m, [])[0].failed).toBe(true);
  });

  // SILENCE IS NOT AN ENDING. A subagent thinking for two minutes emits nothing and is very much
  // alive, so the state comes only from the spawning call's result — never from events drying up.
  it("does not call a quiet subagent finished", () => {
    const m = new Map([["a", lane({ events: [] })]]);
    expect(unseenSubagents(m, [])[0].state).toBe("running");
  });

  it("an ended record with ts 0 still counts as ended — a result is a result", () => {
    const m = new Map([["a", lane({ events: [ev()], ended: { ok: true, ts: 0 } })]]);
    expect(unseenSubagents(m, [])[0].state).toBe("finished");
  });

  // A LIVE ONE OUTRANKS A FINISHED ONE however recently the finished one stopped.
  it("puts running ahead of finished, whatever the clock says", () => {
    const m = new Map([
      ["done", lane({ events: [ev({ ts: 999 })], ended: { ok: true, ts: 999 } })],
      ["live", lane({ events: [ev({ ts: 1 })] })],
    ]);
    expect(unseenSubagents(m, []).map((r) => r.parent)).toEqual(["live", "done"]);
  });
});
