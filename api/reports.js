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
const slug = (v) => String(v || "").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
const reportPath = (pc, name) => `.systemview/report.${slug(pc)}.${slug(name)}.md`;
const REPORT_INDEX = ".systemview/reports.index.json";

// The label a report is known by: its first heading, else the file name, else the opening words.
function labelFor(content, file) {
  const heading = (String(content).match(/^#{1,6}\s+(.+)$/m) || [])[1];
  return heading || (file ? String(file).split("/").pop() : String(content).trim().slice(0, 48));
}


// ANSWERING IN A THREAD, PURELY — document text in, document text out.
//
// A CONTAINER NESTS BY GAINING COLONS: a thread wrapping a `::::columns` block is opened with FIVE,
// and matching exactly four missed precisely the threads on well-built reports, where the content
// worth discussing is code beside its explanation. The close must be the SAME fence, or the reply
// splices into the middle of the inner block.
function replyInto(docText, threadId, body, author) {
  const lines = String(docText).split("\n");
  const openRe = /^(:{4,})thread\{id=([^}]+)\}\s*$/;
  let open = -1;
  let fence = "::::";
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].trim().match(openRe);
    if (m && m[2] === threadId) {
      open = i;
      fence = m[1];
      break;
    }
  }
  if (open === -1) {
    const ids = [...String(docText).matchAll(/(:{4,})thread\{id=([^}]+)\}/g)].map((m) => m[2]);
    return {
      error: `no thread "${threadId}" in this document`,
      threads: ids,
      ...(ids.length ? {} : { hint: "this document has no threads to answer in" }),
    };
  }
  let close = -1;
  for (let i = open + 1; i < lines.length; i++)
    if (lines[i].trim() === fence) {
      close = i;
      break;
    }
  if (close === -1) return { error: `thread "${threadId}" is never closed — fix the document before replying into it` };
  const block = [`:::reply{author=${author} ts=${Date.now()}}`, ...String(body).trim().split("\n"), ":::"];
  return { content: [...lines.slice(0, close), ...block, ...lines.slice(close)].join("\n") };
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

  async function list(projectCode) {
    try {
      const res = await readFile(projectCode, { path: REPORT_INDEX });
      if (!res || res.ok === false) return [];
      return ((JSON.parse(res.content) || {})[projectCode] || []).map((r) => r.name);
    } catch {
      return [];
    }
  }

  return { write, read, list, reportPath, labelFor, REPORT_INDEX };
}

module.exports = { reportsOn, replyInto, reportPath, labelFor, REPORT_INDEX, slug };
