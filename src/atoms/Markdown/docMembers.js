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

// A THREAD'S OWN LIST, on the thread's opening line — the right-click door to the write the chip
// `+` makes. It lands on the THREAD's line and never the document's: those are two different
// subscriptions, and merging them is the bug this pair exists to make impossible.
//
// `docWho` IS THE DOCUMENT'S LIST, and passing it is how this door stops being destructive. Since
// 2026-10-20 a bare thread INHERITS those people (see `threadMembers`), so adding one member to a
// thread that names nobody has to write the inherited list PLUS the new name — write just the name
// and the thread narrows to one person, silently dropping everybody who was in the conversation a
// moment ago. Omit it and the old behaviour stands, which is correct for a document with no members
// and is what every caller before inheritance meant.
export const addThreadMemberPlan = (src, threadLine, code, docWho = []) => {
  const name = String(code || "").trim();
  if (!name || !threadLine) return null;
  const row = String(src).split("\n")[threadLine - 1] || "";
  if (!/^\s*:{3,}\s*thread\b/.test(row)) return null; // not a thread's opening line — refuse
  // RFC-073 §2.1 — the audience attribute is `subscribe=`; a legacy `members=` still answers (c21).
  const raw = /\bsubscribe=/.test(row)
    ? whoOnLine(row, "subscribe")
    : /\bmembers=/.test(row)
      ? whoOnLine(row, "members")
      : null;
  const { who: list } = threadMembers(raw, docWho);
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
// RFC-075 round two (his): "documents need a right-click menu to clear all threads." One pure
// sweep: every thread WRAPPER goes (the two fence lines) and every `:::reply` inside one goes
// WHOLE — a conversation is the wrapper plus what was said in it — while the content the thread
// wrapped stays exactly where it was. Fenced code is examples, not structure. Answers null when
// the document has no threads: a no-op is not a change.
// THE JAM DETECTOR (RFC-075 round two). normalizeFences refuses an unbalanced document — right,
// because guessing at repair could eat writing — but it used to refuse SILENTLY AND FOREVER: one
// orphan fence anywhere and every later save (a reply, a thread wrap) stopped self-nesting with
// nothing on screen saying so; his wraps came out as raw colons. This answers where the balance
// broke so a surface can SAY it. {ok:true} or {ok:false, line, why}.
export const fenceHealth = (src) => {
  const lines = String(src || "").split("\n");
  let inCode = false;
  const stack = [];
  for (let n = 0; n < lines.length; n += 1) {
    if (/^\s*(```|~~~)/.test(lines[n])) { inCode = !inCode; continue; }
    if (inCode) continue;
    if (/^\s*:{3,}\s*[a-zA-Z]/.test(lines[n])) stack.push(n + 1);
    else if (/^\s*:{3,}\s*$/.test(lines[n])) {
      if (!stack.length) return { ok: false, line: n + 1, why: "a closing fence with nothing open" };
      stack.pop();
    }
  }
  if (stack.length) return { ok: false, line: stack[stack.length - 1], why: "a container that never closes" };
  return { ok: true };
};

export const clearAllThreads = (src) => {
  const lines = String(src || "").split("\n");
  const drop = new Set();
  let inCode = false;
  const spanOf = (i, n) => {
    // the matching closer for a container opened at line i with n colons
    const opener = new RegExp(`^:{${n},}\\s*\\w`);
    const closer = new RegExp(`^:{${n}}\\s*$`);
    let depth = 1;
    for (let j = i + 1; j < lines.length; j += 1) {
      if (/^\s*(```|~~~)/.test(lines[j])) { let k = j + 1; while (k < lines.length && !/^\s*(```|~~~)/.test(lines[k])) k += 1; j = k; continue; }
      if (opener.test(lines[j])) depth += 1;
      else if (closer.test(lines[j])) { depth -= 1; if (!depth) return j; }
    }
    return -1;
  };
  for (let i = 0; i < lines.length; i += 1) {
    if (/^\s*(```|~~~)/.test(lines[i])) { inCode = !inCode; continue; }
    if (inCode) continue;
    const t = /^(:{3,})\s*thread\b/.exec(lines[i]);
    if (!t) continue;
    const end = spanOf(i, t[1].length);
    if (end < 0) continue; // unbalanced — leave it; guessing at repair could eat writing
    drop.add(i).add(end); // the wrapper's two fences
    for (let j = i + 1; j < end; j += 1) {
      const r = /^(:{3,})\s*reply\b/.exec(lines[j]);
      if (!r) continue;
      const rEnd = spanOf(j, r[1].length);
      if (rEnd < 0 || rEnd > end) continue;
      for (let k = j; k <= rEnd; k += 1) drop.add(k); // the reply, whole
      j = rEnd;
    }
  }
  if (!drop.size) return null;
  const kept = lines.filter((_, i) => !drop.has(i));
  // collapse the blank-line pairs the removals leave behind
  const out = [];
  for (const l of kept) {
    if (l === "" && out[out.length - 1] === "") continue;
    out.push(l);
  }
  return out.join("\n");
};

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
      who: whoOnLine(row, /\bsubscribe=/.test(row) ? "subscribe" : "members"),
      // THE SAME LIST, BUT PRESENCE-AWARE — the raw attribute when the opener carries one, `null`
      // when it carries none. `who` cannot answer that question: it is "" for a thread that says
      // nothing AND for one that says `subscribe=""`, and the whole inheritance rule below turns on
      // telling those two apart. RFC-073 §2.1 renamed the attribute — a thread's audience is a
      // SUBSCRIPTION, the word the whole mechanism uses — and an opener still saying `members=` is
      // read as `subscribe=` so nobody lost their audience to the rename (c21); the next write
      // rewrites it.
      members: /\bsubscribe=/.test(row)
        ? whoOnLine(row, "subscribe")
        : /\bmembers=/.test(row)
          ? whoOnLine(row, "members")
          : null,
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

// ── A BARE THREAD IS ABOUT THE DOCUMENT'S PEOPLE ──────────────────────────────────────────────
// His, 2026-10-20: *"I have to individually attach you to each thread, even though you're a member
// on the entire document… it should be more accommodating towards the way I actually use it."* A
// thread is a convenience for wrapping one part of a document to say something ABOUT it — not a
// membership ceremony — so the default has to be what he actually does: everybody on the document
// is in the conversation, and attaching them again is a chore nobody keeps up with.
//
// NARROWING IS THE OTHER HALF. A thread that DOES carry `members=` means exactly those people and
// inherits nothing — that is how he says "this argument is between the two of you", and it is also
// what makes removal expressible (see `threadMembersAttr`).
//
// THE DECISION IS PRESENCE, NOT EMPTINESS. No `members=` at all → the document's list. `members=`
// with anything in it → that list. `members=""` → present, and says nobody: DELIBERATELY EMPTY,
// which is the only way a thread can record that it was emptied on purpose. (Drop the attribute
// instead and the next render hands the document's people straight back — press ×, they reappear,
// and the control looks broken.)
//
// AN INHERITED MEMBER IS A MEMBER FOR EVERY PURPOSE: the thread's chip row draws them, a reply
// makes them behind on this thread, `auto=` can name them, and telling them stamps `sent=` on the
// thread's OWN opener. So a thread can carry `sent=buapi:1a2b` while naming nobody — a stamp for
// somebody the line does not list. That is not a contradiction: `members=` says who is on the
// thread and `sent=` says who has been told about this version of it, and only the first one is
// inherited.
//
// `raw` is the attribute AS WRITTEN — a string when the opener carries it (including ""), and
// null/undefined when it does not. `inherited` is not a kind of membership; it says only which
// LINE the list came from, which is the one thing the × has to know.
export const threadMembers = (raw, docWho = []) =>
  raw == null
    ? { who: splitWho(Array.isArray(docWho) ? docWho.join("|") : docWho), inherited: true }
    : { who: splitWho(raw), inherited: false };

// WHAT TO WRITE WHEN A THREAD'S LIST CHANGES — one decision, so the × and the + cannot disagree.
//
// Pressing × on an INHERITED chip cannot simply remove: there is nothing on that line to remove
// from. It MATERIALISES the narrowed list — everyone inherited, minus the one dropped, written onto
// the thread's own opener — after which the thread carries an explicit list and the narrowing rule
// above does the rest. His requirement, 2026-10-20: *"I still have the ability to delete them if I
// wanted to make it different."*
//
// AND EMPTYING MUST MEAN NOBODY, not inheriting again, so an emptied list is written as the empty
// string: present, and naming no one. The exception is a document with nobody on it — there is
// nothing to inherit, so the attribute is REMOVED and the line stays clean, which is the same write
// the right-click clear-all always made.
export const threadMembersAttr = (next = [], docWho = []) => {
  const list = splitWho(Array.isArray(next) ? next.join("|") : next);
  if (list.length) return list.join("|");
  return splitWho(Array.isArray(docWho) ? docWho.join("|") : docWho).length ? "" : null;
};

// WHO WROTE THE LAST REPLY — the field that decides whether a send is news to you or your own echo.
//
// Without it, `by` on a send is always the literal string "you" (docSend's default, overridden by
// nobody), so the harness cannot tell "autobot answered" from "you answered" and `deliverToMembers`
// had to guess with `!e.thread`: skip the owning project on document sends, never on thread ones.
// That guess is wrong in both directions — it wakes an agent with its own reply, and it is the only
// thing standing between hub-side auto and an unbounded A-replies-A-is-woken loop.
//
// Absent is "" rather than "you": a thread whose opening argument moved with no reply in it has no
// author to name, and claiming one would skip a member who should have been told.
export const lastReplyAuthorOf = (body) => {
  const opens = String(body || "").match(/^\s*:{3,}\s*reply\b[^\n]*$/gm) || [];
  if (!opens.length) return "";
  const m = /\bauthor=("[^"]*"|[^\s}]*)/.exec(opens[opens.length - 1]);
  return m ? m[1].replace(/^"|"$/g, "").trim() : "";
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

// A CREATION IS NOT A MOVE, and a member can only tell the difference by spending a turn finding
// out. Measured live 2026-10-20: the first send on this meeting's `bugs` thread produced
// `reply in thread bugs: ` — a dangling colon, because `lastReplyOf` returns "" when nothing has
// been said yet — and the member was summoned to read a thread that still held only its prompt.
// autobot wrote it up from the receiving end: *"a summons to an empty thread is the one case that
// rule exists to prevent."*
//
// The FIRST send on a thread is always this case, so it is the common one, not the edge. Both
// senders in the surface share this so the two controls can never word it differently.
export const threadSummary = (id, body) => {
  const last = lastReplyOf(body);
  return last ? `reply in thread ${id}: ${last}` : `added to thread ${id} — nothing said in it yet`;
};

// EVERYONE WHO IS BEHIND ON ANYTHING, counted once. His rhythm, 2026-10-20: *"I typically like to
// make multiple threads and then send you an update"* — the unit is the PERSON, not the row. A head
// that says "tell all 4 rows" is counting its own controls at him; "tell both of them" is counting
// the thing he actually means.
export const everyoneBehind = (pending = []) => [...new Set((pending || []).flatMap((p) => (p && p.behind) || []))];

// EVERY PENDING UPDATE IN THE DOCUMENT, both levels, in one list — which is exactly what the pinned
// row draws. The document first (it is the whole file), then the threads in the order they appear.
// DOCUMENT MEMBERSHIP MEANS ALL THREADS. His rule, 2026-10-20: *"even if you add it on the document
// level, that just means you add it to all threads."*
//
// THE FLOOD IT FIXES: this meeting had four rows and two members, so bringing one agent up to date
// cost FOUR separate wakes — four whole turns pushed into its session, each landing cold in the
// middle of unrelated work. Measured live the same day, from the receiving end.
//
// AND IT MUST NOT COST HIS OTHER RULE: *"I might have you subscribed on multiple levels, but only
// want to send you the thread update."* Those two only look like a contradiction. The document's
// hash is the WHOLE SOURCE — a reply in any thread already changes it — so a member stamped current
// on the DOCUMENT has, by construction, been told about the file as it stands, threads included.
// They are behind on nothing, and they appear on no row.
//
// A member who is BEHIND on the document still appears on the thread rows, which is exactly the
// case his older rule protects: he can tell them about one thread and leave them behind on the
// document. So one press on the document clears everything, a press on a thread stays surgical, and
// neither rule is traded for the other.
export const pendingOf = (block, threads = [], source = "", stamped = {}) => {
  const out = [];
  const behindOf = (who, sentRaw, body, line) => {
    const map = { ...parseSent(sentRaw), ...(stamped[line] || {}) };
    return dirtyMembers(who, map, body);
  };
  const onDocument = block && block.who ? splitWho(block.who) : [];
  if (onDocument.length) {
    const behind = behindOf(onDocument, block.sent, source, block.line);
    if (behind.length) out.push({ kind: "document", id: "", line: block.line, body: null, sent: block.sent || "", behind });
  }
  // Current on the document = told about the whole file, threads and all.
  const docMap = block ? { ...parseSent(block.sent), ...(stamped[block.line] || {}) } : {};
  const whole = hashOf(source);
  (threads || []).forEach((t) => {
    // AN INHERITED THREAD GETS A ROW TOO — his reversal, 2026-10-26: *"per-thread should still be
    // able to work."* The old rule ("inheritance never manufactures a row") existed against the
    // flood of four rows for one edit, and the flood protection that actually matters is kept just
    // below: anyone CURRENT ON THE DOCUMENT appears on no thread row, so one document press still
    // clears everything and a thread row only stands while somebody is genuinely behind on that
    // argument. What the reversal buys him: a surgical per-thread send on any thread, named
    // audience or inherited.
    //
    // `members` is the presence-aware attribute; a row from an older shape still answers through
    // its own list rather than silently telling nobody.
    const { who } = threadMembers(t.members !== undefined ? t.members : t.who || null, onDocument);
    if (!who.length) return;
    const own = who.filter((m) => docMap[m] !== whole);
    if (!own.length) return;
    const behind = behindOf(own, t.sent, t.body, t.line);
    if (behind.length) out.push({ kind: "thread", id: t.id, line: t.line, body: t.body, sent: t.sent || "", behind });
  });
  return out;
};
