import { useCallback, useRef } from "react";
import { useMarkdownScope, useDocMembers } from "./context";
import { sendUpdateTo } from "./docSend";

// A BLOCK THAT CANNOT RESOLVE WHAT IT POINTS AT TELLS THE AGENT THAT WROTE IT.
//
// WHAT WAS WRONG. A resolving block renders its failure on screen and tells NOBODY. A `::commit`
// carrying a sha from another repo reads "no such commit" in the chat, and the agent that wrote it
// never hears — so it stays wrong until he catches it by eye and says so. The block knows it has
// failed the moment it fails; the only thing missing was delivery.
//
// AND THE ROUTE ALREADY EXISTED, which is the part I got wrong first. `documents.sendUpdate` looks
// document-shaped, but its MEMBERS are supplied by the caller and win over anything read off a
// file — the host says so in as many words: "the window supplies the members itself, so the file is
// only needed for what it can add". So an arbitrary audience is already addressable from here. The
// path is required as a string and does not have to resolve; an unresolvable one costs the arc id
// and nothing else.
//
// WHO HEARS IT. In a document, its members — they are who can fix it, and the author is among
// them. In the chat, the one agent whose reply this is, which the scope already carries: a chat is
// per-project and an agent is addressed by its project code. Nobody else is told, because a broken
// block is a note to its writer, not news.

// TWO DIFFERENT FAULTS, AND ONLY ONE OF THEM IS ABOUT RESOLUTION.
//
// This composer had one sentence and used it for everything: "a ::<kind> you wrote points at
// "<ref>" and it does not resolve — <why>". For the five blocks that resolve something — a file, a
// test, a report chip, a branch, a commit — that is exactly right, and `why` finishes it.
//
// For a CLAIM it was false in both halves. An unproved met-mark came out as *"a ::claim you wrote
// points at "c1" and it does not resolve — marked met with no proof embedded"*, and `c1` resolved
// perfectly: it exists, it is marked met, it carries no proof. Nothing pointed anywhere and nothing
// failed to resolve. The first clause described no part of the fault and the whole fact was in the
// second — so the message spent its opening on a lie and the agent reading it was sent looking for
// a bad reference it never wrote. Measured 2026-11-08 on RFC-078's 21 marks.
//
// So the caller says WHICH FAULT IT IS, and `unresolved` is the default: the five resolution blocks
// are untouched by construction rather than by my having remembered them. A state fault locates the
// block and then states the whole fact, because for that shape the whole fact is all there is.
const FAULTS = {
  // A reference that points somewhere and that somewhere is not there.
  unresolved: (k, r, at, why) =>
    r
      ? `a ::${k} you wrote${at} points at "${r}" and it does not resolve — ${why}`
      : `a ::${k} you wrote${at} does not resolve — ${why}`,
  // A block that resolved and is in a state it should not be in. The ref LOCATES it; it is not the
  // thing that failed, so it never gets a verb of its own.
  state: (k, r, at, why) =>
    r ? `the ::${k} you wrote${at} at "${r}" is ${why}` : `the ::${k} you wrote${at} is ${why}`,
};

/** The one line the agent receives. Pure, so the wording is checkable without a host. */
export function failureSummary({ kind, ref, reason, where = "", fault = "unresolved" } = {}) {
  const k = String(kind || "block").trim();
  const r = String(ref || "").trim();
  const why = String(reason || "could not be resolved").trim();
  const at = where ? ` in ${where}` : "";
  // An unknown shape falls back to the resolution wording rather than throwing: a fault channel
  // that breaks on its own argument tells nobody about the fault it was called for, which is the
  // one outcome this whole mechanism exists to prevent.
  // The REF comes first for a resolution fault: the agent's next act is to find the exact value it
  // wrote and change it.
  return (FAULTS[fault] || FAULTS.unresolved)(k, r, at, why);
}

// Stable key for one failure, so a re-render cannot re-send it.
//
// `fault` IS NOT IN THE KEY, and that is the rule rather than an omission. These keys are PERSISTED
// (`sv.blockFault.sent`), so ANY change to the key format silently invalidates every key already on
// his disk and re-tells him everything that is still on a page — which is the reload-flood this
// file's whole history is about.
//
// Measured 2026-11-11, and it is why this is stated as a rule: `fault` WAS in the key, appended
// only when it was not the default, on the reasoning that a changed wording deserves a fresh
// telling. Then the unproved-claim nudge — far and away the most numerous fault in the system —
// gained `fault: "state"`, every one of its stored keys stopped matching at once, and the next
// bundle he took re-reported FORTY claims into his chat while he was working on something else.
// The wording of a message is not worth re-telling a fact he has already been told.
//
// `reason` is what separates two faults on one block, and it already does: a claim's unproved
// nudge and its jammed-fence nudge carry different reasons and so get different keys. `fault` only
// picks the SENTENCE, and the sentence is not part of the fact.
export const failureKey = ({ kind, ref, reason, audience = [] } = {}) =>
  [kind, ref, reason, [...audience].sort().join(",")].join(" ");

