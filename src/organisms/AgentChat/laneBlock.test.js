import { laneWork, laneFollow, laneChanges, laneFoldOrder, laneLiveness } from "./laneBlock";

// WHAT EACH SPEC IS DOING: holding the lane block's head to the thing he asked it for — *"know
// what the branch is and know what the work is. Not have to guess."* The branch was never the
// problem; it is on the row. These are the claims about the other half.

describe("laneWork — what the work is, and never a guess about it", () => {
  // THE BRIEF IS THE MOST DIRECT STATEMENT OF WHAT A LANE IS FOR that exists anywhere: it is the
  // prompt that scoped the subagent. It was two clicks down, inside a panel, behind a fold.
  it("leads with the brief — what somebody told the lane to do", () => {
    const w = laneWork({ brief: "Make the drawer rows expandable blocks\n\nDetails follow…" });
    expect(w.text).toBe("Make the drawer rows expandable blocks");
    expect(w.from).toBe("brief");
  });

  it("clips a brief whose first line is a paragraph — a row has a width", () => {
    const w = laneWork({ brief: `${"x".repeat(200)}\nsecond line` });
    expect(w.text.length).toBeLessThanOrEqual(72);
    expect(w.text.endsWith("…")).toBe(true);
  });

  // GIT OUTLIVES SESSION MEMORY. The brief is held in the session's event split and is gone after a
  // restart; the commit subjects are on disk forever, which is why they are the fallback and not
  // the headline.
  it("falls back to the newest commit's subject when no brief is held", () => {
    const w = laneWork({ brief: "", commits: [{ subject: "feat(band): rows become blocks" }, { subject: "wip" }] });
    expect(w.text).toBe("feat(band): rows become blocks");
    expect(w.from).toBe("commit");
  });

  it("prefers the brief over the commits, because the assignment outranks the progress", () => {
    const w = laneWork({ brief: "build the four things the lane row owes", commits: [{ subject: "wip" }] });
    expect(w).toMatchObject({ text: "build the four things the lane row owes", from: "brief" });
  });

  it("falls back to the plan's active step, and says that is what it is", () => {
    const w = laneWork({
      items: [{ state: "done", text: "read the band" }, { state: "active", text: "write the pure module" }],
    });
    expect(w.text).toBe("write the pure module");
    expect(w.from).toBe("plan");
    expect(w.says).toMatch(/nobody said what this lane is for/);
  });

  it("takes the first step when nothing is active — a lane that has not started still has a plan", () => {
    expect(laneWork({ items: [{ state: "pending", text: "cut the branch" }] }).text).toBe("cut the branch");
  });

  // AND IT ADMITS WHEN IT HAS NOTHING. Repeating the branch name in a second font would be the
  // guess he complained about, printed twice.
  it("says nothing rather than guessing from the branch name", () => {
    const w = laneWork({});
    expect(w.text).toBe("");
    expect(w.from).toBe("");
    expect(w.says).toMatch(/no brief, no commit, no plan/);
  });

  it("ignores a brief that is only whitespace, and a commit with an empty subject", () => {
    expect(laneWork({ brief: "   \n  ", commits: [{ subject: "  " }, { subject: "real one" }] })).toMatchObject({
      text: "real one",
      from: "commit",
    });
  });
});

describe("laneFollow — when the row may offer to follow a subagent", () => {
  it("offers it when a log is held and the run is still open", () => {
    expect(laneFollow({ events: [{ kind: "tool.call" }], finished: false })).toMatchObject({ has: true, can: true });
  });

  // THE CLOSED RUN WINS OVER THE EVENTS — laneCook's rule, for the same reason: a button that
  // follows nothing is worse than no button, and a finished lane offering a live view is a surface
  // testifying.
  it("refuses to offer a live view of a run that has closed, and says why", () => {
    const f = laneFollow({ events: [{ kind: "tool.call" }], finished: true });
    expect(f.can).toBe(false);
    expect(f.has).toBe(true); // the log is still worth READING — history, not a feed
    expect(f.why).toMatch(/closed/);
  });

  // The two causes want different things from him, so they are different sentences.
  it("names the cause when there is no log at all — this agent's own work, or a session that ended", () => {
    const f = laneFollow({ events: null });
    expect(f).toMatchObject({ has: false, can: false });
    expect(f.why).toMatch(/own work|session ended/);
    expect(laneFollow({ events: [] }).has).toBe(false);
    expect(laneFollow({}).can).toBe(false);
  });
});

