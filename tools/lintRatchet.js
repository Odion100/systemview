// THE WARNING CLASS GOES RED WHEN IT GROWS — `yarn lint:ratchet`.
//
// WHY THIS EXISTS. A clean production build emits a pile of eslint WARNINGS, and `CI=true` is not
// set, so none of them fails anything. The card asking for a strict gate assumed the way there is to
// clear the whole list first; two things make that the wrong order. The list regrows the moment
// nobody is watching, and — the part that was actually costing something — **a real bug can hide
// inside a class nobody reads.** Measured 2026-11-11: of the ten warnings that were neither
// `no-unused-vars` nor a hook dependency, exactly one was a live defect — `no-dupe-keys` on the
// markdown registry, where the key `report` was registered twice and one component became
// unreachable. It had been sitting in the warning output for weeks.
//
// So the gate goes on NOW, against the backlog as it stands. A rule that is already failing keeps
// its allowance; a rule that gets WORSE fails; a rule nobody has ever seen before fails loudest,
// because that is the one most likely to be a real finding rather than style.
//
// AND IT RATCHETS DOWN BY ITSELF: when a count comes in UNDER its allowance the run says so and
// prints the new baseline to paste, so the number can only travel one way.
//
// WHAT IT CANNOT CLAIM. It says nothing about whether any warning is a real bug — only whether the
// shape of the pile changed. It lints `src api cli` and nothing else, and a file outside those is
// not checked (said here rather than implied by a green line).
//
// TEST FILES ARE EXCLUDED, AND NOT FOR CONVENIENCE. The production build does not lint them — they
// are not in the bundle — but a bare `eslint` run reads `package.json`'s config, which extends
// `react-app/jest`, so the `jest` and `testing-library` plugin rules fire at ERROR severity on
// every spec. Measured: 1203 problems and 1093 "errors" with them in, against 94 and zero without.
// Including them would make this measure a different system from the one the build gates, and the
// number would read as a catastrophe nobody can act on. The suites are what check the suites.
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const BASELINE = path.join(__dirname, "lint-baseline.json");
const TARGETS = ["src", "api", "cli"];

function counts() {
  let out = "";
  try {
    out = execFileSync(
      path.join(ROOT, "node_modules/.bin/eslint"),
      [...TARGETS, "--ext", ".js", "--ignore-pattern", "**/*.test.js", "--format", "json"],
      { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
    );
  } catch (e) {
    // eslint exits non-zero when it reports anything at all, and its JSON is still on stdout. A
    // genuinely broken run has no stdout, and that is a failure rather than an empty answer — the
    // alternative is a ratchet that reports every rule cleared because eslint never ran.
    out = (e && e.stdout) || "";
    if (!out.trim()) {
      console.error("eslint produced no output — the ratchet cannot say anything:\n" + ((e && e.stderr) || e));
      process.exit(1);
    }
  }
  const files = JSON.parse(out);
  const by = {};
  let errors = 0;
  files.forEach((f) =>
    (f.messages || []).forEach((m) => {
      if (m.severity === 2) errors += 1;
      const rule = m.ruleId || "(parse error)";
      by[rule] = (by[rule] || 0) + 1;
    }),
  );
  return { by, errors, files: files.length };
}

const now = counts();
const base = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, "utf8")) : { rules: {} };
const allow = base.rules || {};

const worse = [];
const brandNew = [];
const better = [];
Object.entries(now.by).forEach(([rule, n]) => {
  const cap = allow[rule];
  if (cap === undefined) brandNew.push(`${rule} (${n})`);
  else if (n > cap) worse.push(`${rule}: ${n}, allowed ${cap}`);
  else if (n < cap) better.push(`${rule}: ${n}, was ${cap}`);
});
const gone = Object.keys(allow).filter((r) => !now.by[r]);

const total = Object.values(now.by).reduce((a, b) => a + b, 0);
console.log(`  eslint over ${TARGETS.join(" ")} (no specs) — ${total} problem(s) across ${now.files} file(s), ${now.errors} error(s)`);
Object.entries(now.by)
  .sort((a, b) => b[1] - a[1])
  .forEach(([rule, n]) => console.log(`    ${String(n).padStart(4)}  ${rule}${allow[rule] !== undefined && n < allow[rule] ? `   (was ${allow[rule]})` : ""}`));

// AN ERROR IS NEVER ALLOWANCED. `no-undef` and an unresolvable import are compile failures in the
// production build — the ratchet is about the warning class, and treating an error as a tolerable
// count would make this the thing that hides them.
if (now.errors) {
  console.error(`\n  ${now.errors} ERROR(s) — errors are never in the baseline; the build fails on these.`);
  process.exit(1);
}

if (brandNew.length) console.error(`\n  A RULE NOBODY HAS SEEN BEFORE:\n    ${brandNew.join("\n    ")}\n  A new rule is the likeliest place for a real finding. Read it before baselining it.`);
if (worse.length) console.error(`\n  WORSE THAN THE BASELINE:\n    ${worse.join("\n    ")}`);

if (better.length || gone.length) {
  if (better.length) console.log(`\n  BETTER — the allowance comes down:\n    ${better.join("\n    ")}`);
  if (gone.length) console.log(`    gone entirely: ${gone.join(", ")}`);
  console.log(`\n  Paste this into tools/lint-baseline.json so it can only travel one way:\n${JSON.stringify({ rules: now.by }, null, 2)}`);
}

if (brandNew.length || worse.length) process.exit(1);
console.log("\n  no rule got worse and nothing new appeared.\n");
