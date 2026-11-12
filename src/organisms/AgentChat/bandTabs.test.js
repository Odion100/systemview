import { bandTabs, bandLabel, bandHead, withDefaultList, listKey, DEFAULT_LIST_KEY, readBandTab, writeBand, TAB_KEY, showsPlan, BAND_KINDS } from "./bandTabs";

// THE BAND'S THREE TABS ARE A FIXED ROW. His ruling, 2026-11-07, said once and then repeated per
// kind because I shipped only the first of them: *"the list should exist down there empty instead
// of disappearing"* → *"default list always"* → *"jobs, worklists, empty while they're still
// showing"* → *"lanes."*
//
// So the emptiness rule MOVED rather than died: it governs the rows inside a pane, each of which
// says what it has none of, instead of the existence of the pane. What a tabbed surface can still
// get wrong in a way he feels is the other direction — a tab bar that says there is work beside a
// pane that shows none — and the counts are what these claims hold to that.
describe("the work band is tabs — one per type of work", () => {
  it("draws every kind, whatever has rows, and carries each one's real count", () => {
    const { tabs } = bandTabs({ all: 2, jobs: 2, lanes: 0, skills: 0, assignment: 0, corrections: 0 });
    expect(tabs.map((t) => [t.key, t.n])).toEqual([["all", 2], ["jobs", 2], ["lanes", 0], ["skills", 0], ["assignment", 0], ["corrections", 0]]);
  });

  it("keeps the stored choice while it still has rows", () => {
    expect(bandTabs({ jobs: 1, lanes: 3 }, "lanes").active).toBe("lanes");
  });

  // THE OPPOSITE OF WHAT THIS CLAIM USED TO SAY, and the reversal is the ruling. It read "moves
  // off a tab whose rows are gone, instead of showing an empty pane" — which is exactly the
  // disappearing he rejected: the tab he was standing on jumped out from under him the moment a
  // run finished. An empty pane he chose is better than a pane he did not.
  it("STAYS on the tab he chose when its rows run out, and shows it empty", () => {
    expect(bandTabs({ jobs: 1, lanes: 0 }, "lanes").active).toBe("lanes");
  });

  // HIS RULING, 2026-11-07: *"the list should exist down there empty instead of disappearing…
  // default list always."* The band used to render nothing at all when nothing stood, which is a
  // surface you cannot put the first thing on.
  it("draws every kind with nothing standing at all — a surface you can put the first thing on", () => {
    const { tabs, active } = bandTabs({});
    expect(tabs.map((t) => [t.key, t.n])).toEqual([["all", 0], ["jobs", 0], ["lanes", 0], ["skills", 0], ["assignment", 0], ["corrections", 0]]);
    expect(active).toBe("all");
  });

  it("puts all first, then the kinds in the order the head reads them", () => {
    const { tabs } = bandTabs({ all: 4, jobs: 1, lanes: 1, skills: 1, assignment: 1, corrections: 1 });
    expect(tabs.map((t) => t.key)).toEqual(["all", "jobs", "lanes", "skills", "assignment", "corrections"]);
  });

  // THE BAND IS WORK IN FLIGHT, AND NOTHING ELSE — his ruling, 2026-11-06, once the dashboard
  // existed: *"all these documents being shown here are irrelevant… I would make it all about the
  // worklist. Work in flight."* Every kind the band grew through October — owed, reports and their
  // subtypes, RFCs, arcs, gaps — was asked for in its day and now lives on the dashboard. The
  // counts still ARRIVE (one object from one caller), so this is the claim that matters: a kind
  // BAND_KINDS does not name can never draw a tab, however many rows it reports.
  it("gives no tab to a kind that moved to the dashboard, however many rows it has", () => {
    const { tabs } = bandTabs({ owed: 3, reports: 9, rfcs: 4, arcs: 2, gaps: 7 });
    expect(tabs.map((t) => t.key)).toEqual(["all", "jobs", "lanes", "skills", "assignment", "corrections"]);
    expect(tabs.every((t) => t.n === 0)).toBe(true);
  });

  it("and a stored key from the document era falls through to the work that is running", () => {
    // FALLS THROUGH TO THE FIRST TAB, which is now `all` rather than `jobs` — the point of the
    // assertion is that a stored key naming a tab that no longer exists cannot leave the band on
    // nothing, not which tab catches it.
    expect(bandTabs({ all: 1, jobs: 1, reports: 9 }, "reports").active).toBe("all");
    expect(bandTabs({ jobs: 1, reports: 9 }, "reports:spec").active).toBe("all");
    expect(bandTabs({ jobs: 1, owed: 3 }, "owed").active).toBe("all");
  });

  it("speaks the head's own words, singular and plural", () => {
    expect(bandLabel("job", 1)).toBe("1 job");
    expect(bandLabel("lanes", 3)).toBe("3 lanes");
    expect(bandLabel("all", 1)).toBe("1 run");
    expect(bandLabel("all", 4)).toBe("4 runs");
  });

  // ── THE LANE TAB HOLDS TWO KINDS ────────────────────────────────────────────────────────────
  // His ask, 2026-11-01: a subagent with no branch gets the lane's row shape, and the tab reads as
  // two sections. The bug underneath it was arithmetic: `lanes` counted REGISTERED lanes only, so
  // two lane-less subagents and no lanes scored 0, the tab was deleted by the emptiness rule, and
  // the render gate (`active === "lanes"`) could never be true. The rows and their chats existed
  // and nothing on screen could reach them — the exact opposite of "no subagent runs unseen".
  it("gives the lane tab to a running subagent even with no lane registered at all", () => {
    const { tabs, active } = bandTabs({ lanes: { lanes: 0, subagents: 2 } }, "");
    // The tab exists either way now; what this still holds is the COUNT — the one that was 0 and
    // deleted the tab, leaving two running subagents nothing on screen could reach.
    expect(tabs.find((t) => t.key === "lanes").n).toBe(2);
    expect(active).toBe("all");
  });

  it("has a lane tab reading zero when neither kind stands, and keeps him on it", () => {
    const { tabs, active } = bandTabs({ lanes: { lanes: 0, subagents: 0 } }, "lanes");
    expect(tabs.find((t) => t.key === "lanes").n).toBe(0);
    expect(active).toBe("lanes");
  });

  it("counts every row in the pane, so the number cannot disagree with what opening it shows", () => {
    expect(bandTabs({ lanes: { lanes: 1, subagents: 2 } }).tabs.find((t) => t.key === "lanes").n).toBe(3);
  });

  // THE COUNT THAT BUYS THE TAB AND THE WORDS ON IT ARE NOT THE SAME CLAIM. A subagent with no
  // branch has no run record and nothing to diff, so "3 lanes" over one lane and two subagents
  // would trade an invisible row for a false one. The label names both instead.
  it("names both kinds rather than counting a subagent as a lane", () => {
    const t = bandTabs({ lanes: { lanes: 1, subagents: 2 } }).tabs.find((x) => x.key === "lanes");
    expect(bandLabel(t.key, t.n, t.parts)).toBe("1 lane · 2 subagents");
  });

  it("collapses to one kind's words when only one kind stands", () => {
    const lane = (c) => bandTabs({ lanes: c }).tabs.find((t) => t.key === "lanes");
    const only = lane({ lanes: 0, subagents: 2 });
    expect(bandLabel(only.key, only.n, only.parts)).toBe("2 subagents");
    const lanesOnly = lane({ lanes: 3, subagents: 0 });
    expect(bandLabel(lanesOnly.key, lanesOnly.n, lanesOnly.parts)).toBe("3 lanes");
    expect(bandLabel("lanes", 1, { lanes: 1, subagents: 0 })).toBe("1 lane");
    // With no parts at all the tab is the zero one, and it says so rather than naming a section.
    expect(bandLabel("lanes", 0)).toBe("0 lanes");
  });

  // A plain number still works — every other kind passes one, and the lane tab did until today.
  it("takes the lane count as a plain number too", () => {
    expect(bandTabs({ lanes: 2 }).tabs.find((t) => t.key === "lanes").n).toBe(2);
    expect(bandLabel("lanes", 2)).toBe("2 lanes");
  });

  // Reports' object fans OUT into tabs; the lane tab's folds IN. Opposite meanings, same shape —
  // so this is the claim that widening one did not widen the other.
  // THE OBJECT COUNT THAT SURVIVED THE CUT. Two kinds used to arrive as an object and they meant
  // opposite things — a report subtype became its own tab, a lane-less subagent becomes a SECTION
  // inside the lane tab. Only the second one is left, so it is worth claiming on its own.
  it("still folds the lane tab's two parts into one tab, ignoring a document count beside it", () => {
    const { tabs } = bandTabs({ lanes: { lanes: 1, subagents: 1 }, reports: { "": 1, spec: 2 } });
    expect(tabs.map((t) => t.key)).toEqual(["all", "jobs", "lanes", "skills", "assignment", "corrections"]);
    const lane = tabs.find((t) => t.key === "lanes");
    expect(lane.n).toBe(2);
    expect(lane.parts).toEqual({ lanes: 1, subagents: 1 });
  });

  it("survives a storage that refuses to answer — private mode is not an error", () => {
    const hostile = { getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("denied"); } };
    expect(readBandTab(hostile)).toBe("");
    expect(() => writeBand(TAB_KEY, "lanes", hostile)).not.toThrow();
  });
});

