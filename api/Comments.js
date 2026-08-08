const fs = require("fs");

// Reply threads for SystemView's OWN surfaces — the help hub and the help topics.
//
// A thread on a DOCUMENT belongs to that document's repo, so those replies are a sidecar in the
// project's `.systemview/` folder, written through the project's plugin. But the hub and the help
// topics are part of the SystemView install, not of any project: routing their replies through
// "whatever plugin host answered first" scattered them across whichever repo happened to be
// connected (a hub comment written while buAPI was up was invisible the next time it wasn't).
// So they live here, beside CLI history and settings — same idea, same lifetime.
const FILE = `${__dirname}/comments.json`;

function read() {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    return {};
  }
}

function write(all) {
  fs.writeFile(FILE, JSON.stringify(all, null, 2), () => {});
}

module.exports = function Comments() {
  // { [key]: { [threadId]: [{ text, ts, author }] } }
  this.getComments = (key) => read()[key] || {};

  this.saveComments = (key, threads) => {
    const all = read();
    if (threads && Object.keys(threads).length) all[key] = threads;
    else delete all[key];
    write(all);
    return all[key] || {};
  };

  return this;
};
