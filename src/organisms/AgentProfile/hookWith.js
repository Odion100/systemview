// WHICH `with:` FIELDS A HOOK OFFERS, AND WHICH OF THEM IT HAS TO HAVE.
//
// A hook pointing at a job asks the JOB what it takes — nothing is typed from memory here and no
// second list is kept. The job's front matter declares two of them:
//
//   requires: ["period"]              must be supplied, or the hook refuses on every match
//   optional: ["project", "arc"]      may be supplied, and a blank one refuses nothing
//
// WHY THERE ARE TWO LISTS AND NOT ONE MARKED-UP LIST. `requires:` was doing both jobs, so making a
// field APPEAR meant making it MANDATORY — and that is how the arc hook's `project` and `arc`
// fields disappeared the moment the job stopped demanding them (measured in his window,
// 2026-11-10: *"I see those options went away"*). The alternative considered was `requires:
// ["arc?"]`, one list with a suffix, and it was rejected because it overloads a NAME with syntax:
// a reader that does not know to strip the `?` treats `"arc?"` as a literal input name, and then a
// hook supplying `arc` looks correct and satisfies nothing. A plausible wrong answer is worse than
// an error.
//
// THE OPTIONAL HALF IS THE WHOLE POINT OF DECLARING IT AT ALL. An optional input used to live only
// in the job document's prose, and prose is invisible to a surface — so "name one arc to focus this
// run" was a capability reachable only by hand-editing a hook file. The declaration is what turns a
// paragraph back into a field.
//
// NO REACT IN HERE, the same rule `hookRate.js` and `skillSources.js` follow: `AgentProfile.js`
// cannot be mounted in jest, so a decision written inline there is a decision nothing can check.

/**
 * The rows the `with:` form draws, in order: required first, then offerable.
 *
 * `job` is a job record off `jobs:list` — `{ requires: [], optional: [] }`. Returns
 * `[{ key, required }]`, required ones first, deduped, with a required name winning over the same
 * name appearing in both lists (a job that declares one twice means it, and the stricter reading is
 * the safe one — the gate is going to demand it either way).
 */
export function hookWithFields(job) {
  const names = (v) => (Array.isArray(v) ? v : []).map((n) => String(n || "").trim()).filter(Boolean);
  const required = [...new Set(names(job && job.requires))];
  const seen = new Set(required);
  const optional = [...new Set(names(job && job.optional))].filter((k) => !seen.has(k));
  return [
    ...required.map((key) => ({ key, required: true })),
    ...optional.map((key) => ({ key, required: false })),
  ];
}

/**
 * What the form says when a job declares nothing at all.
 *
 * It used to read "this job declares no inputs, so there is nothing to supply", which became FALSE
 * the moment a job could declare offerable ones: `arc-development` requires nothing and offers two.
 * So the sentence is derived from both lists rather than from `requires` alone — and it is only
 * ever said when there is genuinely nothing to draw.
 */
export const hookWithNote = (job) =>
  hookWithFields(job).length ? "" : "this job declares no inputs, so there is nothing to supply";

/**
 * The placeholder for one field, which is the only place the form can say that a blank is allowed.
 *
 * A required field and an optional one look identical in a text input, and "the arc this hook runs
 * it with" reads like an instruction either way. The difference matters at exactly the moment
 * somebody is deciding whether to leave it empty, so it is said there.
 */
export const hookWithHint = (field) => {
  // THE GUARD HAS TO COVER BOTH BRANCHES. `field && field.required ? … : …` reads `field.key` in
  // the else, so a missing field took the optional branch and threw there — the guard looked
  // present and protected exactly one of the two paths.
  const key = String((field && field.key) || "").trim();
  if (!key) return "";
  return field.required
    ? `the ${key} this hook runs it with`
    : `optional — the ${key} to focus on, or leave blank`;
};
