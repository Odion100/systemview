// RFC-071 — WHO IS DIRTY, AND WHAT A SEND SAYS. The decisions, pure, so they can be claimed
// without a document, a host bridge or a window.
//
// THE PROBLEM THIS SOLVES: a member was last told about this document at some point; has it
// changed since? There is no mtime to lean on (the panel holds the text, not the file's stat) and
// a timestamp would lie the moment anyone edits and undoes. So each member carries a short HASH of
// the document as it stood when they were last sent to, written into the same `::members` line —
// one store, versioned with the file, and self-evident in a diff.

// THE HASH IGNORES THE MEMBERS LINE ITSELF. Sending rewrites that line (it records the new hash),
// so hashing the whole document would make every send instantly dirty again — the feature would
// never report anything else. Everything else in the file counts, including thread replies, which
// is right: a reply IS the change a member should hear about.
// A MEMBER NAMES A ROOM — a project code — and the attribute is a list of them. Lives here rather
// than on the block because three things parse it now (the block, a thread's row, the pinned
// update row) and a second copy of this split is a second answer to "who is on this".
export const splitWho = (raw) =>
  String(raw || "")
    .split(/[|,]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s, i, arr) => arr.indexOf(s) === i);

export const bodyOf = (src) =>
  String(src || "")
    .split("\n")
    .filter((l) => !/^\s*::members\b/.test(l))
    .join("\n");

// A SMALL, STABLE, NON-CRYPTOGRAPHIC HASH (FNV-1a). It is a change DETECTOR, not a signature:
// nothing security-shaped rests on it, and the cost of a collision is one unsent update, so 32
// bits of it in base 36 is the right size for something that has to sit in a markdown attribute
// and still be readable.
export const hashOf = (src) => {
  const s = bodyOf(src);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
};

// `sent=buapi:1a2b3c|systemlynx:4d5e6f` — per member, because they were last told at different
// moments and a single stamp would mark everyone clean when one person was sent to.
export const parseSent = (raw) =>
  String(raw || "")
    .split(/[|,]/)
    .map((pair) => pair.trim())
    .filter(Boolean)
    .reduce((acc, pair) => {
      const i = pair.lastIndexOf(":");
      if (i > 0) acc[pair.slice(0, i).trim()] = pair.slice(i + 1).trim();
      return acc;
    }, {});

export const serializeSent = (map) =>
  Object.entries(map || {})
    .filter(([k, v]) => k && v)
    .map(([k, v]) => `${k}:${v}`)
    .join("|");

// DIRTY IS "CHANGED SINCE YOUR LAST SEND", and a member who has never been sent to is dirty by
// construction — they are on the document and have heard nothing about it, which is the loudest
// case, not an exempt one.
export const dirtyMembers = (who = [], sentMap = {}, src = "") => {
  const now = hashOf(src);
  return (who || []).filter((m) => sentMap[m] !== now);
};

// WHAT THE EVENT SAYS HAPPENED. Not a diff — the agent reads the file, which is always current and
// costs nothing to be accurate. This is the one line that tells it whether the change is worth a
// turn: how much moved, and whether the conversation moved with it.
export const summarize = (src = "", prevHashKnown = false) => {
  const threads = (String(src).match(/^\s*:{3,}\s*thread\b/gm) || []).length;
  const replies = (String(src).match(/^\s*:{3,}\s*reply\b/gm) || []).length;
  const lines = bodyOf(src).split("\n").length;
  return (
    `${lines} lines, ${threads} thread${threads === 1 ? "" : "s"}, ${replies} repl${replies === 1 ? "y" : "ies"}` +
    (prevHashKnown ? " — changed since you were last sent to" : " — you have not been sent to before")
  );
};

// ── ADDING A MEMBER, AS TWO PURE WRITES ───────────────────────────────────────────────────────
// These lived inside the right-click handler, where nothing could test them — and the first thing
// that happened was his: *"I'm trying to add somebody as a member of the document. They became a
// member of the fucking thread below."* A write that can land on the wrong line is exactly the
// kind of thing that has to be claimable, so it is out here now.

// `setDirectiveAttr` is 1-BASED (it does `line - 1`), and getting that wrong by one is how an
// attribute lands on the line after the one you meant — which, in a document whose members line is
// followed by a thread, is the bug he hit.
export const membersLineNo = (src) => {
  const i = String(src || "").split("\n").findIndex((l) => /^\s*::members\b/.test(l));
  return i < 0 ? 0 : i + 1; // 0 = there is no members line
};

