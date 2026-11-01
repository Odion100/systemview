import {
  KINDS,
  TRACK_KINDS,
  beadFor,
  emptyWords,
  floorFrom,
  headOf,
  progressFor,
  projectLines,
  reportStacks,
  stationsFor,
  tideOf,
  trackFor,
} from "./dashboardB.data";
// THE MAP IS ADDRESSED BY PROJECT AND ID, so the fixtures build their keys the way the page does.
import { docKey } from "../AgentChat/owed";

// THE FLOOR — and what is worth testing about a dashboard is not that it renders. It is that every
// number on it means what the module that owns that number means, and that the page cannot say
// "nothing to do" when the truth is "nothing was read". Those are the claims below.

const NOW = 1_700_000_000_000;
const DAY = 86400000;

const doc = (row, text) => ({ row: { project: "p", at: NOW - DAY, ...row }, text });

const RFC = (id, { claims = "" } = {}) =>
  doc(
    { id, kind: "rfc", path: `RFCs/${id}-a-thing.md`, state: { verdict: "approved" } },
    `::rfc{id=${id}}\n\n# ${id} — a thing\n\n${claims}`,
  );

// two claims, one met AND proved, one marked met with nothing behind it
const CLAIMS = [
  ":::claim[the first thing happens]{id=c1 state=met by=you at=1 note=\"saw it\"}",
  "::run{cmd=\"yarn test\"}",
  ":::",
  "::claim[the second thing happens]{id=c2 state=met by=you at=1 note=\"saw it\"}",
  "",
].join("\n");

const ARC = doc(
  { id: "ARC-001", kind: "arc", path: "RFCs/arcs/ARC-001-the-work.md", state: { verdict: "approved", objectives: { total: 3, planned: 0, complete: 0 } } },
  [
    '::arc{id=ARC-001 owner=p title="The work"}',
    "",
    ":::objective{id=O1 state=done owner=p}",
    "one",
    ":::",
    ":::objective{id=O2 state=doing owner=you}",
    "two",
    ":::",
    ':::objective{id=O3 state=blocked owner=p because="the hub has no door for it"}',
    "three",
    ":::",
    "",
  ].join("\n"),
);

const GAP_PROOF = doc({ id: "G-1", kind: "gap", path: "gaps/G-1-x.md", state: { hasProof: true } }, "::gap{id=G-1}\n");
const GAP_OPEN = doc({ id: "G-2", kind: "gap", path: "gaps/G-2-y.md", state: {} }, "::gap{id=G-2}\n");

const REPORT = (id, { retain = "14d", openedAt, project = "p" } = {}) =>
  doc(
    { id, kind: "report", project, path: `.systemview/report.${project}.${id}.md`, openedAt, state: { retain } },
    `::report{id=${id} retain=${retain}}\n\n# ${id}\n`,
  );

// ─── PROGRESS MEANS SOMETHING DIFFERENT PER KIND, AND IT IS NEVER RE-DERIVED ────────────────────

