import { approvalOf, verdictInsertAfter, verdictPlan, verdictTitle } from "./verdictPlan";

// A VERDICT WITHOUT SCROLLING TO THE BLOCK — the write, proven without rendering anything.
//
// Nothing that imports the markdown renderer can be mounted under jest (ESM in untransformed
// node_modules), which is how two render-time crashes once shipped beside 543 green claims. So the
// press's whole decision lives in a plain module and this file is where it is checkable.

const DOC = ["# A plan", "", "some prose", "", ":::approval{ask=\"Approve the plan?\"}", "the proposal", ":::", ""].join("\n");

describe("finding the document's approval block", () => {
  it("reads its line 1-BASED, the way setDirectiveAttr counts", () => {
    const a = approvalOf(DOC);
    expect(a.line).toBe(5);
    expect(DOC.split("\n")[a.line - 1]).toMatch(/^:::approval/);
  });

  it("reads the verdict already on it, and the ask", () => {
    expect(approvalOf(DOC).verdict).toBe("");
    expect(approvalOf(DOC).ask).toBe("Approve the plan?");
    expect(approvalOf(DOC.replace("{ask=", "{verdict=approved ask=")).verdict).toBe("approved");
  });

  // A thread or column wrapping the block gives it more colons, the same way a thread's own fence
  // gains them. Matching exactly three missed precisely the well-built documents.
  it("finds it at any fence depth", () => {
    expect(approvalOf("::::approval{ask=x}\ny\n::::").line).toBe(1);
  });

  it("is null when there is none", () => {
    expect(approvalOf("# just a document\n")).toBe(null);
    expect(approvalOf("")).toBe(null);
  });
});

describe("with a block, the chip is a REMOTE — same line, one source of truth", () => {
  it("writes the verdict onto the block's own line", () => {
    expect(verdictPlan(DOC, "approved")).toEqual({ kind: "attr", line: 5, value: "approved", cleared: false });
    expect(verdictPlan(DOC, "rejected")).toEqual({ kind: "attr", line: 5, value: "rejected", cleared: false });
  });

  // The block's own buttons already work this way, and the rule is the same one `::question` has:
  // "I take that back" has to be expressible or the first press is a trap.
  it("pressing the verdict already given CLEARS it", () => {
    const approved = DOC.replace("{ask=", "{verdict=approved ask=");
    expect(verdictPlan(approved, "approved")).toEqual({ kind: "attr", line: 5, value: "", cleared: true });
    // ...but the OTHER verdict replaces rather than clears
    expect(verdictPlan(approved, "rejected").value).toBe("rejected");
  });

  it("never inserts a second block when one exists — that would be two answers in one document", () => {
    expect(verdictPlan(DOC, "approved").kind).not.toBe("insert");
  });
});

describe("with NO block, the press writes block AND verdict in one stroke", () => {
  const bare = "# A plan\n\nsome prose\n";

  it("creates the block carrying the verdict, so nothing sits undecided in the draft", () => {
    const plan = verdictPlan(bare, "approved");
    expect(plan.kind).toBe("insert");
    expect(plan.created).toBe(true);
    expect(plan.text).toMatch(/:::approval\{ask="Approve this document\?" verdict=approved\}/);
    expect(plan.text).toMatch(/\n:::$/);
  });

  it("quotes the ask, because an unquoted space kills the directive silently", () => {
    expect(verdictPlan(bare, "rejected").text).toMatch(/ask="Approve this document\?"/);
  });

  // AT THE END, and not for neatness: an approval WRAPS what is being decided, so mid-document it
  // would either swallow the section it landed in front of or wrap nothing at all.
  it("goes after the last non-blank line, never into the trailing blanks", () => {
    expect(verdictInsertAfter("a\nb\n")).toBe(2);
    expect(verdictInsertAfter("a\nb\n\n\n")).toBe(2);
    expect(verdictInsertAfter("")).toBe(0);
    const plan = verdictPlan("a\nb\n\n\n", "approved");
    expect(plan.insertAfter).toBe(2);
  });

  // The insert door counts from 0 and the attr door counts from 1. Mixing them up by one is how a
  // member once landed on the thread below the line it was meant for.
  it("uses the 0-based position insertAfterLine wants, not the 1-based one setDirectiveAttr wants", () => {
    const src = "# t\n\nbody\n";
    expect(verdictPlan(src, "approved").insertAfter).toBe(3);
    expect(src.split("\n")[verdictPlan(src, "approved").insertAfter - 1]).toBe("body");
  });
});

describe("it refuses rather than guessing", () => {
  it("refuses two blocks, and says how many and where", () => {
    const two = `${DOC}\n:::approval{ask="And the other one?"}\nx\n:::\n`;
    const plan = verdictPlan(two, "approved");
    expect(plan.kind).toBe("refuse");
    expect(plan.why).toMatch(/2 approval blocks/);
    expect(plan.line).toBe(5); // where to send him
    expect(approvalOf(two).multiple).toBe(true);
  });

  it("refuses a verdict that is not one of the two", () => {
    expect(verdictPlan(DOC, "maybe").kind).toBe("refuse");
    expect(verdictPlan(DOC, "").kind).toBe("refuse");
    expect(verdictPlan(DOC, undefined).kind).toBe("refuse");
  });
});

describe("the chip says what pressing will do, not just which mark it is", () => {
  it("names creating a block when there is none", () => {
    expect(verdictTitle("# t\n", "approved")).toMatch(/writes an approval block/);
  });
  it("names the existing block when there is one", () => {
    expect(verdictTitle(DOC, "approved")).toMatch(/document's approval block/);
  });
  it("says 'withdraw' on the verdict already given", () => {
    expect(verdictTitle(DOC.replace("{ask=", "{verdict=rejected ask="), "rejected")).toMatch(/withdraw/);
  });
  it("carries the refusal through as the title, so a dead chip explains itself", () => {
    const two = `${DOC}\n:::approval{ask=b}\nx\n:::\n`;
    expect(verdictTitle(two, "approved")).toMatch(/press the one you mean/);
  });
});
