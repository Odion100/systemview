import { decisionSummary, isDecision, DECIDING } from "./decisions";

describe("what a press SAYS", () => {
  // The failure these replace: every send was shaped "a thread you are in moved", which autobot
  // filed as a bug the first time it got one — it had to open the document to learn nothing had.
  it("names the verdict and what was being decided", () => {
    expect(
      decisionSummary({ kind: "approval", attrs: { ask: "Approve RFC-072 — arcs as trackable documents?" }, value: "approved", by: "odion" })
    ).toBe("odion approved: Approve RFC-072 — arcs as trackable documents?");
  });

  it("says rejected just as plainly", () => {
    expect(decisionSummary({ kind: "approval", attrs: { ask: "Ship it?" }, value: "rejected", by: "odion" }))
      .toBe("odion rejected: Ship it?");
  });

  // "I take that back" is expressible in these blocks, so it has to be expressible in the message
  // — otherwise the room is told the opposite of what happened.
  it("says a verdict was WITHDRAWN rather than announcing an empty one", () => {
    expect(decisionSummary({ kind: "approval", attrs: { ask: "Ship it?" }, value: "", by: "odion" }))
      .toBe("odion withdrew a verdict on: Ship it?");
  });

  it("carries a question's answer and its question", () => {
    expect(decisionSummary({ kind: "question", attrs: { ask: "Which engine?" }, value: "kokoro", by: "odion" }))
      .toBe("odion answered kokoro to: Which engine?");
  });

  it("says a task was ticked, and that unticking is not the same event", () => {
    expect(decisionSummary({ kind: "task", attrs: { label: "rebuild the bundle" }, value: true, by: "odion" }))
      .toBe("odion ticked a task: rebuild the bundle");
    expect(decisionSummary({ kind: "task", attrs: { label: "rebuild the bundle" }, value: false, by: "odion" }))
      .toBe("odion unticked a task: rebuild the bundle");
  });

  it("truncates a long question rather than pushing a wall of text into somebody's session", () => {
    const long = "x".repeat(300);
    const out = decisionSummary({ kind: "approval", attrs: { ask: long }, value: "approved", by: "o" });
    expect(out.length).toBeLessThan(140);
    expect(out.endsWith("…")).toBe(true);
  });

  it("collapses the newlines a wrapped attribute brings with it", () => {
    expect(decisionSummary({ kind: "approval", attrs: { ask: "one\n  two" }, value: "approved", by: "o" }))
      .toBe("o approved: one two");
  });

  it("still says something true with no author and no question", () => {
    expect(decisionSummary({ kind: "approval", value: "approved" })).toBe("approved something in this document");
  });

  // A send with no summary is the "moved" problem wearing a different hat.
  it("never returns an empty sentence, even for a block it does not know", () => {
    expect(decisionSummary({ kind: "slider", value: 4, by: "o" })).toBe("o changed slider in this document");
    expect(decisionSummary({}).length).toBeGreaterThan(0);
  });
});

describe("which writes are decisions at all", () => {
  // Not every setAttr is news. A slider being dragged is a value being explored, and announcing it
  // is the keystroke flood the quiet period exists to prevent.
  it("knows the three that are", () => {
    expect(isDecision("approval", "verdict")).toBe(true);
    expect(isDecision("question", "answer")).toBe(true);
    expect(isDecision("task", "checked")).toBe(true);
  });

  it("refuses a different attribute on a deciding block", () => {
    expect(isDecision("approval", "label")).toBe(false);
    expect(isDecision("question", "options")).toBe(false);
  });

  it("refuses blocks that are not decisions", () => {
    expect(isDecision("slider", "value")).toBe(false);
    expect(isDecision("members", "sent")).toBe(false);
    expect(isDecision("", "verdict")).toBe(false);
    expect(isDecision(undefined, undefined)).toBe(false);
  });

  it("is a short explicit list rather than anything that writes back", () => {
    expect(Object.keys(DECIDING).sort()).toEqual(["approval", "question", "task"]);
  });
});

describe("the words a ticked task is about", () => {
  const { taskLabelOf } = require("./decisions");
  const doc = [
    "# a plan",
    "",
    "- [ ] rebuild the bundle",
    "- [x] press the **commit**",
    "   - [ ] a nested one",
    "1. [ ] an ordered task",
    "- [ ] read `api/reports.js` and the [RFC](RFCs/RFC-072.md)",
    "- [ ]",
    "just a paragraph",
    "",
  ].join("\n");

  it("reads the task's own words", () => {
    expect(taskLabelOf(doc, 3)).toBe("rebuild the bundle");
  });

  it("reads a ticked one as well as an unticked one", () => {
    expect(taskLabelOf(doc, 4)).toBe("press the commit");
  });

  it("handles a nested task and an ordered one — the same shape toggleTaskLine matches", () => {
    expect(taskLabelOf(doc, 5)).toBe("a nested one");
    expect(taskLabelOf(doc, 6)).toBe("an ordered task");
  });

  // This ends up inside a sentence pushed into somebody's session; brackets and asterisks are noise.
  it("strips markdown rather than pushing syntax into somebody's session", () => {
    expect(taskLabelOf(doc, 7)).toBe("read api/reports.js and the RFC");
  });

  it("answers empty for a task with no words, rather than inventing some", () => {
    expect(taskLabelOf(doc, 8)).toBe("");
  });

  // A label that disagreed with what was toggled would quote the wrong task.
  it("says nothing for a line that is not a task", () => {
    expect(taskLabelOf(doc, 9)).toBe("");
    expect(taskLabelOf(doc, 1)).toBe("");
  });

  it("survives a line number that is not in the document", () => {
    expect(taskLabelOf(doc, 0)).toBe("");
    expect(taskLabelOf(doc, 999)).toBe("");
    expect(taskLabelOf("", 1)).toBe("");
    expect(taskLabelOf(undefined, undefined)).toBe("");
  });
});
