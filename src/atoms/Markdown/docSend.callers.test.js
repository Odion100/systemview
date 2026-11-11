import fs from "fs";
import path from "path";

// WHO IS ALLOWED TO ANNOUNCE WITHOUT RECORDING IT.
//
// `sendUpdateTo` announces and stamps NOTHING. The pin's path — `releaseFires` →
// `releaseDocumentFires` — stamps `told=` for exactly who was delivered, which is what stops a
// second press re-sending. So a control that tells a document's MEMBERS by coming through
// `docSend` delivers without recording that it did, and every later press sends again: the
// "send all threads re-sends the ones with nothing new" fault.
//
// That is not hypothetical. A thread's row and the pinned update row BOTH used to call it and were
// retired for exactly that reason (2026-11-06, "a second send from the window was the same decision
// delivered twice") — and `docSend`'s own header went on naming them as its callers for days after,
// which is a map to the mistake sitting in the file somebody reads when they add the next sender.
//
// SO THE CALLER LIST IS A CHECK RATHER THAN A SENTENCE. A comment cannot notice a new import; this
// can. Adding a caller is not forbidden — it is made deliberate: this test fails, you read why, and
// you decide whether you wanted the pin's path instead.
const SRC = path.join(__dirname, "..", "..");

const importersOf = (moduleName) => {
  const hits = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(p); continue; }
      if (!entry.name.endsWith(".js") || entry.name.includes(".test.")) continue;
      const text = fs.readFileSync(p, "utf8");
      // an import of the module, by any relative path, naming sendUpdateTo
      if (/from\s+"[^"]*\/?docSend"/.test(text) && /\bsendUpdateTo\b/.test(text)) {
        hits.push(path.relative(SRC, p).replace(/\\/g, "/"));
      }
    }
  };
  walk(SRC);
  return hits.sort();
};

describe("only these controls announce without stamping", () => {
  it("is exactly the two blocks allowed to announce without recording it", () => {
    // `routeResult` is the third user and lives INSIDE docSend.js, so it imports nothing — a
    // result block's `subscribe=` is news about a block completing, never a document update to
    // a member, which is why it belongs on this side of the line.
    expect(importersOf("docSend")).toEqual([
      "atoms/Markdown/blockFailure.js",
      "atoms/Markdown/blocks/CommitBlock.js",
    ]);
  });

  // THE PIN MUST NEVER APPEAR ABOVE. It is the one control that tells a document's members, and it
  // has to keep going through the host so the delivery is recorded.
  it("and the members pin still releases through the host, which is what records the send", () => {
    const pin = fs.readFileSync(path.join(SRC, "atoms", "Markdown", "blocks", "MembersPin.js"), "utf8");
    expect(pin).toContain("releaseFires");
    expect(pin).not.toContain("sendUpdateTo");
  });
});
