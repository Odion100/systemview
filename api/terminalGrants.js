// WHO MAY TYPE IN WHICH TERMINAL — the grant store, and the reason it is a FILE.
//
// The toggle is pressed in the browser, but the browser cannot be where the answer lives: the hub's
// module surface is reachable by every agent in every room, so a gate held in React state or in
// localStorage is a gate an agent never has to pass. The hub reads this file on every attempt, and
// the file is the only thing it believes.
//
// SHAPE. One entry per terminal session, keyed by the tab's session id — the same id the window
// gives the host and the same id the machine's screen session is named for:
//
//   { "systemview-test-2": { agent: "buapi", by: "odion", at: 1789... } }
//
// One agent per terminal, deliberately. A terminal is a place with a state — a directory, an open
// SSH connection, a half-typed command — and two agents sharing one is the same problem as two
// owners of a project. Granting to a second agent replaces the first, out loud.
//
// ABSENCE IS DENIAL. A missing file, an unreadable file, a session with no entry: all mean no. The
// only thing that grants is an entry a human wrote by pressing the toggle.
const fs = require("fs");
const os = require("os");
const path = require("path");

const FILE = path.join(os.homedir(), ".autobot", "terminal-grants.json");

function read() {
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, "utf8"));
    return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  } catch {
    return {}; // never written, or unreadable — either way nobody is granted anything
  }
}

function write(all) {
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, `${JSON.stringify(all, null, 2)}\n`);
    return true;
  } catch {
    return false;
  }
}

// The whole map, for the surface that draws the toggles.
const grants = () => read();

// Grant, regrant or revoke. `agent` empty (or `on` false) revokes — one verb, because "who may type
// here" has one answer at a time and a separate revoke is a second way to say the same thing.
function setGrant({ session, agent, by, on = true } = {}) {
  const s = String(session || "").trim();
  if (!s) return { ok: false, error: "which terminal?" };
  const all = read();
  if (!on || !String(agent || "").trim()) {
    delete all[s];
    return write(all) ? { ok: true, session: s, agent: null } : { ok: false, error: "could not write the grant file" };
  }
  all[s] = { agent: String(agent).trim(), by: String(by || "").trim() || null, at: Date.now() };
  return write(all) ? { ok: true, session: s, agent: all[s].agent } : { ok: false, error: "could not write the grant file" };
}

// The question the typing verb asks. Returns the granted agent's name, or null.
function grantedAgent(session) {
  const g = read()[String(session || "").trim()];
  return (g && g.agent) || null;
}

module.exports = { grants, setGrant, grantedAgent, FILE };
