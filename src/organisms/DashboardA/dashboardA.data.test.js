// THE DASHBOARD'S FOLD, HELD TO ITS ANSWERS. The component is a wire — it imports nothing jest
// cannot mount and makes no decision this file does not already make — so these are the page's
// real claims: the shared axis covers every trail, the two honest splits stay split, the report
// stack puts the thing about to be destroyed on top, and nothing is omitted silently.
import dashboard, {
  PHASES,
  MOVING_KINDS,
  docTitle,
  everyStationMapped,
  isEnding,
  phaseOf,
  readingLine,
  reportCard,
} from "./dashboardA.data";
import { TRAILS } from "../../atoms/Markdown/blocks/lifecycleState";

const HOUR = 3600000;
const DAY = 86400000;
const NOW = 1_700_000_000_000;

const rfcText = (n, { approval = true, met = 1, unproved = 1, unmet = 1 } = {}) => {
  const claims = [];
  // A PROVED CLAIM IS A CONTAINER WITH ITS PROOF INSIDE IT — four colons so the `:::run`'s own
  // close is not mistaken for the claim's (normalizeFences' rule: the outer fence is longer).
  for (let i = 0; i < met; i += 1)
    claims.push(`::::claim[met and proved ${i}]{id=m${i} state=met by=you note="shown"}\n:::run{title="p${i}"}\n- A.b {}\n:::\n::::`);
  for (let i = 0; i < unproved; i += 1) claims.push(`::claim[marked, nothing behind it ${i}]{id=u${i} state=met by=you note="said"}`);
  for (let i = 0; i < unmet; i += 1) claims.push(`::claim[not done ${i}]{id=x${i} state=unmet}`);
  return [
    `# RFC-0${n} — a design`,
    ``,
    `::rfc{id=RFC-0${n} title="a design"}`,
    ``,
    approval ? `:::approval{ask="ship the read path?"}\nsign it\n:::` : ``,
    ``,
    `## Claims`,
    ``,
    `::claims`,
    ``,
    claims.join("\n\n"),
  ].join("\n");
};

const arcText = `# ARC-001 — the body of work

::arc{id=ARC-001 owner=odion title="the body of work"}

:::objective{id=O1 owner=odion state=done title="first"}
done
:::

:::objective{id=O2 owner=odion state=blocked blocked="waiting on the hub" title="second"}
stuck
:::

:::objective{id=O3 owner=agent state=open title="third"}
open
:::
`;

const gapText = `# a gap in the other project

::gap{id=G-9 title="a gap in the other project"}

:::run{title="the fix, proved"}
- A.b {}
:::
`;

const reportText = (t) => `# ${t}\n\n::report{id=r retain=4h}\n\nan account.\n`;

// A registry row as `api/documentsRegistry.js` really hands it over: `{id kind path project at
// state}` plus the joined `openedAt`, and NO `title` — the hub's own whitelist never writes one.
const row = (over) => ({ at: NOW, project: "alpha", ...over });

