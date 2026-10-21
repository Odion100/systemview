// RFC-071 — WHICH DOCUMENTS HAVE MEMBERS, as a question the hub can answer.
//
// WHY THIS IS A HUB CAPABILITY AND NOT A WINDOW SCAN: "what is buAPI on?" and "how many documents
// have updates nobody has sent?" are questions about a FOLDER, not about the document currently
// open. The window would have to read every markdown file in the project to answer either, over a
// door meant for one file at a time. The hub is already standing in the folder.
//
// The parse is deliberately the dumbest thing that can work — one regex over the head of the file —
// because this runs across every markdown file in a project and the expensive version of it is the
// reason nobody builds this feature.

// `::members{who=a|b sent=a:hash|b:hash}` — the same line the window writes.
//
// `[ \t]`, NOT `\s`, AT BOTH ENDS. Under /m, `\s*$` matches newlines too, so the match ran past
// the end of the line and swallowed the blank line after it — invisible while this regex was only
// ever READ from (`membersOf` takes the attributes and throws the rest away), and immediately
// destructive the moment anything rewrote the match in place: stamping the line deleted the blank
// line below it, which changed the document's body, which moved the hash the stamp had just been
// computed from. A document that re-dirties itself on being settled.
const LINE = /^[ \t]*::members\{([^}]*)\}[ \t]*$/m;

const attrOf = (attrs, key) => {
  const m = new RegExp(`\\b${key}=("[^"]*"|[^\\s}]*)`).exec(attrs || "");
  return m ? m[1].replace(/^"|"$/g, "") : "";
};

const listOf = (raw) =>
  String(raw || "")
    .split(/[|,]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s, i, arr) => arr.indexOf(s) === i);

// Mirrors src/atoms/Markdown/docMembers.js — the window decides dirtiness while he types, the hub
// decides it across a folder, and the two have to agree or the band's count argues with the chip.
// Pinned by api/documentMembers.test.js against the same fixtures.
// WHAT COUNTS AS THE DOCUMENT, for the purpose of "has this changed since you were told".
//
// MEMBERSHIP BOOKKEEPING IS NOT CONTENT. The `::members` line goes entirely — adding somebody, or
// recording that somebody was told, must not make everyone ELSE behind.
//
// A THREAD'S OPENING LINE CARRIES THE SAME BOOKKEEPING AND WAS BEING HASHED. Measured 2026-10-20:
// stamping `sent=` on a thread opener changed the document's hash, so telling ONE thread member
// made EVERY document member behind again — the act of telling somebody counted as a change to the
// document, every time, and a document with threads in use could never settle. The window learned
// this rule one level down, where a thread's own body deliberately excludes its opener; the
// document-level hash never got it.
//
// The opener is normalised to its ID rather than dropped, because the two cases are different: a
// NEW THREAD is a real change to the document and must dirty it, while `members=`/`sent=`/`auto=`
// moving on an existing one is not.
const bodyOf = (src) =>
  String(src || "")
    .split("\n")
    .filter((l) => !/^\s*::members\b/.test(l))
    .map((l) => l.replace(/^(\s*:{3,}\s*thread\{id=[^}\s]+)[^}]*\}\s*$/, "$1}"))
    .join("\n");

const hashOf = (src) => {
  const s = bodyOf(src);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
};

const sentOf = (raw) =>
  String(raw || "")
    .split(/[|,]/)
    .map((p) => p.trim())
    .filter(Boolean)
    .reduce((acc, p) => {
      const i = p.lastIndexOf(":");
      if (i > 0) acc[p.slice(0, i).trim()] = p.slice(i + 1).trim();
      return acc;
    }, {});

// EVERY THREAD THAT NAMES MEMBERS, with its own body.
//
// The window has `threadBlocksOf` for this and the hub cannot import it — different build, no
// shared module — so this is a second implementation and that is a cost worth naming. It is kept
// deliberately small and it copies the two rules that the window learned the hard way:
//
//   · A CONTAINER NESTS BY GAINING COLONS, so a thread wrapping a `::::columns` block opens with
//     five. Matching exactly four misses precisely the threads on well-built documents.
//   · THE ID IS THE FIRST ATTRIBUTE, NOT THE WHOLE BRACE. `id=([^}]+)` swallowed `members=` and
//     `sent=` the moment RFC-071 added them, which is what made every reply into a meeting's thread
//     impossible. Stop at whitespace.
const THREAD = /^(:{3,})\s*thread\{id=([^}\s]+)([^}]*)\}\s*$/;

