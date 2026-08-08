// systemview-test/methods/Cli.js — the `Cli` module of SystemViewCore.
// RFC-021 DEPICTED these namespaces as a project:// ghost; RFC-027 made them real: every method
// actually spawns the systemview CLI and returns what came back, so saved tests here exercise
// SystemView's own command surface end to end.
const { execFile } = require("child_process");
const path = require("path");
const CLI = path.resolve(__dirname, "../../cli/index.js");

const run = (args) =>
  new Promise((resolve) => {
    execFile(process.execPath, [CLI, ...args], { timeout: 60000 }, (err, stdout, stderr) =>
      resolve({
        ok: !err,
        exitCode: err ? err.code || 1 : 0,
        stdout: String(stdout).trim().slice(-4000),
        stderr: String(stderr).trim().slice(-1000),
      }),
    );
  });

module.exports = {
  version: () => run(["--version"]),
  list: ({ target = "systemview-test" } = {}) => run(["list", target, "--json"]),
  test: ({ target = "systemview-test", namespace = "Math.add" } = {}) =>
    run(["test", target, namespace, "--json"]),
  probe: ({ namespace = "TestService.Math.add", args = { a: 2, b: 3 } } = {}) =>
    run(["probe", namespace, JSON.stringify(args), "--json"]),
  logs: ({ target = "systemview-test", limit = 5 } = {}) =>
    run(["logs", target, "--current", "--limit", String(limit)]),
};
