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
//
// AND THE DOOR HAS TWO HALVES, WHICH IS WHY THERE ARE TWO LISTS. Reading imports alone answers
// about two files and there are six announcers: `routeResult` lives INSIDE `docSend.js` and calls
// `sendUpdateTo` directly, so it imports nothing and an import-reading check cannot see it — and
// the four result blocks reach the same door through `routeResult`, naming neither `docSend`'s
// announcing symbol nor anything an import of it would match. A guard that pins the direct
// importers and calls that "everyone" is the fault it exists to catch, one level up.
const SRC = path.join(__dirname, "..", "..");
const DOC_SEND = path.join(SRC, "atoms", "Markdown", "docSend.js");

// COMMENTS ARE STRIPPED BEFORE ANYTHING IS MATCHED, and that is a lesson rather than a nicety: the
// first version of the registry guard searched a whole file for a line and failed on the COMMENT
// explaining why the line was removed. A check that reads prose breaks the moment somebody
// documents it, so this one reads code.
const codeOnly = (text) =>
  text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1");

// HALF ONE — who IMPORTS the door, anywhere in the window.
const importersOf = (symbol) => {
  const hits = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(p); continue; }
      if (!entry.name.endsWith(".js") || entry.name.includes(".test.")) continue;
      const text = fs.readFileSync(p, "utf8");
      // an import of the module, by any relative path, naming the symbol
      if (/from\s+"[^"]*\/?docSend"/.test(text) && new RegExp(`\\b${symbol}\\b`).test(text)) {
        hits.push(path.relative(SRC, p).replace(/\\/g, "/"));
      }
    }
  };
  walk(SRC);
  return hits.sort();
};

// HALF TWO — who calls it from INSIDE `docSend.js`, where no import exists to be read. Each
// top-level `export const` is one segment, and a segment is a caller when the stripped code makes
// the call. A declaration is never its own caller.
const inFileCallersOf = (symbol) => {
  const text = fs.readFileSync(DOC_SEND, "utf8");
  const re = /^export const (\w+) = /gm;
  const segments = [];
  let m;
  let prev = null;
  while ((m = re.exec(text))) {
    if (prev) segments.push({ name: prev.name, body: text.slice(prev.start, m.index) });
    prev = { name: m[1], start: m.index };
  }
  if (prev) segments.push({ name: prev.name, body: text.slice(prev.start) });
  const call = new RegExp(`\\b${symbol}\\s*\\(`);
  return segments
    .filter((s) => s.name !== symbol && call.test(codeOnly(s.body)))
    .map((s) => s.name)
    .sort();
};

describe("only these controls announce without stamping", () => {
  it("is exactly the two files that import the announcing call", () => {
    expect(importersOf("sendUpdateTo")).toEqual([
      "atoms/Markdown/blockFailure.js",
      "atoms/Markdown/blocks/CommitBlock.js",
    ]);
  });

  it("and exactly one thing inside docSend.js calls it, where no import exists to read", () => {
    // `routeResult` is the third direct user. It belongs on this side of the line because a result
    // block's `subscribe=` is news about a block completing — never a document update to a member —
    // so there is no delivery to record. Point it at a document's members and the re-send fault is
    // back; this is what makes doing that a visible act rather than a silent one.
    expect(inFileCallersOf("sendUpdateTo")).toEqual(["routeResult"]);
  });

  it("and exactly these four result blocks reach the door through routeResult", () => {
    // They announce without stamping too — one level removed. Pinned for the same reason and with
    // the same latitude: adding a fifth is allowed, it just cannot happen quietly.
    expect(importersOf("routeResult")).toEqual([
      "atoms/Markdown/blocks/BranchBlock.js",
      "atoms/Markdown/blocks/CmdBlock.js",
      "atoms/Markdown/blocks/RunBlock.js",
      "atoms/Markdown/blocks/TestEmbed.js",
    ]);
  });

  // THE PIN MUST NEVER APPEAR IN EITHER LIST. It is the one control that tells a document's
  // members, and it has to keep going through the host so the delivery is recorded.
  it("and the members pin still releases through the host, which is what records the send", () => {
    const pin = fs.readFileSync(path.join(SRC, "atoms", "Markdown", "blocks", "MembersPin.js"), "utf8");
    expect(pin).toContain("releaseFires");
    expect(pin).not.toContain("sendUpdateTo");
    expect(pin).not.toContain("routeResult");
  });
});
