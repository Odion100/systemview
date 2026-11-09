import { ticksLanes, laneTicksIn } from "./laneTick";

// THE BUG THESE CLAIMS EXIST FOR, measured 2026-11-04: a run opened under
// `skill:skill-authoring` and its row did not appear in the drawer until he reloaded the page —
// *"I don't see any list down here… I refresh the page and there it is."*
//
// Two causes, one here. The host announced `run.started` before writing the record, so the window
// read disk too early and found nothing (fixed on that side). And the `todo.updated` that arrives
// AFTER the write was filtered out by this predicate, because its source was `skill:` rather than
// `lane:` — so nothing ever asked for a second read. A run nobody can see is held is the one thing
// runs exist to prevent.
describe("which events mean re-read the run files", () => {
  it("counts a sourced list write, whatever the source is", () => {
    expect(ticksLanes({ kind: "todo.updated", source: "skill:skill-authoring" })).toBe(true);
    expect(ticksLanes({ kind: "todo.updated", source: "job:proactive-development" })).toBe(true);
    expect(ticksLanes({ kind: "todo.updated", source: "lane:lane/x" })).toBe(true);
  });

  // THE ONE IT MUST NOT COUNT, and the reason is not noise: the session's own plan has no run
  // record at all, so re-reading disk for it asks a question the disk cannot answer. Its row is
  // drawn from the live event.
  it("does not count the session's own plan, which has no record to read", () => {
    expect(ticksLanes({ kind: "todo.updated" })).toBe(false);
    expect(ticksLanes({ kind: "todo.updated", source: "" })).toBe(false);
    expect(ticksLanes({ kind: "todo.updated", source: "   " })).toBe(false);
  });

  it("counts the four run events — including the two that were added after a miss each", () => {
    for (const kind of ["run.started", "run.finished", "run.updated", "lane.removed"]) {
      expect(ticksLanes({ kind })).toBe(true);
    }
  });

  it("counts nothing else, so an ordinary turn does not re-read the disk", () => {
    for (const kind of ["text", "tool.use", "permission.request", "compaction.pending", "say"]) {
      expect(ticksLanes({ kind })).toBe(false);
    }
    expect(ticksLanes(null)).toBe(false);
    expect(ticksLanes({})).toBe(false);
  });

  // The effect depends on this NUMBER, so it has to move when a qualifying event arrives and hold
  // still when one does not — a count that never changes is an effect that never fires again.
  it("the count moves on a qualifying event and holds on the rest", () => {
    const base = [{ kind: "text" }, { kind: "todo.updated", source: "" }];
    expect(laneTicksIn(base)).toBe(0);
    expect(laneTicksIn([...base, { kind: "todo.updated", source: "skill:x" }])).toBe(1);
    expect(laneTicksIn([...base, { kind: "todo.updated", source: "skill:x" }, { kind: "tool.use" }])).toBe(1);
    expect(laneTicksIn([...base, { kind: "run.started" }, { kind: "todo.updated", source: "job:y" }])).toBe(2);
  });

  it("answers for a caller with no events at all", () => {
    expect(laneTicksIn()).toBe(0);
    expect(laneTicksIn(null)).toBe(0);
    expect(laneTicksIn([])).toBe(0);
  });
});

// RFC-078 §2.8 — A CORRECTION ARRIVES. Added 2026-11-09 after a physical test: the manager
// assigned two real runs to this agent, `stripRuns` returned them first, and the band read
// "0 corrections". Every other event in this list rides something the session itself did, so a run
// handed to the agent from outside produced no tick and the row waited for an unrelated one.
describe("a run assigned by another agent", () => {
  it("asks for a re-read, because nothing in this session caused it", () => {
    expect(ticksLanes({ kind: "run.assigned", source: "correction:manager", runId: "r1" })).toBe(true);
  });

  it("counts toward the tick the effect depends on, beside the events it already watched", () => {
    expect(
      laneTicksIn([
        { kind: "message" },
        { kind: "run.assigned", source: "correction:manager" },
        { kind: "todo.updated", source: "" },
        { kind: "run.updated" },
      ]),
    ).toBe(2);
  });

  // THE LIST IS A WHITELIST AND HAS TO STAY ONE — a bare kind nobody declared must not tick, or
  // the window re-reads disk on every feed event in the session.
  it("does not open the door to anything that merely sounds like a run", () => {
    expect(ticksLanes({ kind: "run.assigned.maybe" })).toBe(false);
    expect(ticksLanes({ kind: "assigned" })).toBe(false);
  });
});
