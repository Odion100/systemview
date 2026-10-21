// REPORTS, AS THE HUB'S OWN FILE LAYER — what `show`, `tv` and `reply` are actually made of.
//
// RFC-040: a report is a DOCUMENT, and the chat record is a pointer to it. The writing lived in
// `cli/chat.js`, which reached the project's folder the long way round: load the hub over HTTP, ask
// it for the project root, call back through a plugin shim. Inside the hub all three hops are one
// function call — it holds the roots and it is the thing being dialled.
//
// `readFile`/`writeFile` are INJECTED rather than imported, because they live in api/index.js
// alongside the path-escape guard (`inside()`), and a second copy of a containment check is how one
// of them quietly stops matching the other.
//
// `hashOf` is IMPORTED and never re-implemented. The window writes `sent=<member>:<hash>` with its
// own hash (src/atoms/Markdown/docMembers.js); api/documentMembers.js already mirrors it and is
// pinned against the same fixtures. A second hash in here would agree right up until one of them
// changed, and the symptom would be a stamp that reads like a record of who was told while telling
// nobody anything.
const { hashOf } = require("./documentMembers");

const slug = (v) => String(v || "").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
const reportPath = (pc, name) => `.systemview/report.${slug(pc)}.${slug(name)}.md`;
const REPORT_INDEX = ".systemview/reports.index.json";

// The label a report is known by: its first heading, else the file name, else the opening words.
function labelFor(content, file) {
  const heading = (String(content).match(/^#{1,6}\s+(.+)$/m) || [])[1];
  return heading || (file ? String(file).split("/").pop() : String(content).trim().slice(0, 48));
}


// A CONTAINER NESTS BY GAINING COLONS: a thread wrapping a `::::columns` block is opened with FIVE,
// and matching exactly four missed precisely the threads on well-built reports, where the content
// worth discussing is code beside its explanation. The close must be the SAME fence, or the reply
// splices into the middle of the inner block.
//
// THE ID IS THE FIRST ATTRIBUTE, NOT THE WHOLE BRACE. This matched `id=([^}]+)` and compared the
// capture to the id, which was correct for exactly as long as `id` was the only attribute a
// thread carried. RFC-071 gave threads `members=`, `sent=` and `auto=`, so the capture became
// `bugs members=systemview-test|autobot sent=...` and no id could ever match — every reply into a
// thread with members was refused, with a teaching error that then listed those same swollen
// strings as the ids that exist. Nothing caught it because the test data had no instance of the
// new shape: every thread in `.systemview/` is a bare `::::thread{id=x}`, and only a MEETING
// carries members. Stop at whitespace or the brace, and let whatever else the opener carries ride.
const THREAD_OPEN = /^(:{4,})thread\{id=([^}\s]+)[^}]*\}\s*$/;

// WHERE ONE THREAD STARTS AND ENDS, in one place — `replyInto` splices at the close and `stampSent`
// rewrites the open, and two searches for one thread is two answers to where it is. `close` is -1
// for a thread that is never closed; the callers say so differently and neither may guess.
function threadAt(lines, threadId) {
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].trim().match(THREAD_OPEN);
    if (!m || m[2] !== threadId) continue;
    const fence = m[1];
    let close = -1;
    for (let j = i + 1; j < lines.length; j++)
      if (lines[j].trim() === fence) {
        close = j;
        break;
      }
    return { open: i, close, fence };
  }
  return null;
}

// THE BODY A THREAD IS HASHED ON, SLICED EXACTLY AS THE WINDOW SLICES IT. `threadBlocksOf` in
// src/atoms/Markdown/docMembers.js does `lines.slice(i + 1, end)` and says why: the opening line is
// where `sent=` is stamped, so hashing it would make the stamp its own change and a thread would be
// dirty again the instant anyone was told about it. The hub must exclude it the same way or the two
// stamps are different strings for the same version.
//
// `null` for a thread that is absent or unclosed — there is no body to speak of either way.
function threadBodyOf(docText, threadId) {
  const lines = String(docText).split("\n");
  const at = threadAt(lines, threadId);
  if (!at || at.close === -1) return null;
  return lines.slice(at.open + 1, at.close).join("\n");
}

