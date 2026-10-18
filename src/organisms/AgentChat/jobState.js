// THE WORD ON A JOB CARD, AND WHO SAID IT.
//
// Three different facts used to fight over one chip, and only one of them had an author:
//
//   DERIVED   `running` · `finished` · `finished · landed` — read off the run's own list and the
//             lanes it cut. Nobody said it; the disk implies it.
//   AGENT     `rec.status` — what the agent working the run said about it in its own words.
//   HIS MARK  `rec.state` — *"I have been through this myself"* (his ask, 2026-10-18: *"I want the
//             display to also be a selector… I wanna just know that I've gone through it. And then
//             I'll delete it."*)
//
// His mark WINS the chip when it exists, because it is the only one of the three that records a
// human decision — and the derived word is never lost, it rides along behind it. The mark changes
// nothing about cleanup: deleting the row is still his press, and that rule is deliberately
// untouched (his words: *"I'm not changing the rules about cleaning up after."*)
export const DERIVED = (complete, allLanded, agentStatus) =>
  complete ? (allLanded ? "finished · landed" : "finished") : agentStatus || "running";

// What the chip shows: his mark if he set one, otherwise the derived word. `behind` is the derived
// word, kept for the title so pressing the chip never hides what the disk says.
export const chipFor = (rec, { complete, allLanded } = {}) => {
  const derived = DERIVED(complete, allLanded, rec && rec.status);
  const mark = rec && typeof rec.state === "string" ? rec.state.trim() : "";
  return mark
    ? { label: mark, mine: true, behind: derived, title: `you marked this "${mark}" — the run itself reads ${derived}` }
    : { label: derived, mine: false, behind: "", title: `${derived} — press to mark it yours` };
};

// The menu's rows: the offered vocabulary, plus a clear when a mark is already set. A vocabulary
// the human cannot extend is one he works around, so the shell's list is a STARTING POINT and the
// clear row is always last — the retraction has to be as reachable as the mark.
export const menuFor = (states, current) => {
  const vocab = (Array.isArray(states) && states.length ? states : ["walked it", "approved"]).filter(
    (s) => s && s !== current
  );
  return current ? [...vocab, { clear: true, label: "clear my mark" }] : vocab;
};