// WHERE A NEW MEMBERS LINE GOES: after the title and its lead paragraph, before the first real
// heading. Membership is the document's, so it reads as part of its head — never wherever the
// right-click happened, which is what every other insert in that menu does.
export const membersInsertAfter = (src) => {
  const lines = String(src || "").split("\n");
  let put = 0;
  for (let i = 0; i < lines.length; i += 1) {
    if (/^#\s/.test(lines[i])) { put = i + 1; continue; }
    if (/^##\s/.test(lines[i])) break;
    if (put && lines[i].trim() === "") put = i + 1;
  }
  return put;
};

export const whoOnLine = (line, key = "who") => {
  const m = String(line || "").match(new RegExp(`\\b${key}=("[^"]*"|[^\\s}]*)`));
  return m ? m[1].replace(/^"|"$/g, "") : "";
};

// Returns `{ line, who }` for an existing members line, or `{ insertAfter, text }` for a document
// that has none. The caller does the writing; this decides WHERE and WHAT, which is the half that
// was wrong.
export const addMemberPlan = (src, code) => {
  const name = String(code || "").trim();
  if (!name) return null;
  const at = membersLineNo(src);
  if (at) {
    const cur = String(src).split("\n")[at - 1];
    const who = whoOnLine(cur);
    const list = who.split(/[|,]/).map((x) => x.trim()).filter(Boolean);
    if (list.includes(name)) return { line: at, who: list.join("|"), already: true };
    return { line: at, who: [...list, name].join("|") };
  }
  return { insertAfter: membersInsertAfter(src), text: `::members{who=${name}}` };
};

// A THREAD'S OWN LIST, on the thread's opening line. Never the document's: these are two different
// subscriptions, and merging them is the bug this pair exists to make impossible.
export const addThreadMemberPlan = (src, threadLine, code) => {
  const name = String(code || "").trim();
  if (!name || !threadLine) return null;
  const row = String(src).split("\n")[threadLine - 1] || "";
  if (!/^\s*:{3,}\s*thread\b/.test(row)) return null; // not a thread's opening line — refuse
  const list = whoOnLine(row, "members").split(/[|,]/).map((x) => x.trim()).filter(Boolean);
  if (list.includes(name)) return { line: threadLine, members: list.join("|"), already: true };
  return { line: threadLine, members: [...list, name].join("|") };
};

// THE DOCUMENT'S MEMBERS LINE, read once: where it is and what it says. The pinned update row has
// no block of its own to read attributes off — it is drawn at the top of the surface whatever the
// scroll position — so it needs the same three attributes and the same line number the `::members`
// block writes through. His, 2026-10-19: *"I shouldn't have to scroll back up to where I added
// them as a member to send them an update."*
//
// Returns null for a document with no members line at all, which is most of them.
export const membersBlockOf = (src) => {
  const lines = String(src || "").split("\n");
  const i = lines.findIndex((l) => /^\s*::members\b/.test(l));
  if (i < 0) return null;
  const row = lines[i];
  return {
    line: i + 1, // 1-based, because setDirectiveAttr is
    who: whoOnLine(row, "who"),
    sent: whoOnLine(row, "sent"),
    auto: whoOnLine(row, "auto"),
  };
};

// ── THREADS AS THEIR OWN SUBSCRIPTIONS ────────────────────────────────────────────────────────
// His, 2026-10-19: *"I hope updates that are thread level also go up there as well… it's supposed
// to be for both."* A thread is a conversation with its own people, so it has its own version to
// be behind on — hashed over the thread's OWN body, not the document's. Reply in t1 and only t1's
// members are behind; the document's send is untouched.
//
// The fence has to be matched by DEPTH, not by the next line of colons: a `:::thread` holds
// `:::reply` blocks that close with the same three colons, so the first closer is the reply's.
export const threadBlocksOf = (src) => {
  const lines = String(src || "").split("\n");
  const out = [];
  for (let i = 0; i < lines.length; i += 1) {
    const open = /^(:{3,})\s*thread\b/.exec(lines[i]);
    if (!open) continue;
    const n = open[1].length;
    const opener = new RegExp(`^:{${n},}\\s*\\w`);
    const closer = new RegExp(`^:{${n}}\\s*$`);
    let depth = 1;
    let end = lines.length;
    for (let j = i + 1; j < lines.length; j += 1) {
      if (opener.test(lines[j])) depth += 1;
      else if (closer.test(lines[j])) {
        depth -= 1;
        if (!depth) {
          end = j;
          break;
        }
      }
    }
    const row = lines[i];
    out.push({
      line: i + 1, // 1-based, the line setDirectiveAttr writes to
      id: whoOnLine(row, "id") || `line-${i + 1}`,
      who: whoOnLine(row, "members"),
      sent: whoOnLine(row, "sent"),
      auto: whoOnLine(row, "auto"),
      // The body EXCLUDES the opening line, which is where `sent=` is stamped — so telling someone
      // cannot itself make the thread dirty again. Same reason the document's hash skips its
      // `::members` line.
      body: lines.slice(i + 1, end).join("\n"),
    });
  }
  return out;
};

// WHAT A THREAD MEMBER IS BEING TOLD. The reply IS the news — a thread member is in the
// conversation, so the words are the point, not a count of them.
export const lastReplyOf = (body) => {
  const parts = String(body || "").split(/^\s*:{3,}\s*reply\b[^\n]*\n/m);
  const last = parts.length > 1 ? parts[parts.length - 1] : "";
  return last
    .split(/^\s*:{3,}\s*$/m)[0]
    .trim()
    .slice(0, 200);
};

// EVERY PENDING UPDATE IN THE DOCUMENT, both levels, in one list — which is exactly what the pinned
// row draws. The document first (it is the whole file), then the threads in the order they appear.
export const pendingOf = (block, threads = [], source = "", stamped = {}) => {
  const out = [];
  const behindOf = (who, sentRaw, body, line) => {
    const map = { ...parseSent(sentRaw), ...(stamped[line] || {}) };
    return dirtyMembers(splitWho(who), map, body);
  };
  if (block && block.who) {
    const behind = behindOf(block.who, block.sent, source, block.line);
    if (behind.length) out.push({ kind: "document", id: "", line: block.line, body: null, sent: block.sent || "", behind });
  }
  (threads || []).forEach((t) => {
    if (!t.who) return;
    const behind = behindOf(t.who, t.sent, t.body, t.line);
    if (behind.length) out.push({ kind: "thread", id: t.id, line: t.line, body: t.body, sent: t.sent || "", behind });
  });
  return out;
};
