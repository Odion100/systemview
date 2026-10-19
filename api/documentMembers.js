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
const LINE = /^\s*::members\{([^}]*)\}\s*$/m;

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
const bodyOf = (src) =>
  String(src || "")
    .split("\n")
    .filter((l) => !/^\s*::members\b/.test(l))
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

// Reads one document's membership. `null` when it has none — which is most files, and the caller
// uses that to skip rather than carrying empty rows around.
function membersOf(content) {
  const m = LINE.exec(String(content || ""));
  if (!m) return null;
  const who = listOf(attrOf(m[1], "who"));
  if (!who.length) return null;
  const sent = sentOf(attrOf(m[1], "sent"));
  const now = hashOf(content);
  return {
    who,
    sent,
    // Behind = has not been told about THIS version. Never sent to counts as behind: they are on
    // the document and have heard nothing, which is the loudest case, not an exempt one.
    behind: who.filter((p) => sent[p] !== now),
    // AUTO IS PER MEMBER (his correction): the attribute is a list of who is told automatically,
    // not a switch on the whole document.
    auto: listOf(attrOf(m[1], "auto")),
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
      if (!res.content.includes("::members")) continue;
      const m = membersOf(res.content);
      if (!m) continue;
      if (member && !m.who.includes(member)) continue;
      docs.push({ path, who: m.who, behind: m.behind, auto: m.auto });
    }
    return {
      project: projectCode,
      ...(member ? { member } : {}),
      documents: docs,
      // The two numbers the band asks for, so it never has to re-walk this answer.
      withMembers: docs.length,
      withUpdates: docs.filter((d) => d.behind.length).length,
    };
  };
}

module.exports = { documentMembersOn, membersOf, hashOf, bodyOf, listOf };
