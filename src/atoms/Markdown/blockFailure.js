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

/** The one line the agent receives. Pure, so the wording is checkable without a host. */
export function failureSummary({ kind, ref, reason, where = "" } = {}) {
  const k = String(kind || "block").trim();
  const r = String(ref || "").trim();
  const why = String(reason || "could not be resolved").trim();
  const at = where ? ` in ${where}` : "";
  // The REF comes first: the agent's next act is to find the exact value it wrote and change it.
  return r
    ? `a ::${k} you wrote${at} points at "${r}" and it does not resolve — ${why}`
    : `a ::${k} you wrote${at} does not resolve — ${why}`;
}

/** Stable key for one failure, so a re-render cannot re-send it. */
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
 * `report({kind, ref, reason})` — tells whoever should hear about this block, once.
 * Answers the audience it told, or `null` when there was nobody to tell. Nobody is a legitimate
 * answer: a block rendered where no agent stands behind it has no writer to inform.
 */
export function useBlockFailure() {
  const scope = useMarkdownScope() || {};
  const doc = useDocMembers() || {};
  const inFlight = useRef(new Set());

  return useCallback(
    async ({ kind, ref, reason }) => {
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
        summary: failureSummary({ kind, ref, reason, where: doc.docPath ? "" : "this chat" }),
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
