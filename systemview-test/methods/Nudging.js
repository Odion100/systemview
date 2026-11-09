// systemview-test/methods/Nudging.js — DOORS TO THE SHELL-SIDE MACHINERY RFC-078's SURVIVING
// claims rest on: autobot's `nudge.cjs` (the chaser's closed-condition, c13–c14), `docs.cjs` and
// `context.cjs` (the corpus treatment line, c20–c22 and c37–c38), the mark door and the fire scan
// (c26, c40), and the project roster (c23). The subject lives in the shell's repo with no hub door
// of its own, so the door is made here the way Retrieval.js and Proofs.js already reach across:
// require the REAL module and transcribe what it answers.
//
// THE NUDGE-RECORD DOORS ARE GONE, 2026-11-09, with the module they dialled. `enabled`, `message`,
// `debounce` and `record` each required `electron/agents/nudges.cjs`, which the withdrawal deleted —
// a door that requires a deleted module does not fail its claim, it THROWS, and the claim reads as
// unbuildable rather than unmet. They were removed with the claims they served rather than left to
// rot.
//
// THE RULE (methods/Claims.js states it): no comparison that answers the spec's question. Every
// method passes a declared input to the real function and returns what came back; the assertions
// live in the claim's own fold, where a reader can see them.
//
// `suite` is the one coarser rung — it executes one of the machinery's OWN smoke suites, by
// whitelist, and returns its exit. Legitimate where the claim is about construction or wiring:
// those are pinned as assertions inside the suite and have no single function to dial.
const path = require("path");
const { spawnSync } = require("child_process");

const REPO = path.resolve(__dirname, "..", "..");
const AUTOBOT = path.join(path.dirname(REPO), "..", "autobot");
const agents = (f) => require(path.join(AUTOBOT, "electron", "agents", f));

const SUITES = {
  nudge: "tests/nudge.js",
  fires: "tests/markdown-fires.js",
  context: "tests/context.js",
  docs: "tests/docs.js",
  announce: "tests/markdown-announce.js",
};

module.exports = {
  // The roster (c23): the live projects.json, read — transcription
  // only; the assertion (manager rides the same flat map as every repo) lives in the claim's fold.
  // c23 — THE MANAGER IS A PROJECT IN THE HARNESS'S OWN TERMS. The roster is a file, and the
  // claim is about that file carrying a row, so the door reads the file. It used to read
  // `connectedProjects()` out of autobot's nudge-record module; that module is deleted, and
  // reaching for a survivor's helper would have been a door onto a different fact.
  projects() {
    const fs = require("fs");
    const os = require("os");
    let roster = [];
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(os.homedir(), ".autobot", "projects.json"), "utf8"));
      roster = Array.isArray(raw) ? raw.map((r) => r && r.code).filter(Boolean) : Object.keys(raw || {});
    } catch {}
    return { roster: `|${roster.join("|")}|`, count: roster.length };
  },
  excused({ status = "", attachments = [] } = {}) {
    const { excusedOf } = agents("nudge.cjs");
    return { excused: excusedOf({ status: { text: status }, attachments }) };
  },

  // The treatment line's two layers (c21, c37): the real `treatmentOf` over a declared corpus
  // entry. `prints` is whether any line exists at all; `said`/`derived` come back as "" when absent
  // so the evaluation grammar can assert their absence.
  treatment({ registry = "", treatment } = {}) {
    const { treatmentOf } = agents("docs.cjs");
    const corpus = {
      name: "probe",
      ...(registry ? { registry } : {}),
      ...(treatment !== undefined ? { treatment } : {}),
    };
    const t = treatmentOf(corpus);
    return { prints: !!t, said: (t && t.said) || "", derived: (t && t.derived) || "" };
  },

  // One of the machinery's own suites, by whitelist — and it answers by NAMED CHECK, never by exit
  // code alone.
  //
  // WHAT THESE SUITES STUB, so a claim resting on one knows its own scope. `nudges` REPLACES the
  // document judges through `__setJudges`, deliberately: its subject is the GATING — on, in scope,
  // on this clock, inside its window — and a real judge would only add a second reason for a red.
  // So a proof that cites `nudges` is evidence about the gate and says nothing about whether the
  // judges are RIGHT. That is `judges`, which stubs nothing: real documents on disk, the real parse,
  // the real judges. `nudge`, `fires`, `context`, `docs` and `announce` stub nothing either.
  // Citing `nudges` for a claim about a judge's verdict would be the mistake this note exists to
  // prevent.
  //
  // AN EXIT CODE CANNOT ESTABLISH A NAMED BEHAVIOUR, which a blind review of this RFC's own marks
  // said plainly and correctly: `ok: true` means every assertion that EXISTS passed, so delete the
  // assertion that mattered and the suite still exits 0. A claim resting on that is resting on a
  // count. It is the same rule the jest adapter follows for panels — assert the cases by name.
  //
  // `want` is a list of fragments naming the checks the CLAIM stands on. Each is matched against
  // the suite's own `ok  <name>` lines, so the fragments a reader sees in the spec are the
  // behaviours the claim is actually about. `missing` is pipe-wrapped because the run-block check
  // grammar has no array form, and it names what was NOT found rather than only counting.
  suite({ name = "", want = [] } = {}) {
    const file = SUITES[name];
    if (!file) return { ok: false, error: `unknown suite — one of: ${Object.keys(SUITES).join(", ")}` };
    const res = spawnSync(process.execPath, [path.join(AUTOBOT, file)], {
      cwd: AUTOBOT,
      encoding: "utf8",
      timeout: 120000,
      maxBuffer: 16 * 1024 * 1024,
    });
    const out = String(res.stdout || "");
    // THE SUITES DO NOT AGREE ON THEIR OWN FORMAT, and that mattered silently: most print
    // `  ok  <name>` per passing check, but tests/docs.js prints `  ✓ <name>`. A parser that knew
    // only the first read ZERO named cases out of that suite, so `checkCount` was 0, any `want`
    // would have gone red for a FORMATTING reason rather than a behavioural one, and the only
    // thing left asserting anything was the exit code — while the proof above it looked like a
    // named-check assertion. Found auditing this door against spec-authoring, 2026-11-08.
    const checks = out
      .split("\n")
      .map((l) => l.match(/^\s*(?:ok\s\s+|✓\s+)(.*\S)\s*$/))
      .filter(Boolean)
      .map((m) => m[1]);
    const wanted = (Array.isArray(want) ? want : [want]).map((w) => String(w || "").trim()).filter(Boolean);
    const missing = wanted.filter((w) => !checks.some((c) => c.includes(w)));
    const exited = res.status === 0;
    // NO `ok` FIELD, DELIBERATELY. It used to mean "the suite passed AND every named check was
    // there" — which is the SPEC's conclusion, computed inside the door. A door may call, read,
    // count and hand back what it saw; the moment it decides whether the answer is good, the
    // judgment has moved inside the thing being judged, and fourteen proofs were asserting this
    // door's opinion instead of their own. The facts are below and the claim's fold does the
    // deciding, where a reader can see it: `suitePassed` AND `missing = "||"`.
    return {
      suitePassed: exited,
      exitCode: res.status === null ? -1 : res.status,
      checkCount: checks.length,
      wantedCount: wanted.length,
      matchedAll: missing.length === 0,
      missing: `|${missing.join("|")}|`,
      tail: out.trim().slice(-300),
      ...(res.status !== 0 ? { stderr: String(res.stderr || "").trim().slice(-500) } : {}),
    };
  },
};
