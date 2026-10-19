import React, { useEffect, useRef, useState } from "react";
import { useCommentsContext, InThreadProvider, useMarkdownWrite, useDocMembers } from "../context";
import { claimThread } from "../threadFocus";
import { splitWho } from "./Members";
import MemberAdd from "./MemberAdd";
import MemberSettings from "./MemberSettings";
import useMembership from "../useMembership";
import { AUTO_QUIET_MS } from "./Members";
import { hashOf } from "../docMembers";
import { readSeen, writeSeen, replyStamps, unseenCount, newestOf } from "../threadSeen";
import useDictation from "../../../utils/useDictation";

// RFC-025 §12 — `:::thread{id=extraction}` wraps anything (prose, a table, a code block, an embed)
// and gives it the SAME reply thread a story pane has: the 💬 corner button, your replies and agent
// replies with distinct looks, ⌘↵ to post.
//
// Deliberately a WRAPPER rather than "every block is commentable": the thread belongs to the wrapper,
// the wrapper lives in the document, so it moves with the content it's about — no heading/hash
// anchoring, no orphaned comments, and no gutter noise on paragraphs nobody wants to discuss.
//
// REPLIES LIVE IN THE DOCUMENT, as `:::reply{author=…}` blocks inside the thread:
//
//   :::thread{id=lb-rig}
//   The LB rig is still driven by hand.
//   :::reply{author=you ts=1786…}
//   What should an automated version assert?
//   :::
//   :::
//
// That's the point of the whole surface — read the document and you have the state, including the
// conversation. (It was a sidecar at first, to keep replies out of git diffs. But you see a diff
// before you commit it, and removing a thread is one menu click, so that reason didn't survive.)
// The sidecar remains ONLY as the fallback for surfaces with no file to write to — the hub and help
// topics are JS constants — and to keep already-written replies visible.
const Thread = ({ attrs = {}, line, src, children }) => {
  const { threads, writable: storeWritable, addReply, removeReply, error } = useCommentsContext();
  const { editable, appendInside, setAttr } = useMarkdownWrite();
  // RFC-071 — WHO THIS THREAD IS FOR. `members=` on the thread names its own people; absent, a
  // reply still reaches the DOCUMENT's members, because the common case is "everyone on this
  // document is in this conversation" and making that explicit on every thread is noise nobody
  // maintains.
  //
  // INHERITANCE IS NOT DRAWN. It used to render as a dimmed "from the document" row, and his
  // ruling, 2026-10-19: *"it shouldn't even be showing that from the document, that's implicit. It
  // should only show if there's members on the thread."* So the row below is the thread's OWN list
  // and nothing else — inheritance stays true in `members`, which is what the reply sends to.
  const { hasMembers = false, docPath = "" } = useDocMembers() || {};
  const own = splitWho(attrs.members);
  // INHERITANCE IS NOT A SEPARATE PATH ANY MORE, and nothing was lost: a reply changes the
  // document's body too, so everybody on the DOCUMENT goes behind on the document and hears about
  // it through the document's own pill. A thread's `members=` is the narrower subscription on top
  // of that — these people, about this argument, now.
  // THE SAME WRITE `:::approval` MAKES — the thread's own opening line, which is the line this
  // block was mounted on, so it can never land on the document's members line or the thread below.
  const writeMembers = (next) => setAttr && setAttr(line, "members", next.length ? next.join("|") : null);
  // The row exists once the document has a `::members` block (*"if there's already a member's block
  // in the document"*) — empty, with just the `+`, so a thread's list can be STARTED from a chip
  // rather than from the right-click menu. A document with no membership at all says nothing about
  // it on its threads, and a read-only surface draws the list only when there is one.
  const showMembers = own.length > 0 || (editable && hasMembers);
  // A THREAD IS ITS OWN SUBSCRIPTION — dirtiness measured over the thread's OWN body, so a reply
  // here makes these people behind and leaves the document's membership alone. His: *"let's get
  // dirty"* — a reply no longer tells anybody on the spot; it makes them behind, the auto ones are
  // told when it settles, and the rest are a press in the pinned row at the top.
  const { dirty, isAuto, setAuto, send } = useMembership({
    who: own,
    sent: attrs.sent,
    auto: attrs.auto,
    line,
    body: src,
    thread: attrs.id || "",
  });
  const [settings, setSettings] = useState(false);
  // AUTO, PER THREAD. One timer per thread — the thread is rendered once, so there is exactly one
  // of these however many other controls read the same membership.
  const autoTimer = useRef(null);
  const lastAutoHash = useRef("");
  const autoDue = dirty.filter(isAuto);
  useEffect(() => {
    if (!editable || !autoDue.length) return undefined;
    const now = hashOf(String(src || ""));
    if (lastAutoHash.current === now) return undefined;
    clearTimeout(autoTimer.current);
    autoTimer.current = setTimeout(() => {
      lastAutoHash.current = now;
      send(autoDue);
    }, AUTO_QUIET_MS);
    return () => clearTimeout(autoTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editable, src, autoDue.join(",")]);
  // An id makes the thread survive edits above it; without one, fall back to the source line so an
  // unnamed thread still works (it just re-anchors if the document shifts).
  const id = attrs.id || `line-${line || 0}`;
  // Legacy replies from the sidecar, still shown so nothing written before this is lost.
  const stored = threads[id] || [];
  // Replies written into the document render as children (the `reply` block below), so all this
  // needs is the count for the badge.
  const inlineCount = (String(src || "").match(/^\s*:{3,}\s*reply\b/gm) || []).length;
  const total = stored.length + inlineCount;

  // RFC-071 — WHAT IS NEW IN HERE. The badge used to show the total, which is a number you have
  // already read; this shows what arrived since you last opened the thread, so a document full of
  // settled conversations stays quiet and the one somebody just answered does not.
  const stamps = replyStamps(src, stored);
  const [seen, setSeen] = useState(() => readSeen(window.localStorage, docPath, id));
  const unseen = unseenCount(stamps, seen);
  const markSeen = () => {
    const now = newestOf(stamps) || Date.now();
    writeSeen(window.localStorage, docPath, id, now);
    setSeen(now);
  };

  const fresh = useRef(claimThread(id));
  const [open, setOpen] = useState(fresh.current);
  const [text, setText] = useState("");
  // Same mic the chat input has — replies are spoken as much as typed, so the box you reply in
  // must listen too. Finals append to the draft; posting or cancelling stops the recognition.
  const mic = useDictation((fin) => setText((cur) => (cur ? `${cur} ` : "") + fin));

  // A document we can write to gets the reply IN the document; anything else falls back to the store.
  const canWrite = editable || storeWritable;
  const post = () => {
    const body = text.trim();
    if (!body) return;
    mic.stop();
    if (editable && appendInside) appendInside(line, `:::reply{author=you ts=${Date.now()}}\n${body}\n:::`);
    else addReply(id, body);
    setText("");
    // RFC-071 — A REPLY MAKES THIS THREAD'S MEMBERS BEHIND; it does not tell them here. His
    // ruling, 2026-10-19: *"let's get dirty."* The reply changes the thread's body, so its hash
    // moves and everybody on the thread is behind on it — the auto ones are told once it settles,
    // and the rest are a chip in the pinned row at the top of the document, under this thread's
    // own pill. That is the same rule the document follows, and it is why a member can be on both
    // levels and hear about only one: *"I might have you subscribed on multiple levels, but only
    // want to send you the thread update."*
    // Your own reply is not news to you.
    markSeen();
    // Posting is finishing. Leaving the box open made you press Cancel to put down something you'd
    // already said — the replies stay visible either way, and the 💬 reopens it for the next one.
    setOpen(false);
  };

  return (
    <div
      className={`md-thread${total ? " md-thread--has" : ""}${open ? " md-thread--open" : ""}${
        unseen > 0 ? " md-thread--new" : ""
      }`}
    >
      {/* RFC-071 — WHO IS IN THIS CONVERSATION, on the thread ITSELF, and MANAGEABLE there. It
          was a caption first: visible (his earlier report) but with its only controls off in the
          right-click menu, where removing one person was impossible — *"you can't remove one person
          from the thread."* It is now the document block's own chip row, the same control reused,
          so add and drop work here exactly as they do up there. */}
      {showMembers && (
        <div className="md-members md-members--thread">
          <span className="md-members__kind">in this thread</span>
          {own.map((m) => (
            <span className="md-members__chip" key={m} title={`${m} hears every reply in this thread`}>
              {m}
              {editable && (
                <button
                  type="button"
                  className="md-members__drop"
                  title={`take ${m} out of this thread`}
                  onClick={() => writeMembers(own.filter((x) => x !== m))}
                >
                  ×
                </button>
              )}
            </span>
          ))}
          {/* No own list means the document's people are the audience — said in words rather than
              by drawing their chips here, which is the row he told me to stop rendering. */}
          {!own.length && <span className="md-members__none">nobody on this thread yet</span>}
          {editable && (
            <MemberAdd already={own} onPick={(code) => writeMembers([...own, code])} title="add a member to this thread" />
          )}
          {/* The same gear the document's membership carries, for THIS conversation's auto list —
              two levels, two lists, because "every version of the plan" and "when this argument
              moves" are different subscriptions. */}
          {editable && !!own.length && (
            <button
              type="button"
              className="md-members__gear"
              title={`who hears about ${attrs.id ? `thread ${attrs.id}` : "this thread"} automatically`}
              onClick={() => setSettings((o) => !o)}
            >
              ⚙
            </button>
          )}
          {editable && settings && (
            <MemberSettings
              who={own}
              dirty={dirty}
              isAuto={isAuto}
              setAuto={setAuto}
              onClose={() => setSettings(false)}
              title={`who hears about ${attrs.id ? `thread ${attrs.id}` : "this thread"} automatically`}
            />
          )}
        </div>
      )}
      <div className="md-thread__body">
        <InThreadProvider>{children}</InThreadProvider>
      </div>
      <button
        type="button"
        className="md-thread__toggle"
        title={canWrite ? "Reply on this" : "Read-only here — this surface has nothing to save to"}
        onClick={() => {
          if (!open) markSeen();
          setOpen((o) => !o);
        }}
      >
        💬{total ? <span className="md-thread__count">{total}</span> : null}
        {unseen > 0 && (
          <span className="md-thread__new" title={`${unseen} new since you last opened this thread`}>
            {unseen}
          </span>
        )}
      </button>
      {(open || stored.length > 0) && (
        <div className="md-thread__replies">
                    {/* A NAMED agent wears its own name here too, so a stored reply and an inline `:::reply`
              from the same author read as the same person. But this path does NOT fail closed the
              way the inline one does, and the difference is deliberate: this store is written only
              by the human's own reply box, so a reply with NO author is legacy data of his — fail
              closed here and his old comments would silently relabel themselves as an agent. Agents
              write inline blocks, and that is where an unknown value must not become him. */}
          {stored.map((r, i) => (
            <div className={`md-thread__reply${r.author && r.author !== "you" ? " md-thread__reply--agent" : ""}`} key={i}>
              <span className="md-thread__badge">
                {!r.author || r.author === "you" ? "reply" : r.author === "agent" ? "agent" : r.author}
              </span>
              <span className="md-thread__text">{r.text}</span>
              {storeWritable && (
                <button
                  type="button"
                  className="md-thread__del"
                  title="Delete reply"
                  onClick={() => removeReply(id, i)}
                >
                  ×
                </button>
              )}
            </div>
          ))}
          {open && canWrite && (
            <div className="md-thread__form">
              {/* While the mic listens the words appear HERE as you speak, then commit into the
                  box as they finalize — the line itself is the recording indicator. */}
              {mic.listening && (
                <div className="md-thread__interim">
                  <span className="md-thread__interim-dot" />
                  {mic.interim || "listening…"}
                </div>
              )}
              <textarea
                className="md-thread__input"
                rows={2}
                // Opening a reply box IS the intent to type in it — landing the cursor anywhere else
                // makes you click twice to say one thing.
                autoFocus
                placeholder="reply on this…"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) post();
                }}
              />
              <div className="md-thread__actions">
                <button type="button" className="md-thread__post" disabled={!text.trim()} onClick={post}>
                  Post
                </button>
                <button type="button" className="md-thread__cancel" onClick={() => { mic.stop(); setOpen(false); setText(""); }}>
                  Cancel
                </button>
                {mic.supported && (
                  <button
                    type="button"
                    className={`md-thread__mic${mic.listening ? " md-thread__mic--on" : ""}`}
                    title={mic.listening ? "Stop listening" : "Dictate — speech goes into the reply"}
                    onClick={mic.toggle}
                  >
                    🎙
                  </button>
                )}
              </div>
            </div>
          )}
          {open && !canWrite && (
            <div className="md-thread__note">Replies need a document on disk — this surface has nothing to save to.</div>
          )}
          {error ? <div className="md-thread__note md-thread__note--bad">{error}</div> : null}
        </div>
      )}
    </div>
  );
};

