import { owedFrom, owedHead, skippedLine, isFixture, leafLine } from "./owed";

// WHAT IS OWED BY HIM — and the only thing that makes this surface worth more than the count it
// replaces is that it does not lie. The count it replaces was wrong in BOTH directions at once:
// three MOCK fixtures counted as decisions he owed, and every clock, blocked objective, unplanned
// objective and drifted claim in the system invisible. So the claims here are mostly about honesty:
// what is in, what is out, what was left out and SAID so.

const doc = (row, text) => ({ row: { project: "p", ...row }, text });
const says = (list) => list.map((x) => `${x.id} · ${x.says}`);

const NOW = 1_700_000_000_000;
const DAY = 86400000;

describe("the two groups", () => {
  // PRESS means your signature finishes it. OUTSTANDING means nobody can press it away. That is
  // the split, and it is the shape of the question he asked — "what is owed by me, and what do I
  // press" is two questions with two answers.
  it("an unsigned approval is a press; a signed one is nothing", () => {
    const o = owedFrom({
      docs: [
        doc({ id: "RFC-1", kind: "rfc", path: "RFCs/RFC-001-x.md", state: { verdict: "approved" } },
          '::rfc{id=RFC-1}\n\n:::approval{ask="Approve the plan?" verdict=approved}\nx\n:::\n'),
        doc({ id: "RFC-2", kind: "rfc", path: "RFCs/RFC-002-y.md", state: { verdict: "approved" } },
          '::rfc{id=RFC-2}\n\n:::approval{ask="Is this the complete list of claims?"}\nx\n:::\n'),
      ],
      now: NOW,
    });
    expect(o.press).toHaveLength(1);
    expect(o.press[0].id).toBe("RFC-2");
    expect(o.work).toEqual([]);
  });

  // THE ASK IS THE ROW'S WORDS. "1 approval waits on your verdict" is true of every unsigned
  // approval in the system, so it cannot tell him which one to open. The question somebody wrote on
  // the block can.
  it("one unsigned approval says what it is asking, several say how many", () => {
    const one = owedFrom({
      docs: [doc({ id: "R", kind: "rfc", path: "a.md", state: { verdict: "approved" } },
        '::rfc{id=R}\n:::approval{ask="Approve the migration plan?"}\n:::\n')],
      now: NOW,
    });
    expect(one.press[0].says).toBe("Approve the migration plan?");
    const two = owedFrom({
      docs: [doc({ id: "R", kind: "rfc", path: "a.md", state: { verdict: "approved" } },
        '::rfc{id=R}\n:::approval{ask="a"}\n:::\n:::approval{ask="b"}\n:::\n')],
      now: NOW,
    });
    expect(two.press[0].says).toBe("2 approvals wait on your verdict");
    expect(two.press[0].n).toBe(2);
  });

  // THE LINE IS THE BLOCK'S, so the row can point at the thing rather than at the file.
  it("the row carries the line of the block it is about", () => {
    const o = owedFrom({
      docs: [doc({ id: "R", kind: "rfc", path: "a.md", state: { verdict: "approved" } },
        ['::rfc{id=R}', "", "prose", "", ':::approval{ask="x" verdict=approved}', ":::", "", ':::approval{ask="y"}', ":::"].join("\n"))],
      now: NOW,
    });
    expect(o.press[0].line).toBe(8);
  });

  // A FENCED EXAMPLE IS A QUOTATION. This repo's RFCs quote their own vocabulary constantly —
  // RFC-073 holds an approved `:::approval` inside a ```markdown fence — and counting one would put
  // a phantom obligation on the band.
  it("an approval inside a fence is a document teaching the vocabulary, not one holding a decision", () => {
    const o = owedFrom({
      docs: [doc({ id: "R", kind: "rfc", path: "a.md", state: { verdict: "approved" } },
        ['::rfc{id=R}', "", "```markdown", ':::approval{ask="this is how you write one"}', ":::", "```", ""].join("\n"))],
      now: NOW,
    });
    expect(o.press).toEqual([]);
    expect(o.work).toEqual([]);
  });

  it("a gap whose proof is already in the file is one press from resolved", () => {
    const o = owedFrom({
      docs: [
        doc({ id: "G-1", kind: "gap", path: "gaps/g1.md", state: { hasProof: true } }, "::gap{id=G-1}\n"),
        doc({ id: "G-2", kind: "gap", path: "gaps/g2.md", state: {} }, "::gap{id=G-2}\n"),
      ],
      now: NOW,
    });
    expect(says(o.press)).toEqual(["G-1 · the proof is in the file — one press from resolved"]);
  });
});

