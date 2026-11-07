import { VALIDATION_NAMES } from "../../../testing-utilities/stepClaims";

// THE THREE COPIES OF ONE TABLE — and after measuring, there are two.
//
// The per-type list of validation names existed three times: `stepClaims.js` VALIDATION_NAMES (the
// gate that decides whether an assertion runs at all), `ValidationOptions.js` (the picker an author
// uses), and `ValidationMessages.js`'s `ErrorMessages` (the formatters). Only the gate was pinned.
//
// THE THIRD COPY IS GONE, AND THE MEASUREMENT THAT SETTLED IT IS WORTH KEEPING. The formatters did
// carry a real defect — `ValidationMessage` indexed `ErrorMessages[name]` and CALLED it, with 16
// keys against an engine that emits `assertedNothing` and `unknownValidation` too, so one
// unrecognised error was a TypeError inside render. But reachability decided the fix: its only
// importer was `TestSummary`, and NOTHING imported TestSummary — orphaned since 2026-07-31, absent
// from the production bundle entirely. So the card was right and the whole subtree went: a copy
// nobody calls drifts first and tells you nothing when it does, which is exactly what it did.
//
// What survives is the pin the card actually asked for.

// THE PICKER IS THE THIRD COPY, and it was the unpinned one. `stepClaims.test.js` pins the GATE to
// `validators.js` by parsing the source; nothing pinned the picker, so if it drifts it either offers
// a name that asserts nothing or hides one that works — and the author never learns which.
describe("the picker offers exactly the names the gate runs", () => {
  const options = require("./ValidationOptions").default || require("./ValidationOptions");

  it("per type, the picker's values are the gate's names", () => {
    for (const [type, names] of Object.entries(VALIDATION_NAMES)) {
      const offered = (options[type] || {}).values || [];
      expect([...offered].sort()).toEqual([...names].sort());
    }
  });

  it("and every option has an input and a label beside it — three parallel arrays, one length", () => {
    for (const type of Object.keys(VALIDATION_NAMES)) {
      const t = options[type] || {};
      expect(t.values).toHaveLength(t.options.length);
      expect(t.inputs).toHaveLength(t.options.length);
    }
  });
});
