import React from "react";
import { render, screen } from "@testing-library/react";
import ValidationMessage, { ErrorMessages } from "./ValidationMessages";
import { VALIDATION_NAMES, ALL_VALIDATION_NAMES } from "../../../testing-utilities/stepClaims";

// THE THREE COPIES OF ONE TABLE, AND THE ONE THAT CRASHES.
//
// The per-type list of validation names exists three times: `stepClaims.js` VALIDATION_NAMES (the
// gate that decides whether an assertion runs at all), `ValidationOptions.js` (the picker an author
// uses), and this file's `ErrorMessages` (the formatters). The card that filed this called the
// formatters dead code — they are not: `TestSummary/index.js` renders every error through
// `ValidationMessage`. What is true is worse than dead code.
//
// MEASURED 2026-11-07: the formatter table has 16 keys and the engine emits at least two names that
// are not among them — `assertedNothing` and `unknownValidation`, both added later — so
// `ErrorMessages[name](…)` was a TypeError inside render. ONE unrecognised error blanked the whole
// summary. buAPI met the same hole from the other side: of 1316 assertions they audited, ten used
// the name `equals`, which no type implements and nothing formats, and that is what crashed theirs.
describe("a validation message whose name has no formatter", () => {
  it("renders the error's own words instead of taking the summary down", () => {
    // The literal shape stepClaims.assertedNothing() returns.
    render(
      <ValidationMessage
        name="assertedNothing"
        namespace="Svc.Mod.fn"
        expected="at least one evaluation with save: true"
        received="3 evaluations declared, none saved — this step asserted nothing"
      />
    );
    expect(screen.getByText("Svc.Mod.fn")).toBeInTheDocument();
    expect(screen.getByText(/none saved/)).toBeInTheDocument();
  });

  it("and the other one the engine emits — an unknown validator name", () => {
    render(
      <ValidationMessage
        name="unknownValidation"
        namespace="Svc.Mod.fn"
        expected="one of: numEquals, max, min, isOneOf"
        received='"equals" — no validator by that name runs on a number, so this assertion did nothing'
      />
    );
    expect(screen.getByText(/no validator by that name/)).toBeInTheDocument();
  });

  it("a formatter that DOES exist is still used", () => {
    render(<ValidationMessage name="numEquals" namespace="Svc.Mod.fn" expected={7} received={9} />);
    expect(screen.getByText("Svc.Mod.fn")).toBeInTheDocument();
    // The formatter's own wording, not the fallback's.
    expect(screen.getByText(/equal/i)).toBeInTheDocument();
  });

  // THE GUARD THAT KEEPS THE THREE COPIES HONEST FROM THIS SIDE: every name the gate can route here
  // either has a formatter or renders through the fallback — and the fallback is what makes that
  // list non-empty rather than a wish. Asserting "every gate name has a formatter" would have
  // failed today and been fixed by adding two formatters nobody needs: the prose IS the message.
  it("every name the gate knows renders something, formatter or not", () => {
    for (const name of [...ALL_VALIDATION_NAMES, "assertedNothing", "unknownValidation", "equals"]) {
      const { unmount } = render(
        <ValidationMessage name={name} namespace="Svc.Mod.fn" expected="x" received="y" />
      );
      expect(screen.getByText("Svc.Mod.fn")).toBeInTheDocument();
      unmount();
    }
  });
});

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
