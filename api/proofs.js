// THE PROOFS COLLECTOR AND RUNNER — a document's `::test` and `:::run` blocks, collected and run
// HEADLESS, by the same engine a saved test goes through.
//
// WHY IT IS HUB-SIDE. In-document running already worked: the window parses a `:::run`, builds the
// step list and hands it to the same `SavedTestItem` the Test Panel uses. But that made the agent who
// runs these most often the one party who could not — "just make sure that you're able to run the
// test outside of the visual window for yourself, because you will be the one who's really running
// these tests most of the time." So the mechanism lives here, in the hub, and the window becomes one
// consumer of it rather than the only place it exists.
//
// WHAT COUNTS AS A SPEC, and it is not everything that looks runnable: `test` and `run`, nothing
// else. "The CMDs are not really specs. It's only run blocks and test blocks. If there is something
// that a CMD do, you should wrap it in one of those." A `cmd` is experiential facilitation — a
// command HE presses to feel a thing work — so collecting one here would execute shell nobody
// pressed and report it as a proof that passed. The vocabulary lives once, in the shell's
// `blocks.cjs SPECS`, and reaches here through the registry row rather than being re-decided.
//
// NOTHING HERE PARSES MARKDOWN. The shell's watcher already parses every registered document to
// derive its row, so the row carries the inventory — kind, label, title, attrs and an exact
// line span per spec. Collecting is therefore a JSON read, and only a document actually about to RUN
// gets opened, to slice the span. His instruction: "make it so that the test blocks and the run
// blocks can easily be grabbed so you don't have to parse it."
const fs = require("fs");
const path = require("path");
const { specFromRun } = require("../testing-utilities/runSpec");
const { executeSpecs, actionMapFor, collectTests, verifiedClientFor, idOf } = require("./runTests");
const { matchNamespace } = require("../cli/utils/matchNamespace");

// An objective address is `<anything>-O<n>`, and the arc it belongs to is the part before that
// suffix. THE SAME RULE AS THE SHELL'S `arcOfAddress`, deliberately — an arc id is not required to
// look like `ARC-004`: this was first written as `/^(ARC-\d+)(?:-O\d+)?$/`, which matched nothing in
// the fixture whose arc is `MOCK-ARC`, so an arc-scoped run quietly collected the arc's own document
// and none of its plans. A narrower copy of a rule that already exists is how a scope silently
// shrinks, and the shrink reads as "there was nothing there".
//
// An arc id ITSELF is handled by the caller (a row whose id equals the arc), so this answers only
// the objective-address question and returns "" for anything that is not one.
const arcOf = (address) => {
  const m = /^(.+)-O\d+$/i.exec(String(address || "").trim());
  return m ? m[1].toUpperCase() : "";
};

/**
 * THE DOCUMENTS IN SCOPE, each with its spec inventory.
 *
 *   scope({ projectCode, document, arc, objective })
 *
 * - `document` — one id. Its own document only.
 * - `objective` — every plan pointed at that objective's address (`ARC-004-O2`).
 * - `arc` — the arc's own document plus every plan on any of its objectives.
 * - none of them — every document in the project that carries a spec.
 *
 * DEDUPED BY PATH, because a document may carry several registration leaves and each one is its own
 * row holding the same file's inventory — the spec fixtures do exactly this, a `::report{as=spec}`
 * beside the mock leaf it exercises. Walking rows without deduping would run that document twice and
 * report twice as many proofs as exist.
 */
