// THE COLLECTOR'S RULES, kept out of the component because they are the whole feature and they
// were wrong for a long time in a way nobody could see by reading render code.
//
// WHAT WENT WRONG. The links panel was a lens over the ROOM's records (`chatHistory`) — the file
// behind `systemview say`. That was the only conversation this app had when the panel was written.
// It is not the conversation any more: attached, the panel renders `work.rows` (the live agent
// session) and the room is deliberately out of the panel entirely. So every link an agent put in
// the chat he was actually reading went into a surface the collector never looked at, and the
// collector went on listing links from a room he had stopped using — *"the links I see have
// nothing to do with the recent links that you just put in the chat."* Both sources are read here.
//
// AND ONE ROW PER LINK. It used to be one row per MESSAGE holding all of that message's chips, so
// the newest link was somewhere inside the top box rather than at the top, and a sentence carrying
// four references drew a box four chips wide. His rule: *"on the top is the latest link or anything
// you dropped."* One list, newest first, one thing per row.

// The reference/link grammar a chat bubble can carry. ONE copy — the renderer and the collector
// have to agree on what a link is, or the panel lists things the chat doesn't draw (and misses
// things it does).
// A PLAIN MARKDOWN LINK TO A FILE IS A FILE REFERENCE (his ask, 2026-10-05). The target used to have
// to start with `/` or `http`, so `[the picker](src/atoms/CodeView/colorPicker.js)` — the shape an
// agent writes when it is just writing markdown — matched NOTHING and rendered as literal text. He
// refused the alternative out loud: *"Should I correct them? No. Or should it work? ... those links
// and files, markdown should work."*
//
// IT MUST CARRY AN EXTENSION, and that is the whole guard. Accepting any target would swallow
// `[see](#chores)` and `[the team](mailto:...)` and every ordinary anchor; requiring `name.ext` means
// the pattern only fires on something that genuinely looks like a file. The cost is a file with no
// extension (`Makefile`, `LICENSE`) still needing `:file[...]`, which is the right trade: a missed
// chip is a visible plain link, a wrongly-claimed one is an anchor that stopped working.
//
// A LEADING `/` STAYS A ROUTE. `/specs/RFC-067` is this app's own URL and must keep pushing through
// the router — so only RELATIVE targets (and `~/`) are read as paths. Which side a target fell on is
// readable from the href itself, so there is no extra capture group: see `pathHref`.
const ROUTEISH = String.raw`\/[^)\s]+|https?:\/\/[^)\s]+`;
const FILEISH = String.raw`(?:~\/|\.{1,2}\/)?[\w.@+-]+(?:\/[\w.@+-]+)*\.[A-Za-z]\w{0,8}(?:#L\d+(?:-L?\d+)?|:\d+(?:-\d+)?)?`;
export const LINKISH = new RegExp(
  String.raw`:(report|file|ns|ui)\[([^\]]+)\](?:\{([^}]*)\})?` +
    String.raw`|\[([^\]]+)\]\((` + ROUTEISH + "|" + FILEISH + String.raw`)\)` +
    String.raw`|(https?:\/\/[^\s]+)`,
  "g",
);

/**
 * The href of a markdown link, IF it is a path rather than a route or a URL — null otherwise.
 * One rule, read by the renderer and the collector, so a target cannot be a file chip in the bubble
 * and a link row in the panel.
 */
export const pathHref = (href) => {
  const h = String(href || "");
  // A leading `/` is a route; anything with a SCHEME (`http:`, `mailto:`, `vscode:`) belongs to
  // whoever owns that scheme. Everything else written in a link is a path.
  return h && !/^(?:\/|[a-z][\w+.-]*:)/i.test(h) ? h : null;
};

