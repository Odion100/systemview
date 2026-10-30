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
//
//   3. AND IT WAS THE SECOND SCANNER. The ladder in `facilitation.js` reads the same blocks to
//      work out what stands between a document and a station, and the two openers disagreed —
//      this one took a space and bare attributes, that one required `{…}`; that one skipped fenced
//      examples, this one counted them. Two answers to "is a decision waiting here", on real
//      documents: RFC-073 quotes an approved block inside a fence. The scan is now
//      `parseApprovals`, where the ladder's own steps read it, and this file is the band's VIEW of
//      it — the two can no longer drift because there is only one of them.
import { parseApprovals } from "../../atoms/Markdown/blocks/facilitation";

/**
 * Does this document hold an approval block with no verdict on it?
 *
 * One `verdict=` anywhere in a block's attributes means he has answered it — approved or rejected,
 * both are answers. A block with none is the only thing that counts as waiting.
 */
export const waitsOnHim = (content) => parseApprovals(content).some((a) => !a.verdict);

/** Every approval block in a document, with its 1-based line — for a surface that wants to point. */
export const approvalsIn = (content) =>
  parseApprovals(content).map((a) => ({ line: a.line, verdict: a.verdict }));

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
