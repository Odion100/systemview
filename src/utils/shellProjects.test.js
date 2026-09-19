// THE HUB'S THIRD REGISTRY, under test — `api/shellProjects.js`.
//
// IT LIVES IN `src/` FOR ONE REASON: react-scripts pins jest's `roots` to `<rootDir>/src` and will
// not take an override for it, so a test file anywhere else is simply never collected. The MODULE
// under test is api's; only the file is here. Requiring across the boundary works because jest does
// not apply webpack's module scope.
//
// What it guards: the hub reads a file the SHELL owns, on a machine that may not have a shell at
// all. Every failure has to be an empty answer rather than a thrown one, or a hub in CI stops
// resolving anything the moment this module is loaded.
const fs = require("fs");
const os = require("os");
const path = require("path");

const withHome = (write) => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "sv-shellproj-"));
  if (write) {
    fs.mkdirSync(path.join(home, ".autobot"), { recursive: true });
    fs.writeFileSync(path.join(home, ".autobot", "projects.json"), write);
  }
  jest.resetModules();
  jest.doMock("os", () => ({ ...jest.requireActual("os"), homedir: () => home }));
  // eslint-disable-next-line global-require
  return require("../../api/shellProjects");
};

afterEach(() => jest.dontMock("os"));

describe("the shell's project registry, as the hub reads it", () => {
  it("reads the { code: dir } map the shell writes", () => {
    const { shellProjects, shellProjectRoot } = withHome(
      JSON.stringify({ BUStudio: "/Users/x/BUStudio", buAPI: "/Users/x/buAPI" }),
    );
    expect(shellProjects()).toEqual({ BUStudio: "/Users/x/BUStudio", buAPI: "/Users/x/buAPI" });
    // THE WHOLE BUG IN ONE LINE: this returned null, so every file verb answered "no folder for
    // this project" for a folder he had just picked in the window.
    expect(shellProjectRoot("BUStudio")).toBe("/Users/x/BUStudio");
  });

  it("a project it has never heard of is null, not a guess at a path", () => {
    const { shellProjectRoot } = withHome(JSON.stringify({ BUStudio: "/Users/x/BUStudio" }));
    expect(shellProjectRoot("systemview-test")).toBe(null);
    expect(shellProjectRoot("")).toBe(null);
    expect(shellProjectRoot(undefined)).toBe(null);
  });

  // NO SHELL ON THIS MACHINE IS THE NORMAL CASE, not the edge one — the hub runs on servers. Each of
  // these has to come back empty rather than throw, because this module is called from `projectRoot`,
  // which everything else calls.
  it("no file at all is an empty answer", () => {
    const { shellProjects, shellProjectRoot } = withHome(null);
    expect(shellProjects()).toEqual({});
    expect(shellProjectRoot("BUStudio")).toBe(null);
  });

  it("a file that is not JSON is an empty answer", () => {
    expect(withHome("{not json").shellProjects()).toEqual({});
  });

  it("JSON of the wrong shape is an empty answer", () => {
    expect(withHome("[1,2,3]").shellProjects()).toEqual({});
    expect(withHome("null").shellProjects()).toEqual({});
    expect(withHome('"a string"').shellProjects()).toEqual({});
  });

  it("rows that do not name a directory are dropped, not carried as junk", () => {
    const { shellProjects } = withHome(
      JSON.stringify({ good: "/Users/x/good", empty: "", nulled: null, numbered: 7 }),
    );
    expect(shellProjects()).toEqual({ good: "/Users/x/good" });
  });
});
