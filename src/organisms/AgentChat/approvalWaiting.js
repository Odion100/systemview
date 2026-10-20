// AN APPROVAL WAITING IS NEVER MISSED — the band's flag predicate, out of the render.
//
// The band head says how many documents hold a decision waiting on him, and the whole value of that
// number is that a zero means zero. Two things in the three lines this replaces made it able to say
// zero while one waited:
//
//   1. A SILENT CAP. The scan read the first 20 reports. Measured 2026-10-19: there were 23, so
//      three documents were never looked at and nothing anywhere said so. A bound that drops work
//      without naming it reads as "covered everything", which is the one thing a count must not do.
//
//   2. A FENCE MATCHED AT EXACTLY THREE COLONS. `:::approval` only — so an approval wrapped in a
//      thread (four colons, because a container nests by GAINING them) was invisible. That is the
//      same bug the thread reply-writer already had: *"matching exactly four missed precisely the
//      threads on well-built reports, where the content worth discussing is code beside its
//      explanation."* An approval inside a thread is a decision somebody deliberately put in the
//      middle of a conversation — the most likely kind to be waiting, and the kind that never
//      flagged.
//
// WHAT IS NOT A BUG, checked before touching it: `verdict=` present means ANSWERED, whichever way
// it went. A REJECTED document is correctly not counted as waiting. The problem with a rejection
// is elsewhere (nothing treats it as closed); this scan had it right.
//
// AND THIS DELIBERATELY READS REPORTS ONLY. Scanning other folders was the rejected RFC-070's
// proposal and it stays dead.

// A container nests by gaining colons, so three-or-more and the attributes to the end of the line.
const BLOCK = /^[ \t]*:{3,}[ \t]*approval\b([^\n]*)$/gm;

/**
 * Does this document hold an approval block with no verdict on it?
 *
 * One `verdict=` anywhere in a block's attributes means he has answered it — approved or rejected,
 * both are answers. A block with none is the only thing that counts as waiting.
 */
export function waitsOnHim(content) {
  const src = String(content || "");
  BLOCK.lastIndex = 0; // a /g regex carries state between calls; forgetting this skips every other document
  let m;
  while ((m = BLOCK.exec(src)) !== null) {
    if (!/\bverdict=/.test(m[1] || "")) return true;
  }
  return false;
}

/** Every approval block in a document, with its 1-based line — for a surface that wants to point. */
export function approvalsIn(content) {
  const lines = String(content || "").split("\n");
  const out = [];
  for (let i = 0; i < lines.length; i += 1) {
    const m = /^[ \t]*:{3,}[ \t]*approval\b([^\n]*)$/.exec(lines[i]);
    if (!m) continue;
    const v = /\bverdict=("[^"]*"|[^\s}]*)/.exec(m[1] || "");
    out.push({ line: i + 1, verdict: v ? v[1].replace(/^"|"$/g, "") : "" });
  }
  return out;
}

/**
 * Fold a list of read documents into what the band draws.
 *
 * `read` is `[{ path, content }]` — already fetched, because deciding what waits is not the same job
 * as fetching, and only one of the two is testable without a hub.
 *
 * `unread` is how many documents could NOT be read. It is carried rather than swallowed: a count
 * that quietly omits is a count that lies, and the surface can then say "1 waiting, 2 unreadable"
 * instead of implying it looked at everything.
 */
export function flagsFrom(read = [], unread = 0) {
  const flags = {};
  for (const r of read) {
    if (!r || !r.path) continue;
    if (waitsOnHim(r.content)) flags[r.path] = true;
  }
  return { flags, waiting: Object.keys(flags).length, unread: Math.max(0, Number(unread) || 0) };
}
