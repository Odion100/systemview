// systemview-test/methods/Plugin.js — the `Plugin` module of `Test`: THE TEST-SIDE SURFACE.
//
// WHY THIS EXISTS AS ITS OWN MODULE. Every other module here is a DOOR: it calls, reads, counts and
// hands back what it saw, and it never decides whether the answer is good — the moment a door
// judges, the evidence stops being readable from the document that asked, because the judgment has
// moved inside the thing being judged. So doors stay transcription, and anything that DOES
// something on the test's behalf needs a different home.
//
// `support/fixtures.js` is the other half of that rule and it is deliberately NOT in this folder:
// hostProject serves every file in `methods/` as a module, so a helper dropped here becomes a
// callable surface by accident. That reason is sound and it is not an argument against this file —
// it is an argument against ACCIDENTAL surfaces. This one is deliberate and it is named so nobody
// mistakes it for product contract: `Test.Plugin.*` is test-side, by its name, wherever it shows up.
//
// THE PATTERN IS buAPI'S, and it is the one to copy. There, `systemview-plugin` is mounted with
// `module: helpers` and those functions become `<Service>.Plugin.<fn>` — `Plugin.createMockUsers`,
// `Plugin.clearMockGames`, `Plugin.mockGame`. A spec's `Before` steps then call `Plugin.*` to build
// the world with REAL calls, `Main` calls the method under test, `After` clears up. Our service is
// hosted by `api/hostProject.js` rather than by the plugin's `module:` option, so the equivalent is
// a module file with that name — same surface, same labelling, loaded the way this service loads
// everything else.
//
// IT STARTS NEARLY EMPTY ON PURPOSE. The point of landing it now is that the next thing which wants
// to DO something for a spec has an honest home, instead of being written into a door because there
// was nowhere else to put it. One tenant, below, because an empty module teaches nothing.
const fixtures = require("../support/fixtures");

/**
 * ARE THE FIXTURES UP — as a step a spec can assert, rather than a precondition each door re-checks.
 *
 * Today `Api.js` calls `required()` internally, which means every door that needs a fixture carries
 * the same guard and a spec cannot see the precondition at all: it reads as sixteen failed
 * assertions when nothing was listening. As a `Before` step calling `Test.Plugin.fixturesRunning`,
 * the precondition is its OWN row — one red line naming the missing project and the command that
 * starts it, above assertions that never ran.
 *
 * Answers a shape, never a throw: `{ fixturesRunning, missing, why }`.
 */
async function fixturesRunning({ projects = [], chatOn = [] } = {}) {
  return fixtures.required(projects, { chatOn });
}

module.exports = { fixturesRunning };