// A bare URL wears its host, not its query string — same shortening the bubble does.
export const shortUrl = (href) => {
  const short = String(href).replace(/^https?:\/\//, "").replace(/\/$/, "");
  return short.length > 42 ? `${short.slice(0, 40)}…` : short;
};

// PURE, and the seam the test stands on: text in, openable things out, in the order they were
// written. `attrs` stays the RAW `{…}` source — parsing it needs the chat's own parser and this
// module owes nothing to React.
export function linkRefs(text) {
  const out = [];
  const s = String(text || "");
  LINKISH.lastIndex = 0;
  let m;
  while ((m = LINKISH.exec(s))) {
    if (m[1] !== undefined) out.push({ kind: m[1], label: m[2], attrs: m[3] || "" });
    else if (m[4] !== undefined) {
      // A FILE TARGET BECOMES A FILE REF, not a link row — identical to what `:file[...]` produces,
      // so the panel dedupes `[the picker](src/x.js)` against a `:file[src/x.js]` written elsewhere
      // instead of listing the same file twice under two kinds. The author's words are dropped on
      // purpose: a file row is identified by its path, which is also what the chip shows.
      const p = pathHref(m[5]);
      out.push(p ? { kind: "file", label: p, attrs: "" } : { kind: "link", label: m[4], href: m[5] });
    } else out.push({ kind: "link", label: shortUrl(m[6]), href: m[6] });
  }
  return out;
}

// WHAT MAKES TWO ROWS THE SAME THING. A file referenced in six messages is one file; listing it six
// times is how the top of the list stops being useful. The newest mention is the one that survives
// — the rule the show list has always had ("the newest push of a title IS that show"), applied to
// everything now that everything shares a list.
const idOf = (r) =>
  r.kind === "link" ? `link:${r.href}` : `${r.kind}:${r.label}:${r.attrs || ""}`;

const refRows = (text, ts, seq) =>
  linkRefs(text).map((r, i) => ({ ...r, type: "ref", id: idOf(r), ts: ts || 0, seq: seq * 1000 + i }));

/**
 * The one list. `records` are the room's chat records; `rows` are the live session's feed rows.
 * Newest first, one openable thing per entry, deduped by identity, optionally filtered.
 */
export const LINK_LIMIT = 30;

export function collectLinks({ records = [], rows = [], q = "", limit = LINK_LIMIT } = {}) {
  const needle = String(q || "").trim().toLowerCase();
  const out = [];
  let seq = 0;
  for (const m of records || []) {
    seq += 1;
    if (!m || m.hidden) continue; // taken off the list by hand, or superseded by a re-push
    // NO REPORT ROWS. A pushed report used to get an entry here; his call that it should not —
    // *"we don't need links to TV reports anymore"* — because the TV's own header already lists
    // every report and picking one there is fewer steps than finding it in a list of links. This
    // panel answers one question: where is the thing that was dropped in the conversation.
    if (m.kind === "command" || m.kind === "system") continue;
    out.push(...refRows(m.text, m.ts, seq));
  }
  for (const r of rows || []) {
    seq += 1;
    // Speech and his own turns — the two feed rows that carry a sentence a human wrote or read.
    // Tool rows, status notes and thinking are the machinery, not something dropped in the chat.
    if (!r || (r.kind !== "say" && r.kind !== "mine")) continue;
    out.push(...refRows(r.text, r.ts, seq));
  }
  // NEWEST FIRST, and within one message the order it was written — a sentence's own references
  // read left to right, they are all equally "the latest".
  out.sort((a, b) => (b.ts || 0) - (a.ts || 0) || a.seq - b.seq);
  const seen = new Set();
  const kept = out.filter((e) => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    if (!needle) return true;
    return `${e.label} ${e.href || ""}`.toLowerCase().includes(needle);
  });
  // A CAP, NOT A HISTORY. The list exists so the thing just dropped is one glance away; past a
  // screenful it is an archive nobody reads, and the chat itself is the archive. His call. The
  // number is a value to tune, not a mechanism — change LINK_LIMIT and nothing else moves.
  return limit > 0 ? kept.slice(0, limit) : kept;
}