// ONE SEND PER FAILURE, AND IT HAS TO SURVIVE A RELOAD.
//
// This was a module-level Set, which dies with the page — so every refresh re-reported every
// broken block still on screen. Measured the hard way: he refreshed, and I was woken again, for
// the same two blocks, every time. *"All I do is refresh the page and you get that."* A reload is
// the single commonest thing that happens to a window, which made the in-memory version worse
// than no dedupe at all: it looked solved while flooding on exactly the event nobody counts.
//
// So it persists. Being told is a fact about the AGENT, not about this page's lifetime, and a
// reload does not un-tell anybody. The key carries the reason, so a block that starts failing
// differently is a new failure and does report; a block that is FIXED changes its ref and never
// matches again.
//
// BOUNDED, because an unbounded record of every failure ever is a slow leak in his browser. The
// newest entries win and the rest are dropped — the oldest failures are also the ones least
// likely to still be on a page.
const STORE_KEY = "sv.blockFault.sent";
const KEEP = 300;

const readSent = () => {
  try {
    const raw = JSON.parse(window.localStorage.getItem(STORE_KEY) || "{}");
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    // No storage (a privacy mode that throws, a host without one) is not an error here: the
    // feature degrades to per-page dedupe, which is what it did before, rather than failing.
    return {};
  }
};

const markSent = (key) => {
  try {
    const all = readSent();
    all[key] = Date.now();
    const keys = Object.keys(all);
    if (keys.length > KEEP) {
      keys
        .sort((a, b) => all[a] - all[b])
        .slice(0, keys.length - KEEP)
        .forEach((k) => delete all[k]);
    }
    window.localStorage.setItem(STORE_KEY, JSON.stringify(all));
  } catch {}
};

const wasSent = (key) => Object.prototype.hasOwnProperty.call(readSent(), key);

/** Test seam — a suite has to start from nothing. */
export const _resetSentFailures = () => {
  try {
    window.localStorage.removeItem(STORE_KEY);
  } catch {}
};

/**
 * `report({kind, ref, reason, fault})` — tells whoever should hear about this block, once.
 * `fault` is `unresolved` (the default — a reference that leads nowhere) or `state` (the block
 * resolved and is in a state it should not be in); it picks the wording and is part of the key.
 * Answers the audience it told, or `null` when there was nobody to tell. Nobody is a legitimate
 * answer: a block rendered where no agent stands behind it has no writer to inform.
 */
export function useBlockFailure() {
  const scope = useMarkdownScope() || {};
  const doc = useDocMembers() || {};
  const inFlight = useRef(new Set());

  return useCallback(
    async ({ kind, ref, reason, fault = "unresolved" }) => {
      const members = Array.isArray(doc.members) && doc.members.length ? doc.members : [];
      const audience = members.length
        ? members
        : [String(scope.projectCode || "").trim()].filter(Boolean);
      if (!audience.length) return null;
      const key = failureKey({ kind, ref, reason, audience });
      if (wasSent(key) || inFlight.current.has(key)) return null;
      inFlight.current.add(key);
      // THE PATH HAS TO BE A FILE THAT EXISTS, because the message the agent receives ends with
      // "read the file rather than trusting this line" — and the first version pointed at
      // `.systemview/chats/<project>`, which is a folder prefix and not a file. So the one piece
      // of advice in the notification was a dead instruction, visibly, in his window. A chat's
      // real transcript is `<project>.<room>.jsonl` in that folder; the room comes down on the
      // scope for exactly this.
      const chatFile = scope.chat
        ? `.systemview/chats/${scope.projectCode}.${scope.chat}.jsonl`
        : "";
      const where = doc.docPath || chatFile;
      // NO REAL ADDRESS, NO SEND. The notification closes with "read the file rather than trusting
      // this line", so a message carrying a path that leads nowhere spends the reader's trust on a
      // dead instruction — worse than saying nothing, because it looks like a lead. Both cases
      // have an address now; this is the fallback, and refusing is the honest shape of it.
      if (!where) return null;
      const r = await sendUpdateTo({
        path: where,
        project: doc.projectCode || scope.projectCode || "",
        members: audience,
        summary: failureSummary({ kind, ref, reason, fault, where: doc.docPath ? "" : "this chat" }),
        by: "the window",
        // SAY WHAT THIS IS. Without it the harness composes "a document you are a member of was
        // updated", which is wrong twice over: there is no document, and the recipient is the
        // AUTHOR rather than a member. Flagged rather than inferred, the same way a decision is.
        fault: true,
      });
      inFlight.current.delete(key);
      // ONLY A DELIVERED MESSAGE IS REMEMBERED. A refused send that marked itself sent would make
      // the failure permanently unreportable for the life of the page — the quietest possible
      // outcome for a mechanism whose entire purpose is to stop something being quiet.
      if (r && r.ok) {
        markSent(key);
        return audience;
      }
      return null;
    },
    [doc.members, doc.docPath, doc.projectCode, scope.projectCode],
  );
}