function scopeDocuments(rows, { document, arc, objective } = {}) {
  const wanted = (r) => {
    if (document) return r.id === document;
    if (objective) return String(r.arc || "").toUpperCase() === String(objective).toUpperCase();
    if (arc) return r.id === String(arc).toUpperCase() || arcOf(r.arc) === String(arc).toUpperCase();
    return true;
  };
  const seen = new Set();
  const out = [];
  for (const r of rows) {
    if (!wanted(r)) continue;
    const key = `${r.project || ""}::${r.path || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (!Array.isArray(r.specs) || !r.specs.length) continue;
    out.push(r);
  }
  return out;
}

/**
 * Collect, without running anything — the listing, and the shape the arc diagram's per-node counts
 * and the drawer's progress both read.
 *
 * `registry` is a reader taking `{ projectCode }` (api/documentsRegistry's `documentsRegistryOn`),
 * `rootOf` resolves a project code to its root so a relative path can be opened.
 */
function collectProofs({ projectCode, document, arc, objective, withSource = false } = {}, { registry, rootOf } = {}) {
  if (!projectCode) return { error: "projectCode required" };
  const rows = scopeDocuments(registry({ projectCode }) || [], { document, arc, objective });
  // THE BODY, ONLY WHEN ASKED. The window builds each collected run block into the SAME component a
  // document builds it into — his requirement, and the reason this exists: "the run blocks build
  // into components on the fly, so I don't see why they can't do the same over there." To do that
  // it needs the source, which the hub already slices at run time.
  //
  // Off by default, because the diagram's per-node counts and the drawer's progress want the
  // inventory and nothing else, and shipping every run block's text to draw a number is waste.
  const sourceOf = (row) => {
    if (!withSource) return null;
    try {
      const root = rootOf ? rootOf(row.project) : "";
      const abs = row.path && path.isAbsolute(row.path) ? row.path : root ? path.join(root, row.path) : "";
      return fs.readFileSync(abs, "utf8").split("\n");
    } catch {
      return null;
    }
  };
  const documents = rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    path: r.path,
    project: r.project,
    arc: r.arc || null,
    // STALE IS CARRIED THROUGH, not resolved here. The row's inventory is what the last parse saw,
    // so a document edited since then may carry specs the registry has not caught up with — a reader
    // deciding whether to trust a count needs to know that, and a runner slices the live file anyway.
    ...(r.stale ? { stale: true } : {}),
    specs: specsWithSource(r, sourceOf(r)),
  }));
  return {
    projectCode,
    scope: document ? { document } : objective ? { objective } : arc ? { arc } : { project: projectCode },
    documents,
    specs: documents.reduce((n, d) => n + d.specs.length, 0),
  };
}

// A saved test's namespace as the dotted string `matchNamespace` compares against — the same read
// `runTests` does.
const nsStringOf = (t) => {
  const n = (t && t.namespace) || {};
  return [n.projectCode, n.serviceId, n.moduleName, n.methodName].filter(Boolean).join(".");
};

// One document's inventory for the wire, with the sliced body attached when the caller asked for it.
function specsWithSource(row, lines) {
  return (row.specs || []).map((s) => {
    const out = {
      kind: s.kind,
      label: s.label,
      title: s.title,
      line: s.line,
      end: s.end,
      attrs: s.attrs || {},
      // THE CLAIM THIS SPEC DEFENDS, when it sits inside one. A failing proof is read together with
      // the claim it breaks — so the address travels with the result rather than being looked up.
      claim: s.claim || "",
      claimLine: s.claimLine || 0,
    };
    if (lines) out.src = bodyOf(lines, s);
    return out;
  });
}

/** A container's body, sliced out of the file by the span the registry recorded. */
function bodyOf(lines, spec) {
  const from = Number(spec.line) || 0;
  const to = Number(spec.end) || from;
  if (to <= from) return "";
  // `line` is the opening fence and `end` the closing one, both 1-based — so the body is what sits
  // strictly between them.
  return lines.slice(from, to - 1).join("\n");
}

/**
 * COLLECT AND RUN. Returns the same shape `runTests` does, so every consumer that already renders a
 * test run renders this one: `{ projectCode, scope, documents, passed, failed, tests: [...] }`.
 *
 * Two kinds reach the engine by different routes and both end up in one `executeSpecs` pass:
 *
 * - `:::run` — built into a saved-test shape by `testing-utilities/runSpec`. It never existed as a
 *   file; the document IS the spec.
 * - `::test[Namespace]` — a REFERENCE to a saved test, so the named spec is pulled from the services'
 *   own `specs/tests/` by namespace. The document does not restate it, which is the whole point of
 *   the block: the contract keeps answering long after the document settles.
 */
async function runProofs({ projectCode, document, arc, objective, headers = {}, bail = false, dryRun = false } = {}, deps = {}) {
  const { registry, rootOf, connections = [] } = deps;
  const collected = collectProofs({ projectCode, document, arc, objective }, { registry, rootOf });
  if (collected.error) return collected;

  const services = connections.filter((c) => c.projectCode === projectCode);
  if (!services.length) return { ...collected, error: `no connected services for ${projectCode}` };

  const where = {
    ...collected,
    services: services.map((s) => ({ serviceId: idOf(s), at: s.system.connectionData.serviceUrl })),
  };

  if (!collected.documents.length)
    return {
      ...where,
      tests: [],
      passed: 0,
      failed: 0,
      // WHY there is nothing to run is the useful half — a scope that matched no document, and
      // documents that matched but carry no spec, are different problems with the same empty result.
      error: document
        ? `${document} carries no run or test blocks`
        : objective
        ? `no document on ${objective} carries a run or test block`
        : arc
        ? `no document in ${arc} carries a run or test block`
        : `no document in ${projectCode} carries a run or test block`,
    };

  // BUILD FIRST, RUN SECOND — so a document that cannot be read or a step that resolves to nothing is
  // reported as a problem rather than as a failure, and the two never get confused.
  const specs = [];
  const problems = [];
  const namespaces = [];
  for (const doc of collected.documents) {
    const root = rootOf ? rootOf(doc.project) : "";
    const abs = doc.path && path.isAbsolute(doc.path) ? doc.path : root ? path.join(root, doc.path) : "";
    let lines = null;
    try {
      lines = fs.readFileSync(abs, "utf8").split("\n");
    } catch {
      problems.push({ document: doc.id, problem: `cannot read ${doc.path}` });
      continue;
    }
    for (const spec of doc.specs) {
      if (spec.kind === "test") {
        // A reference. The namespace is the label; the saved spec behind it is collected from the
        // services below, exactly as `runTests` does.
        if (spec.label) namespaces.push({ ns: spec.label, document: doc.id, line: spec.line });
        else problems.push({ document: doc.id, line: spec.line, problem: "a ::test with no namespace names nothing" });
        continue;
      }
      const built = specFromRun(
        { src: bodyOf(lines, spec), label: spec.label, attrs: spec.attrs || {}, kind: spec.end > spec.line ? "container" : "leaf" },
        { projectCode: (spec.attrs && spec.attrs.project) || doc.project || projectCode },
        services,
      );
      (built.problems || []).forEach((p) => problems.push({ document: doc.id, line: spec.line, problem: p }));
      // A run block whose every step failed to resolve has nothing to execute. Counting it as a spec
      // that ran would turn an unresolvable document into a clean sheet.
      if (!built.Main.length && !Object.keys(built.sections).length) continue;
      specs.push({ ...built, at: `${doc.path}#L${spec.line}` });
    }
  }

  const client = verifiedClientFor([]);
  const { lists } = await collectTests(services, client);
  const saved = lists.flat();
  for (const want of namespaces) {
    const hit = saved.filter((t) => matchNamespace(nsStringOf(t), want.ns));
    if (!hit.length) {
      problems.push({ document: want.document, line: want.line, problem: `no saved test matching "${want.ns}"` });
      continue;
    }
    hit.forEach((t) => specs.push({ ...t, at: `${want.document}#L${want.line}` }));
  }

  if (dryRun)
    return { ...where, dryRun: true, ...(problems.length ? { problems } : {}), tests: specs.map((s) => ({ namespace: s.namespace, title: s.title, at: s.at || null })) };

  if (!specs.length)
    return {
      ...where,
      tests: [],
      passed: 0,
      failed: 0,
      ...(problems.length ? { problems } : {}),
      error: "every spec in scope failed to build — nothing was executed",
    };

  const actionMap = await actionMapFor(services, [specs], client);
  const { rows, ms } = await executeSpecs(specs, { services, client, actionMap, headers, bail });

  return {
    ...where,
    ms,
    passed: rows.filter((r) => r.passed).length,
    failed: rows.filter((r) => !r.passed).length,
    // PROBLEMS SIT BESIDE THE RESULT, never instead of it. A run of four proofs where a fifth could
    // not be built is not a clean run of four — the reader has to be able to see the difference.
    ...(problems.length ? { problems } : {}),
    tests: rows,
  };
}

module.exports = { collectProofs, runProofs, scopeDocuments, bodyOf, arcOf };
