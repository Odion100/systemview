import { bandBlock, filedBy } from "./bandBlock";

// WHAT EACH SPEC IS DOING: holding the three rules of a drawer block to their words. The headline
// leads with what the thing IS; the flag is the only derived thing allowed to stay up there; and
// everything a flat row used to spend its width on is in the fold, path included.
//
// These were flat lines before — *"a block with some information at the top for me to know exactly
// what the work is"* — so every claim below is really one claim twice: it IS on the headline, or it
// is NOT.

describe("the headline says what the thing is, and nothing it worked out itself", () => {
  it("leads an RFC with its number and its title", () => {
    const b = bandBlock("rfc", { id: "RFC-077", title: "the drawer and the clock", path: "RFCs/RFC-077-x.md" }, { line: "draft" });
    expect(b.title).toBe("RFC-077 — the drawer and the clock");
  });

  it("says the id alone when a document gave itself no title — never a dash with nothing after it", () => {
    expect(bandBlock("rfc", { id: "RFC-077", title: "", path: "x.md" }, {}).title).toBe("RFC-077");
    expect(bandBlock("arc", { id: "ARC-004", path: "x.md" }, {}).title).toBe("ARC-004");
  });

  it("leads a report with the name somebody wrote, not its filename", () => {
    const b = bandBlock("report", { name: "what the band head should say", path: ".systemview/report.claude.band.md" }, {});
    expect(b.title).toBe("what the band head should say");
  });

  it("leads an obligation with the obligation — the sentence is the headline, whole", () => {
    const b = bandBlock("owed", { id: "RFC-050", says: "3 claims unmet · 1 unchecked", group: "work", why: "claims", path: "a.md", line: 44 });
    expect(b.title).toBe("RFC-050 — 3 claims unmet · 1 unchecked");
  });

  // THE STATE WORD IS DERIVED, AND DERIVED FACTS FOLD. A row that led with "built · 1 to approve"
  // made him read a sentence before reaching the thing the sentence was about.
  it("keeps every derived state word OFF the headline", () => {
    const b = bandBlock("rfc", { id: "RFC-050", title: "lanes", path: "x.md", waiting: 1 }, { line: "built · 1 to approve" });
    expect(b.title).not.toMatch(/built|approve/);
    expect(b.fold.find((f) => f.key === "state").text).toBe("built · 1 to approve");
  });
});

describe("the flag is the one derived thing that stays on the headline", () => {
  // A press waiting behind a fold is a press he cannot see — and the band head above is its legend.
  it("flags an RFC whose approval is unsigned, and says how many", () => {
    const b = bandBlock("rfc", { id: "RFC-050", waiting: 2, path: "x.md" }, {});
    expect(b.flag).toBe("⚑");
    expect(b.flagSays).toBe("2 waiting for your verdict");
  });

  it("gives a blocked arc ⊘ and not ⚑ — a stop is not a decision", () => {
    expect(bandBlock("arc", { id: "ARC-004", blocked: 2, path: "x.md" }, {}).flag).toBe("⊘");
    expect(bandBlock("arc", { id: "ARC-004", blocked: 0, path: "x.md" }, {}).flag).toBe("");
  });

  it("flags a gap only when its proof is already in the file — an unfixed gap is work, not a verdict", () => {
    expect(bandBlock("gap", { id: "G-003", state: "open", hasProof: true, path: "x.md" }, {}).flag).toBe("⚑");
    expect(bandBlock("gap", { id: "G-003", state: "open", hasProof: false, path: "x.md" }, {}).flag).toBe("");
    expect(bandBlock("gap", { id: "G-003", state: "resolved", hasProof: true, path: "x.md" }, {}).flag).toBe("");
  });

  it("splits the owed list the way its head legends it — press wears ⚑, outstanding wears ⊘", () => {
    expect(bandBlock("owed", { id: "R-1", says: "s", group: "press", path: "x.md" }).flag).toBe("⚑");
    expect(bandBlock("owed", { id: "R-1", says: "s", group: "work", path: "x.md" }).flag).toBe("⊘");
  });

  // The report's flag is counted by the shell per path, beside the list — so the caller hands it in
  // rather than this file inventing a second count that can disagree with the head.
  it("takes a report's flag from the caller, because the count is not on the row", () => {
    const row = { name: "r", path: ".systemview/report.claude.r.md" };
    expect(bandBlock("report", row, { waiting: 1 }).flag).toBe("⚑");
    expect(bandBlock("report", row, {}).flag).toBe("");
  });
});

