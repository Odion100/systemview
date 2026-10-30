// FACILITATION — what a press on a station it cannot directly reach DOES INSTEAD (RFC-076 §3,
// column four, plus his two corrections at the first live walk, 2026-10-29):
//
//   1. THE LADDER. Pressing a station far from where you stand shows EVERY step between — "you got
//      to hit the approvals, you got to hit this, and then you move on" — each one a button when
//      its turn comes, a ✓ once the source says it happened. One panel, the whole distance.
//   2. SIGNING IS A BUTTON. "It's supposed to be able to click all the approval blocks for you" —
//      the facilitation writes `verdict=approved by=you at=` onto the awaiting blocks; the press on
//      the button IS the signature. (The first build only pointed, off the table's older wording.)
//
// AND THE CURRENT STATE IS READ OFF THE SOURCE, never the registry row — the row is the last
// parse's cache and it was stale at the first demo: the panel never opened because the row still
// said draft about a document whose approvals were signed on screen. The source is the document in
// front of you; for everything the ladder needs (verdicts, claims, the STATUS heading, the leaf's
// own declarations) it is also the complete answer.
//
// RFC ONLY for now (his scope); the other kinds' columns land the same way when their turn comes.
// Pure — no React — so every ladder is provable in Jest.
import { parseClaims } from "../claims";
import { parseObjectives, plansByObjective, addressOf } from "../objectives";
import { unfenced } from "../unfenced";

