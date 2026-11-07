// POSITIONAL FILTERS — a tile's selection narrows every tile BELOW it, and nothing else.
//
// His ruling, 2026-11-06: *"They should be filtering everything below them"* — which replaces the
// earlier whole-surface rule. The old mechanism lived in the provider and narrowed `docs` for the
// entire page; that made a head's press mean the same thing wherever it stood, and he decided the
// opposite: placement IS scope. A head at the top steers the whole page, the same head dragged to
// the middle steers only what is under it, and the tile above it is untouched.
//
// NO REACT IN THIS FILE. The stack owns the selection STATE (it is the thing that knows position);
// this file owns what a selection MEANS, so the meaning is provable in jest without mounting
// anything — the repo's own pattern (fold.js, floor.js, surface.js: logic out of renders).
//
// THE DIMENSIONS are the selections the tiles publish, one key each:
//
//   kind          a head segment's key ("approval", "blocked", …). It narrows by OBLIGATION, not
//                 by document — the segment carries the keys it counted (`owedHead`), so pressing
//                 "4 approvals waiting" shows those four and never the three blocked objectives
//                 their documents also happen to hold. That rule predates this file and survives
//                 it.
//   project       a project code, from the projects tile — *"you should be able to click on those
//                 and filter everything per project."*
//   arc           one arc, as a docKey string, from the standing tile — *"you should be able to
//                 click on arcs and it should filter all the RFCs for that arc."* It keeps the
//                 arc itself and every document whose own leaf addresses that arc (`arc=ARC-001-O6`
//                 — the same address `plansByObjective` resolves plans by).
//
// A REPORT IS NOT A DIMENSION, and the reason is the whole test for whether something belongs here:
// a selection has to have something UNDER it. An arc holds RFCs, a project holds everything in it —
// a report holds nothing, so narrowing the page to one left every tile below showing that single
// document and answering no question anybody had. His ruling, 2026-11-07: *"What the fuck could a
// report filter? What is a report sitting on top of?"* The selection-with-a-fill he asked for was
// always meant for the PROJECTS, which is where it lives now.
import { docKey } from "../AgentChat/owed";
import { parseAddress } from "../../atoms/Markdown/objectives";

export const DIMENSIONS = ["kind", "project", "arc"];

/** One selection value for a document-shaped thing: project + id, one spelling (docKey's own). */
export const holdOf = (x) => docKey(x);

/**
 * MERGE WHAT STANDS ABOVE. `selections` is the stack's array, index-aligned with the tiles; the
 * merge walks everything strictly ABOVE `index`, top first, so when two tiles above both hold the
 * same dimension the NEARER one wins — the later assignment overwrites. A tile never sees its own
 * selection here: it filters what is below it, not itself (the head counting the world it filters
 * FROM is the archetype, and it generalises).
 */
export function mergeAbove(selections = [], index = 0) {
  const out = {};
  for (let i = 0; i < index; i += 1) {
    const s = selections[i];
    if (!s) continue;
    for (const dim of DIMENSIONS) if (s[dim]) out[dim] = s[dim];
  }
  return out;
}

/** Is anything held at all — the cheap test that lets an unfiltered tile keep the original data
 *  object, so every identity-keyed derivation cache below still hits. */
export const anyHeld = (filters = {}) => DIMENSIONS.some((d) => filters && filters[d]);

/** A stable spelling of one merged filter set, so tiles under the SAME filters share one narrowed
 *  object (and one derivation) instead of each paying for its own. */
export const filterKey = (filters = {}) => DIMENSIONS.map((d) => `${d}=${(filters && filters[d]) || ""}`).join("|");

// Which documents one dimension keeps. Each predicate reads the registry row only — the text has
// already been read upstream and nothing here re-derives what a module owns.
const docPredicates = (filters) => {
  const preds = [];
  if (filters.project) preds.push((d) => (d.row.project || "") === filters.project);
  if (filters.arc) {
    const sep = filters.arc.indexOf("\u0000");
    const project = sep >= 0 ? filters.arc.slice(0, sep) : "";
    const arcId = sep >= 0 ? filters.arc.slice(sep + 1) : filters.arc;
    preds.push((d) => {
      // The arc itself stays — a filter that hides the thing you pressed reads as a deletion.
      if (d.row.kind === "arc" && d.row.id === arcId && (d.row.project || "") === project) return true;
      // Everything planned INTO it stays: the leaf's own address (`arc=ARC-001-O6`), parsed by the
      // module that owns what an address is. Matched on the arc id alone, the way
      // `plansByObjective` matches, because a cross-repo plan carries no project prefix.
      const a = parseAddress(d.row.arc);
      return !!a && a.arc === arcId;
    });
  }
  return preds;
};

/**
 * NARROW THE SURFACE'S DATA FOR ONE TILE, from the filters merged above it.
 *
 * Takes the provider's value (`dashboardData.js`) and hands back the same shape with `docs` and
 * `owed` narrowed and `filtering` set — `allDocs` / `allOwed` ride through untouched, because a
 * head counts the world it filters FROM wherever it stands. With nothing held it returns the
 * value itself, identity intact, which is what keeps the per-variant derivation caches warm.
 *
 * The `kind` dimension is the old provider logic, moved here whole: the segment's own `keys` are
 * the filter (a lookup, never a second predicate), the surviving obligations choose the documents.
 * The document dimensions run first, and the owed lists are then cut to obligations whose document
 * survived — so every dimension ANDs with every other and a list and a rail under the same tiles
 * can never disagree about scope.
 */
export function narrowData(value, filters = {}) {
  if (!value || !anyHeld(filters)) return value;
  const allDocs = value.allDocs || value.docs || [];
  const allOwed = value.allOwed || { press: [], work: [] };

  const preds = docPredicates(filters);
  const byDims = preds.length ? allDocs.filter((d) => preds.every((p) => p(d))) : allDocs;
  const dimKeys = preds.length ? new Set(byDims.map((d) => docKey(d.row))) : null;

  // The segment's own keys, exactly — `owedHead` hands every segment the obligations it counted.
  const seg = filters.kind && ((allOwed.head || {}).segs || []).find((s) => s.key === filters.kind);
  const wanted = seg ? new Set(seg.keys || []) : null;

  const keep = (list) =>
    (list || []).filter((o) => (!wanted || wanted.has(o.key)) && (!dimKeys || dimKeys.has(docKey(o))));
  const press = keep(allOwed.press);
  const work = keep(allOwed.work);

  // Holding a SEGMENT narrows the documents to the ones carrying the surviving obligations — the
  // rails and shelves draw documents and have no idea what an obligation is. The document
  // dimensions narrow the documents directly.
  const onDoc = wanted ? new Set([...press, ...work].map(docKey)) : null;
  const docs = onDoc ? byDims.filter((d) => onDoc.has(docKey(d.row))) : byDims;

  return {
    ...value,
    docs,
    owed: { ...allOwed, press, work, head: undefined },
    filtering: true,
  };
}

export default narrowData;