describe("laneChanges — the changes as a count, because the diff is a thing he asks for", () => {
  it("counts the files and the commits", () => {
    expect(laneChanges({ files: [{ path: "a" }, { path: "b" }], commits: [{ hash: "1" }] }).text).toBe("2 files · 1 commit");
  });

  it("says nothing at all before the branch has been read — the caller owns the word for waiting", () => {
    expect(laneChanges({}).text).toBe("");
    expect(laneChanges({ files: null }).text).toBe("");
  });

  // A LANE WITH NO COMMITS IS THE NORMAL CASE. `base...branch` is empty for every lane that has
  // not committed, and "no changes" about a lane that has been writing files for an hour is a lie.
  it("distinguishes an uncommitted lane from a lane with nothing in it", () => {
    expect(laneChanges({ files: [], commits: [] }).text).toMatch(/worktree/);
  });

  it("carries a refusal through instead of reporting it as zero changes", () => {
    const c = laneChanges({ error: "systemview has no branch named lane/x — it belongs to another repo" });
    expect(c.text).toMatch(/another repo/);
    expect(c.tone).toBe("warn");
  });
});

describe("laneFoldOrder — the fold answers the question that brought him", () => {
  it("leads with the log while the lane is running — he came to watch", () => {
    expect(laneFoldOrder({ finished: false })[0]).toBe("live");
  });
  it("leads with the changes once it has stopped — he came to review", () => {
    expect(laneFoldOrder({ finished: true })[0]).toBe("changes");
  });
  // A fold whose contents come and go is a fold you have to search. Same sections, both states.
  it("holds the same sections either way", () => {
    expect([...laneFoldOrder({ finished: true })].sort()).toEqual([...laneFoldOrder({ finished: false })].sort());
  });
});

// ── IS IT ALIVE ───────────────────────────────────────────────────────────────────────────────
// The half that turns seeing into understanding. He can already read a fraction; what he cannot
// read is whether the thing is moving, and he has been answering that by watching a number fail
// to change.
describe("laneLiveness — elapsed, never a diagnosis", () => {
  const NOW = 1_700_000_000_000;
  const at = (msAgo) => ({ events: [{ ts: NOW - msAgo }], now: NOW });

  it("under a minute is working", () => {
    expect(laneLiveness(at(5_000))).toMatchObject({ text: "working", tone: "live" });
  });

  it("minutes are reported as minutes, and never as stalled", () => {
    // A subagent thinking is silent and alive. The number speaks; the words do not diagnose.
    expect(laneLiveness(at(4 * 60_000)).text).toBe("quiet 4m");
    expect(laneLiveness(at(4 * 60_000)).tone).toBe("");
    expect(laneLiveness(at(25 * 60_000))).toMatchObject({ text: "quiet 25m", tone: "warn" });
    expect(laneLiveness(at(3 * 3_600_000)).text).toBe("quiet 3h");
  });

  it("a closed run is finished, whatever its log last said", () => {
    expect(laneLiveness({ ...at(5_000), finished: true })).toMatchObject({ text: "closed", tone: "done" });
  });

  it("no log is an ABSENCE and says nothing — never a reassuring idle", () => {
    expect(laneLiveness({ events: null, now: NOW }).text).toBe("");
    expect(laneLiveness({ events: [], now: NOW }).text).toBe("");
    expect(laneLiveness({ events: [{}], now: NOW }).text).toBe("");
  });

  it("reads `at` as well as `ts`, and takes the newest event", () => {
    expect(laneLiveness({ events: [{ at: NOW - 600_000 }, { ts: NOW - 1_000 }], now: NOW }).text).toBe("working");
  });
});
