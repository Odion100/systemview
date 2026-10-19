// THE HUB'S REPORT LIST IS A LIST OF THINGS THAT ANSWER. `list()` is what every teaching error
// hands over — "nothing on the TV, here is what exists" — so a name in it is a promise that the
// document is readable. It used to answer straight out of `reports.index.json`, which keeps an
// entry long after the file is gone (deleted by hand, by git, by a lane's cleanup).
//
// The door is INJECTED here, exactly as api/index.js injects it, so these claims are about the
// rule and not about a filesystem.
const assert = require("node:assert");
const { test, describe } = require("node:test");
const { reportsOn, REPORT_INDEX } = require("./reports");

// A door over a fake disk: `files` maps path → content; anything else answers `{ok: false}`, which
// is how the real readFile reports a miss. `thrower` is the other case entirely — a door that
// cannot answer at all.
const doorOver = (files, { thrower = null } = {}) => {
  const readFile = async (_pc, { path: p }) => {
    if (thrower && p === thrower) throw new Error("the door itself fell over");
    return Object.prototype.hasOwnProperty.call(files, p)
      ? { ok: true, content: files[p] }
      : { ok: false, error: "not found" };
  };
  return reportsOn({ readFile, writeFile: async () => ({ ok: true }) });
};

const indexOf = (rows) => JSON.stringify({ sv: rows });

describe("Reports.list — a name is offered only while its file answers", () => {
  test("drops an indexed report whose file is gone", async () => {
    const R = doorOver({
      [REPORT_INDEX]: indexOf([
        { name: "alive", path: ".systemview/report.sv.alive.md", ts: 2 },
        { name: "deleted", path: ".systemview/report.sv.deleted.md", ts: 1 },
      ]),
      ".systemview/report.sv.alive.md": "# alive",
    });
    assert.deepStrictEqual(await R.list("sv"), ["alive"]);
  });

  test("keeps every indexed report whose file is there", async () => {
    const R = doorOver({
      [REPORT_INDEX]: indexOf([
        { name: "one", path: ".systemview/report.sv.one.md", ts: 2 },
        { name: "two", path: ".systemview/report.sv.two.md", ts: 1 },
      ]),
      ".systemview/report.sv.one.md": "# one",
      ".systemview/report.sv.two.md": "# two",
    });
    assert.deepStrictEqual(await R.list("sv"), ["one", "two"]);
  });

  // A REFUSAL IS ABSENCE; A THROW IS NOT. This is the claim that keeps the check from being
  // dangerous — one unreadable file must not read as "this project has no reports".
  test("keeps a report whose file read THREW, because that is not evidence of absence", async () => {
    const R = doorOver(
      {
        [REPORT_INDEX]: indexOf([{ name: "unreadable", path: ".systemview/report.sv.unreadable.md", ts: 1 }]),
      },
      { thrower: ".systemview/report.sv.unreadable.md" },
    );
    assert.deepStrictEqual(await R.list("sv"), ["unreadable"]);
  });

  test("keeps an old entry that carries no path — there is nothing to check", async () => {
    const R = doorOver({ [REPORT_INDEX]: indexOf([{ name: "pathless", ts: 1 }]) });
    assert.deepStrictEqual(await R.list("sv"), ["pathless"]);
  });

  test("an unreadable index is an empty list, not a crash", async () => {
    const R = doorOver({});
    assert.deepStrictEqual(await R.list("sv"), []);
  });

  test("a project with no rows of its own answers empty", async () => {
    const R = doorOver({ [REPORT_INDEX]: JSON.stringify({ other: [{ name: "theirs", path: "x.md" }] }) });
    assert.deepStrictEqual(await R.list("sv"), []);
  });
});
