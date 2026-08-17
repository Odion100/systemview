const chalk = require("chalk");
const log = require("./logger");
const { createClient } = require("systemlynx");
const { createCookieHttpClient } = require("./cookieClient");
const Client = createClient(createCookieHttpClient());

// RFC-034 — `systemview comments <projectCode> [path] [--json]`.
//
// His code comments, reachable by a VERB instead of a fact someone has to remember. Telling agents
// "they live in .systemview/code-comments/<the file's path>.json" makes the folder something they
// recall from a broadcast; a command makes it something they can call — and when he says "I left you
// comments", that sentence now has an answer that does not depend on anyone's memory.
//
//   systemview comments buAPI                       every file that has comments, with counts
//   systemview comments buAPI Basketball/index.js   that file's comments, with line ranges
//
// Reads through the project's own plugin (readFile/listFiles), the same path the UI uses — nothing
// here knows where the folder is except this one constant.

const ROOT = ".systemview/code-comments";
const EMPTY_SIDECAR = 40; // `{"threads":[]}` is 20 bytes; a real comment is far bigger

const when = (ts) => {
  const d = new Date(ts || 0);
  return isNaN(d.getTime()) ? "" : d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};
const rangeLabel = (t) => (t.from === t.to ? `${t.from}` : `${t.from}-${t.to}`);

module.exports = async function commentsCommand(projectCode, filePath, { uiUrl, json } = {}) {
  if (!projectCode) {
    log.warn("Usage: systemview comments <projectCode> [path] [--json]");
    return 1;
  }

  let services = [];
  try {
    const { SystemView } = await Client.loadService(`${uiUrl}/systemview/api`);
    const projects = await SystemView.getProjects();
    if (!projects[projectCode]) {
      log.error(`no connected project "${projectCode}" — projects: ${Object.keys(projects).join(", ") || "(none)"}`);
      return 1;
    }
    services = projects[projectCode];
  } catch (err) {
    log.error("Failed to connect to SystemView: " + err.message);
    return 1;
  }

  // Any live service of the project can read its files — siblings share a working directory.
  let Plugin = null;
  for (const s of services) {
    try {
      const svc = await Client.loadService(s.connectionData.serviceUrl);
      if (svc.Plugin && svc.Plugin.readFile) {
        Plugin = svc.Plugin;
        break;
      }
    } catch {} // down or plugin-less — try the next one
  }
  if (!Plugin) {
    log.error(`no live service in ${projectCode} can read files`);
    return 1;
  }

  const readThreads = async (path) => {
    try {
      const res = await Plugin.readFile({ path: `${ROOT}/${path}.json` });
      const doc = JSON.parse(res.content || "{}");
      return Array.isArray(doc.threads) ? doc.threads : [];
    } catch {
      return [];
    }
  };

  // ── one file ────────────────────────────────────────────────────────────────────────────────
  if (filePath) {
    const threads = await readThreads(filePath);
    if (json) {
      console.log(JSON.stringify({ project: projectCode, path: filePath, threads }, null, 2));
      return 0;
    }
    if (!threads.length) {
      log.info(`no comments on ${filePath}`);
      return 0;
    }
    console.log(chalk.bold(`${filePath} — ${threads.length} comment${threads.length === 1 ? "" : "s"}`));
    threads.forEach((t) => {
      console.log(chalk.cyan(`\n  L${rangeLabel(t)}`));
      (t.replies || []).forEach((r) => {
        const who = r.author && r.author !== "you" ? r.author : "him";
        console.log(`    ${chalk.dim(`${who} · ${when(r.ts)}`)}`);
        String(r.text || "")
          .split("\n")
          .forEach((line) => console.log(`    ${line}`));
      });
    });
    return 0;
  }

  // ── the whole project ───────────────────────────────────────────────────────────────────────
  let files = [];
  try {
    const res = await Plugin.listFiles({ dir: ROOT });
    files = (res.files || [])
      // An emptied sidecar is not a comment. Size comes from the plugin (2.20.0+); without it we
      // can't tell from the listing alone, so the read below settles it.
      .filter((f) => typeof f.size !== "number" || f.size >= EMPTY_SIDECAR)
      .map((f) => f.path.slice(ROOT.length + 1).replace(/\.json$/, ""));
  } catch {
    files = []; // no folder yet is the normal case, not an error
  }

  const out = [];
  for (const p of files) {
    const threads = await readThreads(p);
    if (threads.length) out.push({ path: p, threads });
  }

  if (json) {
    console.log(JSON.stringify({ project: projectCode, files: out }, null, 2));
    return 0;
  }
  if (!out.length) {
    log.info(`no code comments in ${projectCode}`);
    return 0;
  }
  console.log(chalk.bold(`${projectCode} — ${out.length} file${out.length === 1 ? "" : "s"} with comments`));
  out.forEach(({ path, threads }) => {
    const lines = threads.map(rangeLabel).join(", ");
    console.log(`  ${chalk.cyan(path)} ${chalk.dim(`— ${threads.length} on L${lines}`)}`);
  });
  console.log(chalk.dim(`\n  systemview comments ${projectCode} <path>   to read one`));
  return 0;
};
