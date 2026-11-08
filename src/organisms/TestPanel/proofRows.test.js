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

// ── WIDENING IS A READ, NEVER A RUN ───────────────────────────────────────────────────────────
// HIS CATCH, 2026-11-07: *"Why do all the tests run right away? Just because I clicked all to show
// all the tests."* The `⤢ all` control, titled "widen to the whole project", called `runProofs` —
// so asking to SEE every spec in the project executed every spec in the project, against live
// services, on one press.
//
// This reads the panel's real source rather than mounting it, for the reason the top of this file
// gives: a test that mounts the panel pulls in the rest of the organism. The claim is the one the
// panel's own comment makes — the run door is not in scope here, and the cards below are what run.
// A source claim is the right shape for it: the defect was not a wrong value, it was reaching for a
// function that should not have been within reach.
describe("the proofs panel lists; the cards run", () => {
  const src = require("fs").readFileSync(require.resolve("./ProofsPanel"), "utf8");

  it("does not import the bus's run door at all", () => {
    const imports = src.slice(0, src.indexOf("\n\n"));
    expect(imports).toMatch(/from "\.\.\/\.\.\/utils\/proofsBus"/);
    expect(imports).not.toMatch(/\brun as \w+/);
    expect(imports).toMatch(/\blist as listProofs\b/);
  });

  it("the widen control reaches the LIST door", () => {
    const widen = src.match(/const go = useCallback\(([^;]*)\);/);
    expect(widen).toBeTruthy();
    expect(widen[1]).toMatch(/listProofs/);
    expect(widen[1]).not.toMatch(/runProofs/);
  });

  it("and the button titled for widening is the one wired to it", () => {
    const btn = src.match(/title="widen to the whole project"[\s\S]{0,120}/);
    expect(btn).toBeTruthy();
    expect(btn[0]).toMatch(/onClick=\{\(\) => go\(\{\}\)\}/);
  });
});

// ── THE PANEL SAYS WHAT IT COULD NOT BUILD — his catch, on his own screen (2026-11-07) ─────────
// "The run blocks don't run, they don't say anything. It's just you click it and nothing's
// happened." The builder lived inline in the panel and `continue`d any spec whose steps all failed
// to resolve — the scope said "1 spec", the list rendered none of it, and a press ran nothing with
// no reason anywhere. These claims hold the builder to the two rules that end that: every skip is a
// NAMED issue, and a block's `{project=…}` picks which services its steps resolve against.
describe("buildProofCards — nothing is skipped silently", () => {
  const { buildProofCards } = require("./proofRows");
  const SVC = (projectCode, serviceId, modules) => ({
    projectCode,
    serviceId,
    system: { connectionData: { serviceId, modules: Object.entries(modules).map(([name, fns]) => ({ name, methods: fns.map((fn) => ({ fn })) })) } },
  });
  const ROW = (over = {}) => ({
    specKind: "run",
    document: "REP-X",
    line: 62,
    at: "path#L62",
    src: '- systemview.Agent.board({ "projectCode": "p", "brief": true })\n  - results.of = 2',
    attrs: {},
    ...over,
  });

  it("a spec whose steps resolve to nothing becomes a NAMED issue, never a silent skip", () => {
    const { cards, issues } = buildProofCards([ROW()], { projectCode: "systemview-test", services: [], allServices: [] });
    expect(cards).toHaveLength(0);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatch(/REP-X#L62/);
    expect(issues[0]).toMatch(/0 of 1 step/);
    expect(issues[0]).toMatch(/"systemview-test"/);
  });

  it("a block's {project=…} picks its pool, exactly as the window block and the headless runner do", () => {
    const hub = SVC("connected-services", "systemview", { Agent: ["board"] });
    const { cards, issues } = buildProofCards(
      [ROW({ attrs: { project: "connected-services" } })],
      { projectCode: "systemview-test", services: [], allServices: [hub] },
    );
    expect(issues).toHaveLength(0);
    expect(cards).toHaveLength(1);
    expect(cards[0].sections.steps).toHaveLength(1);
    expect(cards[0].namespace.serviceId).toBe("systemview");
  });

  it("a declared project with nothing connected says THAT, which is the reload-era symptom by name", () => {
    const { cards, issues } = buildProofCards(
      [ROW({ attrs: { project: "connected-services" } })],
      { projectCode: "systemview-test", services: [], allServices: [] },
    );
    expect(cards).toHaveLength(0);
    expect(issues[0]).toMatch(/nothing from that project is connected/);
  });

  it("a partial drop runs the resolved steps AND names the dropped ones — same deal as the block in the document", () => {
    const math = SVC("systemview-test", "TestService", { Math: ["add"] });
    const src = '- Math.add({ "a": 1 })\n  - results.sum = 1\n- Gone.Module.method({})\n  - results.ok = true';
    const { cards, issues } = buildProofCards([ROW({ src })], { projectCode: "systemview-test", services: [math], allServices: [math] });
    expect(cards).toHaveLength(1);
    expect(cards[0].sections.steps).toHaveLength(1);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatch(/1 of 2/);
  });

  it("a ::test reference matching no saved test is an issue too — the chip used to point at nothing in silence", () => {
    const { cards, issues } = buildProofCards(
      [{ specKind: "test", label: "Hub.Agent.board", document: "REP-X", line: 63, at: "p#L63" }],
      { projectCode: "systemview-test", savedTests: [] },
    );
    expect(cards).toHaveLength(0);
    expect(issues[0]).toMatch(/no saved test matches "Hub\.Agent\.board"/);
  });
});