const DOCS = () => [
  {
    row: row({ id: "RFC-071", kind: "rfc", path: "RFCs/RFC-071-a-design.md", state: { verdict: "approved", built: true, parsed: NOW } }),
    text: rfcText(71),
  },
  { row: row({ id: "RFC-072", kind: "rfc", path: "RFCs/RFC-072-a-draft.md", state: { parsed: NOW } }), text: rfcText(72, { approval: false }) },
  {
    row: row({ id: "ARC-001", kind: "arc", path: "RFCs/arcs/ARC-001-the-body.md", state: { verdict: "approved", objectives: { total: 3, done: 1, planned: 0, complete: 0 }, parsed: NOW } }),
    text: arcText,
  },
  { row: row({ id: "G-9", kind: "gap", project: "beta", path: "gaps/g-9.md", state: { hasProof: true, parsed: NOW } }), text: gapText },
  {
    row: row({ id: "soon", kind: "report", path: ".systemview/report.alpha.The-one-expiring.md", openedAt: NOW - 3 * HOUR, state: { retain: "4h", subtype: "account", parsed: NOW } }),
    text: reportText("The one expiring"),
  },
  {
    row: row({ id: "later", kind: "report", path: ".systemview/report.alpha.The-one-with-room.md", openedAt: NOW - HOUR, state: { retain: "30d", subtype: "account", parsed: NOW } }),
    text: reportText("The one with room"),
  },
  {
    row: row({ id: "unread", kind: "report", path: "meetings/2026-10-28-never-opened.md", state: { retain: "7d", subtype: "planning", parsed: NOW } }),
    text: reportText("Never opened"),
  },
  {
    row: row({ id: "forever", kind: "report", path: "meetings/2026-10-29-kept.md", openedAt: NOW - DAY, state: { retain: "permanent", subtype: "planning", parsed: NOW } }),
    text: reportText("Kept"),
  },
  // an ENDING — superseded, so it leaves the page entirely
  {
    row: row({ id: "gone", kind: "report", path: "meetings/old.md", state: { retired: true, retiredAs: "superseded", retain: "permanent", parsed: NOW } }),
    text: reportText("Superseded"),
  },
  // a PAUSE — retired with a reason that is not an ending, so it stays and says so
  {
    row: row({ id: "RFC-050", kind: "rfc", path: "RFCs/RFC-050-shelved.md", state: { retired: true, retiredAs: "shelf", verdict: "approved", parsed: NOW } }),
    text: rfcText(50, { approval: false, met: 1, unproved: 0, unmet: 0 }),
  },
  // a FIXTURE — hidden by default, counted always
  { row: row({ id: "MOCK-RFC-2", kind: "rfc", path: "RFCs/proofs/mock-rfc-2.md", state: { parsed: NOW } }), text: rfcText(99) },
  // a row whose file could not be read — carried, never swallowed
  { row: row({ id: "RFC-073", kind: "rfc", project: "beta", path: "RFCs/RFC-073-unreadable.md", state: { verdict: "approved", settled: true, parsed: NOW } }) },
];

const ROOTS = { alpha: "/repos/alpha", beta: "/repos/beta", gamma: "/repos/gamma" };
const run = (over = {}) => dashboard({ docs: DOCS(), roots: ROOTS, now: NOW, ...over });
const proj = (d, code) => d.projects.find((p) => p.code === code);
const mark = (d, id) => d.marks.find((m) => m.id === id);

describe("the shared axis", () => {
  it("gives every station of every trail a column — a trail gaining one must not silently stop being drawn", () => {
    expect(everyStationMapped()).toBe(true);
    Object.keys(TRAILS).forEach((kind) =>
      TRAILS[kind].forEach((station) => expect(PHASES.map((p) => p.id)).toContain(phaseOf(kind, station))),
    );
  });

  it("puts a BUILT rfc in moving and only a settled one in landed — built with unproved claims is not finished", () => {
    expect(phaseOf("rfc", "built")).toBe("moving");
    expect(phaseOf("rfc", "settled")).toBe("landed");
    expect(phaseOf("arc", "inProgress")).toBe("moving");
  });

  it("answers nothing for a station a kind does not have", () => {
    expect(phaseOf("report", "built")).toBe("");
    expect(phaseOf("nonsense", "draft")).toBe("");
  });

  it("keeps reports off the track — they decay, they do not travel", () => {
    expect(MOVING_KINDS).toEqual(["rfc", "arc", "gap"]);
    expect(run().marks.some((m) => m.kind === "report")).toBe(false);
  });
});

describe("titles, which the registry row does not carry", () => {
  it("reads the document's own heading and drops the number the row already says", () => {
    expect(docTitle({ path: "RFCs/RFC-071-a-design.md" }, rfcText(71))).toBe("a design");
  });
  it("falls back to the filename, with the write door's report prefix stripped", () => {
    expect(docTitle({ path: ".systemview/report.alpha.The-lane-harvest.md" })).toBe("The lane harvest");
    expect(docTitle({ path: "RFCs/arcs/ARC-004-the-thing.md" })).toBe("the thing");
  });
  it("prefers a row that does carry one", () => {
    expect(docTitle({ title: "from the row", path: "x.md" }, "# from the text")).toBe("from the row");
  });
});

