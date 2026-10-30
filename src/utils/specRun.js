// WHAT EACH SPEC IS DOING RIGHT NOW — the one derivation two surfaces read, so they cannot disagree.
//
// WHY IT EXISTS. Running a spec produced no per-spec state anywhere. `proofsBus` carried ONE
// `running` boolean for a whole run and `proofRows.summaryOf` turned it into the literal string
// "running…", so a run of six specs was one word that did not move. Meanwhile the document's
// diagram marked a node `is-running` from a local `Set` deleted on settle — a dashed border, then
// not-dashed, and no trace that anything ever ran.
//
// AND THE TWO LISTS COULD NOT BE JOINED. `proofRows.resultRows` says it is "keyed by the same
// address the listing uses". It was not: the listing keyed on the document's ID (`MOCK-RFC#L106`)
// and the hub stamps every result row with its PATH (`RFCs/proofs/mock-rfc.md#L106`). Nothing in
// the window ever put a result next to the spec it came from, which is why the panel's cards are
// built from the listing and never from the run. One key, defined here, and the join is free.
//
// THE PATH IS THE KEY, not the id. The hub already emits it (`api/proofs.js` — `at:
// `${doc.path}#L${spec.line}``), a path is what a document-side surface has in its registry row,
// and an id is a display name that a rename changes. The id stays the thing a PERSON reads
// (`proofRows.addressOf`); this is the thing two lists are matched on.

/** The join key for one spec: where its block lives, and the line it opens on. */
export const specKeyOf = (pathOrDoc, line) => {
  const p = typeof pathOrDoc === "string" ? pathOrDoc : (pathOrDoc || {}).path || "";
  if (!p || !line) return "";
  return `${p}#L${Number(line)}`;
};

// THE FIVE THINGS A SPEC CAN BE, and they are five because collapsing any pair loses the answer
// somebody is looking for. `queued` is "in scope and its turn has not come" — the state that makes
// a run look like a run instead of a flash; `running` is the one executing; and a spec with no mark
// at all has simply never been run in this window, which is not the same as passing.
export const SPEC_STATES = ["queued", "running", "pass", "fail"];

/** Every spec a listing put in scope, marked `queued` — the shape of the run before it starts. */
export function queueOf(listed) {
  const out = {};
  for (const doc of (listed && listed.documents) || [])
    for (const spec of doc.specs || []) {
      const key = specKeyOf(doc, spec.line);
      if (key) out[key] = "queued";
    }
  return out;
}

/** The specs of ONE document in a listing, as keys — what a per-document step is about to run. */
export function keysOfDocument(listed, documentId) {
  const doc = ((listed && listed.documents) || []).find((d) => d.id === documentId);
  return ((doc && doc.specs) || []).map((s) => specKeyOf(doc, s.line)).filter(Boolean);
}

/**
 * A HUB ANSWER, FOLDED INTO MARKS. `runProofs` replies with `{ tests: [{ at, passed, … }] }` and
 * `at` is already the key — so this is a fold rather than a lookup, and a row the hub sent with no
 * `at` is skipped rather than guessed at. A guessed address lights the wrong spec green, which is
 * worse than lighting none.
 */
export function marksFrom(ran) {
  const out = {};
  for (const t of (ran && ran.tests) || []) {
    const key = String((t && t.at) || "");
    if (!key) continue;
    out[key] = t.passed ? "pass" : "fail";
  }
  return out;
}

/**
 * A SPEC THAT COULD NOT BE BUILT IS NOT A SPEC THAT PASSED, and it is not one still queued either.
 * `ran.problems` names them by document and line, so they settle as `fail` — the run is over for
 * them and the surface must stop pretending they are waiting their turn.
 *
 * `listed` supplies the path for a problem that names only the document id.
 */
export function problemMarks(ran, listed) {
  const byId = new Map(((listed && listed.documents) || []).map((d) => [d.id, d.path]));
  const out = {};
  for (const p of (ran && ran.problems) || []) {
    const path = byId.get(p && p.document) || "";
    const key = specKeyOf(path, p && p.line);
    if (key) out[key] = "fail";
  }
  return out;
}

/** How a set of marks reads as one line: how many of each, and whether anything is still moving. */
export function tallyOf(marks = {}) {
  const v = Object.values(marks || {});
  const n = (s) => v.filter((x) => x === s).length;
  const pass = n("pass");
  const fail = n("fail");
  const running = n("running");
  const queued = n("queued");
  return { total: v.length, pass, fail, running, queued, settled: pass + fail, moving: running + queued > 0 };
}

/**
 * THE WORST THING UNDER A GROUP, so one dot can speak for many. A plan is red the moment one of its
 * specs is, moving while any is, and only green when every spec under it is green — the
 * conservative direction, because a group reading green over a hidden failure is the one summary
 * that costs more than no summary.
 */
export function rollupOf(keys = [], marks = {}) {
  const had = keys.map((k) => marks[k]).filter(Boolean);
  if (!had.length) return "";
  if (had.includes("fail")) return "fail";
  if (had.includes("running")) return "running";
  if (had.includes("queued")) return "queued";
  return had.length === keys.length ? "pass" : "running";
}

const specRun = { specKeyOf, queueOf, keysOfDocument, marksFrom, problemMarks, tallyOf, rollupOf, SPEC_STATES };
export default specRun;
