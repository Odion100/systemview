// systemview-test/methods/Plugin.js — test-side functions for the `Test` service.
//
// THIS FILE DOES NOT BECOME A MODULE OF ITS OWN. The systemview-plugin mounts a `Plugin` module on
// every service it decorates — getTests, saveTest, getConnection, the surface the test engine
// collects through — so a methods/Plugin.js mounted beside it would be a SECOND module with the
// same name: the record declares both method sets, the built client resolves one, and the whole
// service reads as a registry mismatch. Measured 2026-11-08: this one file made every runTests and
// runProofs in the project report "Test did not answer", which is how RFC-075's 27 proof chips came
// to resolve to nothing.
//
// So hostProject (api/hostProject.js) lifts this file OUT of the module list and hands it to the
// plugin's `module` option — the same door `Plugin.createMockUsers` rides in buAPI — and these
// functions land ON the real Plugin module, beside getTests. The calling convention is unchanged:
// a spec's step still says `Plugin.fixturesRunning`.
//
// `support/fixtures.js` stays out of methods/ because hostProject serves every file there as a
// callable surface; that rule is about ACCIDENTAL surfaces, and this file is a deliberate one.
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
