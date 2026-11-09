// systemview-test/methods/BandPanel.js — THE LIVING SPEC FOR THE BAND SETTINGS PANE's RFC-078
// claims: c15 the pane replaces the popup, c17 a flip writes through the harness's own door, c19
// the two older sections keep every control they had.
//
// The subject is window render-and-wiring behaviour, which a `::test` chip cannot address because a
// jest suite has no namespace. So the suite becomes a door, the adapter Window.js established: run
// the real suite over the narrowest pattern and assert the NAMED cases, never a count — a count goes
// green when somebody deletes the case that mattered and leaves four that did not.
//
// EVERY FIELD HERE NAMES A CASE THAT EXISTS. The nudge-list half of this door (c16, c36, and c17's
// record-shaped cases) was removed with the list on 2026-11-09 rather than left transcribing cases
// that no longer run — a `passed()` against a deleted case answers `false`, which reads as a failing
// claim instead of a door pointing at nothing.
const { jest, passed } = require("../support/jestAdapter");

module.exports = {
  async settings() {
    const run = jest("AgentChat/BandSettings\\.test");
    return {
      suiteProducedResults: (run.tests || 0) > 0,
      failed: run.failed || 0,
      whyNot: run.why || "",
      cases: run.tests || 0,

      // c15 — the cog cannot pop anything up because it no longer HAS a panel; the pane is a
      // sibling of the tab row, which is why the open state lives in the band.
      cogOwnsNoPanel: passed(run, "renders one control, owns no panel, and reports its press upward"),
      cogReportsItsPressUpward: passed(run, "renders one control, owns no panel, and reports its press upward"),
      cogReadsPressedWhileOpen: passed(run, "reads pressed while the pane is open"),

      // c17 — each section writes through its OWN door, one field, and the panel keeps no copy.
      aWorklistKnobGoesToTheChasersDoor: passed(run, "a worklist knob goes to the chaser's door and nowhere else"),
      aCompactionKnobGoesToTheValvesDoor: passed(run, "an auto-compaction knob goes to the valve's door"),

      // §2.8 — THE MANAGER FIELD. Its placeholder is the honest default, and it commits on blur
      // because a text input wired straight to the door writes once per character.
      managerDrawsNobodyAsItsDefault: passed(run, "draws `nobody` as its placeholder"),
      typingWritesNothingUntilBlur: passed(run, "types without writing, and writes once on blur"),
      escapeAbandonsTheEdit: passed(run, "escape abandons the edit without writing anything"),

      // c19 — the two older sections, rehoused with everything they had.
      worklistKnobsAllPresent: passed(run, "the worklist knobs are all present on their own tab"),
      compactionKnobsAllPresent: passed(run, "the auto-compaction knobs are all present on theirs"),
      eachSectionStatesItsOwnAbsence:
        passed(run, "the worklist section says so when its own door is missing") &&
        passed(run, "the valve says so when ITS door is missing"),
    };
  },

  // THE BAND'S OWN SUITE, a second door for the same reason as the first: the tab table and its
  // counts are pure data, asserted in their own jest suite, and a claim about what the band DRAWS
  // has to read that suite rather than my description of it.
  async band() {
    const run = jest("AgentChat/bandTabs\\.test");
    return {
      suiteProducedResults: (run.tests || 0) > 0,
      failed: run.failed || 0,
      whyNot: run.why || "",
      correctionsCountsItsRuns: passed(run, "counts correction runs, and says it in the band's own words"),
      theTabStandsAtZero: passed(run, "stands with nothing owed, because the pane is where the first one lands"),
      everyKindIsDrawn: passed(run, "draws every kind with nothing standing at all"),
    };
  },
};