describe("endings leave, pauses stay", () => {
  it("drops a superseded document and keeps a shelved one, saying which it is", () => {
    const d = run();
    expect(isEnding({ state: { retiredAs: "superseded" } })).toBe(true);
    expect(isEnding({ state: { retiredAs: "shelf" } })).toBe(false);
    expect(d.reports.some((r) => r.id === "gone")).toBe(false);
    expect(mark(d, "RFC-050").line).toMatch(/retired/);
    expect(d.totals.endings).toBe(1);
  });
});

describe("the two honest splits", () => {
  it("keeps marked-but-unproved claims as their own segment, never folded into met", () => {
    const bar = mark(run(), "RFC-071").bar;
    expect(bar).toEqual({ total: 3, done: 1, extra: 1, doneWord: "met", extraWord: "marked, unproved", unitWord: "claims" });
  });

  it("keeps an arc's blocked objectives as their own segment", () => {
    const bar = mark(run(), "ARC-001").bar;
    expect(bar).toEqual({ total: 3, done: 1, extra: 1, doneWord: "done", extraWord: "blocked", unitWord: "objectives" });
  });

  it("falls back to the row's cached parse when the file could not be read, and never invents a bar", () => {
    const m = mark(run(), "RFC-073");
    expect(m.bar).toBe(null); // the row carries no claims count either — silence, not a guess
    expect(m.station).toBe("settled");
    expect(mark(run(), "G-9").bar).toBe(null); // a gap has no interior to measure
  });

  it("clamps rather than drawing a bar past its own end", () => {
    const d = dashboard({
      docs: [{ row: row({ id: "RFC-09", kind: "rfc", path: "RFCs/RFC-09-x.md", state: { claims: { total: 2, met: 5, unproved: 9 }, parsed: NOW } }) }],
      roots: { alpha: "/a" },
      now: NOW,
    });
    expect(mark(d, "RFC-09").bar).toMatchObject({ total: 2, done: 2, extra: 0 });
  });
});

describe("the report stack", () => {
  it("puts the thing about to be destroyed on top, then the running clocks, then the unread, then permanent", () => {
    expect(proj(run(), "alpha").reports.map((r) => r.id)).toEqual(["soon", "later", "unread", "forever"]);
  });

  it("says the clock in retainLine's own words and never invents one", () => {
    const d = run();
    const by = (id) => d.reports.find((r) => r.id === id);
    expect(by("soon")).toMatchObject({ urgent: true, counting: true, clock: "retires in an hour" });
    expect(by("unread")).toMatchObject({ unread: true, counting: false, clock: "retires 7 days after first read" });
    expect(by("forever")).toMatchObject({ permanent: true, clock: "permanent" });
  });

  it("names an undeclared window as undeclared instead of showing a deadline", () => {
    const c = reportCard({ row: row({ id: "r", kind: "report", path: "x.md", state: {} }), text: "" }, NOW);
    expect(c).toMatchObject({ undeclared: true, clock: "", counting: false, left: null });
  });

  it("titles a card off its heading and carries its subtype", () => {
    expect(run().reports.find((r) => r.id === "soon")).toMatchObject({ title: "The one expiring", subtype: "account" });
  });
});

describe("what needs him is owed.js's answer, not a second one", () => {
  it("hangs each document's obligations on its own mark, grouped press and work", () => {
    const d = run();
    // BOTH HALVES OF THE HEAD, by key rather than by wording: the outstanding side is broken out
    // by what the work IS ("1 blocked", "4 with no plan") rather than lumped as one "outstanding",
    // because a segment is a filter now and a lump filters to everything-that-is-not-a-decision.
    const keys = d.head.segs.map((s) => s.key);
    expect(keys).toEqual(expect.arrayContaining(["approval"]));
    expect(keys.some((k) => ["mine", "blocked", "unplanned", "undecidable", "claims", "work"].includes(k))).toBe(true);
    expect(mark(d, "RFC-071").owes.map((o) => o.why)).toEqual(expect.arrayContaining(["approval", "claims"]));
    expect(mark(d, "RFC-071").press).toBe(1);
    expect(mark(d, "RFC-072").owes.map((o) => o.why)).toContain("undecidable");
    expect(mark(d, "G-9").owes.map((o) => o.why)).toContain("proof");
    expect(mark(d, "ARC-001").owes.map((o) => o.why)).toEqual(expect.arrayContaining(["blocked", "unplanned"]));
  });

  it("never counts a fixture as work he owes, even when fixtures are shown", () => {
    const shown = run({ fixtures: true });
    expect(mark(shown, "MOCK-RFC-2").fixture).toBe(true);
    expect(mark(shown, "MOCK-RFC-2").owes).toEqual([]);
    expect(shown.owed.skipped.fixtures).toBeGreaterThan(0);
  });

  it("counts a report's expiring clock into the project that holds it", () => {
    expect(proj(run(), "alpha").press).toBeGreaterThanOrEqual(1);
  });
});

