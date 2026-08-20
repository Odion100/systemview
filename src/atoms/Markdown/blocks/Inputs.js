import React, { useState } from "react";
import { useMarkdownWrite } from "../context";

// RFC-025 §4.5 — INPUT blocks. The document asks *you* something, and your answer lands back in the
// document (§4.6): the block rewrites its own attribute in the source and the surface saves it. No
// second store, so an answer is durable, shared and committed with the file. Where a surface can't
// save (a help topic is a code constant), the control is disabled and says so.

//   ::question[Do embeds complement panes, or replace them?]{id=fork options=complement|replace}
// An answered question keeps `answer=…` in its own attributes, which is also how an agent reads the
// verdict back off disk.
export const Question = ({ label, attrs = {}, line }) => {
  const { editable, setAttr } = useMarkdownWrite();
  const options = String(attrs.options || "")
    .split("|")
    .map((o) => o.trim())
    .filter(Boolean);
  // AN UNQUOTED ATTRIBUTE VALUE STOPS AT THE FIRST SPACE. `{options=browser key|only}` parses as
  // options="browser" and leaves `key|only` as stray attribute names — so the block rendered one
  // nonsense choice and the writer had no idea why. Stray keys are the tell (a real question carries
  // options/id/answer/ask and nothing else), and saying it beats rendering it wrong.
  const KNOWN = ["options", "id", "answer", "ask"];
  const strays = Object.keys(attrs).filter((k) => !KNOWN.includes(k));
  const unquoted = strays.length > 0 && options.length <= 1;
  // Optimistic local answer so the click feels instant; the file is the durable copy.
  const [local, setLocal] = useState(null);
  const answer = local != null ? local : attrs.answer || "";

  // Clicking the chosen option again CLEARS it. A question you can't un-answer forces a position —
  // and "neither, I disagree with the question" is a real answer that a radio group can't express.
  // Clearing drops the `answer=` attribute entirely, so an unanswered question looks unanswered on
  // disk too, rather than carrying an empty value.
  const pick = (opt) => {
    if (!editable) return;
    const next = answer === opt ? "" : opt;
    setLocal(next);
    setAttr(line, "answer", next || null);
  };

  return (
    <div className={`md-input md-input--question${answer ? " md-input--answered" : ""}`}>
      <div className="md-input__head">
        <span className="md-input__kind">question</span>
        <span className="md-input__label">{label || attrs.ask || "…"}</span>
      </div>
      <div className="md-input__options">
        {unquoted ? (
          <span className="md-input__hint">
            options with spaces must be quoted — <code>{'{options="a b|c d"}'}</code> (unquoted, the
            value stops at the first space: this one parsed as <code>{options[0] || "…"}</code>)
          </span>
        ) : options.length ? (
          options.map((opt) => (
            <button
              key={opt}
              type="button"
              disabled={!editable}
              className={`md-input__opt${answer === opt ? " md-input__opt--on" : ""}`}
              onClick={() => pick(opt)}
              title={
                !editable
                  ? "Read-only here — this surface has nothing to save to"
                  : answer === opt
                  ? "Click again to clear your answer"
                  : "Answering writes into the document"
              }
            >
              <span className="md-input__radio">{answer === opt ? "●" : "○"}</span>
              {opt}
            </button>
          ))
        ) : (
          <span className="md-input__empty">no options — add {`{options=a|b}`}</span>
        )}
        {answer ? <span className="md-input__answered">answered</span> : null}
      </div>
    </div>
  );
};
