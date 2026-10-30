// THE PROOFS COLLECTOR — collecting a document's runnable specs, and the two rules that keep the
// answer honest: a `cmd` is never one of them, and a document carrying several registration leaves
// is still ONE document.
//
// THE SUITE LEAVES HIS STORE ALONE. `collectProofs` reads the registry through an injected door, so
// nothing here touches ~/.autobot — but the override is set anyway, because a future edit that
// reaches for the real reader would otherwise write his rows silently.
process.env.AUTOBOT_DOCUMENTS = require("path").join(require("os").tmpdir(), `sv-proofs-test-${process.pid}.json`);

const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test, describe } = require("node:test");
const { collectProofs, scopeDocuments, bodyOf, arcOf } = require("./proofs");
const { specFromRun, parseSteps, toEvaluations, toArg } = require("../testing-utilities/runSpec");

// ---- the fixture tree -------------------------------------------------------------------------
const root = fs.mkdtempSync(path.join(os.tmpdir(), "sv-proofs-"));
const write = (rel, text) => {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, text);
  return rel;
};

// A document's inventory the way the shell's parse records it — kind, label, title, attrs and an
// exact span. These spans are the real ones: written from the files below rather than guessed.
const inventoryOf = (rel, specs) => specs.map((s) => ({ ...s, attrs: s.attrs || {} }));

const PLAN = write(
  "RFCs/RFC-900-a-plan.md",
  [
    "::rfc{id=RFC-900 arc=ARC-900-O1}", // 1
    "", // 2
    ":::run{title=\"two calls\"}", // 3
    '- Math.add { "a": 1, "b": 2 }', // 4
    "  - results.sum = 3", // 5
    "- Math.add(4, 5)", // 6
    ":::", // 7
    "", // 8
    ":::cmd", // 9
    "yarn test", // 10
    ":::", // 11
    "", // 12
    "::test[Math.chainUse]", // 13
  ].join("\n"),
);

const ARCDOC = write(
  "RFCs/arcs/ARC-900-the-arc.md",
  ["::arc{id=ARC-900 owner=sv}", "", ":::run{title=\"the arc's own\"}", '- Math.add { "a": 9 }', ":::"].join("\n"),
);

const PAIR = write(
  "RFCs/proofs/mock-pair.md",
  ["::report{id=FIX-900 as=spec retain=permanent}", "::rfc{id=MOCK-RFC-900}", "", ":::run{title=\"the walk\"}", '- Math.add { "a": 1 }', ":::"].join("\n"),
);

const BARE = write("RFCs/RFC-901-no-specs.md", "::rfc{id=RFC-901}\n\nnothing runnable in here\n");

const ROWS = [
  {
    id: "RFC-900",
    kind: "rfc",
    project: "sv",
    path: PLAN,
    arc: "ARC-900-O1",
    specs: inventoryOf(PLAN, [
      { kind: "run", label: "", title: "two calls", line: 3, end: 7 },
      { kind: "test", label: "Math.chainUse", title: "", line: 13, end: 13 },
    ]),
  },
  {
    id: "ARC-900",
    kind: "arc",
    project: "sv",
    path: ARCDOC,
    specs: inventoryOf(ARCDOC, [{ kind: "run", label: "", title: "the arc's own", line: 3, end: 5 }]),
  },
  // ONE FILE, TWO LEAVES, TWO ROWS — each carrying the same inventory.
  {
    id: "FIX-900",
    kind: "report",
    project: "sv",
    path: PAIR,
    specs: inventoryOf(PAIR, [{ kind: "run", label: "", title: "the walk", line: 4, end: 6 }]),
  },
  {
    id: "MOCK-RFC-900",
    kind: "rfc",
    project: "sv",
    path: PAIR,
    specs: inventoryOf(PAIR, [{ kind: "run", label: "", title: "the walk", line: 4, end: 6 }]),
  },
  { id: "RFC-901", kind: "rfc", project: "sv", path: BARE },
  // ANOTHER PROJECT's document, which must never be collected.
  { id: "RFC-902", kind: "rfc", project: "other", path: "x.md", specs: inventoryOf("x.md", [{ kind: "run", line: 1, end: 3 }]) },
];

