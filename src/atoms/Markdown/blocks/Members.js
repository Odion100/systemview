import React, { useContext, useState } from "react";
import ServiceContext from "../../../ServiceContext";
import { useMarkdownWrite, useDocMembers } from "../context";
import { splitWho } from "../docMembers";
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
  const { connectedServices = [] } = useContext(ServiceContext);
  const [local, setLocal] = useState(null);
  const [settings, setSettings] = useState(false); // the gear: who hears automatically

  const who = local != null ? local : splitWho(attrs.who);
  // MEMBERSHIP AND ITS AUTO LIST — the policy the ENGINE reads. Who is behind, and the press that
  // tells them, both left this block: delivery belongs to the engine's gate, and the pinned row is
  // the one release in the surface.
  const { editable, isAuto, refusal, setRefusal, setAuto } = useMembership({
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

  // AUTO — the opt-in. A member marked auto is told the moment a block FIRES — the engine reads
  // this list off the line and delivers; nothing in the window sends. There is no timer any more
  // because there is nothing to settle: prose edits send no updates, period, so the only moments
  // that reach anybody are decisions, and those are events, not versions.
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
          className="md-members__chip"
          key={m}
          title={`${m} is on this document`}
          // A CHIP NEVER SENDS — what is waiting on his press lives in the pinned row at the top
          // of the document, read off the engine's held lane. A chip here opens the settings,
          // which is what this membership is FOR: who is on it, and who hears without being told.
          onClick={() => editable && setSettings(true)}
        >
          {m}
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
          isAuto={isAuto}
          setAuto={setAuto}
          onClose={() => setSettings(false)}
          title="who hears about this document automatically"
        />
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
