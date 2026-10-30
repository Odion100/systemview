import { parseArc, timelineOf } from "./objectives";
import { stateOf } from "./blocks/lifecycleState";
import { specKeyOf } from "../../utils/specRun";

// WHERE THE PLAN IS, AND WHAT IS STOPPING IT — one composition of a document's objectives and the
// plans attached to them, with no React in it so every number here can be held to its answer.
//
// WHY IT EXISTS. `::progress` used to compute two progress numbers in two places: the block's own
// header counted OBJECTIVES (`1/7 done · 14%`) and the diagram's chips summed CLAIMS (`5/16`). Two
// hundred pixels apart, never reconciled, so "where is this plan" had two answers and a reader had
// to pick one. They are not rivals — they are two readings of ONE composition, and the only way to
// stop them disagreeing is to derive both from the same rows. That is this file.
//
// AND IT USES THE ORDER THE SYSTEM ALREADY COMPUTES. `timelineOf` has worked out real dependency
// order, per-objective `blockedBy` with met/waiting/elsewhere/unresolved, and a cycle flag, since
// RFC-072 — and nothing but its own test file ever read it. ARC-001 has three real edges
// (`O2→O1`, `O3→O1`, `O5→O4`) that were computed and thrown away on every render. They arrive here.

/** The claims an attached plan agrees and has checked, summed over a list of registry rows. */
const claimsOf = (rows) =>
  rows.reduce(
    (acc, r) => {
      const c = (r.state || {}).claims || {};
      return { met: acc.met + (c.met || 0), total: acc.total + (c.total || 0) };
    },
    { met: 0, total: 0 }
  );

/**
 * A DEPENDENCY, IN WORDS RATHER THAN A WIRE.
 *
 * Most arcs have no `needs=` at all — MOCK-ARC has none; only ARC-001 and RFC-072 use it. A drawing
 * that spends geometry on edges therefore spends it on nothing most of the time, and a curve that
 * crosses a wrapped row is unfollowable even when it IS there. So a dependency says itself, and
 * degrades to no line at all when there is nothing to say.
 *
 * `to` is the objective a reader can jump to — only present when the address resolves HERE.
 */
export function waitLabel(b = {}) {
  const addr = b.address || b.objective || "something";
  if (b.status === "waiting") return { kind: "waiting", to: b.objective, text: `waits on ${b.objective}` };
  if (b.status === "elsewhere") return { kind: "elsewhere", to: "", text: `waits on ${addr} — another project` };
  return { kind: "unresolved", to: "", text: `needs ${addr} — nothing here answers to it` };
}

/**
 * THE WHOLE PICTURE, FROM THE DOCUMENT AND THE REGISTRY.
 *
 *   planOf(source, { byObj, arcRow })
 *
 * `byObj` maps an objective id to the rfc registry rows pointed at it (`arc=MOCK-ARC-O3` on the
 * plan's own leaf); `arcRow` is the arc's own registry row. Both are the shell's parse of OTHER
 * documents — the objectives and their order are this document's own, recounted every call.
 */