// The same tokenizer rule claims.js learned the hard way: never regex THROUGH a bag — a quoted
// note saying "state= stays" reads as the state. Pairs are walked, quotes respected.
const attrOf = (attrs, key) => {
  const re = /([A-Za-z_][\w-]*)=("[^"]*"|'[^']*'|[^\s}]*)/g;
  let m;
  while ((m = re.exec(attrs || ""))) {
    if (m[1] === key) return m[2].replace(/^["']|["']$/g, "");
  }
  return "";
};

const names = (raw) => String(raw || "").split(/[|,]/).map((x) => x.trim()).filter(Boolean);
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * Every approval block in the document: { line, verdict, by, ask }, in order. THE ONE APPROVAL
 * SCAN — `approvalWaiting.js` maps its answer rather than running a second one, because "is a
 * decision waiting on him" and "what stands between here and there" were two readers of one
 * subject and they disagreed on two real documents.
 *
 * THE OPENER IS THE PERMISSIVE ONE, which is `approvalWaiting`'s and not this file's former rule.
 * It had `:{3,}approval\{…\}` — no space, braces required — and that misses the two shapes most
 * likely to be WAITING: `::: approval{…}` and a bare `:::approval` with no attributes at all,
 * which is an approval with no verdict by construction. A block this could not see was a block the
 * ladder offered no step for.
 *
 * UNFENCED FIRST, the same rule the objective and claim scans already follow, and the half
 * `approvalWaiting` never had: a ```markdown example of `:::approval` is a document TEACHING the
 * vocabulary, not a document holding a decision. Not hypothetical — RFC-073 quotes an approved one
 * inside a fence, so it read three approvals where it has two, and a fenced example with no verdict
 * would have pinned the document at draft and put a phantom obligation on the band.
 */
const OPENER = /^[ \t]*:{3,}[ \t]*approval\b([^\n]*)$/;
export function parseApprovals(source) {
  const lines = unfenced(source).split("\n");
  const out = [];
  for (let i = 0; i < lines.length; i += 1) {
    const m = OPENER.exec(lines[i]);
    if (!m) continue;
    out.push({
      line: i + 1,
      verdict: attrOf(m[1], "verdict"),
      by: attrOf(m[1], "by"),
      ask: attrOf(m[1], "ask"),
    });
  }
  return out;
}

/**
 * WHERE AN RFC STANDS, read off the document itself — the same reading `stateOf` does from the
 * row, sourced from the page instead of the cache. `leaf` is the leaf line's declared flags
 * (declaredOn), which carry settled/retired; everything else is in the text.
 */
export function rfcCurrent(source, leaf = {}) {
  if (leaf.retired) return "retired";
  const approvals = parseApprovals(source);
  const verdicts = approvals.map((a) => String(a.verdict || "").toLowerCase());
  if (verdicts.some((v) => v === "rejected")) return "rejected";
  if (!approvals.length || verdicts.some((v) => !v)) return "draft";
  if (leaf.settled) return "settled";
  if (/^##\s*STATUS\b/m.test(String(source || ""))) return "built";
  return "approved";
}

// ─── THE STEP BUILDERS — one per station, each answering "what stands between here and you" ────
// A step: { label, done } plus at most one of:
//   writes:[{line,pairs}]  — one save over several lines (setAttrs)
//   appendStatus:true      — write the dated ## STATUS heading
//   leafPairs:{…}          — pairs for the leaf's own line
// and optional note (what is NOT yours, named — never done for its owner).

function stepApprovals(approvals, now) {
  const awaiting = approvals.filter((a) => !a.verdict);
  const done = approvals.length > 0 && !awaiting.length;
  return {
    label: done ? `the ${plural(approvals.length, "approval")} carry their verdicts` : `sign the ${plural(awaiting.length, "approval")} — your press is the signature`,
    done,
    writes: awaiting.map((a) => ({ line: a.line, pairs: { verdict: "approved", by: "you", at: now || undefined } })),
  };
}

function stepMarks(claims, now) {
  const unmarked = claims.filter((c) => !c.state);
  const theirs = unmarked.filter((c) => {
    const r = names(c.reviewers);
    return r.length && !r.includes("you");
  });
  const yours = unmarked.filter((c) => !theirs.includes(c));
  const owners = [...new Set(theirs.flatMap((c) => names(c.reviewers)))];
  return {
    label: unmarked.length ? `mark the ${plural(yours.length, "claim")} that are yours` : "every claim carries a mark",
    done: !unmarked.length,
    writes: yours.map((c) => ({
      line: c.line,
      pairs: { state: "met", by: names(c.by).includes("you") ? c.by : [...names(c.by), "you"].join("|"), at: now || undefined },
    })),
    note: theirs.length ? `${theirs.length} belong to ${owners.join(", ")} — their marks are theirs to make` : "",
  };
}

const stepStatus = (source) => ({
  label: "write the dated STATUS heading — that is what built reads",
  done: /^##\s*STATUS\b/m.test(String(source || "")),
  appendStatus: true,
});

function stepReviews(claims, leaf, today) {
  const marked = claims.filter((c) => !!c.state);
  const unsigned = marked.filter((c) => !names(c.by).includes("you"));
  const waiting = [...new Set(marked.flatMap((c) => names(c.reviewers)).filter((r) => r !== "you"))].filter((r) =>
    marked.some((c) => names(c.reviewers).includes(r) && !names(c.by).includes(r)),
  );
  if (unsigned.length)
    return {
      label: `check off all ${plural(unsigned.length, "review")} of yours`,
      done: false,
      writes: unsigned.map((c) => ({ line: c.line, pairs: { by: [...names(c.by), "you"].join("|") } })),
      note: waiting.length ? `waiting on: ${waiting.join(", ")} — their co-signatures are not offered here` : "",
    };
  return {
    label: waiting.length ? `declare it settled — waiting on: ${waiting.join(", ")}` : "declare it settled",
    done: !!leaf.settled,
    leafPairs: { settled: today },
  };
}

// ─── THE ARC'S COLUMN — and it is the one kind whose steps are not in its own document ─────────
//
// An arc derives UPWARD: its state is read off the plans attached to its objectives, each living
// in its own file. So the step list needs the REGISTRY (every row carrying `arc=<ARC-nnn-Ox>`)
// beside the arc's own objectives — and almost none of its steps can be a button, because the
// work is somewhere else. Naming what is outstanding IS the facilitation here; a count was the
// defect (the row said 2/4 planned and nothing anywhere said WHICH two).

// `plansByObjective` is `objectives.js`'s — the arc's upward derivation and the spec map must not
// disagree about which objective a plan serves, and this file used to hold its own copy of it.

const planState = (r) => {
  const st = (r && r.state) || {};
  if (st.retired) return "retired";
  if (st.settled) return "settled";
  if (st.built) return "built";
  const v = String(st.verdict || "").toLowerCase();
  return v || "draft";
};

// Every objective with no plan attached, NAMED — claim c19's whole subject. Not a button: a plan
// is a document somebody writes, and offering to fake one is offering to lie about the arc.
function stepArcPlanned(objectives, byObj, arcId) {
  const unplanned = objectives.filter((o) => !(byObj[o.id] || []).length);
  if (!objectives.length)
    return { label: "this arc has no objectives — an empty arc satisfies every universal for free", done: false };
  return {
    label: unplanned.length
      ? `plan ${unplanned.map((o) => `${addressOf(arcId, o.id)}${o.title ? ` (${o.title})` : ""}`).join(" · ")}`
      : "every objective has a plan attached",
    done: !unplanned.length,
    note: unplanned.length ? "a plan is a document somebody writes — write it, attach it with arc=, and this crosses itself off" : "",
  };
}

// The plans that are not settled, named with the state they are actually in — "waiting on" is the
// honest form when none of the work is here.
function stepArcSettled(byObj) {
  const plans = Object.values(byObj).flat();
  const moving = plans.filter((r) => planState(r) !== "settled");
  return {
    label: moving.length
      ? `waiting on: ${moving.map((r) => `${r.id} (${planState(r)})`).join(" · ")}`
      : "every attached plan is settled",
    done: plans.length > 0 && !moving.length,
    note: moving.length ? "an arc settles when its plans do — each press lives in that plan's own document" : "",
  };
}

function facilitateArc(station, current, source, ctx, now, leaf, today) {
  const { rows = [], id = "" } = ctx || {};
  const approvals = parseApprovals(source);
  const objectives = parseObjectives(source);
  const byObj = plansByObjective(rows, id);
  const trail = ["draft", "approved", "inProgress", "settled", "retired"];
  const from = trail.indexOf(current);
  const to = trail.indexOf(station);
  if (to < 0 || from < 0) return null;

  if (station === "draft") {
    const given = approvals.filter((a) => a.verdict);
    if (!given.length) return null;
    const whose = [...new Set(given.map((a) => a.by).filter(Boolean))];
    return {
      title: "to reach draft",
      steps: [
        {
          label: `clear the ${plural(given.length, "verdict")}`,
          done: false,
          writes: given.map((a) => ({ line: a.line, pairs: { verdict: null, by: null, at: null } })),
          note: `${whose.length ? `verdicts by ${whose.join(", ")} — ` : ""}the objectives and their plans are untouched`,
          ...(leaf.retired ? { leafPairs: { retired: null, retiredAs: null, supersededBy: null } } : {}),
        },
      ],
    };
  }
  if (to <= from) return null; // every other backward move on an arc is a detach, in the plan's own file

  const steps = [];
  if (to >= 1 && from < 1 && approvals.length) steps.push(stepApprovals(approvals, now));
  if (to >= 2) steps.push(stepArcPlanned(objectives, byObj, id));
  // SETTLED HAS NO BUTTON AT ALL, and the panel says why (claim c22). This state is derived upward
  // and no hand can write it — so its step is a sentence, never a press, and the "nothing left in
  // the way" offer must not appear behind it either.
  if (to >= 3) steps.push(stepArcSettled(byObj));
  if (!steps.filter((s) => !s.done).length) return null;
  return { title: `to reach ${station}`, steps };
}

// ─── THE GAP'S COLUMN — the refusal that is an instruction, and the reopen that names a person ──

function facilitateGap(station, current, source, ctx, now, leaf, today) {
  const { attrs = {}, project = "" } = ctx || {};
  if (station === "open") {
    // REOPENING UNDOES SOMEBODY ELSE'S WORK, so the step says whose and when — a gap is usually
    // closed by the owning project's agent, not by whoever is reading it.
    const was = attrs.resolved ? "resolved" : attrs.rejected ? "rejected" : "";
    if (!was) return null;
    const when = String(attrs[was] || "").trim();
    const who = String(attrs.by || "").trim();
    return {
      title: "back to open",
      steps: [
        {
          label: `remove ${was}=`,
          done: false,
          leafPairs: was === "rejected" ? { rejected: null, why: null } : { resolved: null },
          note: `${was}${when ? ` ${when}` : ""}${who ? ` by ${who}` : ""} — reopening ${
            was === "rejected" ? "reverses that decision" : "undoes that fix"
          }`,
        },
      ],
    };
  }
  if (station === "resolved" && current === "open") {
    // THE ONE REFUSAL THAT IS AN INSTRUCTION: a gap is resolved by evidence, not by saying so, and
    // the missing half is something you can add right here. The step APPENDS the skeleton; the
    // press that follows completes by itself.
    const hasProof = !!((leaf && leaf.hasProof) || attrs.hasProof);
    const steps = [
      {
        label: hasProof ? "the document carries a proof" : "attach a proof — a run, a cmd, or a test that closes it",
        done: hasProof,
        appendText: ":::cmd\n# what proves this gap is closed — press it\n:::",
      },
    ];
    if (project)
      steps.push({
        label: `write resolved= into ${project}'s copy`,
        done: false,
        note: "a gap lives in the repo it was filed INTO, and the presser is usually not its owner",
      });
    if (!steps.filter((s) => !s.done).length) return null;
    return { title: "to reach resolved", steps };
  }
  return null; // rejected asks for its reason in its own field; retired has the reason menu
}

