// THE PROOFS TAB'S SHAPING — what the hub answered, turned into rows, away from the render.
//
// Same reason `nudgeSettings.js` exists: everything that DECIDES what the panel says lives here so
// it can be tested, because a test that mounts the panel pulls in the rest of the organism. A
// module with no JSX in it can be held to its answers.
//
// WHAT IT IS SHAPING. `Agent.listProofs` answers with documents and their spec inventory and runs
// nothing; `Agent.runProofs` answers with the same `{ tests: [...] }` shape a test run gives, plus
// `problems` for specs that could not be built. Both come through here.

import { specKeyOf, tallyOf } from "../../utils/specRun";
import { parseSteps, toStep } from "../../atoms/Markdown/blocks/RunBlock";

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
        // THE JOIN KEY, beside the human one. `key` is what a reader sees (`MOCK-RFC#L106`); `at`
        // is what a result is matched on, and it is the PATH, because that is what the hub stamps
        // on every row it runs. These were the same name doing two jobs and they were not equal —
        // `resultRows` has claimed since it was written to be "keyed by the same address the
        // listing uses", and it never was, so no listed spec in this window had ever been shown
        // its own outcome. One name each, and the match is free.
        at: specKeyOf(doc, spec.line),
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
 * THE RESULT — one row per spec that actually ran, carrying `at`, the key `listRows` now puts on
 * its own rows, so a listed row can find its own outcome without the two lists having to stay in
 * the same order. (It said this before and was wrong: the listing keyed on the document ID and
 * the hub stamps the PATH, so the two could never meet. `utils/specRun.specKeyOf` is the one
 * definition of that address now and both sides call it.)
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
export function summaryOf({ listed, ran, running, marks } = {}) {
  const specs = (listed && listed.specs) || 0;
  const docs = ((listed && listed.documents) || []).length;
  // A RUN IN FLIGHT SHOULD HAVE A NUMBER THAT MOVES. This was the literal string "running…" for
  // the whole of a run of any size, because the bus carried one boolean for all of it and there
  // was nothing finer to say. There is now: the marks settle a document at a time, so the line
  // counts them — and a failure already in the bag is named while the rest is still going, rather
  // than arriving as a surprise at the end.
  if (running) {
    const t = tallyOf(marks);
    if (!t.total) return "running…";
    return `running — ${t.settled}/${t.total}${t.fail ? ` · ${t.fail} failed` : ""}`;
  }
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


// A saved test's namespace as the dotted string a `::test[…]` label is matched against.
const nsOf = (t) => {
  const n = (t && t.namespace) || {};
  return [n.projectCode, n.serviceId, n.moduleName, n.methodName].filter(Boolean).join(".");
};

/**
 * EACH COLLECTED SPEC AS A TEST OBJECT — and EVERY SPEC THAT CANNOT BE ONE, SAID BY NAME.
 *
 * This used to live inline in the panel, where it violated this file's own first paragraph — and
 * it carried the silent shrug HIS use found (2026-11-07, the board card): a listed spec whose steps
 * all failed to resolve was `continue`d, so the scope said "1 spec" while the list rendered none of
 * it and a press ran nothing with no reason anywhere. The headless runner names this exact state
 * (api/proofs.js pushes a problem); the panel now does too, in `issues`.
 *
 * AND THE POOL FOLLOWS THE BLOCK'S DECLARED PROJECT — `{project=…}` on a run block picks which
 * services its steps resolve against, exactly as RunBlock and the headless runner already honour.
 * Built here with the document's project alone, the very blocks that motivated the attribute
 * dropped silently.
 *
 * Same grammar a `:::run` block is built with (`parseSteps` + `toStep`, imported rather than
 * reimplemented), so this list cannot drift from what the document shows.
 */
export function buildProofCards(rows, { projectCode, services = [], allServices = [], savedTests = [] } = {}) {
  const cards = [];
  const issues = [];
  for (const r of rows || []) {
    if (r.specKind === "test") {
      const hit = (savedTests || []).filter((t) => nsOf(t).includes(r.label));
      if (!hit.length)
        issues.push(`${r.document}#L${r.line} — no saved test matches "${r.label}"`);
      hit.forEach((t) => cards.push({ ...t, __at: `${r.document}#L${r.line}`, __key: r.at, __doc: r.document, __claim: r.claim || "", __path: r.path, __line: r.line, __end: r.end || r.line, __claimLine: r.claimLine || 0 }));
      continue;
    }
    if (!r.src) continue; // no body yet — the hub answers the inventory before the source
    const declared = (r.attrs && r.attrs.project) || projectCode;
    const pool = declared === projectCode ? services : (allServices || []).filter((s) => s.projectCode === declared);
    const parsed = parseSteps(r.src).filter((p) => !p.use);
    // AND AN EXPLICITLY NAMED SERVICE IS CHECKED AGAINST THE POOL TOO. `toStep` consults the pool
    // only to resolve a SHORT name — a fully-qualified step (`systemview.Agent.board`) builds
    // whether or not that service is connected, and then dies at PRESS time with nothing on screen,
    // which is the exact silence his click found. Unresolvable is unresolvable; it is said here,
    // at build, whichever way the step was spelled.
    const inPool = (st) =>
      !st.namespace.serviceId ||
      pool.some((s) => (s.serviceId || (s.system && s.system.connectionData && s.system.connectionData.serviceId)) === st.namespace.serviceId);
    const steps = parsed
      .map((p) => toStep(p, { projectCode: declared }, pool))
      .filter((st) => st && inPool(st));
    if (steps.length < parsed.length) {
      const missing = parsed.length - steps.length;
      issues.push(
        `${r.document}#L${r.line} — ${steps.length ? `${missing} of ${parsed.length}` : `0 of ${parsed.length}`} step${parsed.length === 1 ? "" : "s"} resolve${missing === 1 ? "s" : ""} to no connected service in "${declared}"${pool.length ? "" : " — nothing from that project is connected"}`,
      );
    }
    if (!steps.length) continue;
    cards.push({
      title: (r.attrs && r.attrs.title) || r.name,
      namespace: steps[0].namespace || {},
      Main: [],
      sections: { steps },
      sectionRefs: {},
      run: ["steps"],
      __at: `${r.document}#L${r.line}`,
      __key: r.at,
      __doc: r.document,
      __claim: r.claim || "",
      __path: r.path,
      __line: r.line,
      __end: r.end || r.line,
      __claimLine: r.claimLine || 0,
    });
  }
  return { cards, issues };
}
