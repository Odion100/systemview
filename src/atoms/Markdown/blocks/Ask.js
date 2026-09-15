import React from "react";

// `::ask[the one thing I need from you]` — THE ASK, MADE VISIBLE.
//
// His ask, in his words: *"sometimes it's not even about some sort of interaction. It's about me
// being able to see the main question you have."* And then, correctly, that it is not always a
// question — *"what if it's: hey, you need a refresh and you need to do this?"* That is the case
// this was really born from: "restart the shell" buried at the end of four paragraphs, three times
// in one evening, until he said it was getting lost in the long-ass shit.
//
// So it is an ASK, not a question: the one thing needed from the human, whichever kind it is.
//
// `::question` already exists and is a different instrument: it offers options, writes `answer=`
// back into the document, and is how a decision gets recorded. This one records nothing and offers
// nothing. It exists because a question buried in the fourth paragraph of a long reply is a
// question that does not get answered — it gets scrolled past, and then the work continues on a
// guess. One band, unmissable, so the thing being asked is the thing you see.
//
// DELIBERATELY NOT ANSWERABLE. The moment it has a button it becomes a decision record, and there
// is already one of those. Its whole job is to be seen.
//
//   ::ask[Should the corpus point at agents/ or docs/?]
//   ::ask[Which of these do you want first?]{why="both touch the same file, so the order matters"}
//
// `why=` is the one-line reason it is being asked — what the answer changes. Optional, because
// most questions carry their own context, and a forced field just gets filled with noise.
export default function Ask({ attrs = {}, label, children }) {
  const question = String(label || "").trim();
  const why = attrs.why ? String(attrs.why).trim() : "";
  // THE MARK IS INFERRED, so there is no attribute to remember and no way to get it wrong: a
  // question gets "?", anything else is a thing to DO and gets "→". "Restart the shell" and
  // "which folder?" are the same kind of block — both are the one thing needed from the human —
  // but they do not read the same, and a question mark on an instruction reads as hedging.
  const asking = /\?\s*$/.test(question);
  return (
    <div className={`md-ask${asking ? "" : " md-ask--do"}`} role="note">
      <span className="md-ask__mark" aria-hidden="true">
        {asking ? "?" : "→"}
      </span>
      <div className="md-ask__body">
        <div className="md-ask__q">{question || children}</div>
        {why ? <div className="md-ask__why">{why}</div> : null}
        {question && children ? <div className="md-ask__more">{children}</div> : null}
      </div>
    </div>
  );
}