const registry = ({ projectCode } = {}) => ROWS.filter((r) => !projectCode || r.project === projectCode);
const deps = { registry, rootOf: (pc) => (pc === "sv" ? root : "") };

describe("collectProofs — the scope picks the documents", () => {
  test("a project collects every document that carries a spec, and nothing that doesn't", () => {
    const got = collectProofs({ projectCode: "sv" }, deps);
    assert.deepStrictEqual(
      got.documents.map((d) => d.id),
      ["RFC-900", "ARC-900", "FIX-900"],
      "RFC-901 has no specs; MOCK-RFC-900 is the same FILE as FIX-900",
    );
    assert.strictEqual(got.specs, 4, "two in the plan, one in the arc, one in the pair");
  });

  test("another project's documents are never collected", () => {
    assert.ok(!collectProofs({ projectCode: "sv" }, deps).documents.some((d) => d.project !== "sv"));
    assert.strictEqual(collectProofs({ projectCode: "other" }, deps).documents.length, 1);
  });

  test("a document scope is that document alone", () => {
    const got = collectProofs({ projectCode: "sv", document: "RFC-900" }, deps);
    assert.deepStrictEqual(got.documents.map((d) => d.id), ["RFC-900"]);
    assert.deepStrictEqual(got.scope, { document: "RFC-900" });
  });

  test("an objective scope is the plans pointed at THAT objective", () => {
    assert.deepStrictEqual(
      collectProofs({ projectCode: "sv", objective: "ARC-900-O1" }, deps).documents.map((d) => d.id),
      ["RFC-900"],
    );
    assert.deepStrictEqual(
      collectProofs({ projectCode: "sv", objective: "ARC-900-O2" }, deps).documents.map((d) => d.id),
      [],
      "an objective nobody planned collects nothing — it does not fall back to the arc",
    );
  });

  test("an arc scope is its own document plus every plan on any of its objectives", () => {
    assert.deepStrictEqual(
      collectProofs({ projectCode: "sv", arc: "ARC-900" }, deps).documents.map((d) => d.id).sort(),
      ["ARC-900", "RFC-900"],
    );
  });

  test("a document carrying two leaves is collected ONCE — deduped by path, not by row", () => {
    const ids = collectProofs({ projectCode: "sv" }, deps).documents.map((d) => d.id);
    assert.ok(ids.includes("FIX-900") && !ids.includes("MOCK-RFC-900"), "one of the pair, never both");
    // The guard that matters: the spec count cannot double because a fixture declared a second leaf.
    assert.strictEqual(
      scopeDocuments(registry({ projectCode: "sv" }), {}).filter((r) => r.path === PAIR).length,
      1,
    );
  });

  test("projectCode is required — a collector with no project would answer for the whole machine", () => {
    assert.strictEqual(collectProofs({}, deps).error, "projectCode required");
  });
});

describe("the span is the address — a body is sliced, never re-parsed", () => {
  const lines = fs.readFileSync(path.join(root, PLAN), "utf8").split("\n");

  test("bodyOf returns exactly what sits between the fences", () => {
    const body = bodyOf(lines, { line: 3, end: 7 });
    assert.deepStrictEqual(body.split("\n"), [
      '- Math.add { "a": 1, "b": 2 }',
      "  - results.sum = 3",
      "- Math.add(4, 5)",
    ]);
    assert.ok(!/:::/.test(body), "neither fence is in the body");
  });

  test("a leaf block has no body — a one-line ::test cannot be sliced into steps", () => {
    assert.strictEqual(bodyOf(lines, { line: 13, end: 13 }), "");
  });
});

