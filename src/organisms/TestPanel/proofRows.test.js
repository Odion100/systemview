// THE PROOFS TAB'S SHAPING — held to its answers without mounting the panel.
import { listRows, resultRows, summaryOf, scopeLabel, addressOf } from "./proofRows";

const LISTED = {
  projectCode: "sv",
  scope: { arc: "ARC-900" },
  specs: 3,
  documents: [
    {
      id: "RFC-900",
      kind: "rfc",
      path: "RFCs/RFC-900.md",
      specs: [
        { kind: "run", label: "", title: "two calls", line: 3, end: 8 },
        { kind: "test", label: "Math.chainUse", title: "", line: 13, end: 13 },
      ],
    },
    {
      id: "ARC-900",
      kind: "arc",
      path: "RFCs/arcs/ARC-900.md",
      stale: true,
      specs: [{ kind: "run", label: "", title: "", line: 4, end: 6 }],
    },
  ],
};

describe("listRows — one row per spec, in document order", () => {
  it("flattens documents into specs, each knowing where it came from", () => {
    const rows = listRows(LISTED);
    expect(rows.map((r) => r.document)).toEqual(["RFC-900", "RFC-900", "ARC-900"]);
    expect(rows.map((r) => r.line)).toEqual([3, 13, 4]);
  });

  it("names a ::test by the namespace it points at, and a :::run by its title", () => {
    const [run, ref] = listRows(LISTED);
    expect(run.name).toBe("two calls");
    expect(ref.name).toBe("Math.chainUse");
  });

  it("a run block with no title says what it is rather than rendering blank", () => {
    expect(listRows(LISTED)[2].name).toBe("steps");
  });

  it("staleness travels with the row — a count presented as complete when it is not would be a lie", () => {
    const rows = listRows(LISTED);
    expect(rows[0].stale).toBe(false);
    expect(rows[2].stale).toBe(true);
  });

  it("nothing in means nothing out, never a throw", () => {
    expect(listRows(null)).toEqual([]);
    expect(listRows({})).toEqual([]);
    expect(listRows({ documents: [{ id: "X" }] })).toEqual([]);
  });

  it("the address is the document and the line its block opens on", () => {
    expect(addressOf({ id: "RFC-900" }, { line: 3 })).toBe("RFC-900#L3");
  });
});

describe("resultRows — a failure carries the comparison, not a transcript", () => {
  it("turns expected/received into one readable line, per failing step", () => {
    const rows = resultRows({
      tests: [
        { title: "two calls", passed: true, ms: 12, at: "RFCs/RFC-900.md#L3" },
        {
          title: "wrong",
          passed: false,
          ms: 4,
          at: "RFCs/RFC-900.md#L10",
          failures: [{ phase: "main", step: "Math.add({a:1})", namespace: "results.sum", expected: 99, received: 2 }],
        },
      ],
    });
    expect(rows[0].passed).toBe(true);
    expect(rows[1].failures[0].message).toBe("expected 99, got 2");
    expect(rows[1].failures[0].at).toBe("results.sum");
  });

  it("a failure with only a message keeps it — not every failure is a comparison", () => {
    const rows = resultRows({ tests: [{ passed: false, failures: [{ message: "the service did not answer" }] }] });
    expect(rows[0].failures[0].message).toBe("the service did not answer");
  });

  it("an expected value of `false` or `0` is still a comparison, not a missing one", () => {
    const rows = resultRows({ tests: [{ passed: false, failures: [{ expected: false, received: true }] }] });
    expect(rows[0].failures[0].message).toBe("expected false, got true");
    const zero = resultRows({ tests: [{ passed: false, failures: [{ expected: 0, received: 3 }] }] });
    expect(zero[0].failures[0].message).toBe("expected 0, got 3");
  });

  it("nothing in means nothing out", () => {
    expect(resultRows(null)).toEqual([]);
    expect(resultRows({ tests: [] })).toEqual([]);
  });
});

