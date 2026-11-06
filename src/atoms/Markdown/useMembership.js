import { useState } from "react";
import { useMarkdownWrite } from "./context";
import { splitWho } from "./docMembers";

// WHO IS TOLD AUTOMATICALLY — the one thing membership still decides in the window.
//
// This hook used to be the window's own delivery machinery: a `sent=` hash map, a dirty
// computation over the prose, and a send that announced document EDITS. That channel is gone (his
// ruling, 2026-11-06): *"general text in the document should send no updates, period point
// blank."* Blocks are the only senders, the ENGINE delivers their fires, and the members line
// governs WHEN — `auto=` members the moment a block fires, plain members on his press through the
// pinned row. So what remains here is exactly the part the engine reads and cannot write for him:
// the per-member auto toggle.
//
// AUTO IS PER MEMBER (his correction): the attribute is a list of who is told automatically, not
// a switch on the document. The plain member is the only human-gated path.
export default function useMembership({ auto = "", line = 0 } = {}) {
  const { editable, setAttr } = useMarkdownWrite();
  const [localAuto, setLocalAuto] = useState(null);
  const [refusal, setRefusal] = useState("");

  const autoList = localAuto != null ? localAuto : splitWho(auto);
  const isAuto = (m) => autoList.includes(m);

  const setAuto = (m) => {
    const next = isAuto(m) ? autoList.filter((x) => x !== m) : [...autoList, m];
    setLocalAuto(next);
    if (line) setAttr(line, "auto", next.length ? next.join("|") : null);
  };

  return { editable, autoList, isAuto, setAuto, refusal, setRefusal };
}