describe("progress comes from the module that owns it", () => {
  // The honest half of the claims count: `met` is marked AND proved, and the mark with nothing
  // behind it is said separately rather than folded in. Collapsing those two is the specific lie
  // this system exists to stop, so the dashboard must not quietly do it.
  it("an RFC's ring is met-and-proved claims, and the unproved mark is named not counted", () => {
    const p = progressFor(RFC("RFC-001", { claims: CLAIMS }), NOW);
    expect(p.ratio).toBe(0.5); // 1 of 2
    expect(p.says).toBe("1 of 2 claims met and proved");
    expect(p.warn).toBe("1 marked met with no proof");
  });

  // NULL IS A REAL ANSWER. An RFC with no claims list has no progress, and drawing it at 0% would
  // be the page inventing a failure that nobody reported.
  it("an RFC with no claims list has no ratio at all, not a zero", () => {
    const p = progressFor(RFC("RFC-002"), NOW);
    expect(p.ratio).toBe(null);
  });

  it("an arc's ring is its objectives, and a declared block is the warning", () => {
    const p = progressFor(ARC, NOW);
    expect(p.ratio).toBeCloseTo(1 / 3);
    expect(p.says).toBe("1 of 3 · 1 blocked"); // arcLine's own words
    expect(p.warn).toBe("1 blocked");
  });

  // A gap with the evidence already in the file is not two thirds fixed — it is FIXED and unsigned.
  it("a gap holding its proof already sits at half, and says so in gapRows' words", () => {
    expect(progressFor(GAP_PROOF, NOW).ratio).toBe(0.5);
    expect(progressFor(GAP_PROOF, NOW).says).toBe("open · proof ready");
    expect(progressFor(GAP_OPEN, NOW).ratio).toBe(0);
  });

  // THE CLOCK DOES NOT START UNTIL HE OPENS IT (RFC-076 §4.6) — the window measures his attention.
  it("a report's ring drains, and an unopened report's clock has not started", () => {
    const unopened = progressFor(REPORT("r1"), NOW);
    expect(unopened.drains).toBe(true);
    expect(unopened.counting).toBe(false);
    expect(unopened.says).toBe("retires 14 days after first read");

    const half = progressFor(REPORT("r2", { openedAt: NOW - 7 * DAY }), NOW);
    expect(half.ratio).toBeCloseTo(0.5, 2);
    expect(half.counting).toBe(true);
  });

  it("a document that could not be read says so, and gets no ratio", () => {
    const p = progressFor({ row: { id: "X", kind: "rfc", path: "a.md" } }, NOW);
    expect(p.unread).toBe(true);
    expect(p.ratio).toBe(null);
    expect(p.says).toBe("could not be read");
  });
});

// ─── A BEAD STANDS SOMEWHERE ───────────────────────────────────────────────────────────────────

describe("a bead", () => {
  it("stands at the station lifecycleState gives it, never at one of its own", () => {
    expect(beadFor(RFC("RFC-003"), {}, NOW).station).toBe("approved");
    expect(beadFor(doc({ id: "RFC-9", kind: "rfc", path: "a.md", state: {} }, "::rfc{id=RFC-9}\n"), {}, NOW).station).toBe("draft");
    expect(beadFor(doc({ id: "R", kind: "report", path: "a.md", state: { retired: true } }, "::report{id=R}\n"), {}, NOW).station).toBe("retired");
  });

  // ⚑ IS "A DECISION IS WAITING ON YOU" AND ⧗ IS A DEADLINE — the band's rule, which exists
  // because sharing one mark made it unreadable. One mark per bead: two marks is no mark.
  it("carries the mark of the loudest thing it owes, and only one", () => {
    const o = { [docKey({ project: "p", id: "RFC-004" })]: [{ group: "press", why: "approval", says: "Approve it?", line: 9, id: "RFC-004", project: "p" }] };
    const b = beadFor(RFC("RFC-004"), o, NOW);
    expect(b.mark).toBe("⚑");
    expect(b.line).toBe(9); // the press is one scroll away, not a file hunt
    const c = beadFor(RFC("RFC-005"), { [docKey({ project: "p", id: "RFC-005" })]: [{ group: "press", why: "clock", says: "retiring", line: 2, id: "RFC-005", project: "p" }, { group: "press", why: "approval", says: "x", line: 4, id: "RFC-005", project: "p" }] }, NOW);
    expect(c.mark).toBe("⧗");
  });

  it("falls back to the registration leaf when it owes nothing, so a click still lands", () => {
    expect(beadFor(RFC("RFC-006"), {}, NOW).line).toBe(1);
    expect(beadFor(ARC, {}, NOW).line).toBe(1);
  });
});

// ─── THE TRACKS ────────────────────────────────────────────────────────────────────────────────

