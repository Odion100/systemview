// CLI test-harness module.
//
// Runs the *real* SystemView CLI as a child process (never interactive) and returns its output,
// so CLI behavior can be validated by saved tests in the UI — change CLI code, re-run the test.
// Shelling out (rather than requiring the CLI fns in-process) keeps CLI state — cwd, manifest,
// its own client — isolated from this service. Commands connect to the already-running UI/services,
// so nothing needs launching here.

const { spawn } = require("child_process");
const path = require("path");

const CLI_ENTRY = path.join(process.cwd(), "cli", "index.js");

function runCli(args, { timeoutMs = 20000 } = {}) {
  return new Promise((resolve) => {
    // process.execPath = the same node running this service, so no PATH assumptions
    const child = spawn(process.execPath, [CLI_ENTRY, ...args], { cwd: process.cwd() });
    let stdout = "";
    let stderr = "";
    let done = false;
    const finish = (exitCode) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve({ exitCode, stdout, stderr });
    };
    // safety net: kill a hung/streaming command so a test can never hang forever
    const timer = setTimeout(() => {
      try {
        child.kill("SIGTERM");
      } catch {}
      finish(-2);
    }, timeoutMs);
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("close", (exitCode) => finish(exitCode));
    child.on("error", (err) => {
      stderr += String(err && err.message);
      finish(-1);
    });
  });
}

// pull the first parseable JSON object/array out of stdout (probe/test --json prepend nothing,
// but be tolerant of a stray banner line)
function parseJson(stdout) {
  const trimmed = (stdout || "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {}
  const start = trimmed.search(/[[{]/);
  if (start > -1) {
    try {
      return JSON.parse(trimmed.slice(start));
    } catch {}
  }
  return null;
}

const CLI = {
  // generic escape hatch — run any command, get raw output + exit code
  async run({ args = [] } = {}) {
    return runCli(args);
  },

  // `systemview probe <namespace> [args] --json [flags]` → parsed result.
  // `flags` lets a fixture pass extra CLI flags, e.g. ["--header", "testtoken: X"].
  async probe({ namespace, args, flags = [] } = {}) {
    const cliArgs = ["probe", namespace];
    if (args !== undefined && args !== null) {
      cliArgs.push(typeof args === "string" ? args : JSON.stringify(args));
    }
    cliArgs.push("--json", ...(Array.isArray(flags) ? flags : []));
    const { exitCode, stdout, stderr } = await runCli(cliArgs);
    return { exitCode, result: parseJson(stdout), stdout, stderr };
  },

  // `systemview test <project> [namespace] --json [flags]` → parsed result + exit code.
  // NOTE: always scope `namespace` away from the CLI module itself to avoid recursive test runs.
  async test({ project = "systemview-test", namespace, flags = [] } = {}) {
    const cliArgs = ["test", project];
    if (namespace) cliArgs.push(namespace);
    cliArgs.push("--json", ...(Array.isArray(flags) ? flags : []));
    const { exitCode, stdout, stderr } = await runCli(cliArgs);
    return { exitCode, result: parseJson(stdout), stdout, stderr };
  },

  // `systemview list [project] [namespace] --json` → parsed result
  async list({ project, namespace, flags = [] } = {}) {
    const cliArgs = ["list"];
    if (project) cliArgs.push(project);
    if (namespace) cliArgs.push(namespace);
    cliArgs.push("--json", ...(Array.isArray(flags) ? flags : []));
    const { exitCode, stdout, stderr } = await runCli(cliArgs);
    return { exitCode, result: parseJson(stdout), stdout, stderr };
  },

  // `systemview logs [project] [namespace] --current --json` → NDJSON entries + exit code.
  // --current (not --follow) prints existing entries and exits. Robust to the human banner lines
  // the command currently prints alongside the JSON — we pull only the JSON lines.
  async logs({ project = "systemview-test", namespace, flags = [] } = {}) {
    const cliArgs = ["logs"];
    if (project) cliArgs.push(project);
    if (namespace) cliArgs.push(namespace);
    cliArgs.push("--current", "--json", ...(Array.isArray(flags) ? flags : []));
    const { exitCode, stdout, stderr } = await runCli(cliArgs);
    const entries = [];
    for (const line of (stdout || "").split("\n")) {
      const t = line.trim();
      if (t.startsWith("{")) {
        try {
          entries.push(JSON.parse(t));
        } catch {}
      }
    }
    return { exitCode, entries, stdout, stderr };
  },
};

module.exports = CLI;
