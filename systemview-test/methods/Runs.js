// THE RUN RECORDS AS A DOOR — what the harness wrote down about a procedure, and NO assertions.
//
// A skill's own list is the only evidence it was FOLLOWED rather than merely chosen: the `Skill`
// tool call proves the choice, and a procedure abandoned at step one leaves exactly the same trace
// as one driven to the end unless the list is on disk to look at. So this reads the real records
// out of the real worklists directory and hands back what they say.
//
// THE RULE, same as every door here: no comparison that answers the spec's question. This module
// may count items and read states — that is transcription. It may not decide whether there are
// enough runs, whether one closed, or whether a procedure was followed; the moment it does, the
// evidence stops being readable from the document that asked.
const fs = require("fs");
const os = require("os");
const path = require("path");

const DIR = path.join(os.homedir(), ".autobot", "worklists");

const read = (file) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(DIR, file), "utf8"));
  } catch {
    return null;
  }
};

module.exports = {
  // Every run record carrying one source, with how far each got and the item it stopped on.
  // `active` is the single most useful field on a dead run — where a procedure died is the record.
  async sourced({ source } = {}) {
    if (typeof source !== "string" || !source) {
      return { ok: false, error: "sourced needs a source string, e.g. skill:rfc-execution" };
    }
    let files = [];
    try {
      files = fs.readdirSync(DIR).filter((f) => f.startsWith("run-") && f.endsWith(".json"));
    } catch {
      return { ok: false, error: `no worklists directory at ${DIR}`, dir: DIR };
    }
    const runs = [];
    for (const f of files) {
      const r = read(f);
      if (!r || r.source !== source) continue;
      const items = Array.isArray(r.items) ? r.items : [];
      const active = items.find((i) => i.state === "active");
      runs.push({
        id: f.replace(/^run-|\.json$/g, ""),
        done: items.filter((i) => i.state === "done").length,
        total: items.length,
        diedAt: active ? active.text : "",
      });
    }
    return {
      ok: true,
      source,
      dir: DIR,
      count: runs.length,
      // Both forms on purpose: the ids are what a reader wants to see, the count is what a
      // numeric bound can be written against.
      closed: runs.filter((r) => r.total > 0 && r.done === r.total).map((r) => r.id),
      closedCount: runs.filter((r) => r.total > 0 && r.done === r.total).length,
      runs,
    };
  },
};