describe("the tracks are the trails that already exist", () => {
  it("draws the kind's own trail, not one invented here", () => {
    expect(stationsFor("rfc")).toEqual(["draft", "approved", "built", "settled", "retired"]);
    expect(stationsFor("arc")).toEqual(["draft", "approved", "inProgress", "settled", "retired"]);
    expect(stationsFor("gap")).toEqual(["open", "resolved", "rejected", "retired"]);
  });

  // A REPORT DOES NOT PROGRESS, IT AGES. `filed → retired` is two stations and the second is its
  // death, so a report track would draw one pile and teach nothing. Reports get the stack instead.
  it("leaves reports off the tracks on purpose", () => {
    expect(TRACK_KINDS).toEqual(["rfc", "arc", "gap"]);
    expect(KINDS.map((k) => k.kind)).toContain("report");
  });

  // THE EMPTY STATION IS THE WHOLE VALUE OF THE PICTURE: the gap between a full `draft` column and
  // an empty `settled` one is the sentence "nothing is finishing", and dropping it deletes that.
  it("keeps every station even when nothing is standing there", () => {
    const beads = [beadFor(RFC("RFC-007"), {}, NOW)];
    const t = trackFor("rfc", beads);
    expect(t.stations.map((s) => s.station)).toEqual(["draft", "approved", "built", "settled", "retired"]);
    expect(t.stations.find((s) => s.station === "approved").beads).toHaveLength(1);
    expect(t.stations.find((s) => s.station === "settled").beads).toHaveLength(0);
  });

  // A rejected RFC is not on the rfc trail, and it must not vanish — it is the one state somebody
  // is most likely to reopen by accident, so it should be visible saying what it is.
  it("draws a station the trail does not list rather than losing the document", () => {
    const rejected = doc({ id: "RFC-008", kind: "rfc", path: "a.md", state: { verdict: "rejected" } }, "::rfc{id=RFC-008}\n");
    const t = trackFor("rfc", [beadFor(rejected, {}, NOW)]);
    expect(t.stations.map((s) => s.station)).toContain("rejected");
    expect(t.total).toBe(1);
  });
});

// ─── THE STACKS ────────────────────────────────────────────────────────────────────────────────

describe("the report stacks", () => {
  it("is one stack per project, and the pile about to lose something stands first", () => {
    const beads = [
      beadFor(REPORT("a", { project: "quiet" }), {}, NOW),
      beadFor(REPORT("b", { project: "quiet" }), {}, NOW),
      beadFor(REPORT("c", { project: "urgent", openedAt: NOW - 13.9 * DAY }), { [docKey({ project: "urgent", id: "c" })]: [{ group: "press", why: "clock", says: "retires in an hour", line: 1, id: "c", project: "urgent" }] }, NOW),
    ];
    const stacks = reportStacks(beads);
    expect(stacks.map((s) => s.project)).toEqual(["urgent", "quiet"]);
    expect(stacks[0].n).toBe(1);
    expect(stacks[0].urgent).toBe(1);
    expect(stacks[1].n).toBe(2);
  });

  it("holds only reports — the other kinds are on their tracks", () => {
    expect(reportStacks([beadFor(ARC, {}, NOW), beadFor(RFC("RFC-010"), {}, NOW)])).toEqual([]);
  });
});

// ─── THE TIDE ──────────────────────────────────────────────────────────────────────────────────

describe("the tide bar", () => {
  it("sorts every document by its posture toward him, retired first of all", () => {
    const beads = [
      { station: "approved", press: 1, work: 0 },
      { station: "approved", press: 0, work: 2 },
      { station: "settled", press: 0, work: 0 },
      { station: "retired", press: 1, work: 1 },
    ];
    const t = tideOf(beads);
    expect(t.map((x) => [x.key, x.n])).toEqual([
      ["press", 1],
      ["work", 1],
      ["clear", 1],
      ["parked", 1],
    ]);
    expect(t.reduce((s, x) => s + x.pct, 0)).toBeCloseTo(100);
  });

  it("is all zeroes and no NaN when there is nothing to show", () => {
    expect(tideOf([]).every((x) => x.n === 0 && x.pct === 0)).toBe(true);
  });
});

// ─── THE PROJECTS ──────────────────────────────────────────────────────────────────────────────

