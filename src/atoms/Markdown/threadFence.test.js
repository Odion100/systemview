import { normalizeFences, wrapLinesInThread } from "./docEdit";

// THE BUG THESE CLAIMS EXIST FOR. `api/reports.js` requires four colons on a thread opener (a
// thread holds `:::reply` blocks, so it must out-fence them). The window used to write three and
// normalize back down to three, so a thread rendered perfectly and could never be answered.

describe("a thread is born wide enough to hold a reply", () => {
  it("wraps at four colons, not three", () => {
    const out = wrapLinesInThread("a line about something\n", 1, 1);
    expect(out).toMatch(/^::::thread\{id=t1\}$/m);
    expect(out).toMatch(/^::::$/m);
  });

  it("is matched by the same rule api/reports.js uses", () => {
    const out = wrapLinesInThread("a line about something\n", 1, 1);
    const API_OPENER = /^(:{4,})thread\{id=([^}\s]+)[^}]*\}\s*$/m;
    expect(API_OPENER.test(out)).toBe(true);
  });
});

describe("normalizeFences no longer narrows an empty thread", () => {
  // The exact shape that "reverted" on RFC-072, three times.
  it("leaves a four-colon thread with no replies alone", () => {
    const src = ["::::thread{id=state}", "nothing said in it yet", "::::", ""].join("\n");
    expect(normalizeFences(src)).toBe(src);
  });

  it("widens a hand-written three-colon thread rather than trusting it", () => {
    const src = [":::thread{id=state}", "nothing said in it yet", ":::", ""].join("\n");
    expect(normalizeFences(src)).toMatch(/^::::thread\{id=state\}$/m);
  });

  // The selectivity that made this look like a haunting: a thread with a reply already computed
  // to four and survived, so only the untouched ones appeared to revert.
  it("still gives a thread holding a reply exactly four", () => {
    const src = [
      "::::thread{id=bugs}",
      "the prompt",
      ":::reply{author=you ts=1}",
      "a reply",
      ":::",
      "::::",
      "",
    ].join("\n");
    expect(normalizeFences(src)).toBe(src);
  });

  it("widens a thread further when it nests something deeper than a reply", () => {
    const src = [
      ":::thread{id=deep}",
      "::::columns",
      ":::col",
      "x",
      ":::",
      "::::",
      ":::",
      "",
    ].join("\n");
    const out = normalizeFences(src);
    expect(out).toMatch(/^:{5}thread\{id=deep\}$/m);
  });

  // The floor is per KIND — everything that is not a thread keeps the old behaviour, so this
  // change cannot quietly widen the rest of the vocabulary.
  it("leaves other containers at three", () => {
    const src = [":::callout", "a caveat", ":::", ""].join("\n");
    expect(normalizeFences(src)).toBe(src);
  });

  it("does not touch fences inside a code block", () => {
    const src = ["```md", ":::thread{id=shown}", ":::", "```", ""].join("\n");
    expect(normalizeFences(src)).toBe(src);
  });
});
