// THE LIFECYCLE, AS DATA — what each kind can be, which station a document is at, and what a press
// on a station would have to write. No React in here, so all of it is provable in Jest and the
// band's drawer can import it without pulling a renderer.
//
// IT EXISTS BECAUSE THERE WERE TWO ANSWERS TO ONE QUESTION. The trail on a document read the
// registry row — draft → approved → built → settled → retired. The band's RFC drawer had its own
// `stateOf` that parsed approval blocks and had never heard of built, settled or retired, so a
// document that was built and settled read `approved` in the drawer forever, and one carrying an
// approval nobody intends to press read `1 to approve` and sorted above everything else. His
// ruling: the lifecycle IS the state, and what is waiting on him is DERIVED from it as a flag.
// One definition, here, imported by both.

// WHICH STATIONS A LEAF DECLARES on its own, and the attribute that declares them. Still real —
// these are what the shell derives from, and `state=` sits on top of them rather than replacing
// them, so a document written before this still reads correctly.
export const DECLARED = {
  rfc: { settled: "settled", retired: "retired" },
  arc: { retired: "retired" },
  // RFC-076 §4.5 — a gap has TWO endings and they fork: `rejected=` is declined-on-purpose and
  // shares no term with `resolved`, which is what makes the end of this trail a fork and not a line.
  gap: { resolved: "resolved", rejected: "rejected", retired: "retired" },
  report: { retired: "retired" },
};

// Which state flag each leaf attribute sets.
//
// `resolved=` LANDS ON ITS OWN FLAG, NOT ON `done` — and that is RFC-076 §4.5. It used to map
// straight to `done`, which was right while the declaration WAS the state. It is not any more: a
// gap is resolved when it is declared resolved AND the document carries a proof, and the proof is
// not on the leaf. So the leaf declares its half and the row answers the other — exactly the split
// already in force for an rfc's `built` (a STATUS heading) and an arc's `done` (its objectives).
const FLAG_OF = {
  settled: "settled",
  retired: "retired",
  resolved: "resolvedDeclared",
  rejected: "rejected",
};

/**
 * EVERY WORD THIS SYSTEM USES FOR A STATE — exported so a test can assert that no press ever
 * WRITES one (RFC-076 c23: a press writes the fact, never the state). It exists as data rather
 * than as a list retyped inside a test, because a hand-typed copy would keep passing after the
 * code started writing a state word, which is exactly what a blind review caught c23's first
 * test doing.
 */
export const STATE_WORDS = new Set([
  "draft",
  "approved",
  "built",
  "settled",
  "retired",
  "rejected",
  "open",
  "resolved",
  "filed",
  "done",
  "inprogress",
  "doing",
  "blocked",
]);

// MUTUALLY EXCLUSIVE ENDINGS. The trail's ordering already clears everything PAST a target, which
// handles resolving a gap that was rejected; it does not handle the other direction, because
// `rejected` sits after `resolved`. Nothing may read as both — a gap carrying two endings is a
// contradiction no press should be able to create.
const EXCLUDES = { gap: { resolved: ["rejected"], rejected: ["resolved"] } };

// What each kind can be, in the order it becomes them. These are the registry's own derivations
// (the shell's `deriveState`) given their reading names — not a parallel state machine.
export const TRAILS = {
  // SETTLED: built means landed AND still moving — reviewed, amended, proofs pressed. Settled is
  // when the modification stops because nothing is left to modify; retired is the document leaving
  // active service. A declaration (`settled=` on the leaf), never derived from quiet.
  rfc: ["draft", "approved", "built", "settled", "retired"],
  // RFC-076 §2 — an arc runs the approval flow and derives UPWARD: approved is the decision made
  // with objectives still unplanned, inProgress is every objective planned with a plan still
  // moving, settled is every plan settled — read off the plans' own rows, never pressed.
  arc: ["draft", "approved", "inProgress", "settled", "retired"],
  // RFC-076 §4.5 — four states, and the middle two are a FORK. The order matters to `pressTo`,
  // which clears everything past its target: resolving therefore un-rejects for free, and the
  // other direction is handled by `EXCLUDES` above. `stepsFor` is what decides how it DRAWS.
  gap: ["open", "resolved", "rejected", "retired"],
  // A report is never done — it is a view, it only gets old. Two stations.
  report: ["filed", "retired"],
};