describe("the clock — the one obligation that destroys something by waiting", () => {
  const report = (over, openedAt) =>
    doc({ id: "REP", kind: "report", path: ".systemview/report.p.x.md", openedAt, state: { retain: "12h", ...over } },
      "::report{id=REP retain=12h}\n");

  it("a report whose window is nearly up is a press", () => {
    const o = owedFrom({ docs: [report({}, NOW - 11 * 3600000)], now: NOW });
    expect(o.press).toHaveLength(1);
    expect(o.press[0].says).toMatch(/retires in .* — keep it or let it go/);
  });

  // THE WINDOW MEASURES HIS ATTENTION, so it has not started until he has opened it once. A report
  // nobody has read is not about to be destroyed — it is waiting to be read.
  it("a clock he has never started is not a clock", () => {
    expect(owedFrom({ docs: [report({}, undefined)], now: NOW }).press).toEqual([]);
  });

  it("permanent never runs out", () => {
    expect(owedFrom({ docs: [report({ retain: "permanent" }, NOW - 500 * DAY)], now: NOW }).press).toEqual([]);
  });

  it("a window with ages left is not yet his problem", () => {
    expect(owedFrom({ docs: [report({ retain: "30d" }, NOW - DAY)], now: NOW }).press).toEqual([]);
  });

  // WAITING DESTROYS — nothing else here does. So the clock leads the press group, and the clock
  // closest to running out leads the clocks.
  it("the clock outranks the approval, and the nearest clock leads", () => {
    const o = owedFrom({
      docs: [
        doc({ id: "RFC-9", kind: "rfc", path: "a.md", state: { verdict: "approved" } }, '::rfc{id=RFC-9}\n:::approval{ask="x"}\n:::\n'),
        report({}, NOW - 11 * 3600000),
        doc({ id: "REP2", kind: "report", path: "b.md", openedAt: NOW - 11.9 * 3600000, state: { retain: "12h" } }, "::report{id=REP2}\n"),
      ],
      now: NOW,
    });
    expect(o.press.map((x) => x.id)).toEqual(["REP2", "REP", "RFC-9"]);
  });
});

