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
// RFC-039 — A NOTE CAN HOLD A CONVERSATION. It used to hold exactly one reply, and writing a second
// one REPLACED the first, so nothing that was said back and forth survived. His words: "an agent can
// reply, I can reply" — so replies are a list, each stamped with who wrote it, in the order they
// were written. `<!--reply-->` (no author) is the old single-reply form and still reads, as his.
function parseBoard(text) {
  const src = String(text || "");
  const head = src.split(/<!--card /)[0];
  const t = head.match(/^\s*#\s+(.+)\s*$/m);
  const cards = [];
  src.split(/<!--card (\d+)-->/).forEach((part, i, arr) => {
    if (i % 2 !== 1) return;
    const chunk = String(arr[i + 1] || "");
    const bits = chunk.split(/<!--reply(?: ([^>]*?))?-->/);
    const note = bits[0];
    const replies = [];
    for (let b = 1; b < bits.length; b += 2) {
      const attrs = String(bits[b] || "");
      const body = String(bits[b + 1] || "").trim();
      if (!body) continue;
      const who = (attrs.match(/by=([^\s]+)/) || [])[1] || "";
      const ts = Number((attrs.match(/ts=(\d+)/) || [])[1]) || 0;
      replies.push({ by: who, ts, text: body });
    }
    cards.push({ ts: Number(part), text: note.trim(), replies });
  });
  return { title: t ? t[1].trim() : "", cards };
}

function serializeBoard({ title, cards }) {
  return `${title ? `# ${title}\n\n` : ""}${cards
    .map(
      (c) =>
        `<!--card ${c.ts}-->\n${c.text}\n` +
        (c.replies || [])
          .map((r) => `<!--reply${r.by ? ` by=${r.by}` : ""}${r.ts ? ` ts=${r.ts}` : ""}-->\n${r.text}\n`)
          .join(""),
    )
    .join("\n")}`;
}

module.exports = async function boardCommand(projectCode, name, { uiUrl, json, reply, at, as } = {}) {
  if (!projectCode) {
    log.warn('Usage: systemview board <projectCode> [name] [--json] [--reply "…" --at <id|n>] [--as <yourPc>]');
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

  // ANSWERING A NOTE, in the same file, so he sees it answered without a second room. Replies
  // ACCUMULATE now (RFC-039) — he replies, an agent replies, each stamped with who.
  if (reply != null) {
    // RFC-039 — ADDRESS BY ID, NOT BY POSITION. `--at 2` names a place in a list that reorders the
    // moment he adds a note: read the board, he writes one, answer — and the reply lands on a card
    // you never read. That happened. Cards carry a stable ts; `--at` now takes either, and the
    // listing prints the id so there is something stable to pass back.
    const want = String(at || "1");
    const byId = board.cards.find((c) => String(c.ts) === want);
    const card = byId || board.cards[Number(want) - 1];
    if (!card) {
      log.error(
        `no note "${want}" on ${projectCode}'s board — it has ${board.cards.length}.\n` +
          `   ids: ${board.cards.map((c) => c.ts).join(", ") || "(none)"}`,
      );
      return 1;
    }
    if (!byId && board.cards.length > 1)
      log.warn(`--at ${want} is a POSITION; pass the id (${card.ts}) when the board might have moved`);
    card.replies = [...(card.replies || []), { by: as || "agent", ts: Date.now(), text: String(reply) }];
    try {
      await Plugin.writeFile({ path: boardPath(name), content: serializeBoard(board) });
    } catch (err) {
      log.error(`could not write the board: ${err.message}`);
      return 1;
    }
    log.info(`answered note ${card.ts}: ${card.text.slice(0, 60)}${card.text.length > 60 ? "…" : ""}`);
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
    // The ID is printed, not just the position — it is what `--at` should be given back, and the
    // position is only safe until the next note lands.
    console.log(chalk.dim(`\n  ${i + 1}. ${when(c.ts)}   id ${c.ts}`));
    String(c.text)
      .split("\n")
      .forEach((line) => console.log(`  ${line}`));
    (c.replies || []).forEach((r) => {
      const who = r.by && r.by !== "agent" ? `${r.by}: ` : "";
      String(r.text)
        .split("\n")
        .forEach((line, n) => console.log(chalk.cyan(`    ↳ ${n === 0 ? who : ""}${line}`)));
    });
  });
  console.log(chalk.dim(`\n  systemview board ${projectCode} --reply "…" --at <id>   to answer one`));
  console.log("");
  return 0;
};