// TWO FAMILIES IN ONE BAND. Work that is running, and documents in a folder — the second group is
// the one that becomes configurable, and the band has to carry the distinction before anything can
// render it. Reports sits in it by default because of where it lives, not because it is special.
describe("a tab says which family it belongs to", () => {
  it("calls every kind work", () => {
    const { tabs } = bandTabs({ all: 3, jobs: 1, skills: 1, lanes: 1 });
    // DERIVED, NOT COUNTED — a sixth kind should not break an assertion about families. What this
    // claims is that EVERY tab declares one and that it is `work`, which is the actual contract.
    expect(tabs.length).toBeGreaterThan(0);
    expect(tabs.every((t) => t.family === "work")).toBe(true);
  });

  it("has one family left, because one kind of thing is left", () => {
    const { tabs } = bandTabs({ jobs: 1, lanes: 1, lists: 1 });
    expect(tabs.every((t) => t.family === "work")).toBe(true);
    expect(bandTabs({ reports: 1, rfcs: 1, arcs: 1, gaps: 1, owed: 1 }).tabs.every((t) => t.family === "work")).toBe(true);
  });

  it("carries the family through alongside the count, so the render needs no second lookup", () => {
    const tab = bandTabs({ jobs: 4 }).tabs.find((t) => t.key === "jobs");
    expect(tab).toMatchObject({ key: "jobs", n: 4, family: "work" });
  });
});