// `sent=a:1jqt6sb|b:4d5e6f` — per member, because they were last told at different moments. Parsed
// on the LAST colon: the hash never holds one and a member's name conceivably could.
const sentMapOf = (raw) =>
  String(raw || "")
    .split(/[|,]/)
    .map((p) => p.trim())
    .filter(Boolean)
    .reduce((acc, p) => {
      const i = p.lastIndexOf(":");
      if (i > 0) acc[p.slice(0, i).trim()] = p.slice(i + 1).trim();
      return acc;
    }, {});

// AN ATTRIBUTE VALUE WITH A SPACE IN IT KILLS THE DIRECTIVE SILENTLY — the block stops rendering
// and nothing says why. A serialized map never holds one, but it is one character to be sure.
const sentAttrOf = (map) => {
  const v = Object.entries(map || {})
    .filter(([k, h]) => k && h)
    .map(([k, h]) => `${k}:${h}`)
    .join("|");
  return /\s/.test(v) ? `"${v}"` : v;
};

// ── WRITING IS BEING TOLD ─────────────────────────────────────────────────────────────────────
// His, 2026-10-20: *"if there's only me and you in the document, there's no one to update."* A
// reply left its own AUTHOR behind on the thread they had just written. In a document whose only
// member is the agent writing it, the surface showed "1 update owed" permanently and the only
// person who could clear it was him — pressing a button to tell an agent about words that agent
// wrote. He pressed it, and because a thread's summary is its LAST reply, the send quoted the
// agent's own reply back at the agent. Stamping the author at write time kills the whole class at
// the source: nobody is owed an update about their own writing.
//
// MERGE, NEVER REPLACE. `sent=` is the record of who has heard WHICH version; another member's
// stamp is their state, not ours, and clobbering it would tell the document somebody was told who
// was not. Only the one author's entry moves — written in place when it is already there, so a
// second reply re-stamps instead of duplicating.
//
// `hash` is normally the thread's new body hash (the default below). It stays a parameter because
// the hash and the stamp are two decisions, and a caller holding a hash already must not re-derive
// it.
function stampSent(docText, threadId, member, hash) {
  const who = String(member || "").trim();
  if (!who) return { error: "stampSent needs the member being stamped" };
  const lines = String(docText).split("\n");
  const at = threadAt(lines, threadId);
  if (!at) return { error: `no thread "${threadId}" in this document` };
  const body = at.close === -1 ? null : lines.slice(at.open + 1, at.close).join("\n");
  if (hash === undefined || hash === null) {
    if (body === null) return { error: `thread "${threadId}" is never closed — there is no version to stamp` };
    hash = hashOf(body);
  }
  const row = lines[at.open];
  const indent = (row.match(/^\s*/) || [""])[0];
  const trimmed = row.trim();
  const attrs = trimmed.slice(trimmed.indexOf("{") + 1, trimmed.lastIndexOf("}"));
  const found = /\bsent=("[^"]*"|[^\s}]*)/.exec(attrs);
  const map = sentMapOf(found ? found[1].replace(/^"|"$/g, "") : "");
  map[who] = String(hash);
  const attr = `sent=${sentAttrOf(map)}`;
  // NEVER ADD `members=` AS A SIDE EFFECT. A thread carrying no list INHERITS the document's
  // people, and writing a list while stamping would narrow the conversation to whoever happened to
  // reply — everybody else silently dropped out of a thread they were in a moment ago. A bare
  // thread gets a stamp and stays bare: `sent=` says who has been told, `members=` says who is on
  // it, and only the second one is inherited.
  const next = found
    ? attrs.slice(0, found.index) + attr + attrs.slice(found.index + found[0].length)
    : `${attrs.trimEnd()} ${attr}`;
  lines[at.open] = `${indent}${at.fence}thread{${next}}`;
  return { content: lines.join("\n") };
}

