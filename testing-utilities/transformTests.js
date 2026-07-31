const { Argument } = require("./Argument.class");
const Test = require("./Test.class");

// RFC-020 — expand `{ use: <name> }` steps by SPLICING the named action's steps inline at that position,
// recursively, cycle-guarded. `resolveAction(name)` returns the action ({ steps }) or null; when absent
// (e.g. the browser) sections pass through untouched, so this is transport-agnostic. Each spliced step is
// tagged with `actionName` (innermost wins) so a by-name reference — test.before.signIn.results — resolves.
function expandSection(steps, resolveAction, seen = []) {
  const out = [];
  for (const step of steps || []) {
    if (step && step.use) {
      const name = step.use;
      if (seen.includes(name)) continue; // cycle guard — A → B → A stops here
      const action = resolveAction && resolveAction(name);
      if (action && action.steps) {
        expandSection(action.steps, resolveAction, [...seen, name]).forEach((s) =>
          out.push(s.actionName ? s : { ...s, actionName: name })
        );
      }
      // unresolved use → dropped (can't run a missing action)
    } else {
      out.push(step);
    }
  }
  return out;
}

function initializeSavedTests(savedTests, connectedServices, client, extraHeaders, resolveAction) {
  return savedTests.map((ft) => {
    // context matters
    const newTests = [];
    const { title, namespace } = ft;
    const expand = (section) => (resolveAction ? expandSection(section, resolveAction) : section);

    const Before = expand(ft.Before).map((test) =>
      resetTestClass(test, newTests, connectedServices, false, client, extraHeaders)
    );
    const Main = expand(ft.Main).map((test) =>
      resetTestClass(test, newTests, connectedServices, false, client, extraHeaders)
    );
    const Events = expand(ft.Events).map((test) =>
      resetTestClass(test, newTests, connectedServices, false, client, extraHeaders)
    );
    const After = expand(ft.After).map((test) =>
      resetTestClass(test, newTests, connectedServices, false, client, extraHeaders)
    );
    newTests.push(Before);
    newTests.push(Main);
    newTests.push(Events);
    newTests.push(After);
    return { Before, Main, Events, After, title, namespace };
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
  }).getConnection(connectedServices);
};

const resetFullTest = (FullTest, connectedServices, editMode) => {
  //context matters
  const newTests = [[], [], [], []];
  return FullTest.map((section, i) => {
    return section.map((test) => {
      const newTest = resetTestClass(test, newTests, connectedServices, editMode);
      newTests[i].push(newTest);
      return newTest;
    });
  });
};
module.exports = {
  initializeSavedTests,
  resetTestClass,
  resetFullTest,
  expandSection,
};