describe("every project the hub knows is on the page", () => {
  // A PROJECT WITH NOTHING REGISTERED IS A FACT, NOT AN ABSENCE. On this machine today one project
  // out of twelve carries documents, and a dashboard that drew only that one would be answering
  // "what is going on everywhere" with "everywhere I found something".
  it("lists projects with no documents, marked quiet", () => {
    const beads = [beadFor(RFC("RFC-011"), {}, NOW)];
    const lines = projectLines({ p: "/a/p", empty: "/a/empty" }, beads, NOW);
    expect(lines.map((l) => l.code).sort()).toEqual(["empty", "p"]);
    expect(lines.find((l) => l.code === "empty").quiet).toBe(true);
    expect(lines.find((l) => l.code === "p").quiet).toBe(false);
  });

  it("puts the project that needs him first, whatever its size", () => {
    const big = [1, 2, 3].map((n) => beadFor(RFC(`RFC-10${n}`), {}, NOW));
    const needy = beadFor(doc({ id: "RFC-200", kind: "rfc", path: "a.md", project: "needy", state: { verdict: "approved" } }, "::rfc{id=RFC-200}\n"), { [docKey({ project: "needy", id: "RFC-200" })]: [{ group: "press", why: "approval", says: "x", line: 1, id: "RFC-200", project: "needy" }] }, NOW);
    const lines = projectLines({ p: "", needy: "" }, [...big, needy], NOW);
    expect(lines[0].code).toBe("needy");
  });

  // `at` is when the SHELL LAST PARSED the document — the closest thing the system has to "is
  // anything happening here". Said as the parse it is, never as "last changed": a quiet repo and
  // an unwatched one look the same from here and only one of them is fine.
  it("says how long ago the newest parse in that project was", () => {
    const lines = projectLines({ p: "" }, [beadFor(RFC("RFC-012"), {}, NOW)], NOW);
    expect(lines[0].lastWords).toBe("a day ago");
    expect(projectLines({ e: "" }, [], NOW)[0].lastWords).toBe("");
  });
});

// ─── THE HEAD, AND THE THING IT MAY NEVER SAY ──────────────────────────────────────────────────

describe("the head sentence", () => {
  it("leads with the press, then the work nobody can press away", () => {
    const h = headOf({
      owed: { press: [{ n: 2 }, {}], work: [{}, {}, {}], counted: 9, skipped: {} },
      beads: [1, 2, 3],
      projects: [{ quiet: false, press: 3, work: 3 }, { quiet: true, press: 0, work: 0 }],
    });
    expect(h.segs.map((s) => s.text)).toEqual(["3 presses waiting on you", "3 outstanding"]);
    expect(h.reach).toBe("3 documents across 1 of 2 projects · 1 needs you");
  });

  // THAT ZERO IS THE ANSWER HE HAS NEVER BEEN ABLE TO GET, so it is said out loud when it is true.
  it("says nothing owed out loud when it really read something", () => {
    const h = headOf({ owed: { press: [], work: [], counted: 12, skipped: {} }, beads: [], projects: [] });
    expect(h.segs.map((s) => s.text)).toEqual(["nothing owed"]);
  });

  // AN EMPTY STATE THAT READS AS "NOTHING TO DO" WHEN IT MEANS "NOTHING WAS READ" IS THE LIE THIS
  // WHOLE SYSTEM EXISTS TO STOP. A zero over nothing measured is not a zero.
  it("refuses to call an unmeasured nothing a nothing", () => {
    const h = headOf({ owed: { press: [], work: [], counted: 0, skipped: {} }, beads: [], projects: [], total: 7 });
    expect(h.segs.map((s) => s.text)).toEqual(["nothing could be read — this is not a zero"]);
    // and an empty registry is a THIRD thing, said as itself rather than as either of the others
    const none = headOf({ owed: { press: [], work: [], counted: 0, skipped: {} }, beads: [], projects: [], total: 0 });
    expect(none.segs[0].text).toMatch(/the registry is empty/);
  });

  it("carries owed.js's own sentence about what was left out", () => {
    const h = headOf({ owed: { press: [], work: [], counted: 3, skipped: { unreadable: 2, gone: 1 } }, beads: [], projects: [] });
    expect(h.skipped).toBe("not counted: 1 row pointing at a file that is gone · 2 documents that could not be read");
  });
});

