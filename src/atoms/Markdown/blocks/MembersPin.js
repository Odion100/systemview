import React, { useState } from "react";
import { useDocMembers, useMarkdownWrite } from "../context";
import { everyoneBehind, hashOf, parseSent, pendingOf, serializeSent, summarize, threadSummary } from "../docMembers";
import { sendUpdateTo } from "../docSend";
import { readTucked, writeTucked } from "../pinTucked";
import { revealBlock } from "../revealBlock";

// RFC-071 — EVERY PENDING UPDATE IN THIS DOCUMENT, IN ONE PLACE THAT DOES NOT SCROLL AWAY.
//
// His, 2026-10-19: *"I shouldn't have to scroll back up to where I added them as a member to send
// them an update — they're supposed to be on the top right corner regardless"*, and then: *"I hope
// updates that are thread level also go up there as well, and not just document level… it's
// supposed to be for both."*
//
// So this row is the ONLY send in the surface. The `::members` block and a thread's row carry
// membership and a settings gear; neither carries a send button, because a press you have to
// scroll to is a press that does not happen.
//
// IT DISAPPEARS WHEN THERE IS NOTHING TO SEND, which is also how a press is confirmed: tell buapi
// and buapi's chip leaves the row. The row is state read off the document, never a notice.
const MembersPin = () => {
  const { block = null, threads = [], source = "", docPath = "", projectCode = "" } = useDocMembers() || {};
  const { editable, setAttr } = useMarkdownWrite();
  // line → { member: hash } for sends made since the document was last re-read. Merged over the
  // attribute rather than replacing it, so one scope's stamp never blanks another's.
  const [stamped, setStamped] = useState({});
  // TUCKED AWAY TO THE EDGE, THE WAY EVERY OTHER PANEL IN THIS WINDOW TUCKS, AND IT STAYS TUCKED.
  // His correction, 2026-10-19: *"keep it in the same space… animate away to the right, the same
  // [idiom] we use to tuck away into the side to the edge tabs. It's never supposed to be a
  // one-at-a-time thing, so the × is the wrong thing."* And then the bug that followed: *"every
  // time a document updates it reopens… if I refresh the page it doesn't keep the state."*
  //
  // So the state is REMEMBERED per document (localStorage, per reader) and nothing re-opens it but
  // him. That is safe because the collapsed tab is still on screen carrying the count — the only
  // state that hides anything is an empty corner, and an empty corner means nobody is behind.
  const [tucked, setTucked] = useState(() => readTucked(window.localStorage, docPath));
  const tuck = (on) => {
    setTucked(on);
    writeTucked(window.localStorage, docPath, on);
  };
  const [sending, setSending] = useState(0);
  const [refusal, setRefusal] = useState("");

  const pending = pendingOf(block, threads, source, stamped);
  if (!editable || (!pending.length && !refusal)) return null;

  const tell = async (scope, targets) => {
    setSending(scope.line);
    const subject = scope.body == null ? source : scope.body;
    const r = await sendUpdateTo({
      path: docPath,
      project: projectCode,
      members: targets,
      thread: scope.kind === "thread" ? scope.id : "",
      // A thread member is in the conversation — the reply is the news. A document member is
      // watching the file — the shape of the change is.
      summary: scope.kind === "thread" ? threadSummary(scope.id, scope.body) : summarize(source, false),
      threads: scope.kind === "thread" ? 1 : (String(source).match(/^\s*:{3,}\s*thread\b/gm) || []).length,
    });
    setSending(0);
    if (!r.ok) {
      setRefusal(r.error);
      return;
    }
    setRefusal("");
    stampTold(scope, targets);
  };

  // CAUGHT UP WITHOUT BEING TOLD — the press that was missing. There was a way to SEND an update and
  // no way to CLEAR one, and "behind" is derived rather than stored: `sent=` holds the hash each
  // member last heard about, so every save makes everyone behind again. On a document a group is
  // co-editing, the count then climbs on work they are all doing together and stops meaning
  // anything — *"I'm not sending you guys every little update."*
  //
  // It stamps exactly what a send stamps and emits NOTHING. One press says they were told; this one
  // says they were there. Same record, because the record is only ever "they know about this
  // version" — which is why both go through `stampTold` rather than through two copies of it.
  const square = (scope, targets) => {
    setRefusal("");
    stampTold(scope, targets);
  };

  const stampTold = (scope, targets) => {
    const subject = scope.body == null ? source : scope.body;
    const stamp = hashOf(subject);
    const next = { ...parseSent(scope.sent), ...(stamped[scope.line] || {}) };
    targets.forEach((m) => {
      next[m] = stamp;
    });
    setStamped((cur) => ({ ...cur, [scope.line]: next }));
    setAttr(scope.line, "sent", serializeSent(next) || null);
  };

  const behindCount = pending.reduce((n, p) => n + p.behind.length, 0);
  // THE PERSON IS THE UNIT, NOT THE ROW. Walking the rows one press at a time is what turned
  // bringing one agent up to date into four separate wakes, each a whole turn landing cold in the
  // middle of its unrelated work. Document membership now covers the threads, so this is usually a
  // single scope — but when somebody is on one thread only, they still have a row of their own, and
  // this is the press that does not make him hunt for it.
  const people = everyoneBehind(pending);
  const tellEveryone = async () => {
    for (const scope of pending) await tell(scope, scope.behind);
  };
  const squareEveryone = () => {
    pending.forEach((scope) => square(scope, scope.behind));
  };

  return (
    <div className={`md-members-pin${tucked ? " md-members-pin--tucked" : ""}`}>
      {/* THE COLLAPSED TAB — what the stack becomes, the same vertical strip every tucked panel in
          this window leaves behind. It says how much is waiting, because a tab that hides a count
          is a tab you learn to ignore. */}
      {tucked && (
        <button
          type="button"
          className="md-members-pin__tab"
          title={`${behindCount} waiting to be told — bring them back`}
          onClick={() => tuck(false)}
        >
          {/* JUST THE COUNT. Set vertically, "‹ 2 updates" is a tall strip down the right edge and
              it landed on top of the arc's own title — *"the tab blocks part of the arc title."*
              The sentence it used to spell out is in the `title` above, where it costs no pixels. */}
          ‹ {behindCount}
        </button>
      )}
      {!tucked && (
        <div className="md-members-pin__dock">
          <div className="md-members-pin__stack">
            {pending.length > 1 && (
              <button
                type="button"
                className="md-members-pin__all"
                title="tell everyone everything they are behind on — one press, not one per row"
                disabled={!!sending}
                onClick={tellEveryone}
              >
                {sending ? "telling…" : `tell ${people.length === 1 ? people[0] : `all ${people.length}`}`}
              </button>
            )}
            {/* THE OTHER ANSWER TO THE SAME ROW. Not every pile of pending updates wants sending —
                a document several people are editing together makes everybody behind on every
                save, and the honest resolution is often that they were in it. Quieter than the
                tell, because telling is what the row is for. */}
            <button
              type="button"
              className="md-members-pin__square"
              title="they are caught up — stamp this version and tell nobody"
              disabled={!!sending}
              onClick={squareEveryone}
            >
              ✓ caught up
            </button>
      {pending.map((scope) => {
        // GO TO THE THREAD — IN THIS PANE ONLY (his catch, 2026-10-26: clicking the pill "moves
        // the chat and scrolls the chat"). `revealBlock(document, …)` searched the whole PAGE for
        // `data-md-start`, and the chat's karaoke stamps use the same attribute — so the first
        // match was often a chat block and the wrong surface scrolled. The reveal now starts from
        // the pin's own markdown root, which can only ever be this document.
        const reveal = (e) => {
          const root = e.currentTarget && e.currentTarget.closest ? e.currentTarget.closest(".markdown") : null;
          revealBlock(root, scope.line);
        };
        // …AND ONLY A THREAD IS A DOOR. The document row is not a place you go — it is the send
        // that reaches everyone, which is also why it stops saying "document" (his: "it shouldn't
        // even say document… it just sends all threads really").
        const isThread = scope.kind === "thread";
        return (
        <div
          className={`md-members-pin__row md-members-pin__row--${scope.kind}`}
          key={`${scope.kind}-${scope.line}`}
          {...(isThread
            ? {
                role: "button",
                tabIndex: 0,
                title: `go to thread ${scope.id}`,
                onClick: reveal,
                onKeyDown: (e) => (e.key === "Enter" || e.key === " ") && reveal(e),
              }
            : {})}
        >
          <span className="md-members__kind">
            {scope.kind === "document" ? "all threads" : `💬 ${scope.id}`}
          </span>
          {scope.behind.map((m) => (
            <button
              type="button"
              key={m}
              className="md-members__chip md-members-pin__chip"
              disabled={!!sending}
              title={
                scope.kind === "thread"
                  ? `tell ${m} about this version of thread ${scope.id}`
                  : `tell ${m} about this version of the document`
              }
              onClick={(e) => {
                e.stopPropagation(); // a send is not a navigation — the pill around it is the door
                tell(scope, [m]);
              }}
            >
              {m}
              <span className="md-members__mark">•</span>
            </button>
          ))}
          {scope.behind.length > 1 && (
            <button
              type="button"
              className="md-members__send"
              disabled={!!sending}
              title={
                scope.kind === "thread"
                  ? `tell everybody behind on thread ${scope.id}`
                  : "tell everybody behind on the document"
              }
              onClick={(e) => {
                e.stopPropagation();
                tell(scope, scope.behind);
              }}
            >
              {sending === scope.line ? "sending…" : `all ${scope.behind.length}`}
            </button>
          )}
        </div>
        );
      })}
          </div>
          {/* THE POINTER, AT THE RIGHT OF THE TOP ROW — his placement, and the right one: it sits on the
              side the stack travels toward, so the press and the motion agree. A column container stacks whatever you
              put in it, so the first version of this handle added a row and pushed the whole stack
              down, which is the one thing he said it must never do: *"it was never supposed to push
              down — whatever the padding space was, was enough space to fit something in there."*
              So it lives in the row's own space, costs no height, and points the way the stack
              travels. */}
          <button
            type="button"
            className="md-members-pin__tuck"
            title="tuck these to the edge"
            onClick={() => tuck(true)}
          >
            ›
          </button>
        </div>
      )}
      {/* A REFUSAL IS SAID WHERE THE PRESS WAS, and it outlives the chips: a send that failed
          silently is a member who thinks they heard. */}
      {!!refusal && (
        <div className="md-members-pin__row">
          <span className="md-members__refusal">{refusal}</span>
        </div>
      )}
    </div>
  );
};

export default MembersPin;
