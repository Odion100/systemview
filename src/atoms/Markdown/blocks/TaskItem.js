import React from "react";

// A TICKED TASK IS NOT A DECISION, AND THIS COMPONENT IS WHERE THAT WAS DECIDED.
//
// It used to announce every tick to the document's members. It does not any more: ticking a box is
// keeping your place in a list, and the reasoning lives next to the registry it came out of
// (`decisions.js`, `DECIDING`). The write still happens — the box ticks, the document saves — and
// nobody is woken for it.
//
// WHY IT IS STILL A COMPONENT. It was extracted so the telling could see the document's members —
// `Markdown` provides that context and cannot consume its own provider — and with the telling gone
// that reason is gone with it. What keeps it here is the rule below: it is a stable module-scope
// type rather than an arrow rebuilt inside a render, and the markup is a box, a state class and a
// label, which reads better out here than inlined in a component map.
//
// ITS IDENTITY HAS TO BE STABLE. React treats a new function as a new component TYPE, so a
// renderer rebuilt per keystroke unmounts and remounts the whole subtree mid-edit — the exact
// reason `Markdown` keeps its callbacks behind a ref. Declaring this at module scope is what keeps
// that true now that there is a component here instead of an inline arrow.
const TaskItem = ({ line, checked, editable, onToggle, children }) => {
  const press = () => onToggle(line);

  return (
    <li className={`md-task${checked ? " md-task--done" : ""}${editable ? " md-task--live" : ""}`}>
      <input
        type="checkbox"
        className="md-task__box"
        checked={checked}
        disabled={!editable}
        onChange={press}
        title={editable ? "Toggling this edits the document" : "Read-only here — this surface has nothing to save to"}
      />
      <span className="md-task__text">{children}</span>
    </li>
  );
};

export default TaskItem;
