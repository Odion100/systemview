import { useDocMembers, useInThread } from "./context";
import useMembership from "./useMembership";
import { decisionSummary } from "./decisions";
import { splitWho } from "./docMembers";

// TELLING THE ROOM A DECISION WAS MADE — one implementation, used by every block whose write-back
// is a decision. It exists as a hook rather than as lines inside `Approval` because `::question`
// needs exactly the same behaviour, and the moment that is two copies they drift: one would learn
// about threads, or stamping, or the quiet period, and the other would not.
//
// WHO HEARS IT. A press inside a thread belongs to that conversation and reaches the thread's
// people; one in the body of the document belongs to the document. Either way the `sent=` stamp
// lands on THAT scope's own line — never on the block's own, which carries no `sent=` and never
// should.
//
// NOBODY TO TELL IS THE NORMAL CASE. Most documents have no members at all, so an empty roster is
// an early return rather than an error: a report with a `:::approval` in it is still just a report.
export default function useDecisionTell() {
  const inThread = useInThread();
  const { block = null, members: docWho = [] } = useDocMembers() || {};

  const scope = inThread
    ? { who: inThread.who || [], sent: inThread.sent || "", line: inThread.line || 0, thread: inThread.id || "" }
    : { who: docWho, sent: (block && block.sent) || "", line: (block && block.line) || 0, thread: "" };

  const { send } = useMembership({
    who: scope.who,
    sent: scope.sent,
    line: scope.line,
    thread: scope.thread,
  });

  /**
   * Announce one decision. Returns nothing and throws nothing — DELIBERATELY.
   *
   * The caller has already written the decision into the document by the time this runs, and that
   * ordering is the safety property: a send that refuses (no host door, a hub that is down, nobody
   * on the document) must never cost the verdict. So this is fire-and-forget by construction, and
   * a failure is swallowed here rather than surfacing as a failed press — because the press did
   * not fail.
   */
  return (kind, attrs, value) => {
    const targets = splitWho(scope.who).filter(Boolean);
    if (!targets.length) return;
    try {
      Promise.resolve(
        send(targets, { summary: decisionSummary({ kind, attrs, value }), decision: true }),
      ).catch(() => {});
    } catch {
      /* the decision is in the file; the announcement is bookkeeping */
    }
  };
}
