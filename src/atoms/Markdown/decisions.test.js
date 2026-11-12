import { parseDecisions, decisionsOf, owedBy, normalizeState, nextState } from "./decisions";

describe("a decision is a record, not an approval", () => {
  it("is OPEN until somebody chooses — the empty state is the honest one", () => {
    const [d] = parseDecisions('::decision[host or sender?]{id=d1}');
    expect(d.state).toBe("open");
    expect(d.chose).toBe("");
  });

  it("keeps the QUESTION after the answer, because the fork is what makes the record worth having", () => {
    const [d] = parseDecisions('::decision[host or sender?]{id=d1 state=decided chose="the host"}');
    expect(d.question).toBe("host or sender?");
    expect(d.chose).toBe("the host");
  });

  it("carries the ROAD NOT TAKEN, which is the half git cannot give you", () => {
    const [d] = parseDecisions('::decision[where?]{state=decided chose="host" over="sender|a relay in the middle"}');
    expect(d.over).toEqual(["sender", "a relay in the middle"]);
  });

  // HIS POINT, 2026-11-12: "making a decision doesn't mean you have the approval."
  it("can be DECIDED and still owe somebody's ratification", () => {
    const [d] = parseDecisions('::decision[q]{state=decided chose=host ratify=autobot}');
    expect(d.state).toBe("decided");
    expect(d.awaiting).toBe(true);
  });

  it("stops awaiting once every named ratifier has signed", () => {
    const [d] = parseDecisions('::decision[q]{state=decided chose=host ratify="autobot|buapi" approved="autobot|buapi"}');
    expect(d.awaiting).toBe(false);
  });

  it("is not awaiting anything when nobody was asked to ratify — a decision is not pending by default", () => {
    const [d] = parseDecisions('::decision[q]{state=decided chose=host}');
    expect(d.ratify).toEqual([]);
    expect(d.awaiting).toBe(false);
  });

  it("separates who OWED the answer from who MADE the call", () => {
    const [d] = parseDecisions('::decision[q]{owner=you state=decided chose=host by=systemview-test}');
    expect(d.owner).toEqual(["you"]);
    expect(d.by).toEqual(["systemview-test"]);
  });

  // FOUND BY READING THE FIRST LIVE MEETING THAT USED THIS BLOCK (BUApp, 2026-11-12): a block
  // carrying chose=, over= and by=odion while still state=open — his answer, captured in the room,
  // not yet closed. The renderer drew it as "nothing chosen yet", contradicting its own contents.
  it("knows an OPEN decision can already carry the answer somebody gave in the room", () => {
    const [d] = parseDecisions('::decision[q]{state=open chose="the host" by=odion}');
    expect(d.state).toBe("open");
    expect(d.answered).toBe(true);
    expect(d.chose).toBe("the host");
  });

  it("is not 'answered' when it is merely open", () => {
    expect(parseDecisions("::decision[q]{}")[0].answered).toBe(false);
  });

  it("is not 'answered' once it is closed — that is just decided", () => {
    expect(parseDecisions('::decision[q]{state=decided chose=x}')[0].answered).toBe(false);
  });

  it("says out loud that a decision was recorded with nothing chosen", () => {
    const [d] = parseDecisions('::decision[q]{state=decided}');
    expect(d.unsaid).toBe(true);
  });

  it("reads a quoted value whole, rather than finding an attribute inside it", () => {
    const [d] = parseDecisions('::decision[q]{state=decided chose="state= stays as it is"}');
    expect(d.state).toBe("decided");
    expect(d.chose).toBe("state= stays as it is");
  });

  it("is a container as happily as a leaf, and the state lives on the opening line either way", () => {
    const src = [':::decision[q]{id=d4 state=decided chose=host}', "**why** — it is their hardware.", ":::"].join("\n");
    const [d] = parseDecisions(src);
    expect(d.id).toBe("d4");
    expect(d.state).toBe("decided");
    expect(d.line).toBe(1);
  });

  it("ignores a fenced example — a quotation is not a decision", () => {
    const src = ["```markdown", "::decision[not real]{state=decided}", "```", "::decision[real]{}"].join("\n");
    const all = parseDecisions(src);
    expect(all).toHaveLength(1);
    expect(all[0].question).toBe("real");
  });

  it("numbers them in the order written and remembers the line a press writes to", () => {
    const src = ["::decision[a]{}", "", "text", "::decision[b]{}"].join("\n");
    expect(parseDecisions(src).map((d) => [d.n, d.line])).toEqual([[1, 1], [2, 4]]);
  });
});

