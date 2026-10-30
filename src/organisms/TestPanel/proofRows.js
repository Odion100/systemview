// THE PROOFS TAB'S SHAPING — what the hub answered, turned into rows, away from the render.
//
// Same reason `nudgeSettings.js` exists: everything that DECIDES what the panel says lives here so
// it can be tested, because a test that mounts the panel pulls in the rest of the organism. A
// module with no JSX in it can be held to its answers.
//
// WHAT IT IS SHAPING. `Agent.listProofs` answers with documents and their spec inventory and runs
// nothing; `Agent.runProofs` answers with the same `{ tests: [...] }` shape a test run gives, plus
// `problems` for specs that could not be built. Both come through here.

/** A spec's address as a human reads it — the document, and the line its block starts on. */
export const addressOf = (doc, spec) => `${doc.id}#L${spec.line}`;

/**
 * THE LISTING — one row per spec, in document order, each knowing which document it came from.
 *
 * Flattened rather than nested, because the question the panel answers is "what will run", and a
 * tree of one-child documents is a worse way to read a list of nine things.
 */
export function listRows(listed) {
  const docs = (listed && listed.documents) || [];
  const out = [];
  for (const doc of docs)
    for (const spec of doc.specs || [])
      out.push({
        key: addressOf(doc, spec),
        document: doc.id,
        kind: doc.kind,
        path: doc.path,
        line: spec.line,
        specKind: spec.kind,
        // A `::test` is a REFERENCE — its label is the namespace it points at, which is the only
        // name it has. A `:::run` is the spec itself, so its title is its name, and a run block with
        // no title falls back to saying what it is rather than rendering blank.
        name: spec.kind === "test" ? spec.label || "(no namespace)" : spec.title || "steps",
        // THE BODY AND THE ATTRS, so the panel can build this spec into the SAME component the
        // document builds it into rather than re-rendering the hub's verdict in its own words.
        // `src` is present only when the caller asked for it (`withSource`), so a row used purely
        // for a count carries no text.
        src: spec.src || "",
        label: spec.label || "",
        attrs: spec.attrs || {},
        // THE CLAIM THIS SPEC DEFENDS, "" when it stands alone in the document body.
        claim: spec.claim || "",
        claimLine: spec.claimLine || 0,
        // STALENESS TRAVELS WITH THE ROW. The inventory is what the last parse saw, so a document
        // edited since may carry specs this list does not know about — and a count presented as
        // complete when it is not is the kind of quiet lie the whole surface exists to avoid.
        stale: !!doc.stale,
      });
  return out;
}

/**
 * THE RESULT — one row per spec that actually ran, keyed by the same address the listing uses, so a
 * listed row can find its own outcome without the two lists having to stay in the same order.
 */
export function resultRows(ran) {
  const tests = (ran && ran.tests) || [];
  return tests.map((t, i) => ({
    key: t.at || `${t.namespace || "spec"}-${i}`,
    at: t.at || "",
    name: t.title || t.namespace || "(unnamed)",
    namespace: t.namespace || "",
    passed: !!t.passed,
    ms: t.ms,
    // THE COMPARISON, not a transcript — expected against received, at a path. What makes a failing
    // proof actionable instead of something to go and reproduce by hand.
    failures: (t.failures || []).map((f) => ({
      phase: f.phase || "",
      step: f.step || "",
      at: f.namespace || f.path || "",
      message:
        f.expected !== undefined || f.received !== undefined
          ? `expected ${JSON.stringify(f.expected)}, got ${JSON.stringify(f.received)}`
          : f.message || "failed",
    })),
  }));
}

/**
 * THE ONE LINE ABOVE THE LIST. It has to be able to say four different things, because they mean
 * four different things to somebody deciding whether to trust it:
 *
 * - nothing collected at all
 * - collected, nothing run yet
 * - run, and every spec in scope ran
 * - run, and some could not be built — which is NOT a clean run of the rest
 */
export function summaryOf({ listed, ran, running } = {}) {
  const specs = (listed && listed.specs) || 0;
  const docs = ((listed && listed.documents) || []).length;
  if (running) return "running…";
  // A REFUSAL IS SURFACED, NEVER FORCED PAST. `listed.error` used to fall through to the count
  // below, so the hub answering "projectCode required" rendered as "no run or test blocks in
  // scope" — a refusal shown as an absence, which is the one way this surface could lie. Measured
  // live: the panel said the project had no specs while the hub was answering 39.
  if (listed && listed.error) return listed.error;
  if (ran && ran.error && !((ran.tests || []).length)) return ran.error;
  if (ran && (ran.tests || []).length) {
    const total = (ran.passed || 0) + (ran.failed || 0);
    const head = `${total} ran — ${ran.passed || 0} passed, ${ran.failed || 0} failed`;
    const unbuilt = (ran.problems || []).length;
    // SAID OUT LOUD. A run of four where a fifth could not be built reads as a clean four unless
    // the difference is printed, and a thinner run presented as a pass is the one outcome that
    // costs more than a failure.
    return unbuilt ? `${head} · ${unbuilt} could not be built` : head;
  }
  if (!specs) return listed ? "nothing to run here" : "";
  return `${specs} spec${specs === 1 ? "" : "s"} in ${docs} document${docs === 1 ? "" : "s"}`;
}

/** How the scope reads in the header — the thing being run, in his words rather than a param name. */
export function scopeLabel(scope) {
  const s = scope || {};
  if (s.document) return s.document;
  if (s.objective) return `objective ${s.objective}`;
  if (s.arc) return `${s.arc} — the arc and its plans`;
  return s.project ? `${s.project} — everything` : "everything";
}
