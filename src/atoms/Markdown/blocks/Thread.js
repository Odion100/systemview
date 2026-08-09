import React, { useRef, useState } from "react";
import { useCommentsContext, InThreadProvider, useMarkdownWrite } from "../context";
import { claimThread } from "../threadFocus";
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
  const { editable, appendInside } = useMarkdownWrite();
  // An id makes the thread survive edits above it; without one, fall back to the source line so an
  // unnamed thread still works (it just re-anchors if the document shifts).
  const id = attrs.id || `line-${line || 0}`;
  // Legacy replies from the sidecar, still shown so nothing written before this is lost.
  const stored = threads[id] || [];
  // Replies written into the document render as children (the `reply` block below), so all this
  // needs is the count for the badge.
  const inlineCount = (String(src || "").match(/^\s*:{3,}\s*reply\b/gm) || []).length;
  const total = stored.length + inlineCount;

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
    // Posting is finishing. Leaving the box open made you press Cancel to put down something you'd
    // already said — the replies stay visible either way, and the 💬 reopens it for the next one.
    setOpen(false);
  };

  return (
    <div className={`md-thread${total ? " md-thread--has" : ""}${open ? " md-thread--open" : ""}`}>
      <div className="md-thread__body">
        <InThreadProvider>{children}</InThreadProvider>
      </div>
      <button
        type="button"
        className="md-thread__toggle"
        title={canWrite ? "Reply on this" : "Read-only here — this surface has nothing to save to"}
        onClick={() => setOpen((o) => !o)}
      >
        💬{total ? <span className="md-thread__count">{total}</span> : null}
      </button>
      {(open || stored.length > 0) && (
        <div className="md-thread__replies">
          {stored.map((r, i) => (
            <div className={`md-thread__reply${r.author === "agent" ? " md-thread__reply--agent" : ""}`} key={i}>
              <span className="md-thread__badge">{r.author === "agent" ? "agent" : "reply"}</span>
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

// `:::reply{author=you|agent ts=…}` — one reply, written in the document. It renders the same row a
// stored reply does, so inline and legacy replies are indistinguishable to read. An agent writes one
// by adding this block inside the thread; nothing else is needed.
export const Reply = ({ attrs = {}, line, children }) => {
  const { editable, removeBlock } = useMarkdownWrite();
  const agent = attrs.author === "agent";
  return (
    <div className={`md-thread__reply md-thread__reply--inline${agent ? " md-thread__reply--agent" : ""}`}>
      <span className="md-thread__badge">{agent ? "agent" : "reply"}</span>
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
