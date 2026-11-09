// WHICH EVENTS MEAN "RE-READ THE RUN FILES".
//
// The strip's rows are built from the run records on disk (`stripRuns`), so the window has to be
// told when one changes. Everything here is that list, and it lives in its own module because the
// predicate was an inline reduce inside the hook — unclaimable, and wrong in a way nobody could
// see: a `todo.updated` only counted when its source began with `lane:`.
//
// MEASURED 2026-11-04, his words: *"I don't see any list down here… I refresh the page and there
// it is."* A run opened under `skill:skill-authoring`, the host announced `run.started` BEFORE
// writing the record (fixed on that side too), the window read disk and found nothing — and the
// `todo.updated` that arrived after the write was filtered out here, because its source was not a
// lane. So nothing ever re-read, and the row waited for a reload. A run nobody can see is held is
// the one thing runs exist to prevent.
//
// ANY SOURCED LIST WRITE IS A RUN FILE CHANGING. That is the whole rule: `source` is what opens a
// run, so a write carrying one has touched a record the strip reads. A write with NO source is the
// session's own plan — it has no record, its row is drawn from the live event, and re-reading disk
// for it would be work with no answer in it.
export const ticksLanes = (e) => {
  if (!e || !e.kind) return false;
  switch (e.kind) {
    // A run opened, finished, or had a status or an attachment land on it. `run.updated` is the
    // one that was missing first (his catch, 2026-10-26: a run he watched get declared abandoned
    // showed nothing), and `lane.removed` is why this list exists at all — the other kinds tick
    // when a lane MOVES, and nothing ticked when one was cleared.
    case "run.started":
    case "run.finished":
    case "run.updated":
    case "lane.removed":
    // A RUN OPENED FOR THIS AGENT BY SOMEBODY ELSE — a correction (RFC-078 §2.8). It is the only
    // kind here that originates OUTSIDE the session, which is exactly why it had to be added:
    // every other case rides an event this session caused, so a run handed to this agent produced
    // no tick at all. Measured 2026-11-09 with a real assign from the manager — two runs on disk,
    // `stripRuns` returning them first, and the band reading "0 corrections" until something
    // unrelated happened to tick the re-read. Work that arrives has to arrive.
    case "run.assigned":
      return true;
    case "todo.updated":
      return !!String((e && e.source) || "").trim();
    default:
      return false;
  }
};

/** How many of these events ask for a re-read — the number the effect depends on. */
export const laneTicksIn = (events = []) =>
  (Array.isArray(events) ? events : []).reduce((n, e) => n + (ticksLanes(e) ? 1 : 0), 0);

export default ticksLanes;