// ─── RETIREMENT CARRIES A REASON (RFC-076 §4.2) ──────────────────────────────────────────────
//
// Retirement used to be a gate: you could only retire something finished. That gate is gone and
// **the reason replaced it** — so `cancelled` is pressable from `draft`, which is the honest word
// for a plan that was dropped before it was built. What narrows is the VOCABULARY offered, never
// the button: a reason list filtered by where you stand says the same thing a refusal said, while
// still letting you end the document.
//
// THE LIST IS CLOSED BECAUSE CONDITIONS BRANCH ON IT. An unrecognised reason is a state nothing
// can read — `GROUP_OF` returns "" for it and the surfaces say so rather than guessing a group.
// (Contrast a report's `as=` SUBTYPE, which is open precisely because nothing branches on it.)

// THE ATTRIBUTE: `retiredAs=`, and it is neither of the two §9 offered, because both of those
// collide with something already on the same line.
//
// - `as=` collides on a REPORT, where `as=` is the subtype: `::report{id=x as=planning retain=14d
//   retired=2026-10-28}` would have one slot meaning two things, and §1's own example is exactly
//   that line.
// - `why=` collides on a GAP, where `why=` is the REJECTION's reason: `::gap{id=G-12
//   rejected=… why=wontfix retired=… }` would need `why=` twice, and an attribute bag has one slot
//   per name.
//
// A retirement can land on any kind, so its reason needs a name no kind has spent. `retiredAs=`
// reads plainly, says which declaration it qualifies, and matches the derived field the row has
// carried all along. One constant, so the name is changed in one place if it is ever changed.
export const RETIRE_ATTR = "retiredAs";

// WHICH STATES COUNT AS FINISHED, which is the only thing the narrowing turns on.
//
// `filed` is deliberately in NEITHER set, and it is the one judgement call here. A report is never
// done (§2: "it is a view, it only gets old"), so calling `filed` finished would be false — but a
// filed report can honestly end either way: a planning report with nothing pointed at was
// `cancelled`, and a spec report whose subject is gone is `out of service`. So a report offers
// both, and that is stated rather than inferred.
const FINISHED = new Set(["built", "settled", "resolved"]);
const UNFINISHED = new Set(["draft", "approved", "inProgress", "open", "rejected"]);
const classOf = (station) => (FINISHED.has(station) ? "finished" : UNFINISHED.has(station) ? "unfinished" : "");

/**
 * THE CLOSED LIST. `group` is what the lists act on — an **ending** leaves the active lists, a
 * **pause** stays in them showing its reason, because a pause that vanished would be a deletion
 * wearing a softer word, and the whole point of shelving is intending to come back.
 *
 * `only` is the narrowing: which class of state may offer this word. `needs` is the one reason
 * that cannot be completed without a pointer.
 */
export const RETIRE_REASONS = [
  {
    id: "cancelled",
    label: "cancelled",
    group: "ending",
    only: "unfinished",
    why: "it was dropped before it was finished",
  },
  {
    id: "superseded",
    label: "superseded",
    group: "ending",
    needs: "supersededBy",
    why: "something else replaced it",
  },
  {
    id: "out-of-service",
    label: "out of service",
    group: "ending",
    only: "finished",
    why: "it was finished, and what it described is gone",
  },
  { id: "shelf", label: "shelf", group: "pause", why: "put down on purpose, and meant to come back" },
  { id: "sideline", label: "sideline", group: "pause", why: "parked for something else, and meant to come back" },
];

const REASON_BY_ID = RETIRE_REASONS.reduce((acc, r) => ({ ...acc, [r.id]: r }), {});

/** The reason record for a stored token, or null — the one door for an unrecognised word. */
export const reasonOf = (id) => REASON_BY_ID[String(id || "").trim()] || null;

/**
 * `ending` · `pause` · `""`.
 *
 * The empty string is the answer that matters: a reason nobody put on the list is neither, and a
 * surface that defaulted it to one or the other would be inventing a decision. It is still
 * `retired` — nothing branches on `as=` for the STATE — it just cannot be filed.
 */
export const GROUP_OF = (id) => (reasonOf(id) || {}).group || "";