describe("summaryOf — it has to be able to say four different things", () => {
  it("says what is in scope before anything has run", () => {
    expect(summaryOf({ listed: LISTED })).toBe("3 specs in 2 documents");
  });

  it("says so when nothing was collected at all", () => {
    expect(summaryOf({ listed: { specs: 0, documents: [] } })).toBe("nothing to run here");
  });

  // THE BUG THIS CAUGHT, found by reading the live panel rather than the code: the hub answered
  // "projectCode required" and the summary fell straight through to the count, so the panel said
  // the project had no specs while the hub was answering 39 for that same project. A refusal
  // rendered as an absence is the one way this surface can lie, so it is pinned.
  it("surfaces a REFUSAL from the listing instead of calling it an absence", () => {
    expect(summaryOf({ listed: { error: "projectCode required" } })).toBe("projectCode required");
    expect(summaryOf({ listed: { error: "projectCode required", specs: 0, documents: [] } })).toBe(
      "projectCode required",
    );
  });

  it("counts a run", () => {
    expect(summaryOf({ listed: LISTED, ran: { tests: [{}, {}], passed: 1, failed: 1 } })).toBe(
      "2 ran — 1 passed, 1 failed",
    );
  });

  it("A RUN OF FOUR WITH A FIFTH UNBUILT IS NOT A CLEAN RUN OF FOUR — it says both", () => {
    const s = summaryOf({
      listed: LISTED,
      ran: { tests: [{}, {}], passed: 2, failed: 0, problems: [{ problem: "cannot read x.md" }] },
    });
    expect(s).toBe("2 ran — 2 passed, 0 failed · 1 could not be built");
  });

  it("an error with no results at all is the error, not a count of zero", () => {
    expect(summaryOf({ listed: LISTED, ran: { error: "no connected services for sv", tests: [] } })).toBe(
      "no connected services for sv",
    );
  });

  it("running beats everything — the panel never shows a stale count mid-run", () => {
    expect(summaryOf({ listed: LISTED, ran: { tests: [{}], passed: 1, failed: 0 }, running: true })).toBe("running…");
  });

  it("singular reads correctly — one spec, one document", () => {
    expect(summaryOf({ listed: { specs: 1, documents: [{ id: "a" }] } })).toBe("1 spec in 1 document");
  });
});

describe("scopeLabel — what is being run, in his words", () => {
  it("names each scope the way it was asked for", () => {
    expect(scopeLabel({ document: "RFC-076" })).toBe("RFC-076");
    expect(scopeLabel({ objective: "ARC-004-O2" })).toBe("objective ARC-004-O2");
    expect(scopeLabel({ arc: "ARC-004" })).toBe("ARC-004 — the arc and its plans");
    expect(scopeLabel({ project: "sv" })).toBe("sv — everything");
    expect(scopeLabel(null)).toBe("everything");
  });
});

describe("the join the two lists never had", () => {
  it("A LISTED SPEC CAN FIND ITS OWN OUTCOME. It never could: the listing keyed on the document ID and the hub stamps the PATH", () => {
    const listed = listRows(LISTED);
    const results = resultRows({
      tests: [
        { at: "RFCs/RFC-900.md#L3", title: "two calls", passed: true },
        { at: "RFCs/arcs/ARC-900.md#L4", title: "", passed: false, failures: [{ message: "nope" }] },
      ],
    });
    const byAt = new Map(results.map((r) => [r.at, r]));
    expect(byAt.get(listed[0].at).passed).toBe(true);
    expect(byAt.get(listed[2].at).passed).toBe(false);
    // the human address is still the human address, and it is a different string
    expect(listed[0].key).toBe("RFC-900#L3");
    expect(listed[0].at).toBe("RFCs/RFC-900.md#L3");
  });
});

describe("summaryOf — a run in flight has a number that moves", () => {
  it("counts what has settled out of what is in scope, rather than saying one fixed word", () => {
    const marks = { a: "pass", b: "pass", c: "running", d: "queued" };
    expect(summaryOf({ listed: LISTED, running: true, marks })).toBe("running — 2/4");
  });

  it("NAMES A FAILURE WHILE THE REST IS STILL GOING — one already in the bag is not a surprise for the end", () => {
    expect(summaryOf({ listed: LISTED, running: true, marks: { a: "fail", b: "queued" } })).toBe("running — 1/2 · 1 failed");
  });

  it("falls back to the bare word when there is nothing finer to say yet", () => {
    expect(summaryOf({ listed: LISTED, running: true })).toBe("running…");
    expect(summaryOf({ listed: LISTED, running: true, marks: {} })).toBe("running…");
  });
});