// ─── THE WHOLE FLOOR ───────────────────────────────────────────────────────────────────────────

describe("floorFrom", () => {
  const docs = [RFC("RFC-020", { claims: CLAIMS }), ARC, GAP_PROOF, GAP_OPEN, REPORT("r", { openedAt: NOW - 13.9 * DAY })];

  it("builds one bead per real document and places each on its kind's track", () => {
    const f = floorFrom({ docs, projects: { p: "/a/p" }, now: NOW });
    expect(f.beads).toHaveLength(5);
    expect(f.tracks.map((t) => [t.kind, t.total])).toEqual([
      ["rfc", 1],
      ["arc", 1],
      ["gap", 2],
    ]);
    expect(f.stacks[0].n).toBe(1);
  });

  // ONE RULE FOR A FIXTURE, IN ONE PLACE. `owed.js` excludes mock documents and proof fixtures and
  // COUNTS what it excluded; the tide and the tracks have to use the same test or the page will
  // show a bead for a document the obligations list deliberately dropped.
  it("drops the proof fixtures the obligations list drops, and says how many", () => {
    const f = floorFrom({
      docs: [...docs, doc({ id: "MOCK-RFC", kind: "rfc", path: "RFCs/proofs/mock-rfc.md", state: {} }, "::rfc{id=MOCK-RFC}\n")],
      projects: { p: "" },
      now: NOW,
    });
    expect(f.beads.map((b) => b.id)).not.toContain("MOCK-RFC");
    expect(f.fixtures).toBe(1);
  });

  // THE OBLIGATIONS ARE `owed.js`'s, ONE CALL OVER EVERY PROJECT AT ONCE — an arc's objectives can
  // be planned by a document in another repo, and `plansByObjective` resolves those by ADDRESS.
  // Splitting the call per project would report cross-repo plans as unplanned work he does not owe.
  it("reports the arc's blocked objective and his own objective as outstanding, unsplit by project", () => {
    const f = floorFrom({ docs, projects: { p: "" }, now: NOW });
    const whys = f.owed.work.map((w) => w.why);
    expect(whys).toContain("blocked");
    expect(whys).toContain("mine");
    expect(f.owed.press.map((p) => p.why)).toContain("proof"); // G-1's proof is in the file
    // and the bead knows what its own document owes, so the mark is on the right bead
    expect(f.beads.find((b) => b.id === "G-1").mark).toBe("⚑");
    expect(f.beads.find((b) => b.id === "G-2").mark).toBe("");
  });

  it("survives an empty registry without claiming the system is clear", () => {
    const f = floorFrom({ docs: [], projects: { a: "/a", b: "/b" }, now: NOW });
    expect(f.beads).toEqual([]);
    expect(f.head.segs.map((s) => s.text)).toEqual(["nothing is registered in any project — the registry is empty"]);
    expect(f.projects.every((p) => p.quiet)).toBe(true);
  });
});

// ─── THE THREE NOTHINGS ────────────────────────────────────────────────────────────────────────
//
// An empty list is three different facts wearing one blank space, and blurring them is the lie
// this whole system exists to stop: a real earned zero, a registry with nothing in it, and rows
// whose files would not open. One helper so three surfaces cannot drift apart about which is which.
describe("emptyWords", () => {
  it("tells an earned zero from an empty registry from an unread one", () => {
    expect(emptyWords({ total: 9, counted: 9 })).toBe("nothing owed");
    expect(emptyWords({ total: 0, counted: 0 })).toMatch(/the registry is empty/);
    expect(emptyWords({ total: 9, counted: 0 })).toMatch(/nothing could be read/);
  });
  it("has a short form for a column head, saying the same three things", () => {
    expect(emptyWords({ total: 9, counted: 9 }, "nothing", true)).toBe("nothing");
    expect(emptyWords({ total: 0, counted: 0 }, "nothing", true)).toBe("nothing is registered yet");
    expect(emptyWords({ total: 9, counted: 0 }, "nothing", true)).toMatch(/unmeasured/);
  });
});