/**
 * ONE OBJECTIVE'S COMPLETENESS, from the plans serving it — the fold rule, in the one place this
 * process defines it. The host's `deriveArc` is the same rule on the other side of the process
 * seam (autobot's blocks.cjs, over real registry rows), where an import cannot reach — two
 * definitions is the floor the seam sets, and each process has exactly one.
 *
 * THE EMPTY SET IS NEVER COMPLETE: `[].every(settled)` is true, so without the length term an arc
 * of empty objectives would settle for free — the vacuous pass every floor in this design exists
 * to stop.
 */
export function objectiveComplete(plans = []) {
  const list = plans || [];
  const settled = list.filter((p) => p && p.settled).length;
  return { total: list.length, settled, planned: list.length > 0, complete: list.length > 0 && settled === list.length };
}

/**
 * The reasons offered from where you are standing — §4.3's narrowing, in the pure module so the
 * control cannot drift from it. A state with no class (a report's `filed`) is offered all of them.
 */
export function reasonsFor(station) {
  const cls = classOf(station);
  return RETIRE_REASONS.filter((r) => !r.only || !cls || r.only === cls);
}

/**
 * WHAT THE LEAF ITSELF DECLARES, as state flags — read straight off the attributes of the line on
 * screen. This exists because the registry row is a CACHE OF THE LAST PARSE and the trail was
 * reading it once at mount: change `settled=` in the file and the trail never moved, so pressing
 * `settled` answered *"already settled"* about a document that was not. The leaf is the freshest
 * source there is — it came from the parse of the document you are looking at.
 *
 * Only the DECLARED stations live here. `built` comes from a STATUS heading and `done` from an
 * arc's objectives, neither of which is on the leaf, so those still come off the row.
 */
export function declaredOn(kind, attrs = {}) {
  const decl = DECLARED[kind] || {};
  const out = {};
  Object.entries(decl).forEach(([, key]) => {
    const v = attrs[key];
    // EVERY DECLARED FLAG IS SET, INCLUDING TO FALSE. Returning only the present ones made this
    // useless for the job it exists for: spreading `{}` over a row that still said `settled: true`
    // left the stale value standing, so the trail kept showing settled after the leaf stopped
    // saying it. The leaf is the COMPLETE answer for the stations it owns — absent means no.
    out[FLAG_OF[key] || key] = !(v == null || String(v).trim() === "");
  });
  return out;
}

/**
 * The one state a registry row is in, in its kind's vocabulary.
 *
 * `leaf` is what the document's own line declares and it WINS over the row, because the row is the
 * last parse and the leaf is now. Pass it wherever you have it.
 */
export function stateOf(kind, row, leaf = null) {
  const st = { ...((row && row.state) || {}), ...(leaf || {}) };
  if (st.retired) return "retired";
  if (kind === "rfc") {
    const v = String(st.verdict || "").toLowerCase();
    if (v === "rejected") return "rejected";
    // EVERY STATE ABOVE DRAFT NEEDS THE VERDICT, and this used to read `settled`/`built` before it
    // ever looked (RFC-076 §2's RFC table: every condition above draft contains
    // `verdicts approved = true`). So a document with a `## STATUS` heading and no verdict read
    // **built** — a surface saying a design landed while a reviewer still holds an approval block.
    //
    // Caught on THIS RFC, by trying to write its own STATUS heading: it carries two approval
    // blocks, the completeness one is unpressed, and the heading would have made it read built.
    // §6 assigns this to no slice either; it is landed because the alternative is shipping the
    // states with a reading §2 forbids. Draft hangs on one artifact and every state above needs
    // that same artifact, which is exactly why draft is their complement and not a case of its own.
    if (!v) return "draft";
    if (st.settled) return "settled";
    if (st.built) return "built";
    return "approved";
  }
  if (kind === "arc") {
    // THE UPWARD DERIVATION (§4.4). The row's objectives carry the fold's two counts — `planned`
    // (served by at least one plan) and `complete` (every plan settled) — and the word is read off
    // them with the verdict underneath. `has objectives` is the floor: an empty arc satisfies
    // every universal for free, and the floor is what stops it taking the whole trail.
    const v = String(st.verdict || "").toLowerCase();
    if (v === "rejected") return "rejected";
    if (!v) return "draft";
    const o = st.objectives || {};
    const total = Number(o.total) || 0;
    const planned = Number(o.planned) || 0;
    const complete = Number(o.complete) || 0;
    if (total > 0 && planned === total) return complete === total ? "settled" : "inProgress";
    return "approved";
  }
  if (kind === "gap") {
    // THE FORK, AND REJECTED IS READ FIRST. A gap carrying both endings is a contradiction, and
    // reading it as `resolved` would be the surface making the STRONGER claim — that the thing is
    // closed and there is evidence for it. `rejected` claims less, so it is the honest answer to a
    // document that cannot be trusted about which ending it took.
    if (st.rejected) return "rejected";
    // The leaf declares the first half. `hasProof` is not on the leaf — it is a fact about the
    // whole document — so the row answers it, and the row is the only thing that can.
    if (st.resolvedDeclared != null) return st.resolvedDeclared && st.hasProof ? "resolved" : "open";
    return st.done ? "resolved" : "open";
  }
  return "filed";
}

