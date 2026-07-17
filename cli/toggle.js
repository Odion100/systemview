const log = require("./logger");
const { setCaseSensitive } = require("./utils/matchNamespace");

// Sticky, UI-persisted high-level flags you can flip from the CLI OR from interactive mode without
// leaving the session (`toggle cs`, `toggle ci`, or bare `cs`/`ci`). Persisted via the UI's CLI
// module (CLI.saveSettings), same store as history. Add rows to ALIASES to introduce more toggles.
//
//   name              → setting key      value (omit = flip current)
const ALIASES = {
  cs: { key: "caseSensitive", value: true },
  ci: { key: "caseSensitive", value: false },
  "case-sensitive": { key: "caseSensitive", value: true },
  "case-insensitive": { key: "caseSensitive", value: false },
  "case-sensitivity": { key: "caseSensitive" }, // no value → flip
};

const DESCRIBE = {
  caseSensitive: (v) =>
    `Namespace matching: ${v ? "case-SENSITIVE" : "case-insensitive"}  (sticks until changed)`,
};

// Mirror the persisted change into this process so the current command honors it immediately.
function applyLocal(key, value) {
  if (key === "caseSensitive") setCaseSensitive(value);
}

// `CLI` is the loaded UI "CLI" service module (getSettings/saveSettings). `name` e.g. "cs" | "ci".
// No name → just report the current state.
module.exports = async function toggle(CLI, name) {
  if (!CLI || !CLI.getSettings) {
    log.warn("SystemView UI not reachable — start it first to change settings.");
    return;
  }
  const settings = await CLI.getSettings();

  // Strip leading dashes so `cs`, `--cs`, and `-cs` all resolve to the same alias.
  const norm = name ? String(name).replace(/^-+/, "").toLowerCase() : "";

  let key, next;
  if (!norm) {
    // Bare `toggle` → FLIP the (single) case-sensitivity setting.
    key = "caseSensitive";
    next = !settings.caseSensitive;
  } else {
    const spec = ALIASES[norm];
    if (!spec) {
      log.warn(`Unknown toggle "${name}". Try: toggle (flip) | toggle cs | toggle ci`);
      return;
    }
    key = spec.key;
    next = "value" in spec ? spec.value : !settings[spec.key];
  }

  const saved = await CLI.saveSettings({ [key]: next });
  applyLocal(key, saved[key]);
  log.success(DESCRIBE[key](saved[key]));
};
