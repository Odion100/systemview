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
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const REPO = path.resolve(__dirname, "..", "..");
const AUTOBOT = path.join(path.dirname(REPO), "..", "autobot");
const agents = (f) => require(path.join(AUTOBOT, "electron", "agents", f));

// The cache the door's own comment accounts for. Keyed on what could make the answer different,
// so a hit and a fresh run cannot disagree.
const RUNS = new Map();
const TTL_MS = 10 * 60 * 1000;

const stampOf = (file) => {
  const parts = [];
  try {
    const st = fs.statSync(path.join(AUTOBOT, file));
    parts.push(`${st.mtimeMs}:${st.size}`);
  } catch {
    parts.push("gone");
  }
  // THE CODE UNDER TEST, not just the test. Keying on the suite file alone would have served a
  // green from before a module was fixed — the exact failure a cache is supposed to be safe from.
  try {
    const dir = path.join(AUTOBOT, "electron", "agents");
    const newest = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".cjs"))
      .reduce((m, f) => {
        try {
          return Math.max(m, fs.statSync(path.join(dir, f)).mtimeMs);
        } catch {
          return m;
        }
      }, 0);
    parts.push(String(newest));
  } catch {
    parts.push("0");
  }
  return parts.join("|");
};

// NOT spawnSync, AND THIS IS THE REASON — the Test service is HOSTED INSIDE THE HUB'S OWN PROCESS
// (RFC-027), so a synchronous two-minute child blocks the hub's event loop and the window with it.
// Measured 2026-11-09: running this document's proofs took the hub to zero responses, he reported
// "the hub is unreachable", and the honest cause was this function rather than anything in the
// suite. An async child yields between ticks, so the hub keeps answering while the suite runs.
//
// IN FLIGHT IS SHARED TOO, not just the finished answer: eight claims citing one suite arrive
// within milliseconds of each other, so without this the first eight calls would each start their
// own child and the cache would only help the ninth.
const INFLIGHT = new Map();

function runSuite(file) {
  const key = `${file}@${stampOf(file)}`;
  const hit = RUNS.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return Promise.resolve(hit.out);
  if (INFLIGHT.has(key)) return INFLIGHT.get(key);
  const p = new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(AUTOBOT, file)], { cwd: AUTOBOT });
    let stdout = "";
    let stderr = "";
    let done = false;
    const finish = (status) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      const out = { stdout, stderr, status };
      RUNS.clear(); // one suite's answer at a time — this door is walked a document at a time
      RUNS.set(key, { at: Date.now(), out });
      INFLIGHT.delete(key);
      resolve(out);
    };
    const timer = setTimeout(() => {
      try { child.kill("SIGKILL"); } catch {}
      stderr += `\n[Test.suite] killed after 300s — the suite did not finish`;
      finish(-1);
    }, 300000);
    child.stdout.on("data", (d) => { stdout += d; });
    child.stderr.on("data", (d) => { stderr += d; });
    child.on("error", (e) => { stderr += String((e && e.message) || e); finish(-1); });
    child.on("close", (code) => finish(code === null ? -1 : code));
  });
  INFLIGHT.set(key, p);
  return p;
}

const SUITES = {
  nudge: "tests/nudge.js",
  fires: "tests/markdown-fires.js",
  context: "tests/context.js",
  docs: "tests/docs.js",
  announce: "tests/markdown-announce.js",
  worklist: "tests/worklist.js",
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
  async suite({ name = "", want = [] } = {}) {
    const file = SUITES[name];
    if (!file) return { ok: false, error: `unknown suite — one of: ${Object.keys(SUITES).join(", ")}` };
    // ONE SPAWN PER SUITE, SHARED BY EVERY CLAIM THAT CITES IT — and this is a facilitation, never
    // a judgment. Eight of RFC-078's claims assert different NAMED CHECKS inside one suite, and
    // each call re-ran the whole file: tests/worklist.js takes ~130 seconds, so walking the
    // document cost twenty minutes and he killed the run rather than wait for it (2026-11-09).
    // The matching below still happens per call; only the identical spawn is reused.
    //
    // WHAT A RED HERE IS AMBIGUOUS BETWEEN — the one sentence a caching door owes its reader: the
    // suite, or a stale cache. The key is what settles it. It carries the suite file's own
    // mtime+size AND the newest mtime under the agents directory the suites exercise, so editing
    // either the test or the code under test invalidates it; the ten-minute ceiling is only there
    // so an unrelated change nobody stamped cannot outlive a session.
    const out = await runSuite(file);
    // THE SUITES DO NOT AGREE ON THEIR OWN FORMAT, and that mattered silently: most print
    // `  ok  <name>` per passing check, but tests/docs.js prints `  ✓ <name>`. A parser that knew
    // only the first read ZERO named cases out of that suite, so `checkCount` was 0, any `want`
    // would have gone red for a FORMATTING reason rather than a behavioural one, and the only
    // thing left asserting anything was the exit code — while the proof above it looked like a
    // named-check assertion. Found auditing this door against spec-authoring, 2026-11-08.
    const checks = String(out.stdout || "")
      .split("\n")
      .map((l) => l.match(/^\s*(?:ok\s\s+|✓\s+)(.*\S)\s*$/))
      .filter(Boolean)
      .map((m) => m[1]);
    const wanted = (Array.isArray(want) ? want : [want]).map((w) => String(w || "").trim()).filter(Boolean);
    const missing = wanted.filter((w) => !checks.some((c) => c.includes(w)));
    const exited = out.status === 0;
    // NO `ok` FIELD, DELIBERATELY. It used to mean "the suite passed AND every named check was
    // there" — which is the SPEC's conclusion, computed inside the door. A door may call, read,
    // count and hand back what it saw; the moment it decides whether the answer is good, the
    // judgment has moved inside the thing being judged, and fourteen proofs were asserting this
    // door's opinion instead of their own. The facts are below and the claim's fold does the
    // deciding, where a reader can see it: `suitePassed` AND `missing = "||"`.
    return {
      suitePassed: exited,
      exitCode: out.status,
      checkCount: checks.length,
      wantedCount: wanted.length,
      matchedAll: missing.length === 0,
      missing: `|${missing.join("|")}|`,
      tail: String(out.stdout || "").trim().slice(-300),
      ...(out.status !== 0 ? { stderr: String(out.stderr || "").trim().slice(-500) } : {}),
    };
  },
};
