// THE BOARD, AS A HUB CAPABILITY — his surface, addressed by project.
//
// The parse/serialize pair is the format and belongs to nobody; the rest was a terminal program
// hunting a live service through HTTP for a folder the hub has always known. Found live before that
// hunt was fixed: `board --add` burned three connection timeouts against dead registrations and then
// refused to leave a note on a repo whose root was sitting in the registry.
const ROOT = ".systemview/boards";
const boardPath = (name) => `${ROOT}/${name || "board"}.md`;

// The file is markdown: an optional `# title`, then cards separated by an invisible stamp comment.
// RFC-039 — A NOTE HOLDS A CONVERSATION. Replies used to be a single slot, so writing a second one
// erased the first; they are a list now, each stamped with who wrote it. `<!--reply-->` with no
// author is the old single form and still reads, as his.
function parseBoard(text) {
  const src = String(text || "");
  const head = src.split(/<!--card /)[0];
  const t = head.match(/^\s*#\s+(.+)\s*$/m);
  const cards = [];
  src.split(/<!--card (\d+)(?: by=([^\s>]+))?-->/).forEach((part, i, arr) => {
    if (i % 3 !== 1) return;
    const who0 = arr[i + 1] || "";
    const chunk = String(arr[i + 2] || "");
    const bits = chunk.split(/<!--reply(?: ([^>]*?))?-->/);
    const replies = [];
    for (let b = 1; b < bits.length; b += 2) {
      const attrs = String(bits[b] || "");
      const body = String(bits[b + 1] || "").trim();
      if (!body) continue;
      replies.push({
        by: (attrs.match(/by=([^\s]+)/) || [])[1] || "",
        ts: Number((attrs.match(/ts=(\d+)/) || [])[1]) || 0,
        text: body,
      });
    }
    cards.push({ ts: Number(part), by: who0, text: bits[0].trim(), replies });
  });
  return { title: t ? t[1].trim() : "", cards };
}

function serializeBoard({ title, cards }) {
  return `${title ? `# ${title}\n\n` : ""}${cards
    .map(
      (c) =>
        `<!--card ${c.ts}${c.by ? ` by=${c.by}` : ""}-->\n${c.text}\n` +
        (c.replies || [])
          .map((r) => `<!--reply${r.by ? ` by=${r.by}` : ""}${r.ts ? ` ts=${r.ts}` : ""}-->\n${r.text}\n`)
          .join("")
    )
    .join("\n")}`;
}

function boardOn({ readFile, writeFile }) {
  async function load(projectCode, name) {
    const res = await readFile(projectCode, { path: boardPath(name) });
    // No board yet is the normal case, not an error.
    return res && res.ok !== false ? parseBoard(res.content) : { title: "", cards: [] };
  }

  return async function board({ projectCode, name, add, reply, at, as } = {}) {
    if (!projectCode) return { error: "projectCode required" };
    // AN UNKNOWN PROJECT IS NOT AN EMPTY BOARD. Reading straight through answered `cards: []` for a
    // project the hub has never heard of — the same silent shrug as "no tests to run" standing in
    // for "nothing was ever asked". The file layer already knows the difference; ask it.
    const probe = await readFile(projectCode, { path: boardPath(name) });
    if (probe && probe.ok === false && /no folder for this project/i.test(probe.error || ""))
      return { error: `no connected project "${projectCode}"` };
    const board = await load(projectCode, name);
    const where = { project: projectCode, board: name || "board" };

    // WHO WROTE IT IS SAID BY THE WRITER. Any agent can write on any board, and nothing in this
    // path can tell who is calling — so a missing signature cannot default to anything. "agent"
    // meant nobody, and defaulting to the board's OWNER would stamp a visitor's answer as his.
    if (add != null || reply != null) {
      if (!as) return { ...where, error: "say who you are — every note and reply is signed by its writer" };
    }

    if (add != null) {
      const text = String(add).trim();
      if (!text) return { ...where, error: "a note needs something to say" };
      board.cards = [{ ts: Date.now(), by: as, text }, ...board.cards];
      const w = await writeFile(projectCode, { path: boardPath(name), content: serializeBoard(board) });
      if (!w || w.ok === false) return { ...where, error: (w && w.error) || "could not write the board" };
      return { ...where, ok: true, added: board.cards[0].ts, by: as };
    }

    if (reply != null) {
      // RFC-039 — ADDRESS BY ID, NOT BY POSITION. `at: 2` names a place in a list that reorders the
      // moment a note is added: read the board, he writes one, answer — and the reply lands on a
      // card nobody read. That happened. Cards carry a stable ts, and it is always returned.
      const want = String(at || "1");
      const byId = board.cards.find((c) => String(c.ts) === want);
      const card = byId || board.cards[Number(want) - 1];
      if (!card)
        return { ...where, error: `no note "${want}" — the board has ${board.cards.length}`, ids: board.cards.map((c) => c.ts) };
      card.replies = [...(card.replies || []), { by: as, ts: Date.now(), text: String(reply) }];
      const w = await writeFile(projectCode, { path: boardPath(name), content: serializeBoard(board) });
      if (!w || w.ok === false) return { ...where, error: (w && w.error) || "could not write the board" };
      return {
        ...where,
        ok: true,
        answered: card.ts,
        note: card.text.slice(0, 80),
        by: as,
        ...(!byId && board.cards.length > 1 ? { warning: `"${want}" was a POSITION — pass the id (${card.ts}) next time` } : {}),
      };
    }
    return { ...where, ...board };
  };
}

module.exports = { boardOn, parseBoard, serializeBoard, boardPath };
