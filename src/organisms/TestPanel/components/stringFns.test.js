import {
  fnCall,
  splitFnArgs,
  isFunction,
  isDateFunction,
  isMathFunction,
  evalMathFn,
  strFn,
} from "./test-helpers";

// THE FIRST TESTS THESE HELPERS HAVE EVER HAD. `strFn` has been resolving `date()`, `random()` and
// `mockFile()` in every saved spec's arguments with zero coverage — found while adding arithmetic,
// which is the second thing that ever needed to compose with a reference.

describe("splitFnArgs — top-level commas only", () => {
  it("keeps a nested call whole instead of tearing it at its comma", () => {
    expect(splitFnArgs("tv(steps[0].results.found), -1")).toEqual([
      "tv(steps[0].results.found)",
      "-1",
    ]);
  });
  it("does not split inside quotes, brackets or braces", () => {
    expect(splitFnArgs('"a,b", [1,2], { "k": 1 }')).toEqual(['"a,b"', "[1,2]", '{ "k": 1 }']);
  });
  it("is empty for an empty argument list", () => {
    expect(splitFnArgs("")).toEqual([]);
  });
});

describe("fnCall — the one call parser, and it NESTS", () => {
  // THE BUG THIS FIXES: four separate regexes each forbade `)` inside an argument, so no string
  // function could take another as an operand. `date(tv(...))` failed at the matcher and stayed a
  // literal string — the assertion then compared against the characters "date(tv(...))".
  it("reads a name and nested arguments", () => {
    expect(fnCall("add(tv(steps[0].results.found), -1)")).toEqual({
      name: "add",
      argsRaw: "tv(steps[0].results.found), -1",
      args: ["tv(steps[0].results.found)", "-1"],
    });
  });
  it("answers null for something that is not a call", () => {
    expect(fnCall("hello")).toBeNull();
    expect(fnCall("")).toBeNull();
  });
  it("isFunction now accepts a nested call, which is the whole point", () => {
    expect(isFunction("date(tv(a.b))")).toBe(true);
    expect(isFunction("plain string")).toBe(false);
  });
  it("the existing matchers still answer for their own calls", () => {
    expect(isDateFunction("date(2020-01-01)")).toBe(true);
    expect(isDateFunction("Date()")).toBe(true);
    expect(isDateFunction("add(1,2)")).toBe(false);
  });
});

describe("math as a string function", () => {
  it("supplies the four operations JavaScript's Math does not have", () => {
    expect(evalMathFn("add(21,1)")).toBe(22);
    expect(evalMathFn("subtract(22,1)")).toBe(21);
    expect(evalMathFn("multiply(3,4)")).toBe(12);
    expect(evalMathFn("divide(22,2)")).toBe(11);
  });
  it("passes the rest through to Math by name", () => {
    expect(evalMathFn("max(3,9)")).toBe(9);
    expect(evalMathFn("min(3,9)")).toBe(3);
    expect(evalMathFn("abs(-4)")).toBe(4);
    expect(evalMathFn("round(2.6)")).toBe(3);
    expect(evalMathFn("floor(2.6)")).toBe(2);
    expect(evalMathFn("ceil(2.1)")).toBe(3);
  });
  it("nests", () => {
    expect(evalMathFn("add(subtract(22,1),1)")).toBe(22);
  });
  // THE FAILURE MODE THAT MATTERS: an unresolved operand must NOT become NaN. NaN compares unequal
  // to everything, so a BROKEN EXPRESSION would read as a genuine failed assertion — which is worse
  // than not having arithmetic at all.
  it("is UNRESOLVABLE rather than NaN when an operand is not a number", () => {
    expect(evalMathFn("add(tv(x),1)")).toBeNull();
    expect(evalMathFn("divide(1,abc)")).toBeNull();
  });
  it("is null for a name that is not a math function", () => {
    expect(evalMathFn("date(2020-01-01)")).toBeNull();
    expect(isMathFunction("add(1,2)")).toBe(true);
    expect(isMathFunction("date()")).toBe(false);
  });
});

describe("strFn dispatches math beside the generators it already had", () => {
  it("evaluates arithmetic", () => {
    expect(strFn("subtract(22,1)")).toBe(21);
  });
  it("leaves an unresolvable call as the literal string, so a typo is visible", () => {
    expect(strFn("add(tv(nope),1)")).toBe("add(tv(nope),1)");
  });
  it("leaves a plain string alone", () => {
    expect(strFn("hello")).toBe("hello");
  });
  it("still resolves a date", () => {
    expect(typeof strFn("date(2020-01-01)")).toBe("string");
    expect(strFn("date(2020-01-01)")).toMatch(/^2020-01-01T/);
  });
});

import { resolveValueString } from "./test-helpers";

describe("resolveValueString — references first, then the functions, as ONE sequence", () => {
  const steps = { "steps[1].results.total": 22, "steps[0].results.name": "hello world" };
  const resolveOne = (inner) => steps[inner];

  it("resolves a whole-value reference and keeps its type", () => {
    expect(resolveValueString("tv(steps[1].results.total)", resolveOne)).toBe(22);
  });

  it("resolves a reference INSIDE a math call and then does the math", () => {
    expect(resolveValueString("add(tv(steps[1].results.total), 1)", resolveOne)).toBe(23);
    expect(resolveValueString("subtract(tv(steps[1].results.total), 1)", resolveOne)).toBe(21);
  });

  // THE DIAGNOSTIC THAT MATTERS: when the reference resolves to the WRONG THING, the failure shows
  // what it resolved to — not NaN, and not the original expression. That is what tells a reader the
  // reference is pointing at the wrong field rather than being broken.
  it("shows what a reference RESOLVED TO when the math cannot proceed", () => {
    expect(resolveValueString("add(tv(steps[0].results.name), 1)", resolveOne)).toBe(
      'add("hello world", 1)',
    );
  });

  it("leaves an unresolvable reference visible as itself", () => {
    expect(resolveValueString("add(tv(nope.missing), 1)", resolveOne)).toBe("add(tv(nope.missing), 1)");
  });

  // NESTING, which is the thing a single substitution pass could not do at all.
  it("nests a call inside a call", () => {
    expect(resolveValueString("add(tv(steps[1].results.total), subtract(tv(steps[1].results.total), 2))", resolveOne)).toBe(42);
  });

  it("lets a reference ride inside another string function", () => {
    // A reference path must contain `results`, `error` or `args` — that is what stops any dotted
    // word being read as one. `tv(s.at)` is not a reference; `tv(steps[0].results.at)` is.
    const withDate = { "steps[0].results.at": "2020-01-01" };
    expect(resolveValueString("date(tv(steps[0].results.at))", (i) => withDate[i])).toMatch(/^2020-01-01T/);
  });

  // THE PREFIX THAT WAS REQUIRED IN ONE PLACE ONLY. Every documented example omits `test.`, the
  // resolver strips it, and the recogniser used to demand it — so `tv(steps[0].results.total)`
  // reached services as literal characters. Both forms resolve now.
  it("accepts the documented short form AND the test.-prefixed one", () => {
    expect(resolveValueString("tv(steps[1].results.total)", resolveOne)).toBe(22);
    expect(resolveValueString("tv(test.steps[1].results.total)", (i) =>
      steps[i.replace(/^test\./, "")])).toBe(22);
  });

  it("passes a plain value straight through", () => {
    expect(resolveValueString("22", resolveOne)).toBe("22");
    expect(resolveValueString("just a string", resolveOne)).toBe("just a string");
  });
});