// ANSWERING IN A THREAD, PURELY — document text in, document text out.
function replyInto(docText, threadId, body, author) {
  const lines = String(docText).split("\n");
  const at = threadAt(lines, threadId);
  if (!at) {
    // Same capture, same reason — an error that lists `bugs members=...|autobot sent=...` as an
    // available id teaches the caller a string it can never successfully pass back.
    const ids = [...String(docText).matchAll(/(:{4,})thread\{id=([^}\s]+)[^}]*\}/g)].map((m) => m[2]);
    return {
      error: `no thread "${threadId}" in this document`,
      threads: ids,
      ...(ids.length ? {} : { hint: "this document has no threads to answer in" }),
    };
  }
  if (at.close === -1)
    return { error: `thread "${threadId}" is never closed — fix the document before replying into it` };
  const block = [`:::reply{author=${author} ts=${Date.now()}}`, ...String(body).trim().split("\n"), ":::"];
  return { content: [...lines.slice(0, at.close), ...block, ...lines.slice(at.close)].join("\n") };
}

function reportsOn({ readFile, writeFile }) {
  // INDEXED, not walked — the Reports tab lists the index, so a report that skips it exists on disk
  // and nowhere a human looks.
  async function write(projectCode, name, content) {
    const path = reportPath(projectCode, name);
    const w = await writeFile(projectCode, { path, content });
    if (!w || w.ok === false) throw new Error((w && w.error) || "could not write the report");
    let index = {};
    try {
      const res = await readFile(projectCode, { path: REPORT_INDEX });
      if (res && res.ok !== false) index = JSON.parse(res.content) || {};
    } catch {
      /* no index yet is the normal case */
    }
    const rows = (index[projectCode] || []).filter((r) => r.name !== name);
    index[projectCode] = [{ name, path, ts: Date.now() }, ...rows];
    try {
      await writeFile(projectCode, { path: REPORT_INDEX, content: JSON.stringify(index, null, 2) });
    } catch {
      /* the document is the thing; a failed index entry must not lose it */
    }
    return path;
  }

  // By NAME or by PATH, one place — so `tv` and `reply` can never disagree about where a document
  // lives. A miss answers with the reports that DO exist: an error that teaches.
  async function read(projectCode, report) {
    const path = /\.md$/i.test(report) ? report : reportPath(projectCode, report);
    const res = await readFile(projectCode, { path });
    if (res && res.ok !== false)
      return {
        path,
        name: /\.md$/i.test(report) ? path.split("/").pop().replace(/\.md$/i, "") : report,
        text: res.content || "",
      };
    return { error: `no report "${report}" in ${projectCode} (looked for ${path})`, known: await list(projectCode) };
  }

  // AN INDEXED NAME IS A CLAIM, NOT A REPORT. This answered straight out of the index, so a report
  // deleted outside this door — by hand, by git, by a lane's cleanup — was still offered by name in
  // every teaching error (`nothing on the TV, here is what exists`) and the agent that took the
  // offer got a miss. A name is only handed over while its file answers.
  //
  // A REFUSAL IS ABSENCE; A THROW IS NOT. `ok === false` is the door saying the file is not there,
  // which is the whole point of the check — but a door that threw knows nothing about the file, and
  // pruning on that would turn one bad read into "this project has no reports".
  async function list(projectCode) {
    try {
      const res = await readFile(projectCode, { path: REPORT_INDEX });
      if (!res || res.ok === false) return [];
      const rows = ((JSON.parse(res.content) || {})[projectCode] || []).filter((r) => r && r.name);
      const kept = await Promise.all(
        rows.map(async (r) => {
          if (!r.path) return r.name; // an entry from before paths were indexed — nothing to check
          try {
            const f = await readFile(projectCode, { path: r.path });
            return f && f.ok !== false ? r.name : null;
          } catch {
            return r.name;
          }
        }),
      );
      return kept.filter(Boolean);
    } catch {
      return [];
    }
  }

  return { write, read, list, reportPath, labelFor, REPORT_INDEX };
}

module.exports = { reportsOn, replyInto, stampSent, threadBodyOf, reportPath, labelFor, REPORT_INDEX, slug };
