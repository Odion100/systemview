import Argument from "../TestPanel/components/Argument.class";
import Test from "../TestPanel/components/Test.class";

// RFC-020 — a named-action section entry resolves to that action's steps: `{ use: <name> }` pulls the
// stored procedure's steps; an inline array is used as-is. Mirrors testing-utilities/transformTests.js.
export function resolveSteps(val, resolveAction) {
  if (Array.isArray(val)) return val;
  if (val && val.use) {
    const action = resolveAction && resolveAction(val.use);
    return (action && action.steps) || [];
  }
  return val ? [val] : [];
}

// Resolve a raw saved test's named-action sections (`{ use }` → the action's steps) so the browser render
// path (which has no resolver) can show/run them. The CLI resolves inside initializeSavedTests; the
// browser pre-resolves at fetch time — see TestPanel.
export function resolveTestActions(ft, resolveAction) {
  if (!ft || !ft.sections) return ft;
  const sections = {};
  const sectionRefs = {}; // instance key → underlying action name (preserved through resolution for edit)
  Object.entries(ft.sections).forEach(([name, val]) => {
    sections[name] = resolveSteps(val, resolveAction);
    if (val && val.use) sectionRefs[name] = val.use;
  });
  return { ...ft, sections, sectionRefs };
}

// The run-procedure default: before → events → main → after (events special, historical slot).
const DEFAULT_ORDER = ["before", "events", "main", "after"];

// RFC-020 — a test becomes a **sections object** `{ before, main, events, after, <named> }` (the reference
// target + shared FullTest) PLUS a **run-order** list of section names (what the engine loops). Named
// sections are peers of the built-ins. Mirrors testing-utilities/transformTests.js.
export function initializeSavedTests(savedTests, connectedServices, resolveAction) {
  return savedTests.map((ft) => {
    const { title, namespace } = ft;
    const sections = {}; // name -> [Test]; also the shared FullTest handed to every step for references

    const initSteps = (steps) =>
      (steps || []).map((step) => resetTest(step, sections, connectedServices, false));

    Object.entries({ before: ft.Before, main: ft.Main, events: ft.Events, after: ft.After }).forEach(
      ([name, steps]) => {
        sections[name] = initSteps(steps);
      }
    );
    Object.entries(ft.sections || {}).forEach(([name, val]) => {
      sections[name] = initSteps(resolveSteps(val, resolveAction));
    });

    // Match run-order names to real section keys: a named section keeps its case (`seedSum`); a built-in
    // given as "Before" normalizes to `before`.
    const order = (ft.run || DEFAULT_ORDER)
      .map((n) => {
        const name = String(n);
        return sections[name] ? name : sections[name.toLowerCase()] ? name.toLowerCase() : name;
      })
      .filter((n) => sections[n]);

    return { sections, order, title, namespace };
  });
}

export const resetTest = (test, FullTest, connectedServices, editMode) => {
  return new Test({
    ...test,
    args: (test.args || []).map(
      (arg) => new Argument(arg.name, FullTest, arg.input_type, arg.input, arg.targetValues)
    ),
    editMode,
    FullTest, // RFC-020 — the sections object, so refs/`tv()` resolve
  }).getConnection(connectedServices);
};

// RFC-020 — load a raw saved test into the SCRATCHPAD: built-in section arrays + the test's named-action
// sections, ALL bound to one shared sections object so cross-section references resolve while editing.
// Named sections come back in the test's run-order. Returns { Tests: [B,M,E,A], named: [{name, tests}] }.
export const resetScratchpad = (ft, connectedServices) => {
  const sections = { before: [], main: [], events: [], after: [] };
  const init = (steps) =>
    (steps || []).map((test) => resetTest(test, sections, connectedServices));
  sections.before = init(ft.Before);
  sections.main = init(ft.Main);
  sections.events = init(ft.Events);
  sections.after = init(ft.After);

  const namedNames = Object.keys(ft.sections || {});
  const runList = ft.run || [];
  const runOrder = runList.filter((n) => namedNames.includes(n));
  const ordered = runOrder.concat(namedNames.filter((n) => !runOrder.includes(n)));
  const mainIdx = runList.indexOf("main");
  const named = ordered.map((name) => {
    const steps = Array.isArray(ft.sections[name]) ? ft.sections[name] : [];
    sections[name] = init(steps);
    // Placement relative to main (the scratchpad's two insertion points): before main = "pre", after = "post".
    const pos = mainIdx !== -1 && runList.indexOf(name) > mainIdx ? "post" : "pre";
    const action = (ft.sectionRefs && ft.sectionRefs[name]) || name;
    return { name, action, tests: sections[name], pos };
  });

  return { Tests: [sections.before, sections.main, sections.events, sections.after], named };
};
