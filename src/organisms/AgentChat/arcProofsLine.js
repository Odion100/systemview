// THE DRAWER'S LIGHT PROGRESS — a few words about one arc's proofs run, away from the render.
//
// "In the drawer it would probably just show some light progress, nothing crazy." So: running, a
// count, or nothing at all. Never a failure list — the drawer is 300px wide and the place to read a
// failure is the Proofs tab or the document itself.
//
// THE RULE WITH TEETH IS THE SCOPE CHECK. The bus holds ONE run, whoever started it, so a row that
// reads the bus without asking "was this run mine?" would show ARC-004's numbers on every arc in the
// list. A row speaks about its own arc or it says nothing.

/**
 * `lightLine(busState, arcId)` → `{ text, tone }` or `null` when this row has nothing to say.
 *
 * tone is `running` | `pass` | `fail` | `none` — the class suffix, so the words and their colour are
 * decided in one place and the component only prints them.
 */
export function lightLine(state, arcId) {
  const s = state || {};
  const scope = s.scope || {};
  // NOT MINE — the commonest case in a drawer of several arcs, and the one that has to stay silent.
  if (!arcId || scope.arc !== arcId) return null;
  if (s.running) return { text: "running", tone: "running" };
  const ran = s.ran;
  if (!ran) return null;
  // AN ERROR IS SAID, SHORT. "no services" is the whole useful content; the reason why is in the tab.
  if (ran.error && !((ran.tests || []).length)) return { text: "no specs", tone: "none" };
  const passed = ran.passed || 0;
  const failed = ran.failed || 0;
  if (!passed && !failed) return { text: "no specs", tone: "none" };
  // THE UNBUILT COUNT RIDES ALONG, because a run of four with a fifth that could not be built is not
  // a clean four — and this row is the only thing he may look at.
  const unbuilt = (ran.problems || []).length;
  const tail = unbuilt ? ` · ${unbuilt} unbuilt` : "";
  if (failed) return { text: `${failed} failed${tail}`, tone: "fail" };
  return { text: `${passed} passed${tail}`, tone: "pass" };
}

export default lightLine;
