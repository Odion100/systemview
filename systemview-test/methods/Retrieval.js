// RETRIEVAL, ON THE CHANGE LOOP — and it exists because an excuse turned out to be laziness.
//
// Three claims in RFC-075 are about an agent ASKING the store and getting the right chapter back
// (c10, c11, c20). Every one of them carried the same note: *"context() has no door a saved spec
// can call, so that half was verified live after indexing"* — and that sentence was wrong twice.
//
// Wrong the first way: a door DOES exist. The shell service publishes `Docs.search`, and it answers
// the exact query c10 names at 0.737 on the right chunk. But a spec hung on it is red whenever the
// Electron shell is down, which makes it the confirming half rather than a change-loop defence.
//
// Wrong the second way, and this is the one worth learning from: **retrieval has a structural
// precondition that needs no store at all.** A query reaches a chapter only if the chapter's subject
// lands in ONE chunk, under a heading that names it, inside a corpus root that covers the file. All
// three of those are computable from the file on disk — by the REAL chunker, `chunkMarkdown` in
// autobot's `electron/agents/docs.cjs`, which is CommonJS and requires clean. No shell, no vector
// store, no network: it rides the loop.
//
// So the honest split is: this module defends "the chapter is RETRIEVABLE" durably, and the live
// `Docs.search` call is what he presses to see it actually retrieved. Two halves, both real, and
// the thing that was called unassertable was assertable the whole time by a different instrument.
//
// Same rule as `Claims.js`: real values out, no comparison that answers the spec's question.
const fs = require("fs");
const path = require("path");

const REPO = path.resolve(__dirname, "..", "..");
const DOCS = "/Users/odionedwards/autobot/electron/agents/docs.cjs";

module.exports = {
  // THE REAL CHUNKER on a real file. Returns every chunk the corpus would produce — its heading
  // path, its size, and its text — which is exactly what `docsPlan` shows a human.
  async chunksOf({ path: rel, project } = {}) {
    if (!rel) return { ok: false, error: "path is required (repo-relative)" };
    const root = project ? String(project) : REPO;
    const abs = path.isAbsolute(rel) ? rel : path.join(root, String(rel));
    let text;
    try {
      text = fs.readFileSync(abs, "utf8");
    } catch (err) {
      return { ok: false, path: rel, error: String((err && err.message) || err) };
    }
    let chunkMarkdown;
    try {
      ({ chunkMarkdown } = require(DOCS));
    } catch (err) {
      // "COULD NOT CHUNK" IS NOT "NO CHUNKS" — the same scar the store carries. An empty list here
      // would read as "this file produces nothing", which is a finding about the document rather
      // than about a missing dependency.
      return { ok: false, path: rel, error: `chunker unreachable: ${String((err && err.message) || err)}` };
    }
    // PROBED, not assumed: a chunk is `{ headingPath: string[], text, line, part }` — `part` is
    // null unless the subject was split, which is the field that says a heading owns more than one
    // chunk. Guessing this shape cost one red probe, which is the cheapest place to be wrong.
    const chunks = chunkMarkdown(text).map((c, i) => ({
      n: i,
      line: c.line,
      part: c.part === undefined ? null : c.part,
      headingPath: (Array.isArray(c.headingPath) ? c.headingPath : [c.headingPath]).filter(Boolean).join(" › "),
      chars: String(c.text || "").length,
      text: String(c.text || ""),
    }));
    return { ok: true, path: rel, count: chunks.length, chunks };
  },

  // ONE CHUNK, BY ITS HEADING — the shape a claim about retrieval actually wants. Returns the
  // chunk's own text and size so the spec can assert on the words; `matches` is how many chunks
  // carry that heading, which is the number that says whether the subject got split.
  async chunkByHeading({ path: rel, heading, project } = {}) {
    const all = await module.exports.chunksOf({ path: rel, project });
    if (!all.ok) return all;
    if (!heading) return { ok: false, error: "heading is required" };
    const needle = String(heading).toLowerCase();
    const hits = all.chunks.filter((c) => c.headingPath.toLowerCase().includes(needle));
    return {
      ok: true,
      path: rel,
      heading,
      // `matches` is the number that matters: ONE means the subject owns a chunk of its own, which
      // is the structural precondition for a query reaching it. More than one means it was split.
      matches: hits.length,
      headingPath: hits.length ? hits[0].headingPath : null,
      line: hits.length ? hits[0].line : 0,
      part: hits.length ? hits[0].part : null,
      chars: hits.length ? hits[0].chars : 0,
      text: hits.length ? hits[0].text : "",
    };
  },

  // WHICH CORPORA COVER A FILE. Words on disk that nothing indexes answer nobody, so a claim about
  // retrieval has to know the file is inside an indexed root. Reads the real corpora config.
  async corporaCovering({ path: abs } = {}) {
    if (!abs) return { ok: false, error: "path is required (absolute)" };
    let corpora;
    try {
      ({ corpora } = require(DOCS));
    } catch (err) {
      return { ok: false, error: `corpora unreachable: ${String((err && err.message) || err)}` };
    }
    const list = (typeof corpora === "function" ? corpora() : corpora) || [];
    const covering = list
      .filter((c) => c && c.root && String(abs).startsWith(String(c.root)))
      .map((c) => ({ name: c.name, kind: c.kind, root: c.root }));
    return { ok: true, path: abs, covering, count: covering.length };
  },
};