describe("the count a ::decisions block draws", () => {
  const src = [
    "::decision[a]{id=d1 owner=you}",
    "::decision[b]{id=d2 state=decided chose=left}",
    "::decision[c]{id=d3 state=decided chose=right ratify=autobot}",
    "::decision[d]{id=d4 state=reversed chose=left}",
    "::decision[e]{id=d5 state=decided}",
  ].join("\n");

  it("derives every number from the blocks, so it cannot disagree with them", () => {
    const got = decisionsOf(src);
    expect(got.total).toBe(5);
    expect(got.open).toBe(1);
    expect(got.decided).toBe(3);
    expect(got.reversed).toBe(1);
  });

  it("counts what is awaiting ratification separately from what is open", () => {
    expect(decisionsOf(src).awaiting).toBe(1);
  });

  it("counts a decision recorded with nothing chosen, because that record is the wrong half", () => {
    expect(decisionsOf(src).unsaid).toBe(1);
  });

  it("counts what was answered in the room but not closed, apart from what is simply open", () => {
    const got = decisionsOf(
      ["::decision[a]{id=d1}", '::decision[b]{id=d2 state=open chose="his words" by=odion}'].join("\n"),
    );
    expect(got.open).toBe(2);
    expect(got.answered).toBe(1);
  });

  it("counts what was answered in the room but not closed, apart from what is simply open", () => {
    const got = decisionsOf(
      ["::decision[a]{id=d1}", '::decision[b]{id=d2 state=open chose="his words" by=odion}'].join("\n"),
    );
    expect(got.open).toBe(2);
    expect(got.answered).toBe(1);
  });

  it("is all zeroes for a document with none, rather than throwing", () => {
    expect(decisionsOf("# just prose").total).toBe(0);
    expect(decisionsOf(undefined).total).toBe(0);
  });

  it("groups what is still owed by who owes it, and keeps the UNOWNED visible", () => {
    const owed = owedBy(["::decision[a]{id=d1 owner=you}", "", "::decision[b]{id=d2}"].join("\n"));
    expect(owed.get("you").map((r) => r.id)).toEqual(["d1"]);
    expect(owed.get("nobody named").map((r) => r.id)).toEqual(["d2"]);
  });

  it("carries each id's LINE, because the id is an address to press and not just to read", () => {
    const owed = owedBy(["::decision[a]{id=d1 owner=you}", "", "text", "::decision[b]{id=d2 owner=you}"].join("\n"));
    expect(owed.get("you")).toEqual([
      { id: "d1", line: 1, n: 1 },
      { id: "d2", line: 4, n: 2 },
    ]);
  });
});

describe("the states, and the press between them", () => {
  it("takes the words somebody would actually write", () => {
    expect(normalizeState("made")).toBe("decided");
    expect(normalizeState("overturned")).toBe("reversed");
    expect(normalizeState("superseded")).toBe("reversed");
    expect(normalizeState("")).toBe("open");
    expect(normalizeState("banana")).toBe("open");
  });

  it("only offers REVERSED on something already decided — you cannot overturn a choice nobody made", () => {
    expect(nextState("open")).toBe("decided");
    expect(nextState("decided")).toBe("reversed");
    expect(nextState("reversed")).toBe("open");
  });
});
