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
  gap: { resolved: "resolved", retired: "retired" },
  report: { retired: "retired" },
};

// Which state flag each leaf attribute sets. `resolved=` lands on `done` for a gap — the shell's
// own mapping, mirrored here so a press can be simulated before it is made, and so the leaf's own
// attributes can be read as state.
const FLAG_OF = { settled: "settled", retired: "retired", resolved: "done" };

// What each kind can be, in the order it becomes them. These are the registry's own derivations
// (the shell's `deriveState`) given their reading names — not a parallel state machine.
export const TRAILS = {
  // SETTLED: built means landed AND still moving — reviewed, amended, proofs pressed. Settled is
  // when the modification stops because nothing is left to modify; retired is the document leaving
  // active service. A declaration (`settled=` on the leaf), never derived from quiet.
  rfc: ["draft", "approved", "built", "settled", "retired"],
  arc: ["open", "done", "retired"],
  gap: ["open", "resolved", "retired"],
  // A report is never done — it is a view, it only gets old. Two stations.
  report: ["filed", "retired"],
};

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
    if (st.settled) return "settled";
    if (st.built) return "built";
    const v = String(st.verdict || "").toLowerCase();
    if (v === "rejected") return "rejected";
    return v ? "approved" : "draft";
  }
  if (kind === "arc") return st.done ? "done" : "open";
  if (kind === "gap") return st.done ? "resolved" : "open";
  return "filed";
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
  arc: { open: "an objective still being open", done: "every objective being done" },
  gap: { open: "resolved= not being set" },
  report: { filed: "the document existing" },
};

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
 * @returns {{ok: true, attrs: object, appendStatus?: boolean} | {ok: false, why: string}}
 */
export function pressTo(kind, station, row, today, leaf = null) {
  const trail = TRAILS[kind] || [];
  const decl = DECLARED[kind] || {};
  // THE LEAF WINS over a cached row: the row is the last parse, the leaf is the document on screen.
  const current = stateOf(kind, row, leaf);
  const to = trail.indexOf(station);
  if (to < 0) return { ok: false, why: `${station} is not a station on a ${kind}` };
  if (station === current) return { ok: false, why: `already ${station}` };
  const at = trail.indexOf(current);

  const attrs = {};
  // Clear every declaration PAST the target. This is how you go back, and it is also right going
  // forward: landing on settled should not leave a retired= behind it.
  trail.slice(to + 1).forEach((s2) => {
    if (decl[s2]) attrs[decl[s2]] = null;
  });

  let appendStatus = false;
  if (decl[station]) attrs[decl[station]] = today;
  else if (to > at && kind === "rfc" && station === "built") appendStatus = true;

  if (wouldLand(kind, row, attrs, appendStatus, leaf) !== station) {
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
