import { rowsOf } from "./Glance";

// THE REPORT HEADER READS ITS OWN SOURCE, not its rendered children — which is what lets it tell an
// EMPTY field from a filled one and mute it, while the file still reads as a plain list to anyone
// opening it in an editor or a diff.
//
// His ask, 2026-11-11: *"I want to be able to look and see the same things across every report…
// new feature, none. Fix, none. Even if these sections are empty, they're there."*
const doc = (...lines) => lines.join("\n");

describe("the fields a glance block holds", () => {
  it("reads the list between its own fences, in order", () => {
    const src = doc(
      "# A report",
      "",
      ":::glance",
      "- **agent** — systemview-test",
      "- **run** — the proactive-development job",
      "- **new features** — none",
      ":::",
      "",
      "- **not a field** — this list is outside the block",
    );
    expect(rowsOf(src, 2)).toEqual([
      { label: "agent", value: "systemview-test" },
      { label: "run", value: "the proactive-development job" },
      { label: "new features", value: "none" },
    ]);
  });

  it("STOPS at the closing fence — a list after the block is not part of the header", () => {
    const src = doc(":::glance", "- **agent** — me", ":::", "- **fixes** — belongs to the prose below");
    expect(rowsOf(src, 0).map((r) => r.label)).toEqual(["agent"]);
  });

  it("keeps an empty field as a row rather than dropping it", () => {
    // "Even if these sections are empty, they're there." A header that changed shape per report is
    // the thing this block exists to stop.
    const src = doc(":::glance", "- **new features** — none", "- **corrections** — not stated", ":::");
    expect(rowsOf(src, 0)).toEqual([
      { label: "new features", value: "none" },
      { label: "corrections", value: "not stated" },
    ]);
  });

  it("takes an en dash or a hyphen as the separator, not only an em dash", () => {
    const src = doc(":::glance", "- **agent** – me", "- **run** - his ask", ":::");
    expect(rowsOf(src, 0)).toEqual([
      { label: "agent", value: "me" },
      { label: "run", value: "his ask" },
    ]);
  });

  it("answers nothing for a half-written block instead of inventing a row", () => {
    // The state he passes through while typing. The component renders its children there, so the
    // markdown shows as itself rather than as an empty box.
    expect(rowsOf(doc(":::glance", "- **agent**", ":::"), 0)).toEqual([]);
    expect(rowsOf("", 0)).toEqual([]);
    expect(rowsOf(undefined, undefined)).toEqual([]);
  });
});

// The cost of reading raw source is that markdown's inline syntax arrives as characters. One span
// is honoured — backticks — because a field value routinely names a path or a script, and a colon
// token MUST be backticked in the source or the renderer parses it as a directive and eats it.
describe("inline code in a field value", () => {
  it("is split out of the raw value rather than printed with its backticks", () => {
    const { rowsOf: _r } = require("./Glance");
    const rows = _r([":::glance", "- **fixes** — the dead `smoke:judges` entry removed", ":::"].join("\n"), 0);
    // the SOURCE keeps the backticks, which is what protects the colon token from the parser
    expect(rows[0].value).toBe("the dead `smoke:judges` entry removed");
  });
});