function threadsOf(content) {
  const lines = String(content || "").split("\n");
  const out = [];
  for (let i = 0; i < lines.length; i += 1) {
    const open = THREAD.exec(lines[i]);
    if (!open) continue;
    const fence = open[1];
    const closer = new RegExp(`^:{${fence.length}}\\s*$`);
    const opener = new RegExp(`^:{${fence.length},}\\s*\\w`);
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
    const who = listOf(attrOf(open[3], "who") || attrOf(open[3], "members"));
    if (who.length)
      out.push({
        id: open[2],
        who,
        sent: sentOf(attrOf(open[3], "sent")),
        // THE OPENING LINE IS EXCLUDED, so telling somebody cannot re-dirty the thread: stamping
        // `sent=` rewrites that line, and hashing it would make the stamp its own change.
        body: lines.slice(i + 1, end).join("\n"),
      });
  }
  return out;
}

// Reads one document's membership — BOTH LEVELS.
//
// It used to read only the `::members` line, which meant the one verb that answers "what am I on?"
// was blind to the case the thread level exists to serve: somebody brought into a single
// conversation. They were on the document by its own text and invisible to the tool, and a document
// carrying thread members but no `::members` line was not listed at all. A verb that reports a
// subscription nobody can see is the same failure RFC-071 was written to end, one layer out — and
// it got sharper the day the delivery message started telling members *"you are on it because the
// document says so"* and sending them here to check.
//
// DOCUMENT MEMBERSHIP MEANS ALL THREADS (his rule, 2026-10-20). The document's hash is the whole
// source, so a member current on the document has been told about every thread in it by
// construction — they are behind on nothing, and they are not re-listed under each thread. A
// member BEHIND on the document still appears per thread, which keeps his older rule working:
// *"I might have you subscribed on multiple levels, but only want to send you the thread update."*
function membersOf(content) {
  const m = LINE.exec(String(content || ""));
  const threads = threadsOf(content);
  const who = m ? listOf(attrOf(m[1], "who")) : [];
  // NOT A DOCUMENT ONLY WHEN NEITHER LEVEL NAMES ANYBODY. A thread-only document is a document.
  if (!who.length && !threads.length) return null;
  const sent = m ? sentOf(attrOf(m[1], "sent")) : {};
  const now = hashOf(content);
  const behind = who.filter((p) => sent[p] !== now);
  const current = (p) => sent[p] === now;
  return {
    who,
    sent,
    // Behind = has not been told about THIS version. Never sent to counts as behind: they are on
    // the document and have heard nothing, which is the loudest case, not an exempt one.
    behind,
    // AUTO IS PER MEMBER (his correction): the attribute is a list of who is told automatically,
    // not a switch on the whole document.
    auto: m ? listOf(attrOf(m[1], "auto")) : [],
    threads: threads.map((t) => {
      const bodyHash = hashOf(t.body);
      return {
        id: t.id,
        who: t.who,
        // A document member current on the document is covered here too.
        behind: t.who.filter((p) => !current(p) && t.sent[p] !== bodyHash),
      };
    }),
    // EVERYONE AT ANY LEVEL, counted once — what "is this project on this document?" actually asks.
    everyone: [...new Set([...who, ...threads.flatMap((t) => t.who)])],
  };
}