describe("an arc — what it is owed that no count ever said", () => {
  const ARC = [
    "::arc{id=ARC-001 title=\"an rfc you can check\"}",
    "",
    ':::objective{id=O1 title="the leaf" state=done}',
    ":::",
    ':::objective{id=O2 title="the registry" owner=you state=doing}',
    ":::",
    ':::objective{id=O3 title="the sweep" state=blocked blocked="waiting on his ruling about folders"}',
    ":::",
    ':::objective{id=O4 title="the drawer"}',
    ":::",
    ':::approval{ask="Approve the arc?" verdict=approved}',
    ":::",
  ].join("\n");
  const arcRow = { id: "ARC-001", kind: "arc", path: "RFCs/arcs/ARC-001-x.md", state: { verdict: "approved" } };

  // THE BLOCKED REASON IS THE ROW'S WORDS. `blocked=` is the one state written rather than derived,
  // on the grounds that it is a statement about the world — and that statement was a hover title on
  // one block inside one file. The band head was silent about the only declared blocked objective
  // in the system.
  it("names the blocked objective and WHY, which was a hover title before", () => {
    const o = owedFrom({ docs: [doc(arcRow, ARC)], now: NOW });
    const blocked = o.work.find((x) => x.why === "blocked");
    expect(blocked.says).toBe("blocked — waiting on his ruling about folders — the sweep");
    expect(blocked.tail).toBe("ARC-001-O3");
    expect(blocked.line).toBe(7);
  });

  it("an objective of HIS leads the outstanding group", () => {
    const o = owedFrom({ docs: [doc(arcRow, ARC)], now: NOW });
    expect(o.work[0].why).toBe("mine");
    expect(o.work[0].says).toBe("yours, and doing — the registry");
  });

  // BLOCKED WINS OVER OWNERSHIP, because it says more: an objective of his that is also stuck needs
  // the obstacle named, not a second row saying it is his.
  it("an objective that is his AND blocked gets one row, the blocked one", () => {
    const o = owedFrom({
      docs: [doc(arcRow, '::arc{id=ARC-001}\n:::objective{id=O1 owner=you state=blocked blocked="the hub"}\n:::\n:::approval{verdict=approved}\n:::\n')],
      now: NOW,
    });
    expect(o.work.filter((x) => x.tail === "ARC-001-O1")).toHaveLength(1);
    expect(o.work[0].why).toBe("blocked");
  });

  it("a blocked objective with no reason says that nobody gave one", () => {
    const o = owedFrom({
      docs: [doc(arcRow, "::arc{id=ARC-001}\n:::objective{id=O1 state=blocked}\n:::\n:::approval{verdict=approved}\n:::\n")],
      now: NOW,
    });
    expect(o.work[0].says).toBe("blocked — no reason given on the block");
  });

  // THE COUNT WAS THE DEFECT: the row said 2 of 4 planned and nothing anywhere said WHICH two. The
  // attachment is derivable — `arc=ARC-001-O2` on the PLAN's own registry row, which the arc's file
  // cannot see, which is why the whole registry is handed in.
  it("names the objectives with no plan attached, in ONE row", () => {
    const o = owedFrom({
      docs: [
        doc(arcRow, ARC),
        doc({ id: "RFC-5", kind: "rfc", path: "RFCs/RFC-005-z.md", arc: "ARC-001-O2", state: { verdict: "approved" } }, "::rfc{id=RFC-5}\n"),
      ],
      now: NOW,
    });
    const un = o.work.filter((x) => x.why === "unplanned");
    expect(un).toHaveLength(1);
    expect(un[0].says).toBe("2 objectives with no plan attached");
    expect(un[0].tail).toBe("O3 · O4");
  });

  it("a done objective with no plan is not work that cannot start", () => {
    const o = owedFrom({
      docs: [doc(arcRow, "::arc{id=ARC-001}\n:::objective{id=O1 state=done}\n:::\n:::approval{verdict=approved}\n:::\n")],
      now: NOW,
    });
    expect(o.work.filter((x) => x.why === "unplanned")).toEqual([]);
  });

  // A FENCED `::objective` IS AN EXAMPLE. The first real arc document also EXPLAINED the vocabulary,
  // and the line scan counted the example — `::progress` read 8 where `::timeline` read 7.
  it("an objective inside a fence is not an objective", () => {
    const o = owedFrom({
      docs: [doc(arcRow, '::arc{id=ARC-001}\n\n```markdown\n:::objective{id=O9 owner=you}\n:::\n```\n\n:::approval{verdict=approved}\n:::\n')],
      now: NOW,
    });
    expect(o.work.filter((x) => x.why === "mine")).toEqual([]);
  });
});

describe("a draft nothing can decide", () => {
  // An rfc reaches every state above draft THROUGH A VERDICT, so one carrying no approval block at
  // all is parked forever — and the trail's own refusal says so only if you go and press it.
  it("an rfc in draft with no approval block says nothing can take it out", () => {
    const o = owedFrom({ docs: [doc({ id: "RFC-53", kind: "rfc", path: "a.md", state: { parsed: 1 } }, "::rfc{id=RFC-53}\n\n# a design\n")], now: NOW });
    expect(says(o.work)).toEqual(["RFC-53 · no approval block — nothing can take it out of draft"]);
    expect(o.work[0].line).toBe(1);
  });

  it("a draft that HAS an approval block is simply waiting on the press", () => {
    const o = owedFrom({ docs: [doc({ id: "RFC-54", kind: "rfc", path: "a.md", state: { parsed: 1 } }, '::rfc{id=RFC-54}\n:::approval{ask="go?"}\n:::\n')], now: NOW });
    expect(o.work.filter((x) => x.why === "undecidable")).toEqual([]);
    expect(o.press).toHaveLength(1);
  });

  it("a report is not undecidable — existence is not a thing you press", () => {
    const o = owedFrom({ docs: [doc({ id: "REP", kind: "report", path: "a.md", state: { retain: "permanent" } }, "::report{id=REP}\n")], now: NOW });
    expect(o.work).toEqual([]);
  });
});

