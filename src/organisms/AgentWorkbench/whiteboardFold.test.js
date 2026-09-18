import { foldState, splitLaneEvents, LANE_LOG_CAP } from "./feedRows";

// The whiteboard's CONTENT rules (whole board every event, empty is the wipe) are pinned in
// feedRows.test.js. These pin the half that isn't: the WRITE TIMESTAMP, which the view compares to
// its own mount time to decide whether the board auto-opens — and the lane split, which keeps a
// delegated agent's traffic out of the owner's feed. The guard under test is one line:
// `if (s.whiteboard && !ev.replay && s.whiteboard !== wasBoard) s.whiteboardTs = ev.ts || 0`.
const ev = (kind, rest = {}) => ({ kind, ts: 1, ...rest });

describe("the whiteboard write timestamp — a replayed board is history, not news", () => {
  it("a live changed write stamps whiteboardTs with the event's time", () => {
    const s = foldState([ev("whiteboard.updated", { text: "## draft", ts: 42 })]);
    expect(s.whiteboard).toBe("## draft");
    expect(s.whiteboardTs).toBe(42);
  });

  it("a replay-marked event lands the content but never advances the stamp", () => {
    // The host re-emits the board on every query open with a FRESH ts — the flag is the only
    // thing standing between a history batch and the board popping open on attach.
    const s = foldState([ev("whiteboard.updated", { text: "## draft", ts: 42, replay: true })]);
    expect(s.whiteboard).toBe("## draft");
    expect(s.whiteboardTs).toBe(0);
  });

  it("re-emitting the same board live is not a write", () => {
    const s = foldState([
      ev("whiteboard.updated", { text: "same words", ts: 10 }),
      ev("whiteboard.updated", { text: "same words", ts: 20 }),
    ]);
    expect(s.whiteboardTs).toBe(10);
  });

  it("a genuine change after the re-emit advances the stamp again", () => {
    const s = foldState([
      ev("whiteboard.updated", { text: "first", ts: 10 }),
      ev("whiteboard.updated", { text: "first", ts: 20 }),
      ev("whiteboard.updated", { text: "second", ts: 30 }),
    ]);
    expect(s.whiteboard).toBe("second");
    expect(s.whiteboardTs).toBe(30);
  });

  it("a replayed board followed by its own live echo still reads as no write", () => {
    // Both guards have to hold at once: the replay half refuses the first event, the
    // content-changed half refuses the second — identical words are not a second write.
    const s = foldState([
      ev("whiteboard.updated", { text: "carried over", ts: 5, replay: true }),
      ev("whiteboard.updated", { text: "carried over", ts: 50 }),
    ]);
    expect(s.whiteboard).toBe("carried over");
    expect(s.whiteboardTs).toBe(0);
  });

  it("the wipe clears the board without claiming a write", () => {
    // An empty board is falsy, so the wipe can never stamp — the last REAL write stays the
    // answer to "when did someone last put something here".
    const s = foldState([
      ev("whiteboard.updated", { text: "up for review", ts: 10 }),
      ev("whiteboard.updated", { text: "", ts: 20 }),
    ]);
    expect(s.whiteboard).toBe("");
    expect(s.whiteboardTs).toBe(10);
  });
});

// RFC-059 — the basic split (parent-tagged → lane, untagged → main, source joined from the
// sourced set) is pinned in feedRows.test.js. These pin the edges: lanes stay separate, the
// join is strict about its prefix, and the log is a window, not a ledger.
describe("splitLaneEvents — the edges of the lane split", () => {
  it("keeps each parent's lane separate, sourced set included in its own log", () => {
    const { main, lanes } = splitLaneEvents([
      ev("tool.call", { name: "mcp__worklist__set", input: { source: "lane:test/a" }, parent: "t1" }),
      ev("tool.call", { name: "mcp__worklist__set", input: { source: "lane:refine/b" }, parent: "t2" }),
      ev("assistant.text", { text: "lane one speaking", parent: "t1" }),
    ]);
    expect(main).toHaveLength(0);
    expect(lanes.size).toBe(2);
    expect(lanes.get("t1").source).toBe("lane:test/a");
    expect(lanes.get("t2").source).toBe("lane:refine/b");
    // The set call is the lane's own event too — the join reads it, it doesn't consume it.
    expect(lanes.get("t1").events).toHaveLength(2);
    expect(lanes.get("t2").events).toHaveLength(1);
  });

  it("a source without the lane: prefix never becomes the lane's name", () => {
    // A subagent running a skill sends `source: "skill:study"` down the same pipe — that names
    // its procedure, not the lane, and taking it would mislabel the panel.
    const { lanes } = splitLaneEvents([
      ev("tool.call", { name: "mcp__worklist__set", input: { source: "skill:study" }, parent: "t1" }),
    ]);
    expect(lanes.get("t1").source).toBe("");
  });

  it("caps the per-lane log at LANE_LOG_CAP, dropping the oldest and keeping the join", () => {
    const events = [ev("tool.call", { name: "mcp__worklist__set", input: { source: "lane:test/a" }, parent: "t1", ts: 0 })];
    for (let i = 1; i <= LANE_LOG_CAP + 4; i += 1) events.push(ev("assistant.text", { text: `e${i}`, parent: "t1", ts: i }));
    const { lanes } = splitLaneEvents(events);
    const lane = lanes.get("t1");
    expect(lane.events).toHaveLength(LANE_LOG_CAP);
    // Oldest first out: the sourced set and the first four texts are gone, the newest survives.
    expect(lane.events[0].text).toBe("e5");
    expect(lane.events[lane.events.length - 1].text).toBe(`e${LANE_LOG_CAP + 4}`);
    // The join outlives the event it was read from — the name is captured, not looked up.
    expect(lane.source).toBe("lane:test/a");
  });
});