describe("arcOf — a plan's objective address names its arc", () => {
  test("an objective address reduces to its arc", () => {
    assert.strictEqual(arcOf("ARC-004-O2"), "ARC-004");
    assert.strictEqual(arcOf("arc-004-o2"), "ARC-004", "case is not a different arc");
  });

  // THE BUG THIS CAUGHT, and the reason the rule is the shell's and not a narrower copy: written as
  // `/^(ARC-\d+)(?:-O\d+)?$/` it matched nothing in the fixture whose arc is MOCK-ARC, so an
  // arc-scoped run collected the arc's own document and NONE of its six plans — and reported the
  // shrink as "1 passed", which reads like a pass.
  test("AN ARC ID DOES NOT HAVE TO LOOK LIKE ARC-004", () => {
    assert.strictEqual(arcOf("MOCK-ARC-O3"), "MOCK-ARC");
    assert.strictEqual(arcOf("SOME-LONG-NAME-O12"), "SOME-LONG-NAME");
  });

  test("anything that is not an objective address names no arc", () => {
    assert.strictEqual(arcOf("RFC-073"), "", "a plan with no objective suffix serves no objective");
    assert.strictEqual(arcOf("ARC-004"), "", "an arc id is matched by the row's own id, not through here");
    assert.strictEqual(arcOf(""), "");
    assert.strictEqual(arcOf(null), "");
  });

  // And the scope that bug broke, end to end over the fixture's own shape.
  test("an arc scope reaches a plan whose arc id is not ARC-nnn", () => {
    const rows = [
      { id: "MOCK-ARC", kind: "arc", project: "sv", path: "a.md", specs: [{ kind: "run", line: 1, end: 3 }] },
      { id: "MOCK-RFC-2", kind: "rfc", project: "sv", path: "b.md", arc: "MOCK-ARC-O3", specs: [{ kind: "run", line: 1, end: 3 }] },
      { id: "OTHER", kind: "rfc", project: "sv", path: "c.md", arc: "OTHER-ARC-O1", specs: [{ kind: "run", line: 1, end: 3 }] },
    ];
    assert.deepStrictEqual(
      scopeDocuments(rows, { arc: "MOCK-ARC" }).map((r) => r.id),
      ["MOCK-ARC", "MOCK-RFC-2"],
      "the arc and its plan, and never another arc's plan",
    );
  });
});

