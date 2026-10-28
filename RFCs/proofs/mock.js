#!/usr/bin/env node
// SET A MOCK DOCUMENT TO A STATE — the script behind every `:::cmd` in the mock documents.
//
// THE MOCKS ARE A WALK, NOT A DIORAMA (his design, 2026-10-28): each mock carries one cmd per state
// in its kind's table order (RFC-076 §2), so pressing down the document IS the lifecycle test — and
// the walk ends with a teardown, because a fixture that cannot leave the drawer is furniture.
// *"Make the test go away from the drawer and be quiet and disappear when you're not testing."*
//
// Everything here writes ONLY to `RFCs/proofs/mock-*.md`. It touches no real document, ever.
//
//   node RFCs/proofs/mock.js <kind> <state>   jump a mock to a state (see the table below)
//   node RFCs/proofs/mock.js <kind> off       TEARDOWN — strips the leaf; the registry row follows
//   node RFCs/proofs/mock.js <kind> on        bring it back — restores the leaf, re-registers
//
// `off` works because the leaf IS the identity (RFC-073): a parse of a known file whose leaf is
// gone removes the row, so the mock leaves every list and drawer honestly. The leaf is kept in the
// file as an HTML comment while off, so `on` restores it exactly.
const fs = require("fs");
const path = require("path");

const DIR = __dirname;
const file = (kind) => path.join(DIR, `mock-${kind}.md`);
const LEAF = { rfc: "::rfc", arc: "::arc", gap: "::gap", report: "::report", plan: "::rfc" };

function today() {
  return new Date().toISOString().slice(0, 10);
}

// THE STATES, EACH ONE A ROW OF RFC-076 §2's TABLES. `verdicts` drives the approval blocks in
// order; `attrs` is the leaf; `objectives` the ::objective blocks by id; `status` the STATUS
// heading; `plans` writes the serving documents' leaves (the arc's states that derive UPWARD can
// only be reached by moving the PLANS, which is the whole lesson).
const CLEAR = { settled: null, retired: null, retiredAs: null, supersededBy: null };
const STATES = {
  rfc: {
    draft: { verdicts: [null, null], status: false, attrs: { ...CLEAR } },
    "half-approved": { verdicts: ["approved", null], status: false, attrs: { ...CLEAR } },
    approved: { verdicts: ["approved", "approved"], status: false, attrs: { ...CLEAR } },
    rejected: { verdicts: ["approved", "rejected"], status: false, attrs: { ...CLEAR } },
    built: { verdicts: ["approved", "approved"], status: true, attrs: { ...CLEAR } },
    settled: { verdicts: ["approved", "approved"], status: true, attrs: { ...CLEAR, settled: today() } },
    retired: {
      verdicts: ["approved", "approved"],
      status: true,
      attrs: { settled: today(), retired: today(), retiredAs: "shelf" },
    },
  },
  gap: {
    open: { attrs: { resolved: null, rejected: null, why: null, ...CLEAR } },
    resolved: { attrs: { resolved: today(), rejected: null, why: null, ...CLEAR } },
    rejected: { attrs: { rejected: today(), why: "wontfix", resolved: null, ...CLEAR } },
    retired: {
      attrs: { resolved: today(), rejected: null, why: null, retired: today(), retiredAs: "out-of-service" },
    },
  },
  report: {
    filed: { attrs: { retired: null, retiredAs: null } },
    retired: { attrs: { retired: today(), retiredAs: "shelf" } },
  },
  // THE ARC DERIVES UPWARD, so its states are reached by moving the verdicts and THE PLANS — the
  // arc's own file changes only its approval blocks. `plans` maps serving document → the address it
  // serves (null detaches) and whether it is settled.
  arc: {
    draft: { verdicts: [null], attrs: { retired: null, retiredAs: null }, plans: { rfc: null, plan: null } },
    approved: {
      verdicts: ["approved"],
      attrs: { retired: null, retiredAs: null },
      plans: { rfc: { arc: "MOCK-ARC-O1", settled: false }, plan: null },
    },
    inProgress: {
      verdicts: ["approved"],
      attrs: { retired: null, retiredAs: null },
      plans: { rfc: { arc: "MOCK-ARC-O1", settled: true }, plan: { arc: "MOCK-ARC-O2", settled: false } },
    },
    settled: {
      verdicts: ["approved"],
      attrs: { retired: null, retiredAs: null },
      plans: { rfc: { arc: "MOCK-ARC-O1", settled: true }, plan: { arc: "MOCK-ARC-O2", settled: true } },
    },
    retired: { verdicts: ["approved"], attrs: { retired: today(), retiredAs: "cancelled" } },
  },
};

