// THE DELETE IS HIS, FOR EVERY RUN — not just lanes (his ask, 2026-11-07: *"I need to be able to
// delete anything… when it comes to worklist, like jobs, or list or whatever it is — the ability
// to, if it's not done, then it just gives me a warning."* And the motive, in his words: *"they're
// nudging you — I want to stop myself."*). A run could only be closed from the agent side; the
// lane rows had a 🗑 and the job and skill cards had only a ×, which clears the VIEW and leaves
// the record nudging.
//
// ONE DECISION, ONE PLACE — the same shape as laneConfirm(): the row's control and its confirm
// must never answer differently about the same run, so what the press does is decided here and
// tested here, not in the markup.
//
// A DONE RUN DELETES PLAIN. Its ending is already on the record (every item done, or abandoned
// WITH its account attached — the same two endings the × already recognises), so there is nothing
// left to warn about. A run that is NOT done warns first: the press arms into a confirm — the
// two-step the lane row and the commit block already wear — and the text says what dies: the
// record, and with it the nudging, because the nudge chases run files and a file that is gone is
// a run nobody chases.
export const runDelete = ({ done = 0, total = 0, abandoned = false, accounted = false } = {}) => {
  const ended = (total > 0 && done === total) || (abandoned && accounted);
  if (ended) return { plain: true, warn: false, text: "" };
  const left = Math.max(0, total - done);
  return {
    plain: false,
    warn: true,
    text: abandoned
      ? "declared abandoned but no account is attached — the record is the only trace of where it died. Delete anyway?"
      : `not done — ${left} of ${total} still open. The record and its nudging die with it. Delete anyway?`,
  };
};

export default runDelete;
