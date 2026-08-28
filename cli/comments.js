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

// The line a reply addresses — the START of the range, which is what `--at` matches against.
// THE REAL FIELDS ARE `from`/`to`. I guessed `line`/`range` from the call sites and printed
// `--at 0` for a comment sitting on line 74 — the same not-reading-the-shape mistake that has cost
// four rounds today, made one more time on a file I could have opened in a second.
const firstLine = (t) => Number(t.from ?? t.line ?? (t.range && t.range[0]) ?? 0);
const lastLine = (t) => Number(t.to ?? t.endLine ?? (t.range && t.range[1]) ?? firstLine(t));

module.exports = async function commentsCommand(
  projectCode,
  filePath,
  { uiUrl, json, reply, at, as } = {},
) {
  if (!projectCode) {
    log.warn("Usage: systemview comments <projectCode> [path] [--json]");
    log.warn('       systemview comments <projectCode> <path> --reply "…" [--at <line>] [--as <who>]');
    return 1;
  }
  if (reply && !filePath) {
    log.error("a reply needs the file it belongs to: systemview comments <pc> <path> --reply \"…\"");
    return 1;
  }

  let services = [];
  let Hub = null;
  try {
    const { SystemView } = await Client.loadService(`${uiUrl}/systemview/api`);
    Hub = SystemView;
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

  // THE HUB SERVES THE FILES — no service hunting. This walked the project's live services looking
  // for one with a plugin that could read, so `comments` on a project whose services were down said
  // "no live service can read files" about a sidecar sitting on disk.
  const Plugin = {
    readFile: (args) => Hub.readFile(projectCode, args),
    writeFile: (args) => Hub.writeFile(projectCode, args),
    listFiles: (args) => Hub.listFiles(projectCode, args),
  };

  const readThreads = async (path) => {
    try {
      const res = await Plugin.readFile({ path: `${ROOT}/${path}.json` });
      const doc = JSON.parse(res.content || "{}");
      return Array.isArray(doc.threads) ? doc.threads : [];
    } catch {
      return [];
    }
  };

  // ── answering one ───────────────────────────────────────────────────────────────────────────
  // HIS COMMENTS WERE READABLE AND UNANSWERABLE. An agent could see a note on line 74 and had
  // nowhere to put the answer, so every reply went into the chat instead — detached from the code,
  // and the comment still reads as unanswered next session. The UI has always written back to this
  // sidecar; only the CLI had no door to it, which meant any agent not sitting in the browser could
  // read and not respond. His instruction: *"fix it so that agents can reply properly."*
  //
  // `--at <line>` picks the thread. With one comment on the file it is optional — there is nothing
  // to disambiguate — and a wrong line says which lines DO have comments rather than failing blind.
  if (reply) {
    const threads = await readThreads(filePath);
    if (!threads.length) {
      log.error(`no comments on ${filePath} to answer`);
      return 1;
    }
    const wanted = at != null ? Number(at) : null;
    const hit =
      wanted != null
        ? threads.find((t) => {
            const a = firstLine(t);
            const b = lastLine(t);
            return wanted >= Math.min(a, b) && wanted <= Math.max(a, b);
          })
        : threads.length === 1
        ? threads[0]
        : null;
    if (!hit) {
      log.error(
        wanted != null
          ? `no comment covering line ${wanted} — comments are on L${threads.map(rangeLabel).join(", L")}`
          : `${threads.length} comments on this file — say which with --at <line> (L${threads.map(rangeLabel).join(", L")})`,
      );
      return 1;
    }
    // Any agent can answer any comment and the CLI cannot tell who is running it — so the
    // signature is required, not defaulted (neither "agent" nor the file's own project).
    if (!as) {
      log.error(`comments --reply: say who you are — --as <yourProjectCode>.`);
      return 1;
    }
    hit.replies = [
      ...(hit.replies || []),
      { author: as, text: String(reply), ts: Date.now() },
    ];
    try {
      await Plugin.writeFile({
        path: `${ROOT}/${filePath}.json`,
        content: `${JSON.stringify({ threads }, null, 2)}\n`,
      });
    } catch (err) {
      log.error(`could not save the reply: ${(err && err.message) || err}`);
      return 1;
    }
    if (json) {
      console.log(JSON.stringify({ project: projectCode, path: filePath, line: rangeLabel(hit), thread: hit }, null, 2));
      return 0;
    }
    console.log(`  ✓ replied on ${chalk.cyan(filePath)} ${chalk.dim(`L${rangeLabel(hit)}`)}`);
    return 0;
  }

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
      // THE LINE IS THE ADDRESS, so it is printed as the address — the exact command that answers
      // THIS comment, with the number already in it. A verb you have to assemble from three places
      // in the help text is a verb nobody uses; the last thing you read should be the thing you run.
      const answered = (t.replies || []).some((r) => r.author && r.author !== "you");
      console.log(chalk.cyan(`\n  L${rangeLabel(t)}`) + (answered ? chalk.dim("  · answered") : chalk.yellow("  · unanswered")));
      (t.replies || []).forEach((r) => {
        const who = r.author && r.author !== "you" ? r.author : "him";
        console.log(`    ${chalk.dim(`${who} · ${when(r.ts)}`)}`);
        String(r.text || "")
          .split("\n")
          .forEach((line) => console.log(`    ${line}`));
      });
      console.log(
        chalk.dim(
          `    ↳ systemview comments ${projectCode} ${filePath} --at ${firstLine(t)} --reply "…"`,
        ),
      );
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
  console.log(chalk.dim(`\n  systemview comments ${projectCode} <path>                    read one file's comments`));
  console.log(chalk.dim(`  systemview comments ${projectCode} <path> --at <line> --reply "…"   answer one`));
  return 0;
};