// ---- the builder: the half that has to agree with the window ----------------------------------
//
// These are the SAME assertions the window's own run-block tests make, run against the CJS half. The
// two implementations cannot import each other (webpack's module scope forbids `src/` reaching above
// itself, and `src/` is not in the package's `files`), so this is what holds them together: a drift
// between headless and on-screen fails here instead of surfacing as a proof that runs differently in
// the two places.
describe("runSpec — the headless builder matches the window's grammar", () => {
  test("steps, nested assertions and the call form", () => {
    const steps = parseSteps('- Math.add { "a": 1, "b": 2 }\n  - results.sum = 3\n- Math.add(4, 5)');
    assert.strictEqual(steps.length, 2, "the indented bullet is an assertion, not a third step");
    assert.deepStrictEqual(steps[0].checks, ["results.sum = 3"]);
    assert.strictEqual(steps[1].rest, "(4, 5)");
  });

  test("a `use:` line stays a shared-action reference", () => {
    assert.deepStrictEqual(parseSteps("- use: seedSum"), [{ use: "seedSum" }]);
  });

  test("`expect` and ✓ are accepted spellings of the same assertion", () => {
    const steps = parseSteps("- Math.add(1)\n  - expect results.sum = 1\n  - ✓ results.ok = true");
    assert.deepStrictEqual(steps[0].checks, ["results.sum = 1", "results.ok = true"]);
  });

  test("evaluations carry their validator by the type of the value", () => {
    const [num, bool, str, like, min] = toEvaluations([
      "results.sum = 3",
      "results.ok = true",
      'results.label = "first"',
      "results.name ~ ser_",
      "results.count >= 1",
    ]);
    assert.deepStrictEqual(num.validations, [{ name: "numEquals", value: 3 }]);
    assert.deepStrictEqual(bool.validations, [{ name: "boolEquals", value: true }]);
    assert.deepStrictEqual(str.validations, [{ name: "strEquals", value: "first" }]);
    assert.deepStrictEqual(like.validations, [{ name: "isLike", value: "ser_" }]);
    assert.deepStrictEqual(min.validations, [{ name: "min", value: 1 }], ">= maps onto the validator's inclusive bound");
  });

  test("an unreadable assertion is DROPPED AND COUNTED, never silently passed", () => {
    assert.strictEqual(toEvaluations(["this is not an assertion"]).length, 0);
    const built = specFromRun(
      { src: "- Math.add(1)\n  - this is not an assertion", kind: "container" },
      { projectCode: "sv", serviceId: "Test" },
      [],
    );
    assert.strictEqual(built.Main.length, 1, "the step still runs");
    assert.match(built.problems[0], /couldn't be read/, "and the run says what it dropped");
  });

  test("a tv() reference is lifted out of the payload into targetValues", () => {
    const arg = toArg('{ "base": tv(steps[0].results.sum) }');
    assert.strictEqual(arg.input.base, "test.steps[0].results.sum", "rooted at test. for the engine");
    assert.deepStrictEqual(arg.targetValues[0].source_map, ["input", "base"]);
  });

  test("a non-JSON argument stays a string — the engine resolves it at run time", () => {
    assert.strictEqual(toArg("user-random(6)@test.com").input, "user-random(6)@test.com");
    assert.strictEqual(toArg("user-random(6)@test.com").input_type, "string");
  });

  test("a `use:` before the first call runs BEFORE main, and after it runs after", () => {
    const built = specFromRun(
      { src: "- use: seedSum\n- Math.add(1)\n- use: cleanup", kind: "container" },
      { projectCode: "sv", serviceId: "Test" },
      [],
    );
    assert.deepStrictEqual(built.run, ["seedSum", "main", "cleanup"]);
    assert.deepStrictEqual(built.sections.seedSum, { use: "seedSum" });
  });

  test("a step's {title=} is its label, and is not mistaken for an argument", () => {
    const built = specFromRun(
      { src: '- Math.add({ "a": 1 }){title="adds two"}', kind: "container" },
      { projectCode: "sv", serviceId: "Test" },
      [],
    );
    assert.strictEqual(built.Main[0].title, "adds two");
    assert.deepStrictEqual(built.Main[0].args[0].input, { a: 1 });
  });

  test("the object shorthand also ends in braces and is left alone as data", () => {
    const built = specFromRun(
      { src: '- Math.add { "a": 1 }', kind: "container" },
      { projectCode: "sv", serviceId: "Test" },
      [],
    );
    assert.deepStrictEqual(built.Main[0].args[0].input, { a: 1 }, "JSON is `\"key\":`, an attribute is `key=`");
  });

  test("a two-segment step with no service in scope resolves off the connection tree", () => {
    const services = [
      {
        projectCode: "sv",
        system: { connectionData: { serviceId: "Test", modules: [{ name: "Math", methods: [{ name: "add" }] }] } },
      },
    ];
    const built = specFromRun({ src: "- Math.add(1)", kind: "container" }, { projectCode: "sv" }, services);
    assert.strictEqual(built.Main[0].namespace.serviceId, "Test", "found by asking which service has Math.add");
  });

  test("and when nothing in the project answers, the step is a PROBLEM, not a pass", () => {
    const built = specFromRun({ src: "- Nope.missing(1)", kind: "container" }, { projectCode: "sv" }, []);
    assert.strictEqual(built.Main.length, 0);
    assert.match(built.problems[0], /no connected service in sv has "Nope.missing"/);
  });

  test("a run block's address is its first step's namespace — never undefined.undefined", () => {
    const built = specFromRun(
      { src: "- Math.add(1)", attrs: { title: "two calls" }, kind: "container" },
      { projectCode: "sv", serviceId: "Test" },
      [],
    );
    assert.strictEqual(built.title, "two calls");
    assert.deepStrictEqual(built.namespace, { projectCode: "sv", serviceId: "Test", moduleName: "Math", methodName: "add" });
    assert.strictEqual(specFromRun({ src: "", kind: "container" }, {}, []).namespace, null, "no steps, no address");
  });

  test("the saved form (::run[name]) is one `use` section and nothing else", () => {
    const built = specFromRun({ src: "", label: "seedSum", kind: "leaf" }, { projectCode: "sv" }, []);
    assert.deepStrictEqual(built.run, ["seedSum"]);
    assert.strictEqual(built.Main.length, 0);
  });

  test("a ::run naming nothing says so rather than building an empty run", () => {
    const built = specFromRun({ src: "", kind: "leaf" }, {}, []);
    assert.match(built.problems[0], /name an action/);
  });
});

process.on("exit", () => fs.rmSync(root, { recursive: true, force: true }));
