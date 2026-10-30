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

/** Every `:::approval{…}` in the document: { line, verdict, by, ask }, in order. */
export function parseApprovals(source) {
  const lines = String(source || "").split("\n");
  const out = [];
  for (let i = 0; i < lines.length; i += 1) {
    const m = /^\s*:{3,}approval\{([^}]*)\}/.exec(lines[i]);
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

/**
 * THE PLAN A PRESS OPENS — `{ title, steps:[…] }` — or null when there is nothing to facilitate
 * and the write (or its named refusal) is the answer. The gates stay gates: built → approved still
 * refuses on the STATUS heading, in pressTo, by name.
 */
export function facilitate(kind, station, current, source, now = 0, leaf = {}, today = "") {
  // NO SOURCE, NO FACILITATION — a surface that cannot hand over the document (the chat's
  // session render, a bare test mount) gets the write path and its named refusals, never a
  // ladder derived from an empty string ("sign the 0 approvals" is how that reads).
  if (kind !== "rfc" || station === current || !String(source || "").trim()) return null;
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
