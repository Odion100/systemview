const { Argument } = require("./Argument.class");
const Test = require("./Test.class");

// RFC-020 — a named-action section entry resolves to that action's steps. A `{ use: <name> }` pulls the
// stored procedure's steps; an inline array is used as-is. NOT spliced into a built-in section — a named
// section is its OWN section (a peer of before/main/after).
function resolveSteps(val, resolveAction) {
  if (Array.isArray(val)) return val; // inline steps
  if (val && val.use) {
    const action = resolveAction && resolveAction(val.use);
    return (action && action.steps) || [];
  }
  return val ? [val] : [];
}

// The run-procedure — the ordered list of section names the engine loops. Always effectively bookended by
// before…after; events keep their historical slot (special: listened first). A test's own `run` overrides.
const DEFAULT_ORDER = ["before", "events", "main", "after"];

// RFC-020 — a test is a **sections object** keyed by section name `{ before, main, events, after, <named> }`
// (the reference target — `test.seedSum[0].results` is `obj(sections).get("seedSum.0.results")`) PLUS a
// **run-order** list of those names (what the engine loops). Two structures, decoupled: object = address,
// list = placement. Built-in sections come from the test's capitalized keys (back-compat); named sections
// from `ft.sections` (each `[steps]` or `{ use }`).
function initializeSavedTests(savedTests, connectedServices, client, extraHeaders, resolveAction) {
  return savedTests.map((ft) => {
    const { title, namespace } = ft;
    const sections = {}; // name -> [Test]; also the shared FullTest handed to every step for references

    const initSteps = (steps) =>
      (steps || []).map((step) =>
        resetTestClass(step, sections, connectedServices, false, client, extraHeaders)
      );

    // Built-in sections (capitalized on disk → lowercase keys).
    Object.entries({ before: ft.Before, main: ft.Main, events: ft.Events, after: ft.After }).forEach(
      ([name, steps]) => {
        sections[name] = initSteps(steps);
      }
    );
    // Named-action sections — peers of the built-ins, each its OWN section.
    Object.entries(ft.sections || {}).forEach(([name, val]) => {
      sections[name] = initSteps(resolveSteps(val, resolveAction));
    });

    // Match run-order names to real section keys: a named section keeps its case (`seedSum`), while a
    // built-in given as "Before" normalizes to `before`. Unknown names drop out.
    const order = (ft.run || DEFAULT_ORDER)
      .map((n) => {
        const name = String(n);
        return sections[name] ? name : sections[name.toLowerCase()] ? name.toLowerCase() : name;
      })
      .filter((n) => sections[n]);

    return { sections, order, title, namespace };
  });
}

const resetTestClass = (test, FullTest, connectedServices, editMode, client, extraHeaders) => {
  return new Test({
    ...test,
    // `|| []` — defensive: a real test step always has args, but this keeps a stray/unexpanded step from
    // hard-crashing the whole run (RFC-020: `{ use }` steps are expanded away before they reach here).
    args: (test.args || []).map(
      (arg) =>
        new Argument(arg.name, FullTest, arg.input_type, arg.input, arg.targetValues)
    ),
    editMode,
    client,
    extraHeaders,
    FullTest, // RFC-020 — so `validate` can resolve `tv()` references in evaluation values
  }).getConnection(connectedServices);
};

module.exports = {
  initializeSavedTests,
  resetTestClass,
  resolveSteps,
};