/** Set or remove `key=value` on one line. `[^\s}]+`, never `\S+` — the greedy form eats the
 * closing brace when removing the bag's last attribute, and the leaf stops being a leaf. The mock
 * itself caught that within a minute of existing, which is what a fixture is for. */
function setOn(line, key, value) {
  const has = new RegExp(`\\s${key}=(?:"[^"]*"|[^\\s}]+)`);
  if (value == null) return line.replace(has, "");
  const pair = ` ${key}=${/\s/.test(String(value)) ? `"${value}"` : value}`;
  if (has.test(line)) return line.replace(has, pair);
  return line.replace(/\}\s*$/, `${pair}}`);
}

const OFF_MARK = "<!-- mock off — bring it back with: node RFCs/proofs/mock.js";

function readLines(kind) {
  return fs.readFileSync(file(kind), "utf8").split("\n");
}
function writeLines(kind, lines) {
  fs.writeFileSync(file(kind), lines.join("\n"));
}

/** TEARDOWN — the leaf becomes a comment, the parse sees no registration, the row is removed. */
function off(kind) {
  const lines = readLines(kind).map((l) =>
    l.startsWith(LEAF[kind] + "{") ? `${OFF_MARK} ${kind} on -->\n<!-- mock-leaf: ${l} -->` : l
  );
  writeLines(kind, lines);
  console.log(`mock-${kind}.md → off (the leaf is a comment; the registry row follows on the next parse)`);
}

/** Bring it back — the exact leaf, out of the comment. */
function on(kind) {
  const lines = [];
  for (const l of readLines(kind)) {
    if (l.startsWith(OFF_MARK)) continue;
    const m = /^<!-- mock-leaf: (.+) -->$/.exec(l);
    lines.push(m ? m[1] : l);
  }
  writeLines(kind, lines);
  console.log(`mock-${kind}.md → on (the leaf is back; saving re-registers it)`);
}

function apply(kind, state) {
  if (state === "off") return off(kind);
  if (state === "on") return on(kind);
  const spec = (STATES[kind] || {})[state];
  if (!spec) {
    const words = Object.keys(STATES[kind] || {}).concat(["off", "on"]).join(" · ") || "(no such kind)";
    console.error(`no state "${state}" for a ${kind}. try: ${words}`);
    process.exit(1);
  }
  let lines = readLines(kind);

  lines = lines.map((l) => {
    if (!l.startsWith(LEAF[kind] + "{")) return l;
    let out = l;
    for (const [k, v] of Object.entries(spec.attrs || {})) out = setOn(out, k, v);
    return out;
  });

  if (spec.verdicts) {
    let i = 0;
    lines = lines.map((l) => (l.startsWith(":::approval{") ? setOn(l, "verdict", spec.verdicts[i++]) : l));
  }

  if (spec.objectives) {
    lines = lines.map((l) => {
      const m = /^:::objective\{id=(\w+)/.exec(l);
      return m && spec.objectives[m[1]] ? setOn(l, "state", spec.objectives[m[1]]) : l;
    });
  }

  // the STATUS heading is what `built` reads, and a press cannot unwrite it — so this can.
  if (spec.status !== undefined) {
    lines = lines.filter((l) => !/^##\s*STATUS/.test(l));
    if (spec.status) lines.push(`## STATUS — built ${today()}`, "");
  }

  writeLines(kind, lines);
  console.log(`mock-${kind}.md → ${state}`);

  // The arc's upward states move the PLANS — their leaves, in their own files.
  for (const [doc, plan] of Object.entries(spec.plans || {})) {
    const lns = readLines(doc).map((l) => {
      if (!l.startsWith(LEAF[doc] + "{")) return l;
      let out = setOn(l, "arc", plan ? plan.arc : null);
      out = setOn(out, "settled", plan && plan.settled ? today() : null);
      return out;
    });
    writeLines(doc, lns);
    console.log(
      plan
        ? `mock-${doc}.md now serves ${plan.arc}${plan.settled ? ", settled" : ", still moving"}`
        : `mock-${doc}.md detached`
    );
  }
}

const [kind, state] = process.argv.slice(2);
if (!kind || !state) {
  console.log("usage: node RFCs/proofs/mock.js <kind> <state>\n");
  for (const [k, v] of Object.entries(STATES))
    console.log(`  ${k.padEnd(7)} ${Object.keys(v).concat(["off", "on"]).join(" · ")}`);
  console.log(`  plan    (moved by the arc's states — it serves MOCK-ARC-O2)`);
  process.exit(0);
}
apply(kind, state);