/**
 * WHAT THE TRAIL DRAWS from where you are standing — which is not always its whole list.
 *
 * A trail that draws a station the document will never reach reads as *"still coming"*. So a
 * rejected RFC shows draft → rejected and nothing else, and a gap shows the ONE ending it took
 * rather than both. From `open`, though, both of a gap's endings are genuinely available and both
 * are drawn — that is the fork, and hiding half of it would hide a press.
 *
 * @returns {{steps: string[], alt: string[]}} the stations, and which of them are ALTERNATIVES to
 *   the one before rather than steps after it — the renderer draws those with a different mark.
 */
export function stepsFor(kind, current, row = null, leaf = null) {
  if (kind === "rfc") return { steps: current === "rejected" ? ["draft", "rejected"] : TRAILS.rfc, alt: [] };
  // An arc's approval can be rejected like any other — same fork, same drawing.
  if (kind === "arc") return { steps: current === "rejected" ? ["draft", "rejected"] : TRAILS.arc, alt: [] };
  if (kind === "gap") {
    if (current === "resolved") return { steps: ["open", "resolved", "retired"], alt: [] };
    if (current === "rejected") return { steps: ["open", "rejected", "retired"], alt: [] };
    // A RETIRED GAP TOOK ONE SIDE OF THE FORK, and drawing both would mark both as PAST — the
    // trail claiming the document walked through two mutually exclusive endings. So the retired
    // case reads which ending is actually declared, and a gap retired straight from `open` draws
    // open → retired with no middle at all, which is exactly what `cancelled` from open means.
    if (current === "retired") {
      const st = { ...((row && row.state) || {}), ...(leaf || {}) };
      if (st.rejected) return { steps: ["open", "rejected", "retired"], alt: [] };
      if (st.resolvedDeclared || st.done) return { steps: ["open", "resolved", "retired"], alt: [] };
      return { steps: ["open", "retired"], alt: [] };
    }
    return { steps: ["open", "resolved", "rejected", "retired"], alt: ["rejected"] };
  }
  return { steps: TRAILS[kind] || [], alt: [] };
}

// WHERE THE OTHER STATIONS COME FROM — said out loud on the control, because a button that does
// nothing teaches the surface lies. `built` is the one exception that a press CAN reach, by writing
// the dated STATUS heading the claims bar already writes.
export const DERIVED_FROM = {
  rfc: {
    draft: "there being no verdict yet",
    approved: "the approval block's verdict",
    rejected: "a rejected verdict",
  },
  arc: {
    draft: "there being no verdict yet",
    approved: "the approval blocks' verdicts, with an objective still unplanned",
    rejected: "a rejected verdict",
    inProgress: "every objective having a plan attached, with one still moving",
    settled: "every objective's plans being settled, in their own documents",
  },
  // RFC-076 §4.5 — `resolved` is the one state a press cannot outrun, and the reason it gives is
  // an INSTRUCTION rather than a dead end: the missing half is something you can go and add.
  gap: { open: "resolved= not being set" },
  report: { filed: "the document existing" },
};

/** The proof blocks that count as evidence — unrestricted on purpose (§4.5). */
export const PROOF_BLOCKS = ["run", "cmd", "test"];