// `:::reply{author=you|<projectCode>|agent ts=…}` — one reply, written in the document. It renders
// the same row a stored reply does, so inline and legacy replies are indistinguishable to read. An
// agent writes one by adding this block inside the thread; nothing else is needed.
//
// FAIL CLOSED — this test used to be `attrs.author === "agent"`, so anything that was NOT that exact
// string fell through to the HUMAN look. The fallback pointed the wrong way: a typo, a missing
// attribute, or an agent naming itself (`author=systemlynx`) rendered as the human's own reply,
// wearing his badge, in his own document. It happened live twice in one evening — buAPI reached for
// its project name and systemlynx did the same.
//
// Now only the literal `you` is the human. Everything else is an agent, and the value IS the badge —
// so `author=BUApp` reads "BUApp", which is what identity-is-your-project means everywhere else in
// the system. An unknown or garbled value still cannot impersonate him; the worst it can do is wear
// a strange name. Impersonation is structurally impossible instead of a convention to remember.
export const Reply = ({ attrs = {}, line, children }) => {
  const { editable, removeBlock } = useMarkdownWrite();
  const author = String(attrs.author || "").trim();
  const human = author === "you";
  const agent = !human;
  // A named agent wears its own name; a bare `author=agent` (or nothing at all) stays generic.
  const badge = human ? "reply" : author && author !== "agent" ? author : "agent";
  return (
    <div className={`md-thread__reply md-thread__reply--inline${agent ? " md-thread__reply--agent" : ""}`}>
      <span className="md-thread__badge">{badge}</span>
      <span className="md-thread__text">{children}</span>
      {editable && removeBlock ? (
        <button type="button" className="md-thread__del" title="Delete reply" onClick={() => removeBlock(line)}>
          ×
        </button>
      ) : null}
    </div>
  );
};

export default Thread;
