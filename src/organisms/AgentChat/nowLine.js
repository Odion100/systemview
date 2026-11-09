// WHAT A RUN IS DOING RIGHT NOW — the one sentence every row in the drawer leads with, and until
// 2026-11-09 it existed twice: once in the ordinary list row and nowhere at all in the job card,
// which said its name, its state, its count and when it ran, and never the step it was standing on.
// His call: the job rows "could use a redesign to look similar to the regular list… it's really not
// special anymore." Giving the job row that line meant writing the sentence a second time, and two
// copies of one grammar drift — so it is one function, here, and both rows read it.
//
// A LIST OF STEPS HAS THREE STATES AND THE SENTENCE MUST NAME ALL THREE. One is active, so say
// which. All of them done, so say so. None active and not finished — which is its own problem and
// the nudge's whole subject, so it must never read as "working".
//
// THE WORDS ARE THE CALLER'S, because the noun is not the same thing twice: the session's own
// worklist is a PLAN and a job's is a RUN, and he wrote both. The defaults are the list row's,
// unchanged.
export function nowLine(items, { complete = "plan complete", idle = "planning" } = {}) {
  const list = Array.isArray(items) ? items : [];
  const active = list.find((t) => t && t.state === "active");
  if (active && String(active.text || "").trim()) return String(active.text);
  // AN EMPTY LIST IS NOT A FINISHED ONE. `done === length` is true of zero items, which would read
  // "plan complete" at a list nobody has written yet — the most confident possible lie about a run.
  if (!list.length) return idle;
  return list.every((t) => t && t.state === "done") ? complete : idle;
}

export default nowLine;