describe("claims resting on nothing", () => {
  const CLAIMS = [
    "::rfc{id=RFC-7}",
    ":::approval{verdict=approved}",
    ":::",
    "::claim[one]{id=c1 state=met by=you}",
    "::claim[two]{id=c2 state=met by=you}",
    "::claim[three]{id=c3}",
    "::claim[four]{id=c4 state=unmet}",
  ].join("\n");

  // FORTY-FOUR UNPROVED CLAIMS ARE ONE ROW, NEVER FORTY-FOUR. That is exactly how a surface meant
  // to focus him becomes the thing he scrolls past.
  it("however many claims, one row — and the three failures are said apart", () => {
    const o = owedFrom({ docs: [doc({ id: "RFC-7", kind: "rfc", path: "a.md", state: { verdict: "approved" } }, CLAIMS)], now: NOW });
    const c = o.work.filter((x) => x.why === "claims");
    expect(c).toHaveLength(1);
    expect(c[0].says).toBe("1 claim unmet · 1 unchecked · 2 marked met with no proof");
    expect(c[0].tail).toBe("4 claims");
  });

  it("a document whose every claim is met and proved owes nothing for them", () => {
    const o = owedFrom({
      docs: [doc({ id: "RFC-8", kind: "rfc", path: "a.md", state: { verdict: "approved" } },
        ":::claim[one]{id=c1 state=met by=you}\n::test{SystemViewCore.Owed.oneRowPerObligation}\n:::\n:::approval{verdict=approved}\n:::\n")],
      now: NOW,
    });
    expect(o.work).toEqual([]);
  });

  // THE HEAVIEST MESS LEADS ITS BAND. The ordering is data so a reader can argue with it.
  it("the document with the most resting on nothing leads the claims rows", () => {
    const many = ["::rfc{id=X}", ":::approval{verdict=approved}", ":::", ...Array.from({ length: 9 }, (_, i) => `::claim[c]{id=k${i}}`)].join("\n");
    const o = owedFrom({
      docs: [
        doc({ id: "RFC-7", kind: "rfc", path: "a.md", state: { verdict: "approved" } }, CLAIMS),
        doc({ id: "RFC-9", kind: "rfc", path: "b.md", state: { verdict: "approved" } }, many),
      ],
      now: NOW,
    });
    expect(o.work.filter((x) => x.why === "claims").map((x) => x.id)).toEqual(["RFC-9", "RFC-7"]);
  });
});

