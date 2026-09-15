// CODE COMMENTS, AS A HUB CAPABILITY — RFC-034's sidecar, reachable without a folder path anyone
// has to remember.
//
// This was a terminal program that loaded the hub over HTTP and then handed itself a `Plugin` shim
// whose three methods forwarded straight back to the hub's readFile/writeFile/listFiles. Inside the
// hub that shim IS the hub, so it is gone.
//
// His comments were readable and unanswerable for a long time: an agent could see a note on line 74
// and had nowhere to put the answer, so every reply went to the chat — detached from the code, and
// the comment still read as unanswered the next session.
const ROOT = ".systemview/code-comments";
const EMPTY_SIDECAR = 40; // `{"threads":[]}` is 20 bytes; a real comment is far bigger

// THE REAL FIELDS ARE `from`/`to`. Guessing `line`/`range` from the call sites printed "L0" for a
// comment sitting on line 74 — the shape is read here, once, and nowhere else.
const firstLine = (t) => Number(t.from ?? t.line ?? (t.range && t.range[0]) ?? 0);
const lastLine = (t) => Number(t.to ?? t.endLine ?? (t.range && t.range[1]) ?? firstLine(t));
const rangeLabel = (t) => (firstLine(t) === lastLine(t) ? `${firstLine(t)}` : `${firstLine(t)}-${lastLine(t)}`);
const sidecar = (path) => `${ROOT}/${path}.json`;

function commentsOn({ readFile, writeFile, listFiles }) {
  async function threadsOf(projectCode, path) {
    try {
      const res = await readFile(projectCode, { path: sidecar(path) });
      if (!res || res.ok === false) return [];
      const doc = JSON.parse(res.content || "{}");
      return Array.isArray(doc.threads) ? doc.threads : [];
    } catch {
      return [];
    }
  }

  return async function comments({ projectCode, path, reply, at, as } = {}) {
    if (!projectCode) return { error: "projectCode required" };
    if (reply && !path) return { error: "a reply needs the file it belongs to" };
    // AN UNKNOWN PROJECT IS NOT A PROJECT WITH NO COMMENTS. Reading straight through answered
    // `files: []` for a project that was never connected — a shrug that reads as an answer.
    const known = await readFile(projectCode, { path: `${ROOT}/.probe` });
    if (known && known.ok === false && /no folder for this project/i.test(known.error || ""))
      return { error: `no connected project "${projectCode}"` };

    // ── answering one ──────────────────────────────────────────────────────────────────────────
    if (reply) {
      const threads = await threadsOf(projectCode, path);
      if (!threads.length) return { project: projectCode, path, error: `no comments on ${path} to answer` };
      const wanted = at != null ? Number(at) : null;
      // `at` is optional when there is only one comment — there is nothing to disambiguate — and a
      // wrong line answers with the lines that DO have comments rather than failing blind.
      const hit =
        wanted != null
          ? threads.find((t) => wanted >= Math.min(firstLine(t), lastLine(t)) && wanted <= Math.max(firstLine(t), lastLine(t)))
          : threads.length === 1
          ? threads[0]
          : null;
      if (!hit)
        return {
          project: projectCode,
          path,
          error:
            wanted != null
              ? `no comment covering line ${wanted}`
              : `${threads.length} comments on this file — say which with a line`,
          lines: threads.map(rangeLabel),
        };
      // Any agent can answer any comment and nothing here can tell who is calling, so the signature
      // is required, not defaulted — neither to "agent" nor to the file's own project.
      if (!as) return { project: projectCode, path, error: "say who you are — a reply is signed by its writer" };
      hit.replies = [...(hit.replies || []), { author: as, text: String(reply), ts: Date.now() }];
      const w = await writeFile(projectCode, { path: sidecar(path), content: `${JSON.stringify({ threads }, null, 2)}\n` });
      if (!w || w.ok === false) return { project: projectCode, path, error: (w && w.error) || "could not save the reply" };
      return { project: projectCode, path, ok: true, line: rangeLabel(hit), by: as, thread: hit };
    }

    // ── one file ───────────────────────────────────────────────────────────────────────────────
    if (path) return { project: projectCode, path, threads: await threadsOf(projectCode, path) };

    // ── the whole project ──────────────────────────────────────────────────────────────────────
    let files = [];
    try {
      const res = await listFiles(projectCode, { dir: ROOT });
      files = ((res && res.files) || [])
        // An emptied sidecar is not a comment. Size comes from the file layer; without it the read
        // below settles it anyway.
        .filter((f) => typeof f.size !== "number" || f.size >= EMPTY_SIDECAR)
        .map((f) => f.path.slice(ROOT.length + 1).replace(/\.json$/, ""));
    } catch {
      files = []; // no folder yet is the normal case, not an error
    }
    const out = [];
    for (const p of files) {
      const threads = await threadsOf(projectCode, p);
      if (threads.length) out.push({ path: p, lines: threads.map(rangeLabel), threads });
    }
    return { project: projectCode, files: out };
  };
}

module.exports = { commentsOn, firstLine, lastLine, rangeLabel, ROOT };