// ── THE CLOSED BAND'S ONE LINE ─────────────────────────────────────────────────────────────────
// The head spent a week saying what was OWED; the same ruling that took the document tabs out took
// that with it. It answers one question now — is anything running right now — and every word is
// derived from the rows the tabs count, so the line and the pane can never disagree.
describe("the head speaks work-state", () => {
  it("names what is running, in the order the tabs sit in", () => {
    expect(bandHead({ jobs: 1, lanes: 2, subagents: 1, runs: 3 }).map((s) => s.text)).toEqual([
      "1 job running",
      "2 lanes out",
      "1 subagent running",
      "3 runs open",
    ]);
  });

  it("says nothing about what it does not have", () => {
    expect(bandHead({ lanes: 1 }).map((s) => s.text)).toEqual(["1 lane out"]);
  });

  // A MEASURED ZERO, and not a door: the band can render with nothing moving — finished runs he
  // has not cleared, a whiteboard with no work beside it — and a button opening a tab that does
  // not exist is a press that answers nothing.
  it("says nothing in flight when nothing is, and that segment opens no tab", () => {
    const [only] = bandHead({});
    expect(only.text).toBe("nothing in flight");
    expect(only.tab).toBe("");
    expect(bandHead().length).toBe(1);
  });

  it("every other segment names the tab it opens", () => {
    for (const s of bandHead({ jobs: 1, lanes: 1, subagents: 1, runs: 1 })) {
      expect(["all", "jobs", "lanes", "skills", "assignment", "corrections"]).toContain(s.tab);
    }
  });

  // A subagent is not a lane and the head keeps them apart, the same way the tab's label does.
  it("counts a subagent separately from a lane, because they are not the same thing", () => {
    expect(bandHead({ lanes: 0, subagents: 2 }).map((s) => s.text)).toEqual(["2 subagents running"]);
  });
});

