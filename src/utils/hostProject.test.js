import { hostProjects, isHostProject } from "./hostProject";

// A PROJECT IS A DIRECTORY, NOT A NAME.
//
// His question, and it was the right one: *"How are these projects still here? … Why would I bring
// a thing in here and call it folder? … Have you really fucking transitioned?"*
//
// No. Two registries name the same thing differently: a SystemLynx plugin DECLARES its project code
// (`systemview-test`), and the host NAMES A FOLDER BY ITS DIRECTORY (`systemview`). The nav deduped
// on the name alone, so one directory arriving under two names drew two cards — proven in a real
// browser before this test existed, and pinned here so it cannot come back.
// Set the bridge ON the existing jsdom window rather than replacing `window` wholesale — replacing
// it silently left the module reading the real (empty) one, and every assertion passed against `[]`
// whether the code worked or not. A stub that does not take is worse than no test: it reports green.
const withHost = (rows) => {
  window.systemview = { projects: { list: async () => rows } };
};
const withNoHost = () => {
  delete window.systemview;
};

describe("one directory is one project, whatever it is called", () => {
  const ROOT = "/Users/odionedwards/Systemly/systemview";
  const connected = [
    { projectCode: "systemview-test", serviceId: "TestService", root: ROOT },
    { projectCode: "systemlynx", serviceId: "Users", root: "/Users/odionedwards/Systemly/SystemLynx" },
  ];

  // The guard against the harness lying again: prove the stub is live before trusting a green [].
  it("actually reaches the host (so an empty answer means something)", async () => {
    withHost([{ projectCode: "proof", root: "/tmp/proof" }]);
    expect(await hostProjects([])).toHaveLength(1);
  });

  it("does not draw a second card for a directory that is already connected", async () => {
    withHost([{ projectCode: "systemview", root: ROOT }]);
    expect(await hostProjects(connected)).toEqual([]);
  });

  it("ignores a trailing slash — the same folder is the same folder", async () => {
    withHost([{ projectCode: "systemview", root: `${ROOT}/` }]);
    expect(await hostProjects(connected)).toEqual([]);
  });

  it("still keeps the old name-based guard for a host that reports no root", async () => {
    withHost([{ projectCode: "systemview-test" }]);
    expect(await hostProjects(connected)).toEqual([]);
  });

  it("lets a genuinely new folder through, and dresses it as a project", async () => {
    withHost([{ projectCode: "scratch", root: "/tmp/scratch" }]);
    const out = await hostProjects(connected);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ projectCode: "scratch", root: "/tmp/scratch", serviceId: "Files" });
    expect(isHostProject(out)).toBe(true);
  });

  it("keeps a folder whose name collides with nothing and whose root is elsewhere", async () => {
    withHost([
      { projectCode: "systemview", root: ROOT }, // same folder, different name — dropped
      { projectCode: "notes", root: "/tmp/notes" }, // genuinely new — kept
    ]);
    const out = await hostProjects(connected);
    expect(out.map((s) => s.projectCode)).toEqual(["notes"]);
  });

  it("answers nothing at all when there is no host", async () => {
    withNoHost();
    expect(await hostProjects(connected)).toEqual([]);
  });
});