describe("it does not lie — what is left out is counted and said", () => {
  // A FIXTURE IS NOT WORK. A mock arc's unpressed approval is test data wearing an obligation, and
  // three of the eight the band counted were exactly that.
  it("a MOCK document's unpressed approval is test data, by its id, wherever it lives", () => {
    expect(isFixture({ id: "MOCK-RFC-2", path: "anywhere/x.md" })).toBe(true);
    expect(isFixture({ id: "mock-plan", path: "x.md" })).toBe(true);
    expect(isFixture({ id: "RFC-076", path: "RFCs/RFC-076-x.md" })).toBe(false);
  });

  // AND THE REST OF THEM BY FOLDER, because `the-proofs-run.md` and `the-lifecycle-walk.md` are
  // fixtures too and are not named MOCK. Both signals are CONVENTIONS, not declarations — which is
  // why what they removed is counted rather than silently dropped.
  it("a fixture that is not named MOCK is caught by the folder it was put in", () => {
    expect(isFixture({ id: "lifecycle-walk", path: "RFCs/proofs/the-lifecycle-walk.md" })).toBe(true);
    expect(isFixture({ id: "proofs-run", path: ".systemview/report.p.The-proofs-run.md" })).toBe(false);
  });

  it("a fixture's obligations are COUNTED, not filtered into silence", () => {
    const o = owedFrom({
      docs: [
        doc({ id: "MOCK-RFC-2", kind: "rfc", path: "RFCs/proofs/mock-rfc-2.md", state: { verdict: "approved" } },
          '::rfc{id=MOCK-RFC-2}\n:::approval{ask="MOCK"}\n:::\n::claim[x]{id=m1}\n'),
        doc({ id: "RFC-76", kind: "rfc", path: "RFCs/RFC-076-x.md", state: { verdict: "approved" } },
          '::rfc{id=RFC-76}\n:::approval{ask="Approve the lifecycle?"}\n:::\n'),
      ],
      now: NOW,
    });
    expect(o.press.map((x) => x.id)).toEqual(["RFC-76"]);
    expect(o.skipped.fixtures).toBe(2);
    expect(skippedLine(o.skipped)).toBe("not counted: 2 in proof fixtures");
  });

  // A ROW POINTING AT A FILE THAT IS GONE owes nothing and must not vanish — the registry's §1.4
  // lag is real, and a count that quietly drops rows reads as "covered everything".
  it("a row whose file is gone is said out loud", () => {
    const o = owedFrom({
      docs: [doc({ id: "RFC-1", kind: "rfc", path: "gone.md", missing: true, state: { verdict: "approved" } }, undefined)],
      now: NOW,
    });
    expect(o.press).toEqual([]);
    expect(o.skipped.gone).toBe(1);
    expect(skippedLine(o.skipped)).toBe("not counted: 1 row pointing at a file that is gone");
  });

  it("a document that could not be read is said out loud, and rides the head", () => {
    const o = owedFrom({
      docs: [doc({ id: "RFC-1", kind: "rfc", path: "a.md", state: { verdict: "approved" } }, undefined)],
      now: NOW,
    });
    expect(o.counted).toBe(0);
    expect(o.skipped.unreadable).toBe(1);
    expect(skippedLine(o.skipped)).toBe("not counted: 1 document that could not be read");
    expect(owedHead(o).unread).toBe(1);
  });

  it("nothing left out says nothing", () => {
    expect(skippedLine({})).toBe("");
    expect(skippedLine({ fixtures: 0, gone: 0, unreadable: 0 })).toBe("");
  });

  // A RETIRED DOCUMENT IS OUT OF ACTIVE SERVICE and owes nothing — including a pause, which is not
  // work he is behind on, and which is why it is not counted as an omission either.
  it("a retired document owes nothing and is not an omission", () => {
    const o = owedFrom({
      docs: [doc({ id: "MOCK-RFC", kind: "rfc", path: "x.md", state: { retired: true, retiredAs: "shelf", verdict: "approved" } },
        '::rfc{id=MOCK-RFC}\n:::approval{ask="x"}\n:::\n')],
      now: NOW,
    });
    expect(o.press).toEqual([]);
    expect(o.skipped).toEqual({ fixtures: 0, unreadable: 0, gone: 0 });
  });

  it("a row with no id or no path is not a document", () => {
    const o = owedFrom({ docs: [null, {}, { row: { id: "x" } }, { row: { path: "y" } }], now: NOW });
    expect(o.counted).toBe(0);
    expect(o.press).toEqual([]);
  });
});

describe("the head — the legend for the two groups below it", () => {
  const owed = (press, work, counted = 5) => ({ press: new Array(press).fill({}), work: new Array(work).fill({}), counted, skipped: {} });

  it("says both numbers, and both are doors", () => {
    expect(owedHead(owed(3, 9)).segs).toEqual([
      { key: "press", flag: "⚑", text: "3 to press" },
      { key: "work", flag: "", text: "9 outstanding" },
    ]);
  });

  it("drops a group that has nothing rather than saying zero", () => {
    expect(owedHead(owed(0, 2)).segs).toEqual([{ key: "work", flag: "", text: "2 outstanding" }]);
  });

  // THE ZERO IS THE ANSWER HE HAS NEVER BEEN ABLE TO GET, so it is said out loud. A blank head
  // would read as "not measured", which is the thing this surface exists to stop.
  it("says nothing owed out loud when it really read something", () => {
    expect(owedHead(owed(0, 0, 11)).segs).toEqual([{ key: "clear", flag: "", text: "nothing owed" }]);
  });

  it("says nothing at all when it read nothing — a zero over no documents is not a zero", () => {
    expect(owedHead(owed(0, 0, 0)).segs).toEqual([]);
    expect(owedHead({}).segs).toEqual([]);
  });
});

describe("leafLine — where a row with nothing more specific to point at lands", () => {
  it("finds the registration leaf of every kind", () => {
    expect(leafLine("# t\n\n::rfc{id=RFC-1}\n")).toBe(3);
    expect(leafLine("::arc{id=ARC-1}\n")).toBe(1);
    expect(leafLine("# t\n::gap{id=G}\n")).toBe(2);
    expect(leafLine("# t\n\n\n::report{id=R}\n")).toBe(4);
  });

  it("a fenced leaf is an example, and line 1 is the floor", () => {
    expect(leafLine("# t\n\n```markdown\n::rfc{id=RFC-1}\n```\n")).toBe(1);
    expect(leafLine("")).toBe(1);
    expect(leafLine(undefined)).toBe(1);
  });
});
