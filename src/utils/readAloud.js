// A FILE READ ALOUD FOLLOWS THE ORDER YOU SEE — his: *"you say something, you drop a document, you
// say something after — why wouldn't it follow the order that you're seeing?"*
//
// Two surfaces can read a voiced `::file` chip and they must not both do it, and in the chat the
// CHIP cannot be the owner: the reply's recital has to split around it (text before → the passage →
// text after), and only the reader that owns the whole reply can order that. So:
//
//   - the chat's reader finds the voiced chips in a new reply (findVoicedFiles), claims each one,
//     and enqueues reply-segment / passage / reply-segment in document order;
//   - FileEmbed claims on a DEFERRED tick (one macrotask) — children's effects run before their
//     parents', so without the deferral the chip would always win the claim and the order would
//     break. In a document pane there is no reader, the deferred claim succeeds, the chip reads.
//
// The claim set is also the once-per-window-session guard: re-mounts, reopened chats and bundle
// swaps must not re-read a passage at him.

import { spokenMap, chunkMap, spokenChunks } from "./spokenForm";

const CLAIMED = new Set();

export const passageKey = (project, path, lines) =>
  `read:${project || ""}:${path}:${lines ? lines.join("-") : "all"}`;

/** Claim a passage for reading. True exactly once per key per window session. */
export function claimRead(key) {
  if (CLAIMED.has(key)) return false;
  CLAIMED.add(key);
  return true;
}

export const isClaimed = (key) => CLAIMED.has(key);

// The voiced file chips in a reply's markdown, with the line each sits on — found with the same
// leaf shape the renderer parses, fences respected (a quoted example must not read a file).
//   → [{ line, path, lines }]
export function findVoicedFiles(markdown) {
  const out = [];
  const rows = String(markdown || "").split("\n");
  let inCode = false;
  for (let i = 0; i < rows.length; i += 1) {
    if (/^\s*(```|~~~)/.test(rows[i])) {
      inCode = !inCode;
      continue;
    }
    if (inCode) continue;
    const m = rows[i].match(/^\s*::file\[([^\]]+)\]\{[^}]*\b(?:voice|read)\b[^}]*\}\s*$/);
    if (!m) continue;
    const spec = m[1];
    const range = spec.match(/#L?(\d+)(?:-L?(\d+))?$/i);
    const path = range ? spec.slice(0, spec.length - range[0].length) : spec;
    const lines = range ? [Number(range[1]), Number(range[2] || range[1])] : null;
    out.push({ line: i + 1, path, lines });
  }
  return out;
}

// The cue leaves in a reply, with the line each sits on — `::cue[body?]{at=… | highlight=… |
// press=… | call=… say=…}`, fences respected (a quoted example must not walk the bot).
//   → [{ kind: "cue", line, body, at, highlight, press, call, say }]
export function findCues(markdown) {
  const out = [];
  const rows = String(markdown || "").split("\n");
  let inCode = false;
  for (let i = 0; i < rows.length; i += 1) {
    if (/^\s*(```|~~~)/.test(rows[i])) {
      inCode = !inCode;
      continue;
    }
    if (inCode) continue;
    const m = rows[i].match(/^\s*::cue(?:\[([^\]]*)\])?(?:\{([^}]*)\})?\s*$/);
    if (!m || (!m[1] && !m[2])) continue;
    const cue = { kind: "cue", line: i + 1, body: m[1] || "" };
    const attrs = m[2] || "";
    const re = /(\w+)=(?:"([^"]*)"|([^\s}]+))/g;
    let a;
    while ((a = re.exec(attrs))) cue[a[1]] = a[2] !== undefined ? a[2] : a[3];
    out.push(cue);
  }
  return out;
}

/**
 * A reply's recital split around its voiced chips AND its cues, in document order:
 *   [{ kind: "say", text, chunks }, { kind: "file", … }, { kind: "cue", … }, …]
 * Each say-segment carries its own engine-chunk positions, so the karaoke subtitle and the lit
 * paragraph keep working per segment. A reply with neither is ONE say segment — exactly what the
 * reader spoke before any of this existed.
 */
export function recitalSegments(markdown, opts = {}) {
  const marks = [...findVoicedFiles(markdown).map((f) => ({ kind: "file", ...f })), ...findCues(markdown)].sort(
    (a, b) => a.line - b.line
  );
  const sentences = spokenMap(String(markdown || ""), opts);
  const segOf = (list) => {
    const text = list.map((s) => s.text).join(" ");
    return { kind: "say", text, chunks: chunkMap(list, spokenChunks(text)) };
  };
  if (!marks.length) return sentences.length ? [segOf(sentences)] : [];
  const out = [];
  let from = 0;
  for (const f of marks) {
    let end = from;
    while (end < sentences.length && (!sentences[end].lines || sentences[end].lines[0] <= f.line)) end += 1;
    if (end > from) out.push(segOf(sentences.slice(from, end)));
    out.push(f);
    from = end;
  }
  if (from < sentences.length) out.push(segOf(sentences.slice(from)));
  return out;
}