/**
 * WHY `resolved` IS OUT OF REACH, when it is — separated from the generic refusal because this one
 * is actionable. A gap that has declared itself resolved and has nothing runnable in it is one
 * block away from being true, and a control that says *"a proof is missing"* and offers to add one
 * is the difference between a refusal and a step. Returns "" when nothing is missing.
 */
export function missingProof(kind, row, leaf = null) {
  if (kind !== "gap") return "";
  const st = { ...((row && row.state) || {}), ...(leaf || {}) };
  if (st.hasProof) return "";
  return "a gap is resolved by evidence, not by saying so — add a run, a cmd or a test block";
}

/**
 * WOULD THIS PRESS ACTUALLY MOVE IT? Applies the attribute changes to a copy of the row's state and
 * asks `stateOf` where that lands — the one definition answers, so a press can never disagree with
 * the trail it is drawn on.
 */
export function wouldLand(kind, row, attrs = {}, appendStatus = false, leaf = null) {
  const st = { ...((row && row.state) || {}), ...(leaf || {}) };
  Object.entries(attrs).forEach(([k, v]) => {
    const f = FLAG_OF[k] || k;
    if (v == null) delete st[f];
    else st[f] = true;
  });
  if (appendStatus) st.built = true;
  return stateOf(kind, { ...(row || {}), state: st });
}

/**
 * WHAT PRESSING A STATION HAS TO WRITE — or why it cannot.
 *
 * Going forward sets the station's own declaration. Going BACK clears every declaration past the
 * target, which is the only honest way back: the state is pinned by what the document says, so
 * un-saying it is the move. A target that nothing can reach comes back refused WITH ITS REASON
 * rather than as a dead control — `built` is pinned by a STATUS heading `setAttr` cannot remove, so
 * built → approved is refused and says so, instead of clearing two attributes and appearing stuck.
 *
 * RETIRING TAKES A REASON (§4.2) and will not go without one. That is not the old gate coming
 * back in another coat: the old gate refused the BUTTON from the wrong state, this refuses an
 * UNSAID reason from any state — `cancelled` from `draft` goes through, which is the case the gate
 * used to block. And the reason offered is narrowed by where you stand (`reasonsFor`), so pressing
 * a word that does not belong where you are is refused by name rather than silently written.
 *
 * @param {string} [reason] a RETIRE_REASONS id, required when station is `retired`
 * @param {string} [pointer] what superseded it — required by, and only by, `superseded`
 * @returns {{ok: true, attrs: object, appendStatus?: boolean} | {ok: false, why: string}}
 */
