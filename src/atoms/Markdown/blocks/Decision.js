import React from "react";
import { useMarkdownWrite } from "../context";
import { normalizeState, nextState, names } from "../decisions";

// `::decision[the fork]{id=d3 state=decided chose="…" over="…" owner=you by=… at=… ratify=…}`
//
// A DECISION IS A RECORD. His, 2026-11-12: *"it's not a matter of approval… it's a matter of
// record. In the future it will matter and of course it's different from approval because making a
// decision doesn't mean you have the approval. And when you think about it in an organization, it's
// different."* He is the only person using this today; the record is for when he is not.
//
// SO THIS IS NOT `::approval` WEARING MORE ATTRIBUTES, and the difference is load-bearing enough to
// state in the component that renders it:
//
//   an APPROVAL is one party SANCTIONING something. It gates the document, it is binary, and the
//   verdict is the whole of it.
//
//   a DECISION is one party CHOOSING. It gates nothing, it is n-way, and whether anybody ever
//   ratified it is a SEPARATE fact that is usually absent. `ratify=` is where that lives, and it is
//   opt-in precisely so that the common case — a decision nobody has to sign — is not painted as
//   pending something.
//
// WHAT IT RENDERS THAT PROSE CANNOT. The question stays the question after the answer lands; the
// choice sits beside what it was chosen OVER; and the state is addressable, countable and
// pressable. The rejected road is the half that disappears when a section gets rewritten — and the
// first thing anybody asks about a decision they did not sit in on.
//
// THE PRESS IS DELIBERATELY SMALL. It moves the state and stamps the clock; it does not offer an
// options picker. He speaks his decisions and they get written down — a widget for choosing would
// be modelling a ceremony that does not happen, and a decision recorded with nothing chosen says so
// out loud rather than pretending the fork closed cleanly.
const Decision = ({ attrs = {}, label = "", line, children }) => {
  const { editable, setAttr } = useMarkdownWrite();
  const state = normalizeState(attrs.state);
  const id = attrs.id || "";
  const chose = String(attrs.chose || "").trim();
  const over = names(attrs.over);
  const owner = names(attrs.owner);
  const by = names(attrs.by);
  const ratify = names(attrs.ratify);
  const approved = names(attrs.approved);
  const awaiting = state === "decided" && ratify.length > 0 && !ratify.every((r) => approved.includes(r));
  const at = Number(attrs.at) || 0;

  const press = () => {
    if (!editable || !line) return;
    const to = nextState(state);
    // THE CLOCK IS STAMPED WITH THE STATE, in one write — `setAttr` takes an object for exactly
    // this reason. A record whose WHEN is missing is the half of a record that ages badly: "we
    // decided this" is worth little without "and we decided it before X happened".
    setAttr(line, to === "decided" ? { state: to, at: String(Date.now()) } : { state: to });
  };

  const when = at
    ? new Date(at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
    : "";

  return (
    <div className={`md-decision md-decision--${state}${awaiting ? " md-decision--awaiting" : ""}`}>
      <div className="md-decision__head">
        <span className="md-decision__kind">decision</span>
        {id ? <span className="md-decision__id">{id}</span> : null}
        <button
          type="button"
          className={`md-decision__state md-decision__state--${state}`}
          disabled={!editable}
          onClick={press}
          title={
            editable
              ? `${state} — press for ${nextState(state)}`
              : "Read-only here — this surface has nothing to save to"
          }
        >
          {state}
        </button>
        {when ? <span className="md-decision__when">{when}</span> : null}
        {/* WHO OWED IT vs WHO MADE IT. Two names, never folded into one, because a decision taken
            by somebody it was not assigned to is exactly what a record has to be able to show. */}
        {state === "open" && owner.length ? (
          <span className="md-decision__owner">{owner.join(" · ")} to decide</span>
        ) : null}
        {state !== "open" && by.length ? <span className="md-decision__by">by {by.join(" · ")}</span> : null}
      </div>
      {/* THE QUESTION, AND IT STAYS. A record that overwrote its own fork with the answer would
          lose the thing worth keeping — the reader a year out is asking what the choice WAS. */}
      {label ? <div className="md-decision__question">{label}</div> : null}
      {state === "open" ? (
        // AN OPEN DECISION THAT ALREADY CARRIES AN ANSWER IS A REAL STATE, and rendering it as
        // "nothing chosen yet" was this block LYING about its own contents. Found by reading the
        // first live meeting that used it (BUApp, 2026-11-12): a block carrying `chose=`, `over=`
        // and `by=odion` — his answer, written down, not yet closed — drew as though nobody had
        // said anything. That is the worst failure available to a record: contradicting the data
        // it is displaying.
        //
        // It is a legitimate thing to want: an answer captured in the room, left open because it
        // has not been confirmed. So it says both — what was answered, and that it is not closed.
        chose ? (
          <div className="md-decision__outcome md-decision__outcome--unclosed">
            <span className="md-decision__chose">{chose}</span>
            {over.length ? (
              <span className="md-decision__over">
                over {over.map((o) => (
                  <span key={o} className="md-decision__alt">{o}</span>
                ))}
              </span>
            ) : null}
            <span className="md-decision__unclosed">answered, not closed</span>
          </div>
        ) : (
          <div className="md-decision__pending">Open — nothing chosen yet</div>
        )
      ) : (
        <div className="md-decision__outcome">
          {chose ? (
            <span className="md-decision__chose">{chose}</span>
          ) : (
            // UNSAID IS SAID OUT LOUD, the way an unexplained blocked objective is. A reader cannot
            // otherwise tell "nobody wrote what was chosen" from "there was nothing to choose", and
            // those ask for different things.
            <span className="md-decision__chose is-unsaid">decided, and nobody wrote down what was chosen</span>
          )}
          {over.length ? (
            <span className="md-decision__over">
              over {over.map((o) => (
                <span key={o} className="md-decision__alt">{o}</span>
              ))}
            </span>
          ) : null}
        </div>
      )}
      {state === "reversed" ? (
        <div className="md-decision__reversed">Reversed — this is what WAS decided, not what stands</div>
      ) : null}
      {/* HIS DISTINCTION, MADE VISIBLE. Made, and still owed a signature — a state an approval block
          cannot express, because to an approval there is nothing to approve until it is pending. */}
      {awaiting ? (
        <div className="md-decision__ratify">
          Awaiting {ratify.filter((r) => !approved.includes(r)).join(" · ")} — decided, not approved
        </div>
      ) : null}
      {ratify.length && !awaiting && state === "decided" ? (
        <div className="md-decision__ratified">Ratified by {approved.join(" · ")}</div>
      ) : null}
      <div className="md-decision__body">{children}</div>
    </div>
  );
};

export default Decision;
