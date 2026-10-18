// JOBS ARE THE SHELL'S, and the window reads them rather than being told about them.
//
// The bridge already existed and nothing in this app had ever called it: `svPreload.cjs` has
// exposed `window.systemview.jobs` — list, get, runs, save, remove, rate — since RFC-005 §10, with a
// comment on the rate verb reading *"§5 — capturable where the report is READ."* That is exactly
// where it is now captured, and until this file there was no door from here to it.
//
// WHY READ THE RECORD AT ALL, when the session's own event stream already carries the run. Because
// the stream carries what the agent DID and the record carries what HAPPENED to the job: its status,
// the account it filed, the rating somebody gave it. A card built only from events would be the
// agent's testimony about its own work — and a job's whole point is that its result is checkable
// without that.
const api = () =>
  (typeof window !== "undefined" && window.systemview && window.systemview.jobs) || null;

export const hasHostJobs = () => !!api();

const safe = async (fn, fallback) => {
  const j = api();
  if (!j) return fallback;
  try {
    return await fn(j);
  } catch {
    // A SHELL THAT CANNOT ANSWER IS NOT AN ERROR HERE. This runs in a card beside a live run; a
    // throw would take the chat down with it, and the honest fallback is a card that shows what the
    // events already proved and says nothing it cannot support.
    return fallback;
  }
};

/** Every job on the machine — `[{ id, name, requires, enabled, ... }]`, or [] with no shell. */
export const listJobs = () => safe((j) => j.list(), []);

/** One job, document included. */
export const getJob = (id) => safe((j) => j.get(id), null);

/** A job's run records, newest first. */
export const jobRuns = (id) => safe((j) => j.runs(id), []);

/** One run, by id — the card's own row rather than the whole history. */
export const jobRun = async (id, runId) => {
  const runs = await jobRuns(id);
  return (Array.isArray(runs) ? runs : []).find((r) => String(r.id) === String(runId)) || null;
};

/**
 * Write a job — `{ id, doc, name? }`. The DOCUMENT is the job; `job.json` is derived from it, and
 * the host refuses a save with no `doc` at all.
 *
 * THE WINDOW COULD NOT CREATE ONE UNTIL NOW, which he found by going to do it: *"there's no new job
 * button when a job is very simple."* `window.systemview.jobs.save` has been exposed since RFC-005
 * §10 and `jobs-host.cjs` has answered `jobs:save` the whole time — there was simply no door from
 * this app to it, so every job on the machine arrived through an agent's `jobsWrite`.
 */
export const saveJob = (rec) => safe((j) => j.save(rec), { error: "no shell to write a job" });

/** His rating, where he read the report. `rating` is a number; `note` is optional. */
export const rateJobRun = (id, runId, rating, note = "") =>
  safe((j) => j.rate(id, runId, { rating, note }), null);

/**
 * HIS OWN MARK on a run — "walked it", "approved" — free text, `""` clears it. Returns the updated
 * record, or null when this shell has no such door (an older shell: the card then shows the derived
 * word with nothing to press, which is the honest degradation — a selector that cannot save is
 * worse than no selector).
 */
export const markJobState = (id, runId, state) => safe((j) => j.state(id, runId, state), null);

/** The vocabulary the window offers first — the shell's list, never a copy kept here. */
export const jobStates = () => safe((j) => j.states(), []);

/** Whether this shell can record his mark at all — asked before the chip offers a press. */
export const hasJobState = () => {
  const j = api();
  return !!(j && typeof j.state === "function");
};
