import React, { useContext, useState } from "react";
import ServiceContext from "../../../ServiceContext";

// RFC-071 — THE `+` THAT ADDS A MEMBER, shared by the document's `::members` block and a thread's
// own row. His, 2026-10-19: *"well, now all the threads have their own members, right? So why the
// hell don't they have the same button functionality?"* The answer has to be ONE control used
// twice — two that merely look alike is two that drift, and the thread's would be the one left
// behind, exactly as it already was.
//
// IT PICKS; IT NEVER ASKS YOU TO TYPE (*"and better not asking me to utter"*). A member names a
// ROOM — a connected project code — so the options ARE the registry minus whoever is already on:
// a chip that points at nothing would be delivered to nobody and still look sent, and a press that
// re-adds somebody already there does nothing.
const MemberAdd = ({ already = [], onPick, title = "add a member" }) => {
  const { connectedServices = [] } = useContext(ServiceContext);
  const [open, setOpen] = useState(false);
  const codes = [...new Set((connectedServices || []).map((s) => s.projectCode).filter(Boolean))]
    .filter((c) => !already.includes(c))
    .sort();

  if (!open)
    return (
      <button type="button" className="md-members__add" title={title} onClick={() => setOpen(true)}>
        +
      </button>
    );
  return (
    <select
      className="md-members__pick"
      autoFocus
      defaultValue=""
      onBlur={() => setOpen(false)}
      onChange={(e) => {
        setOpen(false);
        if (e.target.value) onPick(e.target.value);
      }}
    >
      <option value="" disabled>
        add…
      </option>
      {codes.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </select>
  );
};

export default MemberAdd;