export function planOf(source, { byObj, arcRow } = {}) {
  const arc = parseArc(source);
  const timeline = timelineOf(source);
  const rowsFor = (id) => {
    const got = byObj && typeof byObj.get === "function" ? byObj.get(id) : (byObj || {})[id];
    return got || [];
  };

  // DEPENDENCY RANK — how deep in the order an objective sits. `timelineOf` already emits in
  // dependency order, so every dependency of an objective has been ranked by the time we reach it;
  // an objective inside a cycle has no honest rank and takes 1, with `cycle` saying why.
  const rank = new Map();
  const rankOf = (o) => {
    if (o.cycle) return 1;
    const deps = (o.blockedBy || [])
      .filter((b) => b.status === "met" || b.status === "waiting")
      .map((b) => b.objective);
    return deps.reduce((m, d) => Math.max(m, rank.get(d) || 0), 0) + 1;
  };

  const objectives = timeline.map((o) => {
    const rows = rowsFor(o.id);
    const claims = claimsOf(rows);
    const specs = rows.reduce((n, r) => n + (r.specs || []).length, 0);
    const r = rankOf(o);
    rank.set(o.id, r);
    return {
      id: o.id,
      title: o.title || "",
      owner: o.owner || "",
      state: o.state,
      // WHY IT IS BLOCKED, carried as a first-class field rather than a hover. It reached the
      // screen only as a `title=` on a 10px state word — the one thing he asked to be able to see.
      because: o.because || "",
      cycle: !!o.cycle,
      rank: r,
      waits: (o.blockedBy || []).filter((b) => b.status !== "met").map(waitLabel),
      claims,
      specs,
      // AN UNPLANNED OBJECTIVE IS INCOMPLETE — it is not "nothing to show", it is a hole in the
      // plan, and it has to be visible as one.
      unplanned: !rows.length,
      // THE FILL IS THE CLAIMS, AND ONLY THE CLAIMS. "No percentage of a half-finished objective"
      // (progressOf's own rule): a fraction invented for an objective would be a lie, so this is
      // not one — it is the met/total of the claims its plans agreed, a real count of checked
      // statements. An objective somebody has marked `done` reads full, because the press is a step
      // a person performs and their word outranks a derivation.
      fraction: o.state === "done" ? 1 : claims.total ? claims.met / claims.total : 0,
      // CLAIMS ALL MET, STILL NOT MARKED DONE — the frontier, and the one reading the old drawing
      // could not express. MOCK-ARC's O2 is exactly this: 1/1 claims, written `open`.
      ready: o.state !== "done" && claims.total > 0 && claims.met === claims.total,
      // NOTHING MEASURABLE YET: a plan is attached and has agreed no claims, so the fill is 0 for
      // want of anything to count rather than because no work happened. Different, and said.
      unclaimed: !!rows.length && !claims.total,
      plans: rows.map((row) => {
        const c = (row.state || {}).claims || {};
        return {
          id: row.id,
          station: stateOf("rfc", row),
          met: c.met || 0,
          total: c.total || 0,
          specs: (row.specs || []).length,
          project: row.project || "",
          path: row.path || "",
          stale: !!row.stale,
          // THE SPECS THEMSELVES, not only how many. A count can say "defended by three things
          // that re-run"; it cannot be watched running. Each one carries the key `utils/specRun`
          // joins a result on, so a dot on this plan and a card in the side panel are the SAME
          // spec by address rather than by both surfaces being kept in step by hand.
          specRows: (row.specs || []).map((s) => ({
            key: specKeyOf(row.path, s.line),
            line: s.line,
            end: s.end || s.line,
            kind: s.kind || "run",
            // A `::test` is a reference and its label is the only name it has; a `:::run` is the
            // spec itself, so its title is its name. The same rule `proofRows.listRows` uses.
            name: s.kind === "test" ? s.label || "(no namespace)" : s.title || "steps",
            claim: s.claim || "",
            claimLine: s.claimLine || 0,
          })),
        };
      }),
    };
  });

  const count = (fn) => objectives.filter(fn).length;
  const sum = (fn) => objectives.reduce((n, o) => n + fn(o), 0);
  const claims = {
    met: sum((o) => o.claims.met),
    total: sum((o) => o.claims.total),
  };

  // WHO HAS WHAT. `progressOf` computed this for `::progress`'s owner list off its own second
  // parse of the document — the same two-derivations problem the percent had, one level down. It
  // comes off these rows now, so the owner tally and the objective rows are the same objectives.
  // An objective with no owner is not "nobody's problem"; it is a real row under a name that says
  // it needs one, because the alternative is work no listing shows.
  const owners = new Map();
  objectives.forEach((o) => {
    const key = o.owner || "unowned";
    const row = owners.get(key) || { owner: key, total: 0, done: 0 };
    row.total += 1;
    if (o.state === "done") row.done += 1;
    owners.set(key, row);
  });
  return {
    arc: arc
      ? {
          id: arc.id,
          title: arc.title || "",
          owner: arc.owner || "",
          station: arcRow ? stateOf("arc", arcRow) : "",
          // the arc's OWN specs — an arc document is collected like any other, not merely a
          // container for its plans
          specs: ((arcRow || {}).specs || []).length,
          path: (arcRow || {}).path || "",
          project: (arcRow || {}).project || "",
          specRows: (((arcRow || {}).specs) || []).map((s) => ({
            key: specKeyOf((arcRow || {}).path, s.line),
            line: s.line,
            end: s.end || s.line,
            kind: s.kind || "run",
            name: s.kind === "test" ? s.label || "(no namespace)" : s.title || "steps",
            claim: s.claim || "",
            claimLine: s.claimLine || 0,
          })),
        }
      : null,
    objectives,
    totals: {
      objectives: objectives.length,
      complete: count((o) => o.state === "done"),
      doing: count((o) => o.state === "doing"),
      open: count((o) => o.state === "open"),
      blocked: count((o) => o.state === "blocked"),
      unplanned: count((o) => o.unplanned),
      ready: count((o) => o.ready),
      claims,
      specs: sum((o) => o.specs),
      // Stable order: most work first, then alphabetical, so the list does not reshuffle on a press.
      byOwner: [...owners.values()].sort((a, b) => b.total - a.total || a.owner.localeCompare(b.owner)),
      // ONE PERCENT, AND IT IS THE BAR'S INK. The mean of the per-objective fills, because an
      // objective is an objective — weighting by claim count would say a six-claim objective is
      // six times the work, and would give an UNPLANNED one zero width, which is the one thing
      // that must stay visible.
      pct: objectives.length ? Math.round((sum((o) => o.fraction) / objectives.length) * 100) : 0,
      // IS ANYTHING ACTUALLY ORDERED? With no `needs=` anywhere every rank is 1 and the order
      // column says nothing — so a surface can leave it out entirely rather than drawing a
      // column of 1s that implies a sequence nobody declared.
      ordered: objectives.some((o) => o.rank > 1),
      cycle: objectives.some((o) => o.cycle),
    },
  };
}

