const log = require("./logger");
const appIsRunning = require("./appIsRunning");
const startLineReader = require("./startLineReader");
const listTests = require("./listTests");

// THE CLI DOES NOT START THE HUB ANY MORE — IT ATTACHES OR IT REFUSES.
//
// It used to `require("../api")` and stand one up in its own process, which was right when the CLI
// WAS SystemView: you ran it, it launched a hub and opened a browser at it. The IDE hosts the hub
// now, so that path had become a way to answer with the wrong system — a second hub on the same
// port knows none of your projects, none of your documents and none of your connected services, and
// everything downstream then reports confidently against an empty world. He lands in "a stale
// window" and nothing says why.
//
// A REFUSAL IS STRICTLY BETTER THAN A SECOND HUB, which is the whole argument: an error says what
// to do, and a silent self-start answers wrongly. So this probes, attaches, and when nothing is
// there it names the port, the fix, and the environment variable — and returns false so the caller
// can exit non-zero instead of proceeding into an obscure connection failure.
//
// THE PORT IS READ THE WAY THE HUB READS IT. `SV_PORT || 3000`, same expression, because a CLI that
// hardcodes 3000 while the hub honours an override is the trigger for the very symptom above: the
// probe misses a hub that is running and the old code then started a rival on top of it.
// SAID ONCE PER PROCESS. Two call sites can both miss the hub in one run — the case-setting
// preload and then the command itself — and printing the same refusal twice reads as two faults.
let said = false;

module.exports = async function launchApp(port, { interactive = false, connectedUrls = new Set(), onReady } = {}) {
  const ui = `http://localhost:${port}`;
  const api = `${ui}/systemview/api`;

  if (!(await appIsRunning(api))) {
    if (!said) {
      said = true;
      log.error(`SystemView's hub is not running on port ${port}.`);
      console.log("  The IDE hosts it — open SystemView and the hub comes up with it.");
      console.log("  On another port, set SV_PORT=<port>; the hub reads the same variable.\n");
    }
    return false;
  }

  if (!interactive) return true;

  log.success("connected!");
  console.log(`  SystemView UI  \u2192 ${ui}`);
  console.log(`  SystemView API \u2192 ${api}\n`);
  if (onReady) await onReady();
  await listTests(ui, null, null, { connectedUrls });
  await startLineReader(ui, { connectedUrls });
  return true;
};
