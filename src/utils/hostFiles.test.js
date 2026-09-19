import { hostFiles } from "./hostFiles";
import { setHub } from "./hub";

// THE SHAPE IS THE CONTRACT, AND FOUR TIMES TODAY IT WAS WRONG IN A WAY THAT LOOKED LIKE AN ANSWER.
// `changedFiles` returned a bare array and the panel drew a clean tree. `getDiff` returned a patch
// string and every diff stripe drew nothing. `gitState` came back without `log`/`staged`/`unstaged`
// and a repo with 41 changes rendered "no commits yet". `commit` came back without `state`/`sha` and
// the block said "undefined undefined" and lost its Push button. Not one of them threw. Every one
// was found by him pressing a button.
//
// His question, and it is the whole reason this file exists: *"don't we literally have tests in
// SystemView that document the exact shape of things?"* We do — and the file layer moved to the hub
// with none. These assert what the CALL SITES READ, which is the only definition of the contract
// that matters.
const hub = (over = {}) => ({
  SystemView: {
    gitState: async () => ({
      ok: true, repo: true, branch: "main", upstream: "origin/main", ahead: 1, behind: 0,
      log: [{ sha: "abc1234", subject: "a change", who: "odion", when: "1 hour ago", pushed: false }],
      staged: [{ path: "a.js", status: "modified", staged: true }],
      unstaged: [{ path: "b.js", status: "modified", unstaged: true }],
      untracked: [{ path: "c.js", status: "untracked" }],
    }),
    changedFiles: async () => ({ ok: true, files: [{ path: "a.js", status: "modified" }] }),
    getDiff: async () => ({ ok: true, base: "old", index: null, head: "old", diff: "@@" }),
    commit: async () => ({ ok: true, sha: "abc1234", subject: "a change", output: "1 file changed", state: { repo: true, ahead: 1 } }),
    push: async () => ({ ok: true, pushed: true, output: "pushed", state: { repo: true, ahead: 0 } }),
    stageFiles: async () => ({ ok: true, changed: ["a.js"] }),
    discardFiles: async () => ({ ok: true, discarded: ["a.js"] }),
    readFile: async () => ({ ok: true, path: "a.js", content: "hello" }),
    listFiles: async () => ({ ok: true, dir: "", files: [{ path: "a.js" }], truncated: false }),
    searchFiles: async () => ({ ok: true, results: [{ path: "a.js", line: 3, text: "hit" }] }),
    fileHistory: async () => ({ ok: true, commits: [{ sha: "abc1234", subject: "a change" }] }),
    readSnapshot: async () => ({ ok: true, path: "a.js", sha: "abc1234", content: "then" }),
    ...over,
  },
});

