const fs = require("fs");

// Persisted CLI settings, stored on the UI server (same idea as CLIHistory) so preferences stick
// across CLI sessions. Currently: `caseSensitive` — whether namespace matching in test/logs/list/open
// respects case. Default false (case-insensitive).
const SETTINGS_FILE = `${__dirname}/cli-settings.json`;
const DEFAULTS = { caseSensitive: false };

function read() {
  try {
    return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8")) };
  } catch {
    return { ...DEFAULTS };
  }
}

function write(settings) {
  fs.writeFile(SETTINGS_FILE, JSON.stringify(settings), () => {});
}

module.exports = function Settings() {
  this.getSettings = () => read();

  this.saveSettings = (partial) => {
    const next = { ...read(), ...(partial || {}) };
    write(next);
    return next;
  };

  return this;
};