describe("every project, including the ones with nothing in them", () => {
  it("draws a lane for a registered folder that has no documents, and says it is unregistered rather than clear", () => {
    const g = proj(run(), "gamma");
    expect(g.registered).toBe(0);
    expect(g.marks).toEqual([]);
    expect(g.reports).toEqual([]);
    expect(run().projects[run().projects.length - 1].code).toBe("gamma");
  });

  it("surfaces a project a registry row names that the roots map has never heard of", () => {
    const d = dashboard({
      docs: [{ row: row({ id: "RFC-1", kind: "rfc", project: "orphan", path: "RFCs/RFC-1-x.md", state: { parsed: NOW } }), text: rfcText(1) }],
      roots: {},
      now: NOW,
    });
    expect(proj(d, "orphan")).toMatchObject({ unknownRoot: true, registered: 1 });
  });

  it("orders lanes by what needs him, and puts the never-parsed folders last", () => {
    const codes = run().projects.map((p) => p.code);
    expect(codes.indexOf("alpha")).toBeLessThan(codes.indexOf("gamma"));
    expect(codes[codes.length - 1]).toBe("gamma");
  });

  it("counts the phases per lane so the mass is readable down the page", () => {
    const a = proj(run(), "alpha").phases;
    expect(a.proposed).toBe(1); // RFC-072, the draft
    expect(a.moving).toBe(1); // RFC-071, built with claims still owed
    expect(a.setdown).toBe(1); // RFC-050, shelved
  });
});

describe("nothing is omitted silently", () => {
  it("hides proof fixtures by default and reports the number either way", () => {
    expect(run().totals).toMatchObject({ fixtures: 1, showingFixtures: false });
    expect(mark(run(), "MOCK-RFC-2")).toBeUndefined();
    expect(mark(run({ fixtures: true }), "MOCK-RFC-2")).toBeDefined();
    expect(run({ fixtures: true }).totals.showingFixtures).toBe(true);
  });

  it("says what it read, out of what exists, in a sentence", () => {
    const d = run();
    expect(readingLine(d.totals)).toContain(`${d.totals.read} of ${d.totals.registered} documents read`);
    expect(readingLine(d.totals)).toContain("2 of 3 projects have anything registered");
    expect(readingLine(d.totals)).toContain("proof fixtures hidden");
  });

  it("says the registry is EMPTY rather than drawing a clear page", () => {
    expect(readingLine(dashboard({ docs: [], roots: ROOTS, now: NOW }).totals)).toMatch(/registry is empty/);
  });

  it("carries the lag — a row whose file moved since the last parse is marked, not trusted", () => {
    const d = dashboard({
      docs: [{ row: row({ id: "RFC-1", kind: "rfc", path: "RFCs/RFC-1-x.md", stale: true, state: { parsed: NOW } }), text: rfcText(1) }],
      roots: { alpha: "/a" },
      now: NOW,
    });
    expect(mark(d, "RFC-1").stale).toBe(true);
    expect(proj(d, "alpha").stale).toBe(1);
  });

  it("survives junk — no docs, no roots, no arguments at all", () => {
    expect(() => dashboard()).not.toThrow();
    expect(dashboard().projects).toEqual([]);
    expect(dashboard({ docs: [null, {}, { row: {} }] }).marks).toEqual([]);
  });
});