describe("the fold carries what the line could not afford — and the fact it never had", () => {
  // THE PATH WAS ONLY EVER A HOVER TITLE. Where a thing lives is the first question once you are
  // interested in it, and a hover is not something you can read down a list.
  it("puts the path in every kind's fold", () => {
    const where = (kind, row, extra) => (bandBlock(kind, row, extra).fold.find((f) => f.key === "path") || {}).text;
    expect(where("report", { name: "r", path: ".systemview/report.claude.r.md" }, {})).toBe(".systemview/report.claude.r.md");
    expect(where("rfc", { id: "RFC-1", path: "RFCs/RFC-001-a.md" }, {})).toBe("RFCs/RFC-001-a.md");
    expect(where("arc", { id: "ARC-1", path: "RFCs/arcs/ARC-001-a.md" }, {})).toBe("RFCs/arcs/ARC-001-a.md");
    expect(where("gap", { id: "G-1", path: "gaps/G-001-a.md" }, {})).toBe("gaps/G-001-a.md");
  });

  // An obligation is on a BLOCK, and which block is how you find it once the document is open.
  it("takes an obligation to the line it sits on, and drops the line when there is nothing to point at", () => {
    expect(bandBlock("owed", { id: "A", says: "s", group: "press", path: "a.md", line: 44 }).fold.find((f) => f.key === "path").text).toBe("a.md:44");
    expect(bandBlock("owed", { id: "A", says: "s", group: "press", path: "a.md", line: 1 }).fold.find((f) => f.key === "path").text).toBe("a.md");
  });

  it("names the category behind an obligation in words he recognises, not owed.js's tag", () => {
    const b = bandBlock("owed", { id: "A", says: "s", group: "work", why: "blocked", path: "a.md" });
    expect(b.fold.find((f) => f.key === "why").text).toBe("an objective is declared blocked");
  });

  it("folds a report's clock, its author and its filing time — and marks an urgent clock", () => {
    const b = bandBlock(
      "report",
      { name: "r", path: ".systemview/report.ozzy.r.md" },
      { when: "30 Oct 4:12 pm", clock: { text: "2 days left", urgent: true } },
    );
    expect(b.fold.map((f) => [f.key, f.text])).toEqual([
      ["clock", "2 days left"],
      ["who", "ozzy"],
      ["when", "30 Oct 4:12 pm"],
      ["path", ".systemview/report.ozzy.r.md"],
    ]);
    expect(b.fold.find((f) => f.key === "clock").tone).toBe("warn");
  });

  it("leads a report's fold with an invalid leaf, because every other fact is downstream of it", () => {
    const b = bandBlock("report", { name: "r", path: "x.md", state: { invalid: "no ending declared" } }, { when: "now" });
    expect(b.fold[0]).toMatchObject({ key: "invalid", text: "no ending declared", tone: "warn" });
  });

  // A LABEL WITH NOTHING AFTER IT IS WORSE THAN NO LINE. The fold's whole value is that every line
  // in it says something — an empty "owner:" is the furniture this replaced.
  it("draws no entry for a fact the row does not have", () => {
    const b = bandBlock("arc", { id: "ARC-1", path: "a.md", owner: "" }, { line: "" });
    expect(b.fold.map((f) => f.key)).toEqual(["path"]);
  });
});

// A ROW VANISHING BECAUSE NOBODY TAUGHT THIS FILE ITS WORD is the same silent omission the owed
// list was built to replace. A kind it has never met still draws, with whatever identity it has.
describe("a kind this file has not met still draws", () => {
  it("falls back to the row's own identity and folds its path", () => {
    const b = bandBlock("note", { id: "N-1", path: "notes/n.md" });
    expect(b.title).toBe("N-1");
    expect(b.fold.map((f) => f.key)).toEqual(["path"]);
    expect(b.flag).toBe("");
  });
});

describe("filedBy — who wrote a report, read out of its filename", () => {
  it("takes the agent out of report.<agent>.<name>.md", () => {
    expect(filedBy(".systemview/report.claude.the-band.md")).toBe("claude");
  });
  it("answers nothing for a path that is not a report, rather than guessing a name", () => {
    expect(filedBy("RFCs/RFC-001-a.md")).toBe("");
    expect(filedBy("")).toBe("");
  });
});
