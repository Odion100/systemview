import React from "react";

// RFC-071 — THE SETTINGS BESIDE A MEMBERSHIP. His, 2026-10-19: *"we don't even need a send update
// button next to the members… what's left is just a settings icon, so you can decide which members
// to make auto on the disparate levels."*
//
// SENDING MOVED OUT. Every pending update is pressed in the pinned row at the top of the document,
// where it is reachable from anywhere — so the control that stays next to the membership is the one
// that is ABOUT the membership: who hears automatically. Per member, and per level: the document's
// auto list and a thread's auto list are different lists, because "tell me every version of the
// plan" and "tell me when this argument moves" are different subscriptions.
const MemberSettings = ({ who = [], dirty = [], isAuto, setAuto, onClose, title = "who hears automatically" }) => (
  <div className="md-members__panel" onClick={(e) => e.stopPropagation()}>
    <div className="md-members__panel-head">{title}</div>
    {!who.length && <div className="md-members__row-state">nobody here yet</div>}
    {who.map((m) => (
      <label key={m} className="md-members__row">
        <span className="md-members__row-name">{m}</span>
        <span className="md-members__row-state">{dirty.includes(m) ? "behind" : "current"}</span>
        <button
          type="button"
          className={`md-members__row-auto${isAuto(m) ? " md-members__row-auto--on" : ""}`}
          title={
            isAuto(m)
              ? `${m} is told automatically once this settles — press to stop that`
              : `tell ${m} automatically whenever this settles`
          }
          onClick={(e) => {
            e.preventDefault();
            setAuto(m);
          }}
        >
          auto
        </button>
      </label>
    ))}
    <div className="md-members__panel-foot">
      <button type="button" className="md-members__cancel" onClick={onClose}>
        done
      </button>
    </div>
  </div>
);

export default MemberSettings;
