// THE BOARD'S FILE FORMAT, AS THE PANEL READS IT — lifted out of the component for one reason:
// nothing could test it. It lived as three closures inside Board.js while `api/board.js` carried a
// second implementation of the same format, and the two could only be compared by eye.
//
// THEY ARE STILL TWO COPIES, AND THAT IS NOT AN ACCIDENT. The window cannot import from `api/`
// (CRA's module scope forbids reaching outside `src/`) and the hub cannot import from `src/`
// (package.json ships `api/*.js` and `build/` — `src/` is not in the published package at all), so
// one shared module would break one of the two. What replaces the shared module is a TEST:
// `boardFormat.test.js` round-trips the same fixtures through both implementations and fails the
// moment they disagree. A field this panel cannot parse is a field it DELETES on the next save —
// it holds the whole board in memory and rewrites the whole file — so drift here is not cosmetic.

// ON DISK IT IS STILL ONE MARKDOWN FILE — cards are separated by an HTML comment carrying the
// time. Invisible in any renderer, so the file reads like notes rather than like a database, and
// every block this app has still works inside a card.
// A card, and OPTIONALLY one answer from the agent under it — his ask: "you could make one
// response to a note". It lives in the same file, right under the note it answers, so reading the
// file is reading the conversation.
// RFC-039 — A NOTE HOLDS A CONVERSATION. One reply that got REPLACED on the next write meant
// nothing said back and forth survived ("I reply to you and then my reply goes on the note").
// Replies are a list now, each stamped with who wrote it. `<!--reply-->` with no author is the
// old single-reply form and still reads — as the agent's, which is the only thing it ever was.
// THE STATE IS THE FIRST WORD OF THE ACCOUNT. The point of the account is that the board can be
// MANAGED without re-reading it — scanned, grouped, followed up on, cleared — and a line of prose
// cannot be managed by anything. So the state leads the line (`implemented — reports are a band tab
// now`), the hub refuses an account without one, and this copy must read it identically or the
// panel's next save strips it. Mirrors api/board.js; boardFormat.test.js fails if they diverge.
// FIVE WORDS, ONE OF THEM DERIVED FROM AN ABSENCE. `open` is a card with no account at all —
// nobody has even read it. The other four are STAMPED by whoever did the thing:
//   reviewed  an agent read it and says so   → it is understood, not yet worked
//   partial   started, half of it is real
//   blocked   waiting on HIM — the only one that is a request
//   resolved  finished — he reads one line and deletes it
//
// `reviewed` was derived for about ten minutes (untitled + unsigned = unread) and his answer ended
// it: *"how can I derive that you actually reviewed it?"* A title proves somebody typed a title.
// Only a stamp proves somebody read the card. Mirrors api/board.js; boardFormat.test.js fails if
// the two ever disagree.
export const STATES = ["resolved", "reviewed", "partial", "blocked"];
export const DONE = ["resolved"];
export // A HYPHEN IS NOT A SEPARATOR HERE: `implemented-ish, sort of` is not the word `implemented`,
// and reading it as one would file a hedge as finished. A spaced ` - ` still splits on the space.
const stateOf = (text) => {
  const first = String(text || "").trim().split(/[\s—:]/)[0].toLowerCase();
  return STATES.includes(first) ? first : null;
};

export const parseBoard = (text) => {
  const out = [];
  String(text || "")
    // THE STAMP CARRIES FIELDS NOW, not just an author — `title` is one, and a field this copy
    // cannot parse is a field it DELETES on the next save, which is the whole reason this module
    // and api/board.js are pinned to each other by a test.
    .split(/<!--card (\d+)((?: [a-z]+=(?:"[^"]*"|[^\s>]+))*)-->/)
    .forEach((part, i, arr) => {
      if (i % 3 !== 1) return;
      const attrs0 = String(arr[i + 1] || "");
      const unquote = (v) => String(v || "").replace(/^"|"$/g, "");
      const by = unquote((attrs0.match(/\bby=("[^"]*"|[^\s]+)/) || [])[1] || "");
      const cardTitle = unquote((attrs0.match(/\btitle=("[^"]*"|[^\s]+)/) || [])[1] || "");
      // THE SPLIT REMEMBERS WHICH COMMENT IT CUT AT, so a status is never mistaken for a reply
      // and a reply is never mistaken for the account. Same regex as api/board.js — and
      // boardFormat.test.js is what keeps the two honest (this panel re-serializes the WHOLE
      // file, so any field it fails to parse is a field it silently deletes).
      const bits = String(arr[i + 2] || "").split(/<!--(reply|status)(?: ([^>]*?))?-->/);
      const replies = [];
      let status = null;
      for (let b = 1; b < bits.length; b += 3) {
        const kind = bits[b];
        const attrs = String(bits[b + 1] || "");
        const body = String(bits[b + 2] || "").trim();
        if (!body) continue;
        const at = {
          by: (attrs.match(/by=([^\s]+)/) || [])[1] || "",
          ts: Number((attrs.match(/ts=(\d+)/) || [])[1]) || 0,
          text: body,
          ...(kind === "status" ? { state: stateOf(body) } : {}),
        };
        if (kind === "status") status = at;
        else replies.push(at);
      }
      out.push({
        ts: Number(part),
        by,
        ...(cardTitle ? { title: cardTitle } : {}),
        text: bits[0].trim(),
        replies,
        ...(status ? { status } : {}),
      });
    });
  return out;
};
// The title rides at the top as a plain `# heading`, before the first card — so the file opens as
// a titled note anywhere else that reads markdown, and an untitled board has no heading at all
// rather than an empty one.
export const parseTitle = (text) => {
  const head = String(text || "").split(/<!--card /)[0];
  const m = head.match(/^\s*#\s+(.+)\s*$/m);
  return m ? m[1].trim() : "";
};
export const serializeBoard = (cards, title) =>
  `${title ? `# ${title}\n\n` : ""}${cards
    .map(
      (c) =>
        `<!--card ${c.ts}${c.by ? ` by=${c.by}` : ""}${c.title ? ` title="${String(c.title).replace(/"/g, "'")}"` : ""}-->\n${c.text}\n` +
        (c.status && c.status.text
          ? `<!--status${c.status.by ? ` by=${c.status.by}` : ""}${c.status.ts ? ` ts=${c.status.ts}` : ""}-->\n${c.status.text}\n`
          : "") +
        (c.replies || [])
          .map((r) => `<!--reply${r.by ? ` by=${r.by}` : ""}${r.ts ? ` ts=${r.ts}` : ""}-->\n${r.text}\n`)
          .join(""),
    )
    .join("\n")}`;
