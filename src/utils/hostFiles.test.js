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

  // A FAILURE MUST ARRIVE AS A FAILURE. The whole class of bug above was silent wrong answers, and
  // an `{ ok:false }` that slips through as an empty list is the same bug wearing the same clothes.
  it("throws on ok:false instead of returning something empty and plausible", async () => {
    setHub(hub({ changedFiles: async () => ({ ok: false, error: "git did not run" }) }));
    await expect(hostFiles("p").changedFiles()).rejects.toThrow("git did not run");
  });
});
