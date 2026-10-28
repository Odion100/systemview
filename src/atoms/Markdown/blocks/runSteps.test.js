import { parseSteps, splitStepAttrs } from "./runSteps";
import { toEvaluations } from "./RunBlock";

// THE FIRST TESTS THE RUN GRAMMAR HAS HAD. Written while adding a step label — the thing a saved
// spec's step always had and an inline step could not say, so `toStep` filled it with the call
// signature and a reader got `AutobotShell.Window.count({"selector":".md-claim"})` where a sentence
// belonged.

describe("splitStepAttrs — a label, told apart from the object shorthand", () => {
  it("pulls a trailing {title=…} off the step", () => {
    expect(splitStepAttrs('Window.count({ "selector": ".md-claim" }){title="count the claims"}')).toEqual({
      body: 'Window.count({ "selector": ".md-claim" })',
      attrs: { title: "count the claims" },
    });
  });
  // THE AMBIGUITY THIS RESOLVES: the bare-object shorthand also ends in braces. Attributes are
  // `key=`; JSON is `"key":`. A trailing group that is data stays data.
  it("leaves the OBJECT SHORTHAND alone — that brace group is an argument", () => {
    expect(splitStepAttrs('Math.add { "a": 1, "b": 2 }')).toEqual({
      body: 'Math.add { "a": 1, "b": 2 }',
      attrs: {},
    });
  });
  it("leaves a step with no attributes untouched", () => {
    expect(splitStepAttrs("Math.add(1, 2)")).toEqual({ body: "Math.add(1, 2)", attrs: {} });
  });
  it("takes single quotes or none", () => {
    expect(splitStepAttrs("Math.add(1,2){title='adds'}").attrs).toEqual({ title: "adds" });
    expect(splitStepAttrs("Math.add(1,2){title=adds}").attrs).toEqual({ title: "adds" });
  });
});

describe("parseSteps — the label reaches the step", () => {
  it("carries a title and still parses the call and its assertions", () => {
    const steps = parseSteps(
      [
        '- Window.count({ "selector": ".md-claim" }){title="count the claims on the page"}',
        "  - results.ok = true",
        '- Window.count({ "selector": ".md-claim__row" }){title="count the rows drawn for them"}',
        "  - results.found = tv(steps[0].results.found)",
      ].join("\n"),
    );
    expect(steps).toHaveLength(2);
    expect(steps[0].title).toBe("count the claims on the page");
    expect(steps[0].ns).toBe("Window.count");
    expect(steps[0].checks).toEqual(["results.ok = true"]);
    expect(steps[1].title).toBe("count the rows drawn for them");
    expect(steps[1].checks).toEqual(["results.found = tv(steps[0].results.found)"]);
  });
  it("a step with no label simply has none, and nothing else changes", () => {
    const steps = parseSteps(["- Math.add { \"a\": 1, \"b\": 2 }", "  - results.sum = 3"].join("\n"));
    expect(steps).toHaveLength(1);
    expect(steps[0].title).toBeUndefined();
    expect(steps[0].ns).toBe("Math.add");
    expect(steps[0].rest).toBe('{ "a": 1, "b": 2 }');
    expect(steps[0].checks).toEqual(["results.sum = 3"]);
  });
  it("a `use:` step is untouched by any of this", () => {
    expect(parseSteps("- use: seedSum")).toEqual([{ use: "seedSum" }]);
  });
});

// THE BOUNDS. `=` is the right answer for a count that comes out of the document — hard-code it and
// the spec goes red until somebody ups the number. A bound is for a value that grows every time the
// claimed thing runs, where "there is at least one" IS the claim. Without these, a step written
// `results.count >= 1` was silently dropped and the block asserted nothing.
describe("toEvaluations — bounds, and what is deliberately not one", () => {
  it("reads >= as the validator's inclusive min", () => {
    expect(toEvaluations(["results.count >= 1"])).toEqual([
      { namespace: "results.count", expected_type: "number", validations: [{ name: "min", value: 1 }], save: true },
    ]);
  });
  it("reads <= as the validator's inclusive max", () => {
    expect(toEvaluations(["results.elapsed <= 250"])).toEqual([
      { namespace: "results.elapsed", expected_type: "number", validations: [{ name: "max", value: 250 }], save: true },
    ]);
  });
  // `>` and `<` are absent ON PURPOSE: faking them as min(value+1) is wrong for anything that is
  // not an integer, and a bound that is quietly wrong is worse than one that visibly does not parse.
  it("DROPS a strict > rather than guessing at value+1", () => {
    expect(toEvaluations(["results.count > 1"])).toEqual([]);
  });
  it("drops a bound whose right-hand side is not a number", () => {
    expect(toEvaluations(["results.count >= many"])).toEqual([]);
  });
  // The regression the longest-first alternation protects: `>=` must not be read as a bare `=` with
  // a `>` stuck on the namespace.
  it("does not mistake >= for =", () => {
    const [ev] = toEvaluations(["results.count >= 2"]);
    expect(ev.namespace).toBe("results.count");
    expect(ev.validations[0].name).toBe("min");
  });
  it("still reads the three operators it always had", () => {
    expect(toEvaluations(["results.total = 5"])[0].validations[0]).toEqual({ name: "numEquals", value: 5 });
    expect(toEvaluations(["results.ok = true"])[0].validations[0]).toEqual({ name: "boolEquals", value: true });
    expect(toEvaluations(["results.name ~ ser_"])[0].validations[0]).toEqual({ name: "isLike", value: "ser_" });
  });
});