/**
 * THE PLAN A PRESS OPENS — `{ title, steps:[…] }` — or null when there is nothing to facilitate
 * and the write (or its named refusal) is the answer. The gates stay gates: built → approved still
 * refuses on the STATUS heading, in pressTo, by name.
 *
 * `ctx` carries what a kind's steps cannot read off its own document: `rows` (the registry, for an
 * arc's plans), `id`, `project`, and the leaf's raw `attrs` (for a gap's closing date and hand).
 */
export function facilitate(kind, station, current, source, now = 0, leaf = {}, today = "", ctx = {}) {
  if (station === current || !String(source || "").trim()) return null;
  if (kind === "arc") return facilitateArc(station, current, source, ctx, now, leaf, today);
  if (kind === "gap") return facilitateGap(station, current, source, ctx, now, leaf, today);
  return facilitateRfc(kind, station, current, source, now, leaf, today);
}

function facilitateRfc(kind, station, current, source, now = 0, leaf = {}, today = "") {
  // NO SOURCE, NO FACILITATION — a surface that cannot hand over the document (the chat's
  // session render, a bare test mount) gets the write path and its named refusals, never a
  // ladder derived from an empty string ("sign the 0 approvals" is how that reads). Checked by
  // the one door above; a report has no column of its own (existence is not pressable).
  if (kind !== "rfc") return null;
  const approvals = parseApprovals(source);
  const claims = parseClaims(source);
  const trail = ["draft", "approved", "built", "settled", "retired"];
  const from = trail.indexOf(current);
  const to = trail.indexOf(station);
  if (to < 0 || from < 0) return null;

  // FORWARD — the ladder: every station between here and there contributes its step, done ones
  // wearing their ✓ so the distance is visible even where it is already crossed. A step whose
  // subject does not exist in the document (no approvals, no claims) is not a step — it is the
  // write path's refusal, which names where the state really comes from.
  if (to > from) {
    const steps = [];
    if (to >= 1 && from < 1 && approvals.length) steps.push(stepApprovals(approvals, now));
    if (to >= 2 && claims.length) steps.push(stepMarks(claims, now));
    if (to >= 2 && steps.length) steps.push(stepStatus(source));
    if (to >= 3 && claims.length) steps.push(stepReviews(claims, leaf, today || undefined));
    const open = steps.filter((s) => !s.done);
    if (!open.length) return null; // nothing between — the press itself is the answer
    return { title: `to reach ${station}`, steps };
  }

  // BACKWARD — single honest steps, from the table.
  if (station === "draft") {
    const given = approvals.filter((a) => a.verdict);
    if (!given.length) return null;
    const whose = [...new Set(given.map((a) => a.by).filter(Boolean))];
    return {
      title: "to reach draft",
      steps: [
        {
          label: `clear the ${plural(given.length, "verdict")}`,
          done: false,
          writes: given.map((a) => ({ line: a.line, pairs: { verdict: null, by: null, at: null } })),
          note: `${whose.length ? `verdicts by ${whose.join(", ")} — ` : ""}co-signatures and claim marks stay; neither defines draft`,
          // Declarations PAST draft go in the same press — a draft carrying `settled=` is a
          // document saying two states at once, the residue pressTo's own backward path clears.
          ...(leaf.settled ? { leafPairs: { settled: null } } : {}),
        },
      ],
    };
  }
  if (station === "built" && current === "settled") {
    const signed = claims.filter((c) => names(c.by).includes("you") && !!c.state);
    if (!signed.length) return null;
    return {
      title: "back to built",
      steps: [
        {
          label: `remove your ${plural(signed.length, "co-signature")}`,
          done: false,
          writes: signed.map((c) => ({
            line: c.line,
            pairs: { by: names(c.by).filter((x) => x !== "you").join("|") || null },
          })),
          note: "the claim marks stay — a co-signature removed is a review withdrawn, not a claim unmade",
          leafPairs: { settled: null },
        },
      ],
    };
  }
  return null;
}

export default facilitate;
