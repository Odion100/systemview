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
  // WHAT THE HARNESS RECORDED ABOUT A HOOK FIRING — the other half of "a procedure ran": `sourced`
  // below says a run happened, this says what TRIGGERED one. A hook fires only for an agent that
  // CARRIES it, and ~/.autobot/hooks-fired.json keys each firing by `<agent>|<hook>`, so the
  // carrier is readable too — which matters for a hook whose whole design is that the role is
  // assignable rather than baked into an identity.
  //
  // Transcription only: a row exists or it does not, with its count and its carriers. Whether one
  // firing is enough, or whether it fired for the right agent, is the spec's question.
  async fired({ hook } = {}) {
    if (typeof hook !== "string" || !hook) {
      return { ok: false, error: "fired needs a hook name, e.g. work-audit-drain" };
    }
    const file = path.join(os.homedir(), ".autobot", "hooks-fired.json");
    let rec;
    try {
      rec = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (e) {
      return { ok: false, error: `could not read ${file}: ${String((e && e.message) || e)}` };
    }
    const rows = Object.entries(rec && typeof rec === "object" ? rec : {})
      .filter(([k, v]) => k.endsWith(`|${hook}`) || (v && v.hook === hook))
      .map(([k, v]) => ({ carrier: k.split("|")[0], n: Number((v && v.n) || 0), ts: Number((v && v.ts) || 0) }));
    return {
      ok: true,
      hook,
      fired: rows.length > 0,
      rowCount: rows.length,
      // Pipe-wrapped, the house exact-match discipline — |manager| cannot match |manager2|.
      carriers: "|" + rows.map((r) => r.carrier).sort().join("|") + "|",
      totalFirings: rows.reduce((a, r) => a + r.n, 0),
      rows,
    };
  },

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
      // WHAT IT ATTACHED, transcribed — kinds only, in order. A run's attachments are how it says
      // what it PRODUCED, and a procedure whose whole obligation is "record a result, never
      // silence" is checkable from this field and nowhere else in the record.
      const att = Array.isArray(r.attachments) ? r.attachments : [];
      runs.push({
        id: f.replace(/^run-|\.json$/g, ""),
        done: items.filter((i) => i.state === "done").length,
        total: items.length,
        diedAt: active ? active.text : "",
        // Pipe-wrapped, the house exact-match discipline: |report| cannot match |reportish|.
        attached: "|" + att.map((a) => String((a && a.kind) || "")).filter(Boolean).join("|") + "|",
        attachedCount: att.length,
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
      // COUNTING, never deciding: how many runs of this source carry an attachment whose kind is
      // `report`. Whether that is enough is the spec's question, asked in the document.
      withReport: runs.filter((r) => r.attached.includes("|report|")).length,
      // THE DURABLE FORM. A count grows every time this source runs again, so a spec asserting one
      // is red the second time — and the grammar has no greater-than. This is the UNION of every
      // kind any run of this source attached, pipe-wrapped, so "a drain of this source has recorded
      // an account" stays assertable however many drains follow.
      kinds:
        "|" +
        [...new Set(runs.flatMap((r) => r.attached.split("|").filter(Boolean)))].sort().join("|") +
        "|",
      // THE DURABLE RECORD. pruneRuns deletes closed run FILES after 14 days — a decided retention
      // (worklist.cjs, RFC-067 §4: "pruneRuns is not reopened") — so a count asserted on files alone
      // goes red the day the evidence ages out, with nothing wrong. The stamp is the record the
      // system keeps on purpose: .chore-stamps.json carries the last close per source, forever.
      everClosed: (() => {
        try {
          const stamps = JSON.parse(fs.readFileSync(path.join(DIR, ".chore-stamps.json"), "utf8"));
          const row = stamps[source];
          return !!(row && Object.keys(row).length);
        } catch {
          return false;
        }
      })(),
      runs,
    };
  },
};