export function pressTo(kind, station, row, today, leaf = null, reason = "", pointer = "") {
  const trail = TRAILS[kind] || [];
  const decl = DECLARED[kind] || {};
  // THE LEAF WINS over a cached row: the row is the last parse, the leaf is the document on screen.
  const current = stateOf(kind, row, leaf);
  const to = trail.indexOf(station);
  if (to < 0) return { ok: false, why: `${station} is not a station on a ${kind}` };
  if (station === current) return { ok: false, why: `already ${station}` };
  const at = trail.indexOf(current);

  // A GAP'S REJECTION CARRIES ITS REASON OR IT IS NOT A REJECTION (§4.5). Without it, declined-on-
  // purpose is indistinguishable from a gap nobody looked at — which is the exact failure a gap
  // exists to prevent, so this is refused rather than written bare.
  //
  // THE REASON HERE IS FREE TEXT, and that is not an oversight: §3's gap table describes "a short
  // closed list plus a line" but never names the list's members, so inventing five words here
  // would be putting a vocabulary into the system that nobody approved. The line is the half that
  // was specified; the menu is facilitation waiting on its words.
  if (station === "rejected") {
    const said = String(reason || "").trim();
    if (!said) return { ok: false, why: "say why this is declined — a rejection without a reason reads as neglect" };
    // AND IT MAY NOT BE A STATE WORD. The reason is free text, so nothing stopped `why=resolved`
    // from being written onto a leaf — a STATE WORD stored as a fact, which is the one thing this
    // whole design forbids (c23). A blind review of c23 found the hole: the claim says no state
    // word is ever written and the free-text field was the exception nobody had looked at. It is
    // also a meaningless reason — "declined because resolved" says nothing — so refusing costs
    // nothing a real reason would want.
    if (STATE_WORDS.has(said.toLowerCase()))
      return { ok: false, why: `“${said}” is a state, not a reason — say why it is declined` };
  }

  // THE RETIREMENT'S REASON, CHECKED BEFORE ANYTHING IS WRITTEN — a half-written retirement is
  // worse than a refused one, because the document would then be out of the lists for a reason
  // nobody gave.
  let picked = null;
  if (station === "retired") {
    picked = reasonOf(reason);
    if (!picked) {
      const offered = reasonsFor(current)
        .map((r) => r.label)
        .join(", ");
      return {
        ok: false,
        why: reason
          ? `${reason} is not a retirement reason — from ${current} you can say: ${offered}`
          : `a retirement needs a reason — from ${current} you can say: ${offered}`,
      };
    }
    if (!reasonsFor(current).some((r) => r.id === picked.id))
      return { ok: false, why: `${picked.label} is not something you can say from ${current}` };
    // §4.2's one pointer. Refused rather than written half-done: "superseded" with nothing named
    // is the same dead end as a gap resolved by assertion — a claim with no referent.
    if (picked.needs && !String(pointer || "").trim())
      return { ok: false, why: `superseded by what? name the document that replaced this one` };
  }

  const attrs = {};
  // Clear every declaration PAST the target. This is how you go back, and it is also right going
  // forward: landing on settled should not leave a retired= behind it.
  trail.slice(to + 1).forEach((s2) => {
    if (decl[s2]) attrs[decl[s2]] = null;
  });
  // And clear the endings this one EXCLUDES, which the ordering above cannot reach in both
  // directions. Rejecting a gap that was resolved has to un-resolve it, or the document says both.
  ((EXCLUDES[kind] || {})[station] || []).forEach((s2) => {
    if (decl[s2]) attrs[decl[s2]] = null;
  });
  // AND WHEN `retired=` IS BEING CLEARED, ITS REASON GOES WITH IT. Un-retiring a document and
  // leaving `as=shelf` on the line leaves a live document carrying the reason it was put down —
  // a fact about a state it is no longer in, which is the kind of residue a surface reads as true.
  if (decl.retired && attrs[decl.retired] === null) {
    attrs[RETIRE_ATTR] = null;
    attrs.supersededBy = null;
  }

  let appendStatus = false;
  if (decl[station]) attrs[decl[station]] = today;
  else if (to > at && kind === "rfc" && station === "built") appendStatus = true;
  if (picked) {
    attrs[RETIRE_ATTR] = picked.id;
    if (picked.needs) attrs.supersededBy = String(pointer).trim();
  }
  // A gap's rejection writes its reason beside the date, in `why=` — the attribute §4.5 names.
  if (station === "rejected") attrs.why = String(reason).trim();

  if (wouldLand(kind, row, attrs, appendStatus, leaf) !== station) {
    // §4.5 — THE ONE REFUSAL THAT IS AN INSTRUCTION. Everything else here says where a state comes
    // from so you stop pressing; this says what to add so you can. `needs` lets the control offer
    // the fix rather than only reporting the problem.
    if (kind === "gap" && station === "resolved") {
      const gap = missingProof(kind, row, leaf);
      if (gap) return { ok: false, why: gap, needs: "proof" };
    }
    // THE REFUSAL HAS TO NAME THE RIGHT OBSTACLE, and for this one it did not. Going BACKWARD from
    // `built` to `approved` was refused with "approved comes from the approval block's verdict" —
    // true of going forward, and beside the point going back: the verdict is sitting right there,
    // and what actually blocks you is that `setAttr` cannot unwrite a `## STATUS` heading. A blind
    // review of this RFC's own claims caught it by reading c21's quoted message against c21's
    // words, which ask the control to say the heading cannot be unwritten. It now does.
    if (kind === "rfc" && station === "approved" && (((row && row.state) || {}).built || (leaf || {}).built))
      return {
        ok: false,
        why: "a press cannot unwrite the ## STATUS heading — delete it in the document to go back to approved",
      };
    const why = (DERIVED_FROM[kind] || {})[station];
    return {
      ok: false,
      why: why
        ? `${station} comes from ${why} — a press cannot fake it`
        : `nothing on this leaf declares ${station}`,
    };
  }
  return appendStatus ? { ok: true, attrs, appendStatus: true } : { ok: true, attrs };
}