// ── THE DEFAULT LIST ALWAYS HAS A ROW ──────────────────────────────────────────────────────────
// His ruling, 2026-11-07, after watching it appear only once this session wrote one: *"default
// list always… I don't know why the default list is ever disappearing."* The plan is the session's
// own working memory — no source, no nudge, no run record — and it is what the drawer is for.
describe("the default list always has a row", () => {
  it("synthesises an empty one when the session has no plan", () => {
    expect(withDefaultList([])).toEqual([
      // `muted` is on the synthesised row for the same reason every other field is: the plan is a
      // list he can mute, so a row that cannot carry the state would draw the toggle permanently
      // off whatever the record says.
      { key: DEFAULT_LIST_KEY, source: "", items: [], status: null, attachments: null, muted: null },
    ]);
  });

  it("keeps the real one untouched when there is one — items, record and all", () => {
    const plan = { key: "sess", source: "", items: [{ id: "1" }], status: { text: "x" }, attachments: [1] };
    expect(withDefaultList([plan])).toEqual([plan]);
  });

  // A plan with nothing on it must not outrank work that is actually moving, so it goes last.
  it("puts the synthesised one at the END, behind the runs that are moving", () => {
    const run = { key: "r1", source: "job:x", items: [{ id: "1" }] };
    const rows = withDefaultList([run]);
    expect(rows[0]).toBe(run);
    expect(rows[1].source).toBe("");
  });

  it("does not add a second one when the session's plan is already empty", () => {
    const empty = { key: "sess", source: "", items: [] };
    expect(withDefaultList([empty])).toEqual([empty]);
  });

  it("answers for a caller that hands it nothing at all", () => {
    expect(withDefaultList().length).toBe(1);
    expect(withDefaultList(null).length).toBe(1);
  });
});

// THE DUPLICATE HE SAW, measured 2026-11-07 in his own band: `📋1/3 default` twice, two identical
// rows for one plan. The session's plan reaches this surface from two places — the session FILE on
// disk (owned `session-<slot>-<uuid>`) and the live `todo.updated` (keyed "session") — and the row
// key was derived from the owner by cutting `run:` off the front, which only ever made sense for a
// run. Keyed apart, the live row could not overwrite the disk row, so both stood.
describe("a sourceless row is the plan, whichever side it arrived from", () => {
  it("collapses the session file and the live event onto one key", () => {
    expect(listKey("", "ion-systemview-test-7225a2d7")).toBe(DEFAULT_LIST_KEY);
    expect(listKey("", "session")).toBe(DEFAULT_LIST_KEY);
    expect(listKey(undefined, undefined)).toBe(DEFAULT_LIST_KEY);
  });

  it("leaves a sourced run keyed by its own record, because each run is its own row", () => {
    expect(listKey("skill:walkthrough", "rmw5csmoe00")).toBe("rmw5csmoe00");
    expect(listKey("job:proactive-development", "rmw72vbyu00")).toBe("rmw72vbyu00");
    expect(listKey("lane:lane/x", "abc")).toBe("abc");
  });

  // And the key it collapses onto is the one `withDefaultList` synthesises, or the plan would be
  // drawn twice again the moment the disk row and the synthesised row met.
  it("agrees with the key the synthesised row carries", () => {
    const [synth] = withDefaultList([]);
    expect(synth.key).toBe(listKey("", "session"));
  });
});

describe("a correction is a run, and it gets its own tab", () => {
  // WHY NOT `lists`: a list is what THIS agent decided to do; a correction is somebody else's
  // judgment of its work, opened as a run owned by the agent that owes it. Same shape, different
  // question — so the pane is separate and the tab stands even at zero, like the other three.
  it("counts correction runs, and says it in the band's own words", () => {
    const { tabs } = bandTabs({ corrections: 3 });
    expect(tabs.find((t) => t.key === "corrections").n).toBe(3);
    expect(bandLabel("corrections", 1)).toBe("1 correction");
    expect(bandLabel("corrections", 3)).toBe("3 corrections");
  });

  it("stands with nothing owed, because the pane is where the first one lands", () => {
    const owed = bandTabs({ all: 6, jobs: 3, lanes: 2, skills: 1 }).tabs.find((t) => t.key === "corrections");
    expect(owed).toBeTruthy();
    expect(owed.n).toBe(0);
    expect(owed.family).toBe("work");
  });
});