describe("what the call sites read", () => {
  beforeEach(() => setHub(hub()));

  it("changedFiles gives { files: [{ path, status }] } — the panel keys rows on status", async () => {
    const res = await hostFiles("p").changedFiles();
    expect(Array.isArray(res.files)).toBe(true);
    expect(res.files[0]).toMatchObject({ path: "a.js", status: "modified" });
  });

  it("gitState carries the log AND the file lists — the commit block reads all three off it", async () => {
    const st = await hostFiles("p").gitState();
    expect(st).toMatchObject({ repo: true, branch: "main" });
    expect(st.log[0]).toMatchObject({ sha: expect.any(String), subject: expect.any(String) });
    expect(st.staged.length).toBeGreaterThan(0);
    expect(st.unstaged.length).toBeGreaterThan(0);
  });

  it("getDiff gives CONTENT, not a patch — stripes compare base against the working file", async () => {
    const d = await hostFiles("p").getDiff({ path: "a.js" });
    expect(d).toHaveProperty("base");
    expect(d).toHaveProperty("index");
  });

  it("commit gives sha, subject, output and fresh state — or the block says undefined undefined", async () => {
    const r = await hostFiles("p").commit({ message: "m" });
    expect(r.sha).toBeTruthy();
    expect(r.subject).toBeTruthy();
    expect(r.output).toBeTruthy();
    expect(r.state).toMatchObject({ repo: true });
  });

  it("push gives state back, so the Push button can disappear when there is nothing left", async () => {
    const r = await hostFiles("p").push();
    expect(r.state).toMatchObject({ ahead: 0 });
  });

  it("readFile gives { path, content, language }", async () => {
    const f = await hostFiles("p").readFile({ path: "a.js" });
    expect(f).toMatchObject({ path: "a.js", content: "hello", language: "javascript" });
  });

  it("listFiles gives { dir, files, truncated }", async () => {
    const l = await hostFiles("p").listFiles({});
    expect(l).toMatchObject({ dir: "", truncated: false });
    expect(l.files[0].path).toBe("a.js");
  });

  // THE OPTION HAS TO MAKE THE TRIP. This bridge hand-wraps every verb, so an option it forgets to
  // forward is not an error — the call succeeds and the hub answers the DEFAULT question, which
  // looks exactly like the answer you asked for. The lazy tree is one flag (`shallow`) away from
  // walking the entire repo again, silently, so the flag is asserted at the wire rather than trusted.
  it("listFiles forwards shallow, and gives back { entries } with dirs marked", async () => {
    let sent = null;
    setHub(
      hub({
        listFiles: async (_p, opts) => {
          sent = opts;
          return {
            ok: true,
            dir: "src",
            shallow: true,
            entries: [
              { name: "atoms", path: "src/atoms", dir: true },
              { name: "App.js", path: "src/App.js", dir: false },
            ],
            truncated: false,
          };
        },
      }),
    );
    const l = await hostFiles("p").listFiles({ dir: "src", shallow: true });
    expect(sent.shallow).toBe(true);
    expect(sent.dir).toBe("src");
    expect(l.entries).toEqual([
      { name: "atoms", path: "src/atoms", dir: true, language: undefined, mtime: undefined },
      { name: "App.js", path: "src/App.js", dir: false, language: "javascript", mtime: undefined },
    ]);
    expect(l.truncated).toBe(false);
  });

  it("without shallow it is still the recursive { files } shape every other caller reads", async () => {
    let sent = null;
    setHub(
      hub({
        listFiles: async (_p, opts) => {
          sent = opts;
          return { ok: true, dir: "", files: [{ path: "a.js" }], truncated: false };
        },
      }),
    );
    const l = await hostFiles("p").listFiles({});
    expect(sent.shallow).toBeUndefined();
    expect(l.files[0]).toMatchObject({ path: "a.js", language: "javascript" });
  });

  // The tree's filter asks about NAMES; `search` (git grep) answers about CONTENT. Two questions,
  // and a partially loaded tree can answer neither on its own.
  it("searchNames asks the hub by name and keeps truncated — the filter has to be able to say 'first 500'", async () => {
    let sent = null;
    setHub(
      hub({
        searchFiles: async (_p, opts) => {
          sent = opts;
          return { ok: true, names: true, results: [{ path: "deep/in/the/tail/Thing.js" }], truncated: true };
        },
      }),
    );
    const r = await hostFiles("p").searchNames({ query: "thing", max: 500 });
    expect(sent).toMatchObject({ query: "thing", max: 500, names: true });
    expect(r.results[0].path).toBe("deep/in/the/tail/Thing.js");
    expect(r.truncated).toBe(true);
  });

  it("search gives the rows themselves, not an envelope", async () => {
    const r = await hostFiles("p").search({ query: "x" });
    expect(Array.isArray(r)).toBe(true);
    expect(r[0]).toMatchObject({ path: "a.js", line: 3 });
  });

  it("history and snapshot are what the history rows open into", async () => {
    expect((await hostFiles("p").fileHistory({ path: "a.js" })).commits[0].sha).toBe("abc1234");
    expect((await hostFiles("p").readSnapshot({ path: "a.js", sha: "abc1234" })).content).toBe("then");
  });

  // A PROJECT THE SHELL KNOWS AND THE CONNECTIONS DO NOT — the bug he hit with BUStudio, from this
  // side of the wire. He added a folder in the window; the card and the tree drew, and every file in
  // it answered "no folder for this project". The card had the root all along (the shell handed it
  // over) and the agent chat's floating panel never had it, because it calls `hostFiles(projectCode)`
  // with no second argument — which is exactly the call below.
  //
  // So the contract this asserts is: WITH NO ROOT, THE PROJECT CODE IS THE WHOLE QUESTION. The hub
  // resolves it (api/shellProjects.js put the shell's registry in `projectRoot`'s chain), and the
  // answer maps into the same shapes as any other project's. If this ever needs a root passed to
  // work, the two-registries bug is back.
  describe("a shell-registered project — the hub is asked by CODE, with no root", () => {
    it("lists shallow and maps the lazy tree's contract", async () => {
      let sent = null;
      setHub(
        hub({
          listFiles: async (pc, opts) => {
            sent = { pc, opts };
            return {
              ok: true,
              dir: "",
              shallow: true,
              entries: [
                { name: "docs", path: "docs", dir: true },
                { name: "README.md", path: "README.md", dir: false },
              ],
              truncated: false,
            };
          },
        }),
      );
      const l = await hostFiles("BUStudio").listFiles({ dir: "", shallow: true });
      expect(sent.pc).toBe("BUStudio");
      expect(sent.opts.root).toBeUndefined(); // the code is the whole question
      expect(sent.opts.shallow).toBe(true);
      expect(l).toMatchObject({ dir: "", shallow: true, truncated: false });
      expect(l.entries).toEqual([
        { name: "docs", path: "docs", dir: true, language: undefined, mtime: undefined },
        { name: "README.md", path: "README.md", dir: false, language: "markdown", mtime: undefined },
      ]);
    });

    it("reads a file, same as any other project", async () => {
      let sent = null;
      setHub(
        hub({
          readFile: async (pc, opts) => {
            sent = { pc, opts };
            return { ok: true, path: "README.md", content: "# BUStudio" };
          },
        }),
      );
      const f = await hostFiles("BUStudio").readFile({ path: "README.md" });
      expect(sent.pc).toBe("BUStudio");
      expect(sent.opts.root).toBeUndefined();
      expect(f).toMatchObject({ path: "README.md", content: "# BUStudio", language: "markdown" });
    });

    // THE STRING HE SAW, and it must keep arriving as a failure. A hub that genuinely cannot place a
    // project has to say so out loud — silently returning an empty tree would turn "I do not know
    // where this is" into "this folder is empty", which is the same class of bug the whole file
    // exists to catch.
    it("still surfaces the hub's refusal when NOBODY knows the folder", async () => {
      setHub(hub({ listFiles: async () => ({ ok: false, error: "no folder for this project" }) }));
      await expect(hostFiles("Nowhere").listFiles({ dir: "", shallow: true })).rejects.toThrow(
        "no folder for this project",
      );
    });

    // The nav DOES know the root and passes it. That path must keep working — it is every
    // hub-known project on screen today.
    it("and a root, when a caller has one, is still forwarded", async () => {
      let sent = null;
      setHub(hub({ readFile: async (_pc, opts) => ((sent = opts), { ok: true, content: "x" }) }));
      await hostFiles("BUStudio", "/Users/odionedwards/BUStudio").readFile({ path: "a.js" });
      expect(sent.root).toBe("/Users/odionedwards/BUStudio");
    });
  });

  // A FAILURE MUST ARRIVE AS A FAILURE. The whole class of bug above was silent wrong answers, and
  // an `{ ok:false }` that slips through as an empty list is the same bug wearing the same clothes.
  it("throws on ok:false instead of returning something empty and plausible", async () => {
    setHub(hub({ changedFiles: async () => ({ ok: false, error: "git did not run" }) }));
    await expect(hostFiles("p").changedFiles()).rejects.toThrow("git did not run");
  });
});

