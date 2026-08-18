const chalk = require("chalk");
const log = require("./logger");
const { createClient } = require("systemlynx");
const { createCookieHttpClient } = require("./cookieClient");
const Client = createClient(createCookieHttpClient());

// `systemview board <projectCode> [--json]` — HIS BOARD, read by a verb.
//
// The board is where he accumulates thoughts between sessions: notes to himself, things to hand an
// agent later, a running list of what's wrong with something while he looks at it. It is his surface
// — nobody watches it — but when he says "go look at my board", that sentence needs an answer that
// doesn't depend on anyone remembering a folder path.
//
//   systemview board buAPI            the title, and every note with when it landed
//   systemview board buAPI --json     the same, structured
//
// Reads through the project's own plugin, the same path the UI writes with.

const ROOT = ".systemview/boards";
const boardPath = (name) => `${ROOT}/${name || "board"}.md`;

const when = (ts) => {
  const d = new Date(Number(ts) || 0);
  return isNaN(d.getTime()) || !ts
    ? ""
    : d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

// The file is markdown: an optional `# title`, then cards separated by an invisible stamp comment.
// A card may carry ONE reply from an agent, under the note it answers.
function parseBoard(text) {
  const src = String(text || "");
  const head = src.split(/<!--card /)[0];
  const t = head.match(/^\s*#\s+(.+)\s*$/m);
  const cards = [];
  src.split(/<!--card (\d+)-->/).forEach((part, i, arr) => {
    if (i % 2 !== 1) return;
    const [note, ...rest] = String(arr[i + 1] || "").split(/<!--reply-->/);
    cards.push({ ts: Number(part), text: note.trim(), reply: rest.join("").trim() || "" });
  });
  return { title: t ? t[1].trim() : "", cards };
}

function serializeBoard({ title, cards }) {
  return `${title ? `# ${title}\n\n` : ""}${cards
    .map((c) => `<!--card ${c.ts}-->\n${c.text}\n${c.reply ? `<!--reply-->\n${c.reply}\n` : ""}`)
    .join("\n")}`;
}

module.exports = async function boardCommand(projectCode, name, { uiUrl, json, reply, at } = {}) {
  if (!projectCode) {
    log.warn("Usage: systemview board <projectCode> [name] [--json]");
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

  let board = { title: "", cards: [] };
  try {
    const res = await Plugin.readFile({ path: boardPath(name) });
    board = parseBoard(res.content);
  } catch {
    // No board yet is the normal case, not an error.
  }

  // ANSWERING ONE NOTE. His ask: one optional response per note, in the same file, so he can see it
  // answered without a second room. It replaces whatever reply was there — one answer, not a thread.
  if (reply != null) {
    const n = Number(at || 1);
    const card = board.cards[n - 1];
    if (!card) {
      log.error(`no note ${n} on ${projectCode}'s board — it has ${board.cards.length}`);
      return 1;
    }
    card.reply = String(reply);
    try {
      await Plugin.writeFile({ path: boardPath(name), content: serializeBoard(board) });
    } catch (err) {
      log.error(`could not write the board: ${err.message}`);
      return 1;
    }
    log.info(`answered note ${n}: ${card.text.slice(0, 60)}${card.text.length > 60 ? "…" : ""}`);
    return 0;
  }

  if (json) {
    console.log(JSON.stringify({ project: projectCode, board: name || "board", ...board }, null, 2));
    return 0;
  }
  if (!board.cards.length && !board.title) {
    log.info(`nothing on ${projectCode}'s board`);
    return 0;
  }
  console.log(chalk.bold(board.title || `${projectCode} — board`));
  board.cards.forEach((c, i) => {
    console.log(chalk.dim(`\n  ${i + 1}. ${when(c.ts)}`));
    String(c.text)
      .split("\n")
      .forEach((line) => console.log(`  ${line}`));
    if (c.reply)
      String(c.reply)
        .split("\n")
        .forEach((line) => console.log(chalk.cyan(`    ↳ ${line}`)));
  });
  console.log(chalk.dim(`\n  systemview board ${projectCode} --reply "…" --at <n>   to answer one`));
  console.log("");
  return 0;
};
