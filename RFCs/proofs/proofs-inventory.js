#!/usr/bin/env node
// WHAT THE FIXTURE COLLECTS — run it and read the answer off the shell's own parser.
//
// The point of this script is the last line: how many runnable specs the fixture carries, and how
// many `:::cmd` blocks were correctly LEFT ALONE. That second number is the one worth printing,
// because "we did not run 28 shell commands nobody pressed" is invisible otherwise — a collector
// that quietly started collecting cmds would look exactly like one that did not.
//
// It reads the REAL modules (autobot's `parse.cjs` and `blocks.cjs`), so it cannot pass while the
// thing it describes is broken. No registry, no services, no window — just the files and the rule.
const fs = require("fs");
const path = require("path");
const os = require("os");

const SHELL = path.join(os.homedir(), "autobot", "electron", "markdown");
const HERE = __dirname;

let parse;
let specsOf;
let registrationsOf;
try {
  ({ parse } = require(path.join(SHELL, "parse.cjs")));
  ({ specsOf, registrationsOf } = require(path.join(SHELL, "blocks.cjs")));
} catch (e) {
  // ABSENCE STATED. This fixture reads the shell's grammar on purpose — one definition — so a
  // machine without the shell gets told that, rather than a confident answer from a second copy.
  console.error(`cannot read the shell's markdown grammar at ${SHELL}`);
  console.error(`(${(e && e.message) || e})`);
  process.exit(2);
}

const FILES = fs
  .readdirSync(HERE)
  .filter((f) => f.endsWith(".md"))
  .sort();

(async () => {
  let specs = 0;
  let cmds = 0;
  let docs = 0;
  for (const f of FILES) {
    const blocks = await parse(fs.readFileSync(path.join(HERE, f), "utf8"));
    const mine = specsOf(blocks);
    const cmd = blocks.filter((b) => b.name === "cmd").length;
    const regs = registrationsOf(blocks);
    specs += mine.length;
    cmds += cmd;
    if (mine.length) docs += 1;
    console.log(
      f.padEnd(22),
      ("leaves " + (regs.map((r) => r.id + (r.arc ? "→" + r.arc : "")).join(",") || "—")).padEnd(42),
      "specs " + String(mine.length).padEnd(3),
      mine.map((s) => `${s.kind}@L${s.line}-${s.end}`).join(" ").padEnd(22),
      "cmds left alone " + cmd,
    );
  }
  console.log(`\n${specs} runnable specs across ${docs} documents · ${cmds} cmd blocks correctly ignored`);
  // A fixture that collects nothing is a broken fixture, not a clean run.
  if (!specs) {
    console.error("\nNO SPECS COLLECTED — the fixture carries no run or test block, which cannot be right");
    process.exit(1);
  }
})().catch((e) => {
  console.error("THREW:", (e && e.message) || e);
  process.exit(1);
});
