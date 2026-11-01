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

// THE SWEEP, AS A TEST. The sentinel's danger is that it is not empty: `@none` passes every
// truthiness check a surface writes, so "no project selected" silently becomes "a project that
// exists nowhere", and the lookup comes back empty with no error. Three more readers were trusting
// the route segment when this was written — the chat's point router, the scratchpad's service
// filter, and a report link's last fallback — and each failed by reporting an ABSENCE.
describe("nothing reads the route segment raw", () => {
  const fs = require("fs");
  const path = require("path");
  const SRC = path.join(__dirname, "..");

  const walk = (dir) =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) return e.name === "node_modules" ? [] : walk(p);
      return /\.jsx?$/.test(e.name) && !/\.test\.jsx?$/.test(e.name) ? [p] : [];
    });

  // A reader is allowed to take projectCode off the route — it just may not be the only thing it
  // trusts. So the check is: a file that destructures it from useParams must also resolve it.
  it("a file taking projectCode from useParams also resolves the sentinel", () => {
    const offenders = [];
    for (const file of walk(SRC)) {
      const text = fs.readFileSync(file, "utf8");
      const takes = /useParams\(\)[\s\S]{0,160}?projectCode/.test(text) || /projectCode[^\n]*=\s*useParams\(\)/.test(text);
      if (!takes) continue;
      const resolves = /effectiveProject|projectOf|@none/.test(text);
      if (!resolves) offenders.push(path.relative(SRC, file));
    }
    expect(offenders).toEqual([]);
  });
});
