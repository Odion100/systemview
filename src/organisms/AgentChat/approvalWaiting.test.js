import { approvalsIn, flagsFrom, waitsOnHim } from "./approvalWaiting";

// AN APPROVAL WAITING IS NEVER MISSED.
//
// The band's count is only worth anything if a zero means zero. These are the two ways it could say
// zero while one waited, plus the thing that was already right and must stay right.

describe("a block with no verdict is the only thing that waits", () => {
  it("waits when there is no verdict", () => {
    expect(waitsOnHim(':::approval{ask="Approve the plan?"}\nthe plan\n:::')).toBe(true);
  });

  // BOTH ANSWERS ARE ANSWERS. This was already correct and the point of pinning it is that it stays
  // correct — a rejected document is not outstanding, whatever else is wrong with how rejections
  // are handled elsewhere.
  it("does NOT wait once answered, either way", () => {
    expect(waitsOnHim(':::approval{ask="x" verdict=approved}\ny\n:::')).toBe(false);
    expect(waitsOnHim(':::approval{ask="x" verdict=rejected}\ny\n:::')).toBe(false);
  });

  it("does not wait on a document with no approval block at all", () => {
    expect(waitsOnHim("# just a report\n\nsome prose\n")).toBe(false);
    expect(waitsOnHim("")).toBe(false);
    expect(waitsOnHim(null)).toBe(false);
  });

  // THE FENCE BUG. A container nests by GAINING colons, so an approval inside a thread opens with
  // four — and matching exactly three made it invisible. An approval deliberately placed inside a
  // conversation is the most likely kind to be waiting.
  it("finds it at any fence depth, not just three colons", () => {
    expect(waitsOnHim('::::approval{ask="in a thread"}\ny\n::::')).toBe(true);
    expect(waitsOnHim(':::::approval{ask="deeper still"}\ny\n:::::')).toBe(true);
  });

  it("finds it indented, the way a nested block is written", () => {
    expect(waitsOnHim('  ::::approval{ask="indented"}\n  y\n  ::::')).toBe(true);
  });

  it("waits when ANY block is unanswered, even beside an answered one", () => {
    const both = ':::approval{ask="a" verdict=approved}\nx\n:::\n\n::::approval{ask="b"}\ny\n::::';
    expect(waitsOnHim(both)).toBe(true);
  });

  // A /g REGEX CARRIES lastIndex BETWEEN CALLS. Forgetting to reset it makes the predicate skip
  // every other document — which would be an intermittent undercount, the worst kind to chase.
  it("gives the same answer called repeatedly", () => {
    const doc = ':::approval{ask="x"}\ny\n:::';
    expect([waitsOnHim(doc), waitsOnHim(doc), waitsOnHim(doc)]).toEqual([true, true, true]);
  });

  it("is not fooled by the word approval in prose", () => {
    expect(waitsOnHim("we should use the approval block at the bottom\n")).toBe(false);
    expect(waitsOnHim("`:::approval{ask=x}` is how you ask\n")).toBe(false); // inline code, not a block
  });
});

describe("the fold over every document, with nothing dropped silently", () => {
  // THE LIVE BUG, as it actually stood: 23 reports and a scan that read the first 20, so the only
  // waiting approval sitting in the 21st was never seen and the band said nothing was waiting.
  const many = Array.from({ length: 23 }, (_, i) => ({
    path: `.systemview/report.p.r${i}.md`,
    content: i === 20 ? ':::approval{ask="the one that waits"}\nx\n:::' : "# nothing to decide\n",
  }));

  it("sees the 21st of 23 — the case the old cap of 20 could never reach", () => {
    const r = flagsFrom(many);
    expect(r.waiting).toBe(1);
    expect(r.flags[".systemview/report.p.r20.md"]).toBe(true);
  });

  it("flags by path, so the row that waits is the row that lights up", () => {
    const r = flagsFrom([
      { path: "a.md", content: ':::approval{ask="x"}\ny\n:::' },
      { path: "b.md", content: "# no\n" },
    ]);
    expect(Object.keys(r.flags)).toEqual(["a.md"]);
    expect(r.waiting).toBe(1);
  });

  // A COUNT THAT QUIETLY OMITS IS A COUNT THAT LIES. What could not be read is carried out so the
  // surface can say so, rather than implying it looked at everything.
  it("carries how many it could not read instead of swallowing them", () => {
    expect(flagsFrom([], 3).unread).toBe(3);
    expect(flagsFrom([], 0).unread).toBe(0);
    expect(flagsFrom([], -5).unread).toBe(0);
  });

  it("ignores a row with no path rather than crashing the band", () => {
    expect(flagsFrom([null, {}, { content: "x" }]).waiting).toBe(0);
  });
});

describe("approvalsIn — for a surface that wants to point at the block", () => {
  it("gives each block's 1-based line and its verdict", () => {
    const doc = ["# r", "", ':::approval{ask="a" verdict=approved}', "x", ":::", "", '::::approval{ask="b"}', "y", "::::"].join("\n");
    expect(approvalsIn(doc)).toEqual([
      { line: 3, verdict: "approved" },
      { line: 7, verdict: "" },
    ]);
    expect(doc.split("\n")[2]).toMatch(/^:::approval/);
  });

  it("is empty on a document with none", () => {
    expect(approvalsIn("# r\n")).toEqual([]);
  });
});