// ── AN OPEN RUN IS NOT NEUTRAL ─────────────────────────────────────────────────────────────────
// His correction, 2026-11-09: "the header says open run… that should actually show in a not a
// neutral color." Every other segment of that line names work RUNNING; this one names work that
// has stalled — steps left and nobody moving them — which is the one state the drawer exists to
// catch. The words were already right; drawn in the same grey as the rest they read as part of an
// all-fine summary.
describe("the head's open-run segment carries a tone", () => {
  it("marks open runs and nothing else", () => {
    const segs = bandHead({ jobs: 2, lanes: 1, subagents: 1, runs: 3 });
    const toned = segs.filter((s) => s.tone);
    expect(toned.map((s) => [s.key, s.tone])).toEqual([["runs", "open"]]);
  });

  it("is the renderer's hook and not its decision — the tone rides the segment", () => {
    const [seg] = bandHead({ runs: 1 });
    expect(seg).toMatchObject({ key: "runs", tone: "open", text: "1 run open" });
  });

  it("opens the all tab, since the everything-else tab it used to open is gone", () => {
    expect(bandHead({ runs: 4 })[0].tab).toBe("all");
  });

  it("says nothing when no run is open — a tone on a zero would be a warning about nothing", () => {
    expect(bandHead({ jobs: 1 }).some((s) => s.tone)).toBe(false);
    expect(bandHead({}).some((s) => s.tone)).toBe(false);
  });
});

// ---- THE PLAN LEADS `runs`, AND APPEARS NOWHERE ELSE (2026-11-09) ----------------------------
// His correction: "make the default list show at the top of runs only… and then it can go away
// from the other tabs." It had been pinned below every pane, which repeated one sourceless row
// under five headings that each promise to be about one KIND of work.
describe("showsPlan — the session's own plan belongs to the runs tab alone", () => {
  it("shows on `all`, the tab that already shows every list", () => {
    expect(showsPlan("all")).toBe(true);
  });

  it("and on no other kind's tab — a list with no source has no kind", () => {
    for (const t of ["jobs", "lanes", "skills", "assignment", "corrections"])
      expect(showsPlan(t)).toBe(false);
  });

  it("nothing active, nothing invented", () => {
    // The band renders no tabs at all when everything is empty (`active: ""`), and a plan drawn
    // against no active tab would be a row with no pane to sit in.
    expect(showsPlan("")).toBe(false);
    expect(showsPlan(null)).toBe(false);
    expect(showsPlan(undefined)).toBe(false);
  });

  it("every tab the band can draw is covered by this rule, one way or the other", () => {
    // THE GUARD THAT SURVIVES A NEW KIND: a tab added to BAND_KINDS gets an answer here without
    // anybody remembering to come back, and the only `true` is the one that is meant to be.
    const answered = BAND_KINDS.map((k) => k.key).filter((k) => showsPlan(k));
    expect(answered).toEqual(["all"]);
  });
});

// A READ THAT DIED IS NOT AN EMPTY PROJECT — measured 2026-11-12, when the door answered 64 rows
// for his project and every tab in his band read 0 with "nothing in flight" above them.
describe("the head says when it could not read", () => {
  it("names the failure instead of asserting nothing is in flight", () => {
    const segs = bandHead({ jobs: 0, lanes: 0, runs: 0, read: "no transport — the window is not attached to a session yet" });
    expect(segs).toHaveLength(1);
    expect(segs[0].key).toBe("unread");
    expect(segs[0].text).toMatch(/can't read the runs/);
    expect(segs[0].text).toMatch(/not attached/);
  });

  it("is the LOUD tone, because it is a thing to act on and not a status", () => {
    expect(bandHead({ read: "boom" })[0].tone).toBe("open");
  });

  it("says nothing in flight only when the read actually SUCCEEDED and found nothing", () => {
    expect(bandHead({ read: "ok" })[0].key).toBe("clear");
    expect(bandHead({})[0].key).toBe("clear");
  });

  it("a successful read with work in it is unaffected", () => {
    expect(bandHead({ runs: 2, read: "ok" }).map((s) => s.key)).toEqual(["runs"]);
  });
});