/**
 * WHAT IS STOPPING IT — the other half of the question, and the half no surface ever answered.
 *
 * `blocked="…"` has carried a reason since RFC-072 and it reached the screen only as a `title=`
 * hover on a ten-pixel state word, which is the same as not reaching it. A dependency that cannot
 * be resolved reached it not at all. So the stoppers are lifted OUT of the rows and listed first,
 * in sentences, because "where is this plan and what is stopping it" is two questions and the
 * second one is the one somebody acts on.
 *
 * ORDERED BY HOW STUCK, not by document order: a cycle is a plan that cannot proceed at all, a
 * written `blocked` is a person saying so, an unmet dependency is a thing with a known cure, and
 * an unplanned objective is the mildest — it is work nobody has written down yet. Reading top
 * down is reading worst first, so a strip that gets truncated truncates the least important end.
 */
const SEVERITY = { cycle: 0, blocked: 1, waiting: 2, elsewhere: 3, unresolved: 4, unplanned: 5 };

export function stoppersOf(plan) {
  const out = [];
  for (const o of (plan && plan.objectives) || []) {
    const at = { id: o.id, title: o.title || "" };
    if (o.cycle)
      out.push({ ...at, kind: "cycle", text: "sits in a dependency cycle — nothing here can go first" });
    // THE WRITTEN REASON, VERBATIM. Paraphrasing it here would make this the second place the
    // sentence lives, and the document is the only store.
    if (o.state === "blocked")
      out.push({ ...at, kind: "blocked", text: o.because || "marked blocked, with no reason written down" });
    for (const w of o.waits || []) out.push({ ...at, kind: w.kind, text: w.text, to: w.to || "" });
    // Unplanned is a stopper only while the objective is still live — an objective somebody marked
    // done without ever attaching a plan is finished, and listing it as a blocker is noise.
    if (o.unplanned && o.state !== "done")
      out.push({ ...at, kind: "unplanned", text: "no plan attached — there is nothing to build from" });
  }
  return out.sort((a, b) => (SEVERITY[a.kind] ?? 9) - (SEVERITY[b.kind] ?? 9));
}

const arcPlan = { planOf, waitLabel, stoppersOf };
export default arcPlan;
