const log = require("./logger");
const appIsRunning = require("./appIsRunning");
const startLineReader = require("./startLineReader");
const listTests = require("./listTests");

// ONE COMMAND HOSTS THE HUB; EVERY OTHER ONE ATTACHES OR REFUSES.
//
// `start` is the host — it is what the shell's own app registry runs to bring SystemView up
// (`start: ["/usr/local/bin/systemview", "start", "3000"]` in autobot's electron/apps/registry.cjs),
// and it stays alive for as long as the hub does. That is why hosting is safe here and nowhere
// else: a command that EXITS would take the hub down with it, so `board`, `test`, `nav` and the
// rest must never stand one up. They probe, attach, and refuse by name.
//
// A SECOND HUB IS STILL THE THING TO AVOID. A rival on the same port knows none of your projects,
// documents or connected services, and everything downstream then reports confidently against an
// empty world. So the host path is gated on the port being FREE: something already serving means
// attach, never replace.
//
// MEASURED 2026-11-07, which is why the distinction is written down. Hosting was removed from this
// file entirely on the argument that "the IDE hosts the hub now" — but the IDE hosts it BY RUNNING
// THIS COMMAND, so the only host in the system was gone and the refusal pointed at itself. He
// stopped the hub, clicked open SystemView, and the launcher spawned `systemview start 3000` eleven
// times in two minutes: each one printed "the hub is not running — open SystemView and the hub comes
// up with it" and exited 0. Nothing could bring it back up.
//
// THE PORT IS READ THE WAY THE HUB READS IT. `SV_PORT || 3000`, same expression, because a CLI that
// hardcodes 3000 while the hub honours an override makes the probe miss a hub that IS running — and
// then the host path above would start a rival on top of it.
// SAID ONCE PER PROCESS. Two call sites can both miss the hub in one run — the case-setting
// preload and then the command itself — and printing the same refusal twice reads as two faults.
let said = false;

module.exports = async function launchApp(port, { interactive = false, host = false, connectedUrls = new Set(), onReady } = {}) {
  const ui = `http://localhost:${port}`;
  const api = `${ui}/systemview/api`;

  if (!(await appIsRunning(api))) {
    // `host` IS THE CALLER SAYING "I STAY ALIVE" — only `start` passes it. Required lazily so no
    // command that merely attaches ever loads the hub's whole module graph.
    if (host) {
      if (interactive) log.info(`Nothing is serving port ${port} — hosting the hub here...`);
      await require("../api")(port);
    } else {
      if (!said) {
        said = true;
        log.error(`SystemView's hub is not running on port ${port}.`);
        console.log(`  Bring it up with \`systemview start ${port}\` — that command hosts it, which is`);
        console.log("  also what opening SystemView in the shell runs for you.");
        console.log("  On another port, set SV_PORT=<port>; the hub reads the same variable.\n");
      }
      return false;
    }
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
