import { projectOf } from "./effectiveProject";

// THE BUG THIS PINS: `@none` is a real string in the URL and it is not a project. Read naively it
// sends every lookup to a project that exists nowhere, and the empty answer reads as "there is
// nothing here" rather than "you asked the wrong question".
describe("projectOf — the route segment is not the project", () => {
  it("takes a real route segment", () => {
    expect(projectOf("systemview-test", "?fproj=other")).toBe("systemview-test");
  });

  it("falls back to fproj when the segment is the @none sentinel", () => {
    expect(projectOf("@none", "?tab=docs&fproj=systemview-test&flang=markdown")).toBe("systemview-test");
  });

  it("falls back to fproj when the segment is missing entirely", () => {
    expect(projectOf("", "?fproj=buAPI")).toBe("buAPI");
    expect(projectOf(undefined, "?fproj=buAPI")).toBe("buAPI");
  });

  it("answers empty when the view is pinned to the machine — there is genuinely no project", () => {
    expect(projectOf("@none", "?fmachine=1&fproj=systemview-test")).toBe("");
  });

  it("answers empty rather than guessing when nothing names a project", () => {
    expect(projectOf("@none", "")).toBe("");
    expect(projectOf("@none", "?tab=docs")).toBe("");
  });
});
