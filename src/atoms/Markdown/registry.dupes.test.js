import fs from "fs";
import path from "path";

// ONE NAME, ONE COMPONENT — asserted on the SOURCE, for two separate reasons.
//
// WHY THIS FILE EXISTS. `registry.js` registered the key `report` twice: once to `ReportLink` (the
// chip that opens a report) and once, eighty lines down, to `Report` (the registration leaf). An
// object literal keeps the LAST key, so the first component became unreachable through the registry
// while AgentChat went on importing it directly — the same `:report[…]` drawing the leaf's
// lifecycle UI in a document and the real chip in the chat. One fact, two answers.
//
// eslint had been saying so for weeks as `no-dupe-keys`, inside a class of 87 warnings that does not
// fail the build. **That is the lesson and the reason this is a TEST**: a warning nobody fails on is
// a signal nobody reads, and the way to make it count is to put it where a suite goes red.
//
// WHY IT READS THE FILE RATHER THAN THE OBJECT, and both halves matter. First, a duplicate key is
// INVISIBLE in the parsed object — by then one of the two is already gone, so counting
// `Object.keys` can never find one. Second, `registry.js` cannot be imported in jest at all: it
// reaches react-markdown, which is ESM outside `transformIgnorePatterns`, and the suite dies on the
// import. Reading the source is the honest substitute, and it is the only instrument that can see
// this particular fault.
const SRC = fs.readFileSync(path.join(__dirname, "registry.js"), "utf8");
const BODY = SRC.slice(SRC.indexOf("export const BLOCKS = {"));

// A key of the BLOCKS literal: exactly two spaces, a name, a colon, an opening brace. Comments
// start with `//` and never match; nested properties are indented deeper and never match either.
const entries = () => [...BODY.matchAll(/^ {2}([A-Za-z][A-Za-z0-9]*)\s*:\s*\{\s*Component:\s*([A-Za-z][A-Za-z0-9]*)/gm)];

test("the registry declares each block name exactly once", () => {
  const names = entries().map((m) => m[1]);
  // A GUARD THAT MATCHED NOTHING WOULD PASS FOREVER while saying nothing — the failure mode this
  // whole suite is a reaction to. So the count is asserted before the claim.
  expect(names.length).toBeGreaterThan(20);
  const seen = new Map();
  names.forEach((k) => seen.set(k, (seen.get(k) || 0) + 1));
  expect([...seen.entries()].filter(([, n]) => n > 1).map(([k, n]) => `${k} ×${n}`)).toEqual([]);
});

test("every name maps to exactly one component, so no two names can disagree about one", () => {
  // The inverse question, and it is not the same one: two NAMES sharing a component is fine (an
  // alias), but one name whose two lines name DIFFERENT components is the fault above wearing a
  // different shape — a rename that only landed in one of the two places.
  const byName = new Map();
  entries().forEach(([, name, comp]) => {
    const prev = byName.get(name);
    expect(prev === undefined || prev === comp).toBe(true);
    byName.set(name, comp);
  });
  expect(byName.size).toBe(entries().length);
});

test("`report` is the registration leaf, not the retired chip", () => {
  // The leaf owns the name: `::report{id=…}` is what makes a document a report. The chip is banned
  // by doctrine in three documents (`agents/markdown.md`, `agents/chat.md`,
  // `docs/interactive-markdown.md` each say *never*) and survives only as AgentChat's unknown-ref
  // fallback, imported from `./blocks/ReportLink` directly rather than through here.
  const hit = entries().filter(([, name]) => name === "report");
  expect(hit.length).toBe(1);
  expect(hit[0][2]).toBe("Report");
  // AND THE REGISTRY DOES NOT IMPORT THE CHIP AT ALL — a structural fact rather than a grep for a
  // string, which is the mistake the first version of this assertion made: it searched the whole
  // file for `report: { Component: ReportLink }` and failed on the COMMENT that explains why that
  // line was removed. A check that reads prose is a check that breaks when somebody documents it.
  const imports = SRC.slice(0, SRC.indexOf("export const BLOCKS = {"));
  expect(imports).not.toMatch(/^import ReportLink /m);
});
