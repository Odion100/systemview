import React, { useState } from "react";
import { useDocMembers, useMarkdownWrite } from "../context";
import { normalizeState, ordinalOf } from "../claims";

// `::claim[do this → this should happen]{id=…}` — a statement somebody can check, and the mark.
//
// It reads like the numbered claim it replaces and it can be PRESSED: met, not met, or back to
// unchecked. The press writes the mark into the line — `state= by= at= note=` — exactly as
// `:::approval` takes `verdict=`, so the document carries who checked what and when, and a reader
// opening it sees which claims were verified before they got there. An unmarked claim reads as
// UNCHECKED, visibly; silence is never a pass.
//
// THE STATEMENT RULE IS FOR AN AGENT, NOT FOR HIM. An agent's mark is its word, and the note is the
// only thing the word rests on — `met` says what was done and seen, `unmet` what happens instead —
// so an agent writing `by=<projectCode>` without `note=` has not marked anything (the chapter says
// so; the block cannot police a file write). His press is its own evidence: he looked. So ✓ and ✗
// write at once — `state= by=you at=` — and a note is OPTIONAL afterwards (his: *"I'm never as a
// human going to write what I saw"*). Pressing the state you already gave clears it — "I take that
// back" has to be expressible, or the first click is a trap.
const when = (ms) => {
  if (!ms) return "";
  const d = new Date(Number(ms));
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const Claim = ({ attrs = {}, label, line, children }) => {
  const { editable, setAttr } = useMarkdownWrite();
  const { source = "" } = useDocMembers() || {};
  const [local, setLocal] = useState(null); // { state, by, at, note } after a press, until the save lands
  const [noting, setNoting] = useState(false); // the optional note box, after a press
  const [note, setNote] = useState("");

  const mark = local || {
    state: normalizeState(attrs.state),
    by: attrs.by || "",
    at: Number(attrs.at) || 0,
    note: attrs.note || "",
  };
  const n = ordinalOf(source, line);
  const statement = String(label || "").trim();

  const press = (value) => {
    if (!editable) return;
    setNoting(false);
    if (mark.state === value) {
      // withdraw: the line goes back to unchecked, nothing left behind
      setLocal({ state: "", by: "", at: 0, note: "" });
      setAttr(line, { state: null, by: null, at: null, note: null });
      return;
    }
    const next = { state: value, by: "you", at: Date.now(), note: "" };
    setLocal(next);
    setAttr(line, { state: value, by: "you", at: next.at, note: null });
  };
  const saveNote = () => {
    const text = note.trim();
    if (!text || !mark.state) return;
    setLocal({ ...mark, note: text });
    setNoting(false);
    setAttr(line, { note: text });
  };

  const cls = `md-claim${mark.state ? ` md-claim--${mark.state}` : " md-claim--unchecked"}`;
  const word = mark.state === "met" ? "met" : mark.state === "unmet" ? "not met" : "unchecked";
  const ro = !editable ? "Read-only here — this surface has nothing to save to" : "";

  return (
    <div className={cls} data-claim-id={attrs.id || undefined}>
      <div className="md-claim__row">
        <span className="md-claim__n" aria-hidden="true">{n || "·"}</span>
        {/* The rendered label when there is one — inline code keeps its look — else the flat text. */}
        <span className="md-claim__statement">
          {React.Children.count(children) ? children : statement || <em>an empty claim — the statement goes in the brackets</em>}
        </span>
        <span className={`md-claim__state md-claim__state--${mark.state || "unchecked"}`}>{word}</span>
        <span className="md-claim__actions">
          <button
            type="button"
            className={`md-claim__btn md-claim__btn--met${mark.state === "met" ? " is-on" : ""}`}
            disabled={!editable}
            title={ro || (mark.state === "met" ? "Click again to withdraw" : "Met — writes into the document")}
            onClick={() => press("met")}
          >
            ✓
          </button>
          <button
            type="button"
            className={`md-claim__btn md-claim__btn--unmet${mark.state === "unmet" ? " is-on" : ""}`}
            disabled={!editable}
            title={ro || (mark.state === "unmet" ? "Click again to withdraw" : "Not met — writes into the document")}
            onClick={() => press("unmet")}
          >
            ✗
          </button>
        </span>
      </div>
      {mark.state ? (
        <div className="md-claim__stamp">
          <span className="md-claim__by">{mark.by || "someone"}</span>
          {mark.at ? <span className="md-claim__at">{when(mark.at)}</span> : null}
          {mark.note ? <span className="md-claim__note">{mark.note}</span> : null}
          {editable && !mark.note && !noting ? (
            <button type="button" className="md-claim__btn md-claim__btn--note" onClick={() => { setNote(""); setNoting(true); }}>
              {mark.state === "met" ? "+ what you saw" : "+ what happens instead"}
            </button>
          ) : null}
          {mark.note && editable && !noting ? (
            <button type="button" className="md-claim__btn md-claim__btn--note" title="Change the note" onClick={() => { setNote(mark.note); setNoting(true); }}>
              edit
            </button>
          ) : null}
        </div>
      ) : null}
      {noting ? (
        <div className="md-claim__ask">
          <input
            autoFocus
            className="md-claim__note-input"
            placeholder={mark.state === "met" ? "what you did, and what you saw (optional)" : "what happens instead (optional)"}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveNote();
              if (e.key === "Escape") setNoting(false);
            }}
          />
          <button type="button" className="md-claim__btn md-claim__btn--go" disabled={!note.trim()} onClick={saveNote}>
            save
          </button>
          <button type="button" className="md-claim__btn" onClick={() => setNoting(false)}>
            cancel
          </button>
        </div>
      ) : null}
    </div>
  );
};

export default Claim;