describe("a hub that does not know `shallow` still yields a tree", () => {
  it("derives this folder's children from the recursive answer", async () => {
    // The live failure: bundle rebuilt, hub not yet restarted — `shallow` unread, `entries` absent,
    // `files` sent instead. Reading `entries` off that gave an empty tree on EVERY project, silently.
    setHub({
      SystemView: {
        listFiles: async () => ({
          ok: true,
          dir: "",
          files: [{ path: "README.md" }, { path: "src/a.js" }, { path: "src/deep/b.js" }],
        }),
      },
    });
    const res = await hostFiles("p").listFiles({ dir: ".", shallow: true });
    expect(res.derived).toBe(true);
    expect(res.entries.map((e) => `${e.dir ? "d" : "f"}:${e.name}`)).toEqual(["d:src", "f:README.md"]);
  });

  it("derives a subfolder's children too, one level only", async () => {
    setHub({
      SystemView: {
        listFiles: async () => ({
          ok: true,
          dir: "src",
          files: [{ path: "src/a.js" }, { path: "src/deep/b.js" }, { path: "src/deep/c.js" }],
        }),
      },
    });
    const res = await hostFiles("p").listFiles({ dir: "src", shallow: true });
    expect(res.entries.map((e) => e.path)).toEqual(["src/deep", "src/a.js"]);
  });
});
