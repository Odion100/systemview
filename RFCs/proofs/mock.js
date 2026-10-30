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

// THE APPROVAL BLOCKS THEMSELVES ARE A VARIABLE — an RFC's verdict is read off EVERY block and the
// weakest answer wins, so the number of them is part of what the lifecycle does. `approval+` and
// `approval-` let a walk prove that from either direction: add one to a document that called itself
// approved and watch it fall back to draft; drop the unanswered one and watch it land.
//
// A new block is inserted after the LAST existing one so the group stays together; with none in the
// document it lands at the end under its own heading. Removal takes the last one, which is the one
// a walk just added.
const APPROVAL_OPEN = /^:::approval\{/;

function approvalLines(lines) {
  const out = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (!APPROVAL_OPEN.test(lines[i])) continue;
    // the close is the next line that is exactly three colons — approval bodies hold prose, and a
    // nested fence would be longer, so this cannot swallow a sibling block
    let end = i;
    for (let j = i + 1; j < lines.length; j += 1) {
      if (/^:::\s*$/.test(lines[j])) { end = j; break; }
    }
    out.push({ start: i, end });
  }
  return out;
}

function addApproval(kind) {
  const lines = readLines(kind);
  const found = approvalLines(lines);
  const n = found.length + 1;
  const block = [
    "",
    `:::approval{ask="MOCK — approve part ${n}?"}`,
    `Added by the walk. Until this carries a verdict, the document cannot read as approved — the`,
    `verdict is every block's answer, and the weakest one wins.`,
    ":::",
  ];
  if (found.length) {
    const at = found[found.length - 1].end + 1;
    lines.splice(at, 0, ...block);
  } else {
    lines.push("", "## The approval blocks the walk drives", ...block);
  }
  writeLines(kind, lines);
  console.log(`mock-${kind}.md → ${n} approval block${n === 1 ? "" : "s"} (the new one carries no verdict)`);
}

function removeApproval(kind) {
  const lines = readLines(kind);
  const found = approvalLines(lines);
  if (!found.length) {
    console.error(`mock-${kind}.md has no approval block to remove`);
    process.exit(1);
  }
  // THE LAST BLOCK IS A FLOOR, NOT A STEP. A document with no approval block at all cannot reach
  // `approved` by its real derivation — the verdict is read off the blocks, and an empty set
  // satisfies "every block approved" for free, which is the vacuous pass every floor in this
  // design exists to stop. So a walk can add and drop blocks freely and never strand the fixture
  // in a state its own trail cannot explain. `off` is how you take the document out of play.
  if (found.length === 1) {
    console.error(
      `mock-${kind}.md has one approval block left — removing it would leave a document whose verdict nothing can answer. Use \`${kind} off\` to take it out of play.`
    );
    process.exit(1);
  }
  const last = found[found.length - 1];
  // take the blank line above it too, so repeated add/remove does not leave a widening gap
  const from = last.start > 0 && lines[last.start - 1].trim() === "" ? last.start - 1 : last.start;
  lines.splice(from, last.end - from + 1);
  writeLines(kind, lines);
  const left = found.length - 1;
  console.log(`mock-${kind}.md → ${left} approval block${left === 1 ? "" : "s"} left`);
}

function apply(kind, state) {
  if (state === "off") return off(kind);
  if (state === "on") return on(kind);
  if (state === "approval+") return addApproval(kind);
  if (state === "approval-") return removeApproval(kind);
  const spec = (STATES[kind] || {})[state];
  if (!spec) {
    const words = Object.keys(STATES[kind] || {}).concat(["off", "on", "approval+", "approval-"]).join(" · ") || "(no such kind)";
    console.error(`no state "${state}" for a ${kind}. try: ${words}`);
    process.exit(1);
  }
  let lines = readLines(kind);

  // A STATE PRESS WHILE TORN DOWN would move verdicts and attrs under a document that is not
  // there — the leaf is the identity, and without it there is nothing to walk. The fixture
  // teaches the order instead: raise it first.
  if (!lines.some((l) => l.startsWith(LEAF[kind] + "{"))) {
    console.error(`mock-${kind}.md is torn down — raise it first: node RFCs/proofs/mock.js ${kind} on`);
    process.exit(1);
  }

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
  //
  // IT RAISES A LEAF IT NEEDS, AND IT ONLY REPORTS WHAT IT WROTE. A plan whose leaf is torn down has
  // no line to edit, and this loop used to write the file back unchanged and announce the attachment
  // anyway — `mock-rfc.md` rests as a SPEC with its rfc leaf commented out, so every arc walk
  // claimed to attach O1's plan and attached nothing, while the map showed O1 unplanned. A fixture
  // that testifies instead of reading state is the one bug it cannot be allowed to have.
  for (const [doc, plan] of Object.entries(spec.plans || {})) {
    const has = () => readLines(doc).some((l) => l.startsWith(LEAF[doc] + "{"));
    // Raising is only ever needed to ATTACH. Detaching a leaf that is already down is already true,
    // so bringing one back just to say "detached" would un-tear-down a fixture nobody asked for.
    if (plan && !has()) {
      on(doc);
      if (!has()) {
        console.log(`mock-${doc}.md has no ${LEAF[doc]} leaf to attach — cannot serve ${plan.arc}`);
        continue;
      }
    }
    if (!plan && !has()) {
      console.log(`mock-${doc}.md is already down — nothing to detach`);
      continue;
    }
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
    console.log(`  ${k.padEnd(7)} ${Object.keys(v).concat(["off", "on", "approval+", "approval-"]).join(" · ")}`);
  console.log(`  plan    (moved by the arc's states — it serves MOCK-ARC-O2)`);
  process.exit(0);
}
apply(kind, state);
