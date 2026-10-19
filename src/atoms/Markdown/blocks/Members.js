import React, { useContext, useEffect, useRef, useState } from "react";
import ServiceContext from "../../../ServiceContext";
import { useMarkdownWrite, useDocMembers } from "../context";
import { hashOf, splitWho } from "../docMembers";
import useMembership from "../useMembership";
import MemberAdd from "./MemberAdd";
import MemberSettings from "./MemberSettings";

// RFC-071 — `::members{who=buapi|systemlynx}` — WHO IS ON THIS DOCUMENT.
//
// His design, 2026-10-19: *"maybe I just need a document, use the threads in the document, have a
// conversation about the document. That's the meeting."* So there is no meeting object — there is a
// document, and people on it. This block is the membership, and it lives IN the markdown for the
// same reason a thread's replies do: the document says who is on it, it travels with the file, you
// see it change in a diff, and there is no second store to consult.
//
// It writes through `setAttr`, exactly as `:::approval` writes a verdict — so a document open in
// the centre takes the press today, and a read-only surface (the chat's renderer, a help topic)
// renders the chips and says why it cannot be edited rather than pretending to save.
//
// THE DELIVERY HALF IS NOT HERE, and that is deliberate (his t1 on the RFC): an update reaches an
// agent through the HOOK system — one standing hook per agent on an ambient `document.updated`,
// matching `members contains me`. This block decides who matches; it never delivers anything.
// How long a document has to sit still before an `auto=true` send goes out. Well past typing
// speed, because the cost of being slightly late is nothing and the cost of being early is a turn
// somebody pays for a half-written sentence.
export const AUTO_QUIET_MS = 20000;

// Re-exported where it has always been imported from; the definition moved to ../docMembers, which
// is where the thread's row and the pinned row read it too.
export { splitWho };

const Members = ({ attrs = {}, line }) => {
  const { setAttr } = useMarkdownWrite();
  // The document it is on, and which file that is — both from scope, so no surface has to remember
  // to configure this block.
  const { source = "" } = useDocMembers() || {};
  const { connectedServices = [] } = useContext(ServiceContext);
  const [local, setLocal] = useState(null);
  const [settings, setSettings] = useState(false); // the gear: who hears automatically

  const who = local != null ? local : splitWho(attrs.who);
  // WHO IS BEHIND AND THE PRESS THAT TELLS THEM is shared with the pinned update row — one
  // definition in useMembership, because two controls now write this same `sent=` map.
  const { editable, dirty, isAuto, send, refusal, setRefusal, setAuto } = useMembership({
    who,
    sent: attrs.sent,
    auto: attrs.auto,
    line,
  });
  // A member names a ROOM — a project code — because that is what delivery already takes. The
  // registry is the one list that decides, the same rule the commit block's project follows.
  const known = (connectedServices || [])
    .map((s) => s.projectCode)
    .filter((p, i, arr) => p && arr.indexOf(p) === i);

  const write = (next) => {
    setLocal(next);
    setAttr(line, "who", next.length ? next.join("|") : null);
  };

  // AUTO — the opt-in, and the last thing built on purpose. A member marked auto is told without
  // him pressing anything once the document settles, which is right for a plan being edited live in
  // front of three agents and wrong as a default, because a change that interrupts costs somebody a
  // turn they did not choose to spend.
  //
  // THE TIMER LIVES HERE, not in the hook: the block is rendered once per document, so there is
  // exactly one of these however many other controls read the same membership. It waits well past
  // typing speed — a send per keystroke is the expense this whole design exists to avoid.
  const autoTimer = useRef(null);
  const lastAutoHash = useRef("");
  const autoDue = dirty.filter(isAuto);
  useEffect(() => {
    if (!editable || !autoDue.length) return undefined;
    const now = hashOf(source);
    if (lastAutoHash.current === now) return undefined; // this version already went out
    clearTimeout(autoTimer.current);
    autoTimer.current = setTimeout(() => {
      lastAutoHash.current = now;
      // ONLY THE AUTO ONES. A member who is behind and not auto stays behind until he presses —
      // that is the whole point of making it per member.
      send(autoDue);
    }, AUTO_QUIET_MS);
    return () => clearTimeout(autoTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editable, source, autoDue.join(",")]);

  const add = (code) => {
    const name = String(code || "").trim();
    if (!name) return;
    // A CHIP POINTING AT NOBODY IS WORSE THAN NO CHIP — an update aimed at a room that does not
    // exist is delivered to nobody and still looks sent. Refuse at the press, naming what is real.
    if (known.length && !known.includes(name)) {
      setRefusal(`no connected project "${name}" — ${known.join(", ")}`);
      return;
    }
    setRefusal("");
    if (!who.includes(name)) write([...who, name]);
  };

  return (
    <div className="md-members">
      <button
        type="button"
        className="md-members__kind md-members__kind--press"
        title="who is on this document"
        onClick={() => editable && setSettings((o) => !o)}
      >
        members
      </button>
      {who.map((m) => (
        <span
          className={`md-members__chip${dirty.includes(m) ? " md-members__chip--dirty" : ""}`}
          key={m}
          title={
            dirty.includes(m)
              ? `${m} has not been told about this version`
              : `${m} is up to date with this document`
          }
          // A CHIP NEVER SENDS — the send lives in the pinned row at the top of the document, and
          // it is the only one in the surface. A chip here opens the settings, which is what this
          // membership is now FOR: who is on it, and who hears without being told to.
          onClick={() => editable && setSettings(true)}
        >
          {m}
          {dirty.includes(m) && <span className="md-members__mark">•</span>}
          {isAuto(m) && (
            <span className="md-members__auto-mark" title={`${m} is told automatically`}>
              a
            </span>
          )}
          {editable && (
            <button
              type="button"
              className="md-members__drop"
              title={`take ${m} off this document`}
              onClick={() => write(who.filter((x) => x !== m))}
            >
              ×
            </button>
          )}
        </span>
      ))}
      {!who.length && <span className="md-members__none">nobody yet</span>}
      {/* The `+` is the SHARED control (MemberAdd) — the same one a thread's row uses, because the
          thread's membership has to be managed the same way this is. */}
      {editable && <MemberAdd already={who} onPick={add} title="add a member" />}
      {/* THE GEAR, NOT A SEND. His, 2026-10-19: *"we don't even need a send update button next to
          the members… it's just the settings, like a setting icon, so you can decide which members
          to make auto."* Every pending update is pressed in the pinned row at the top of the
          document — one place, both levels, reachable from anywhere in the file. */}
      {editable && (
        <button
          type="button"
          className="md-members__gear"
          title="who hears about this document automatically"
          onClick={() => setSettings((o) => !o)}
        >
          ⚙
        </button>
      )}
      {editable && settings && (
        <MemberSettings
          who={who}
          dirty={dirty}
          isAuto={isAuto}
          setAuto={setAuto}
          onClose={() => setSettings(false)}
          title="who hears about this document automatically"
        />
      )}
      {editable && !!who.length && !dirty.length && (
        <span className="md-members__none" title="everybody on this document has been told about this version">
          all current
        </span>
      )}
      {!editable && (
        <span className="md-members__ro" title="this surface has nothing to save to">
          read-only here
        </span>
      )}
      {!!refusal && <span className="md-members__refusal">{refusal}</span>}
    </div>
  );
};

export default Members;
