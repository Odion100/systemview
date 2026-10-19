import { useState } from "react";
import { useMarkdownWrite, useDocMembers } from "./context";
import { dirtyMembers, hashOf, lastReplyOf, parseSent, serializeSent, splitWho, summarize } from "./docMembers";
import { sendUpdateTo } from "./docSend";

// RFC-071 — WHO IS BEHIND, AND THE PRESS THAT TELLS THEM. One definition, used by two controls:
// the `::members` block in the document's head, and the pinned update row that stays in the
// top-right corner however far you have scrolled (his, 2026-10-19: *"I shouldn't have to scroll
// back up to where I added them as a member to send them an update."*).
//
// Two controls writing one attribute is exactly where a second copy of this logic would go wrong,
// which is why there is none: both read the same `sent=` map, both compute dirty the same way, and
// both stamp through the same `setAttr`.
// `body` is WHAT THIS SUBSCRIPTION IS ABOUT — the whole document for the `::members` block, a
// thread's own slice for a thread. Dirtiness is measured against it, so a reply in t1 makes t1's
// members behind and leaves the document's alone. `thread` rides on the event so the landing says
// which conversation moved.
export default function useMembership({ who = [], sent = "", auto = "", line = 0, body = null, thread = "" } = {}) {
  const { editable, setAttr } = useMarkdownWrite();
  const { source = "", docPath = "", projectCode = "" } = useDocMembers() || {};
  const [localSent, setLocalSent] = useState(null);
  const [localAuto, setLocalAuto] = useState(null);
  const [sending, setSending] = useState(false);
  const [refusal, setRefusal] = useState("");

  // MERGED OVER THE ATTRIBUTE, never instead of it. The local map used to replace what the line
  // said, which was safe while one control existed and is a lost stamp now that two do: press the
  // pin for buapi, then the block for systemlynx, and a replacing map would show buapi behind
  // again on a version it has already been told about.
  const sentMap = { ...parseSent(sent), ...(localSent || {}) };
  const subject = body == null ? source : body;
  // WHO HAS NOT HEARD ABOUT THIS VERSION — a member with no hash has never been sent to, which is
  // dirty by construction rather than exempt.
  const dirty = dirtyMembers(who, sentMap, subject);

  const autoList = localAuto != null ? localAuto : splitWho(auto);
  const isAuto = (m) => autoList.includes(m);

  // THE SEND. The window observes the press and the HOST emits the event — nothing here announces
  // anything itself (see files-host.cjs). Afterwards the line records the hash each member was told
  // about, so the next change is dirty for them and nothing else is.
  const send = async (targets) => {
    const to = (targets || []).filter(Boolean);
    if (!to.length) return;
    setSending(true);
    const r = await sendUpdateTo({
      path: docPath,
      project: projectCode,
      members: to,
      thread,
      // A THREAD MEMBER IS IN THE CONVERSATION, so the reply itself is the news. A document member
      // is watching the file, so the shape of the change is.
      summary: thread
        ? `reply in thread ${thread}: ${lastReplyOf(subject)}`
        : summarize(source, to.every((m) => sentMap[m])),
      threads: thread ? 1 : (String(source).match(/^\s*:{3,}\s*thread\b/gm) || []).length,
    });
    setSending(false);
    if (!r.ok) {
      setRefusal(r.error);
      return;
    }
    setRefusal("");
    const stamp = hashOf(subject);
    const next = { ...sentMap };
    to.forEach((m) => {
      next[m] = stamp;
    });
    setLocalSent(next);
    if (line) setAttr(line, "sent", serializeSent(next) || null);
  };

  // AUTO IS PER MEMBER (his correction): the attribute is a list of who is told automatically, not
  // a switch on the document. The TIMER lives on the block, not here — the pin must never start a
  // second one, or a settled document would announce itself twice.
  const setAuto = (m) => {
    const next = isAuto(m) ? autoList.filter((x) => x !== m) : [...autoList, m];
    setLocalAuto(next);
    if (line) setAttr(line, "auto", next.length ? next.join("|") : null);
  };

  return { editable, source: subject, sentMap, dirty, autoList, isAuto, send, sending, refusal, setRefusal, setAuto };
}
