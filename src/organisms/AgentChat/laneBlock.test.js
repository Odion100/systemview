import { laneWork, laneFollow, laneChanges, laneFolds, laneFoldOrder, laneLiveness } from "./laneBlock";

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

  // A PLAN STEP IS NOT AN ANSWER. This is the line that killed the old version: a lane whose brief
  // had aged out and which had committed nothing printed its own step one, which on every lane is
  // the same boilerplate. He read `PLAN Read CLAUDE.md, system-context, and…` on the row and asked
  // what it was referring to — a document? — because it was referring to nothing.
  it("will NOT print a plan step — a step says where the lane is, never what it is for", () => {
    const w = laneWork({
      items: [
        { state: "active", text: "Read CLAUDE.md, system-context.md, and search the store" },
        { state: "pending", text: "cut the branch" },
      ],
    });
    expect(w.text).toBe("");
    expect(w.from).toBe("");
  });

  // AND IT ADMITS WHEN IT HAS NOTHING. Repeating the branch name in a second font would be the
  // guess he complained about, printed twice.
  it("says nothing rather than guessing from the branch name", () => {
    const w = laneWork({});
    expect(w.text).toBe("");
    expect(w.from).toBe("");
    expect(w.says).toMatch(/no brief held, nothing committed/);
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

describe("the sections — branch information and chat information never clutter each other", () => {
  // *"You got to separate the lanes and the chat, and make it so that they expand, so that I don't
  // get cluttered with the lane information when I want to see the chat, or the chat information
  // when I want to see the lane."*
  it("is the branch and the chat, in that order, when there is a chat", () => {
    expect(laneFolds({ chat: true }).map((f) => f.key)).toEqual(["branch", "chat"]);
  });

  // *"Not all of them have a chat, so unless you're going to keep the chat record until it's
  // deleted, why should it all say the chat?"* The log is session memory, so a lane with none has
  // no conversation to offer and the section would be a door onto nothing.
  it("drops the chat entirely when the lane has none", () => {
    expect(laneFolds().map((f) => f.key)).toEqual(["branch"]);
    expect(laneFolds({ chat: false }).map((f) => f.key)).toEqual(["branch"]);
  });

  // THE BRANCH IS ALWAYS THERE — it is what makes a lane a lane.
  it("always has the branch, whatever else is true", () => {
    for (const chat of [true, false]) expect(laneFolds({ chat })[0].key).toBe("branch");
  });

  // *"Stop automatically expanding any part of the lane when you open it up."* A lane's state is
  // not a question, and guessing it once slammed a section open under his hand on every open.
  it("decides NOTHING about what is open — that is his hand, not the lane's state", () => {
    for (const f of laneFolds({ chat: true })) expect(f.open).toBeUndefined();
  });

  // THE WHOLE BLOCK IS THE LANE — so the section is the BRANCH. A section called "the lane"
  // sitting inside a lane is the wrapper problem restated in words.
  it("names them for what they are, and neither is called the lane", () => {
    expect(laneFolds({ chat: true }).map((f) => f.label)).toEqual(["the branch", "the chat"]);
  });
});

describe("laneFoldOrder — what the BRANCH section holds", () => {
  // The log is not in here any more. It is the other fold, which is the separation itself: a
  // section list that still held "live" would put the conversation back inside the branch.
  it("never holds the log — that is the chat, and the split is the point", () => {
    for (const finished of [true, false]) {
      expect(laneFoldOrder({ finished })).not.toContain("live");
    }
  });
  it("leads with the changes once it has stopped — he came to review", () => {
    expect(laneFoldOrder({ finished: true })[0]).toBe("changes");
  });
  it("leads with what it is FOR while it runs — the changes are not final yet", () => {
    expect(laneFoldOrder({ finished: false })[0]).toBe("brief");
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