function documentMembersOn({ listFiles, readFile }) {
  // `member` narrows to one project's documents ("what is buAPI on?"); without it, every document
  // that has any membership at all.
  return async function documents({ projectCode, member, root } = {}) {
    if (!projectCode) return { error: "projectCode required" };
    const listed = await listFiles(projectCode, { root, max: 4000 });
    if (!listed || listed.error) return { error: (listed && listed.error) || "could not list the project" };
    const paths = (Array.isArray(listed) ? listed : listed.files || [])
      .map((f) => (typeof f === "string" ? f : f && f.path))
      .filter((p) => typeof p === "string" && /\.md$/i.test(p));

    const docs = [];
    for (const path of paths) {
      let res;
      try {
        res = await readFile(projectCode, { path, root });
      } catch {
        continue; // a file that cannot be read is not a document with members; it is a file
      }
      if (!res || res.ok === false || typeof res.content !== "string") continue;
      // CHEAP FIRST. Most markdown has no members line; the regex only runs on files that contain
      // the string at all, which keeps a 4000-file project from being 4000 regex passes.
      // A THREAD OPENER CARRIES `members=`, NOT `::members`, so gating on the block's own spelling
      // skipped every document whose membership lived only on its threads — the cheap-first check
      // was quietly deciding the answer. `members` catches both and is just as cheap.
      if (!res.content.includes("members")) continue;
      const m = membersOf(res.content);
      if (!m) continue;
      if (member && !m.everyone.includes(member)) continue;
      docs.push({ path, who: m.who, behind: m.behind, auto: m.auto, threads: m.threads, everyone: m.everyone });
    }
    return {
      project: projectCode,
      ...(member ? { member } : {}),
      documents: docs,
      // The two numbers the band asks for, so it never has to re-walk this answer.
      withMembers: docs.length,
      // ANYBODY BEHIND, AT EITHER LEVEL. Counting only the document's own line reported "nothing
      // waiting" for a document whose thread had somebody waiting on it.
      withUpdates: docs.filter((d) => d.behind.length || d.threads.some((t) => t.behind.length)).length,
    };
  };
}

// WRITING IS BEING TOLD — AT BOTH LEVELS. `stampSent` in api/reports.js makes a reply's author
// current on the THREAD; this is the same sentence one line up, on the document's own `::members`.
//
// WITHOUT IT THE SURFACE INVENTS AN UPDATE OUT OF NOTHING. A reply changes the document, so every
// document member goes behind — including the person who just wrote it. In a document whose only
// member is the agent, nobody can ever clear that: he presses the pinned row and the send quotes
// the agent's own reply back at the agent. His words: *"in a document where I am the only member
// that is where your '1 update owed' keeps coming from."*
//
// THE ORDER IS THE SUBTLE PART AND IT IS WHY THIS TAKES A HASH. `bodyOf` strips `::members` lines,
// so stamping this line does NOT change the document's hash — but the THREAD opener is part of the
// body, so `stampSent` does. Hash after the thread stamp, never before, or the author is recorded
// against a version that stopped existing one line earlier.
//
// THREE REFUSALS, each because the alternative is a lie:
//   - no `::members` line  → there is no document membership to be current on
//   - the member is not on `who` → stamping would claim somebody heard a document they are not on,
//     and ADDING them would quietly put a replier onto a document nobody invited them to
//   - no member named     → there is nobody to stamp
function stampDocSent(docText, member, hash) {
  const who_ = String(member || "").trim();
  if (!who_) return { error: "stampDocSent needs the member being stamped" };
  const text = String(docText || "");
  const m = LINE.exec(text);
  if (!m) return { error: "this document has no ::members line" };
  const roster = listOf(attrOf(m[1], "who"));
  if (!roster.includes(who_))
    return { error: `"${who_}" is not a member of this document` };

  const stamp = hash === undefined || hash === null ? hashOf(text) : String(hash);
  // MERGE, NEVER REPLACE — another member's stamp is their state, not ours.
  const map = sentOf(attrOf(m[1], "sent"));
  map[who_] = stamp;
  const serialized = Object.entries(map)
    .map(([k, v]) => `${k}:${v}`)
    .join("|");

  const attrs = m[1];
  const found = /\bsent=("[^"]*"|[^\s}]*)/.exec(attrs);
  const attr = `sent=${serialized}`;
  const nextAttrs = found
    ? attrs.slice(0, found.index) + attr + attrs.slice(found.index + found[0].length)
    : `${attrs.trimEnd()} ${attr}`;
  const line = m[0];
  const indent = (line.match(/^\s*/) || [""])[0];
  return { content: text.replace(line, `${indent}::members{${nextAttrs}}`) };
}

module.exports = { documentMembersOn, membersOf, threadsOf, hashOf, bodyOf, listOf, stampDocSent };
