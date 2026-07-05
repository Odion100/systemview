const fs = require("fs");

const HISTORY_FILE = `${__dirname}/cli-history.json`;
const LIMIT = 50;

function read() {
  try { return JSON.parse(fs.readFileSync(HISTORY_FILE, "utf8")); }
  catch { return []; }
}

function write(history) {
  fs.writeFile(HISTORY_FILE, JSON.stringify(history), () => {});
}

module.exports = function CLIHistory() {
  this.getHistory = () => read();

  this.saveHistory = (entry) => {
    if (!entry || !entry.trim()) return;
    let history = read();
    history = history.filter((h) => h !== entry);
    history.push(entry);
    if (history.length > LIMIT) history = history.slice(-LIMIT);
    write(history);
    return true;
  };

  return this;
};
