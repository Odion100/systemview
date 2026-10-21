import React from "react";
import { useDocMembers } from "../context";
import useDecisionTell from "../useDecisionTell";
import { taskLabelOf } from "../decisions";

// A TICKED TASK IS A DECISION, and this component exists so it can say so.
//
// WHY IT IS A COMPONENT AT ALL. The checkbox used to be an inline `<li>` in `Markdown.js`'s
// component map, and the telling cannot live there: `Markdown` is the component that PROVIDES the
// member context, so it cannot consume its own provider. Everything rendered by the map is inside
// that provider, which makes this the first place that can both see the members and know which
// line was toggled.
//
// ITS IDENTITY HAS TO BE STABLE. React treats a new function as a new component TYPE, so a
// renderer rebuilt per keystroke unmounts and remounts the whole subtree mid-edit — the exact
// reason `Markdown` keeps its callbacks behind a ref. Declaring this at module scope is what keeps
// that true now that there is a component here instead of an inline arrow.
const TaskItem = ({ line, checked, editable, onToggle, children }) => {
  const { source = "" } = useDocMembers() || {};
  const tell = useDecisionTell();

  const press = () => {
    // THE WRITE FIRST. `onToggle` rewrites the document; the announcement is bookkeeping and must
    // never be able to cost the tick — same ordering as a verdict press.
    onToggle(line);
    // The label is read BEFORE the toggle lands in state but from the source as it stands, which
    // is the version being changed — the sentence describes what was ticked, not what it became.
    tell("task", { label: taskLabelOf(source, line) }, !checked);
  };

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
