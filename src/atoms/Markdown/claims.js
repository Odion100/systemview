import { unfenced } from "./unfenced";

// CLAIMS — a statement somebody can check, written so the checking can be written back.
//
// An RFC used to end in a numbered list of claims and a STATUS line somebody typed: "built, 11/12
// met". The list could be read and never marked, and the status was an assertion with nothing
// under it — the same lie the missing status sections told, with more confidence. So a claim is a
// BLOCK: `::claim[do this → this should happen]{id=c9}`, and a press writes the mark INTO the line:
//
//   ::claim[…]{id=c9 state=met by=you at=1792… note="ran the heredoc with no window; both got it"}
//
// THE ONE HARD RULE: NO MARK WITHOUT A STATEMENT. The mark cannot be derived — it is somebody's
// word — and the only thing that keeps a word honest is what it carries: `met` says what was done
// and seen, `unmet` says what happened instead. A press with an empty note is refused. What IS
// derived is the count: `::claims` recounts the blocks every render, so the number at the top of a
// document is never typed by anyone.
//
// A PLAIN MODULE, like `objectives.js`: no React, no renderer, a line scan — so it answers for a
// document being typed into and can be tested without mounting anything.

// A fenced example is a quotation, not a claim — `unfenced`, imported at the top.

// `::claim[the statement]{attrs}` — a leaf with a label — OR its container form (RFC-075): a claim
// that carries a proof is `:::claim[statement]{attrs}` with the proof as its body, and the fence
// grows with nesting (a claim holding a `:::cmd` is `::::claim`). Two or more colons, one claim;
// the mark lives on the opening line either way. The label may hold anything but a newline; the
// attributes are optional until the first mark writes them.
const CLAIM = /^\s*:{2,}claim\[(.*)\](?:\{([^}]*)\})?\s*$/;

export const STATES = ["met", "unmet"];

// TOKENIZED, NEVER REGEXED THROUGH — the same rule both attribute WRITERS learned the hard way
// (measured 2026-10-25: a naive `(^|\s)key=` scan matches inside a QUOTED VALUE, so a note saying
// `"state= stays"` reads as the state). The bag is split into real pairs, quotes respected.
const attrOf = (attrs, key) => {
  const re = /([A-Za-z_][\w-]*)=("[^"]*"|'[^']*'|[^\s}]*)/g;
  let m;
  while ((m = re.exec(attrs || ""))) {
    if (m[1] === key) return m[2].replace(/^["']|["']$/g, "");
  }
  return "";
};

export const normalizeState = (raw) => {
  const s = String(raw || "").trim().toLowerCase();
  if (s === "met") return "met";
  if (s === "unmet" || s === "not-met" || s === "notmet") return "unmet";
  return "";
};

// WHAT KIND OF ASSERTION THIS IS — declared, never inferred, and SILENCE IS THE STRICT SIDE.
//
// A claim that asserts BEHAVIOUR owes a living spec: a defence that rides the change loop, so
// breaking its contract next month goes red in front of whoever broke it. A claim concluded by the
// human's own eye — *"the dashed badge reads as an invitation"*, *"it could be bolder"* — cannot
// have one, and forcing a test on it produces the worthless translation (`expect(badge).toHaveClass
// ("--invite")` is true and claims nothing the claim claimed). So the exemption exists, and it is
// WRITTEN: absence reads behavioural, exactly as an unmarked claim reads unchecked. Silence never
// buys a pass here either.
//
// AND IT IS DECLARED AT AUTHORING, not when the proof comes due. An agent facing a spec it would
// rather not write will discover the claim was experiential all along; at authoring nobody yet
// knows which proof is inconvenient, so the classification costs nothing to make truthfully — and
// the claims-completeness press freezes it, which makes a later exemption a visible edit to an
// approved contract rather than a quiet one.
export const normalizeKind = (raw) => {
  const s = String(raw || "").trim().toLowerCase();
  if (s === "experiential" || s === "experience" || s === "judgment" || s === "judgement") return "experiential";
  return "behavioral";
};

// THE SPEC BLOCKS, AND ONLY THEY. `::test` embeds a saved test (addressable by namespace, run by
// the suite); `:::run` is the in-fold walk. A `:::cmd` is NOT counted, deliberately: a cmd running
// the project's suite and a cmd running `grep` are indistinguishable at parse level, and a
// heuristic behind a lifecycle gate is worse than an honest absence. So this says "carries a
// spec", never "is proved" — a jest-suite cmd reads as NO SPEC, which is true, and whether the
// pinned case suffices is a reviewer's call and not a parser's.
const SPEC_BLOCK = /^\s*:{2,}(test|run)\b/;

// WHAT COUNTS AS PROOF FOR BEING MET — the HOST's vocabulary (`PROOF_KINDS` in autobot's
// blocks.cjs), mirrored exactly, because the registry row and this bar answer the same question
// about the same document and the window read `4/7 met` while the row said 2. Marked is not met: a
// claim is met when it is marked met AND it carries the proof its kind owes inside its own body —
// a SPEC (test/run/cmd — something that presses and answers) for a behavioural claim, and for an
// experiential one any evidence at all, SHOWN included (a picture is evidence the eye settles).
// `cmd` counts HERE and not in SPEC_BLOCK above, because these are different questions: met asks
// "is there evidence in the fold", spec'd asks "does the change loop defend it without anybody
// remembering to" — and a cmd is pressable evidence nothing re-runs on its own.
const PROOF_SPEC = /^\s*:{2,}(test|run|cmd)\b/;
const PROOF_SHOWN = /^\s*:{2,}(image|file|diff|logs|branch)\b/;

/**
 * Every `::claim` in a document, in the order written — which IS its number — with the line it sits
 * on so a press knows where to write back.
 */
export function parseClaims(source) {
  const lines = unfenced(source).split("\n");
  const out = [];
  for (let i = 0; i < lines.length; i += 1) {
    const m = CLAIM.exec(lines[i]);
    if (!m) continue;
    const attrs = m[2] || "";
    const by = attrOf(attrs, "by");
    const reviewers = attrOf(attrs, "reviewers");
    const names = (raw) => String(raw || "").split(/[|,]/).map((x) => x.trim()).filter(Boolean);
    const state = normalizeState(attrOf(attrs, "state"));
    // THE BODY'S EXTENT, for a container claim. The fence length is on the opening line, and
    // normalizeFences guarantees an outer fence is LONGER than every inner one — so a line of
    // exactly these colons and nothing else is unambiguously this claim's close, with no nesting
    // ambiguity to resolve. A leaf (`::claim`) has no body and carries no spec by construction.
    const fence = ((/^\s*(:+)/.exec(lines[i]) || [, ""])[1] || "").length;
    let hasSpec = false;
    let proofSpec = false;
    let proofShown = false;
    if (fence >= 3) {
      const close = new RegExp(`^\\s*:{${fence}}\\s*$`);
      for (let j = i + 1; j < lines.length; j += 1) {
        if (close.test(lines[j])) break;
        if (SPEC_BLOCK.test(lines[j])) hasSpec = true;
        if (PROOF_SPEC.test(lines[j])) proofSpec = true;
        if (PROOF_SHOWN.test(lines[j])) proofShown = true;
      }
    }
    const kind = normalizeKind(attrOf(attrs, "kind"));
    // PROVED, by the claim's own declaration: behavioural owes a spec, experiential owes anything
    // shown. A leaf claim has no body, so it can never be proved — there is nowhere in it for
    // evidence to live, which is the point.
    const proved = kind === "experiential" ? proofSpec || proofShown : proofSpec;
    out.push({
      n: out.length + 1,
      line: i + 1,
      statement: m[1].trim(),
      id: attrOf(attrs, "id"),
      state,
      kind,
      // CARRIES A SPEC — the living-spec half is present in the fold. Not "proved": see SPEC_BLOCK.
      hasSpec,
      // PROVED — the proof its kind owes is embedded. MARKED IS NOT MET: `met` below requires this,
      // because the window once said 4/7 met over a row that honestly said 2.
      proved,
      // OWED is the honest gap: a behavioural claim someone marked met with no spec behind it. It
      // reads met today and is defended by nobody once the conversation ends.
      owed: kind === "behavioral" && !!state && !hasSpec,
      by,
      at: Number(attrOf(attrs, "at")) || 0,
      note: attrOf(attrs, "note"),
      reviewers,
      // REVIEWED is the second axis (RFC-075 round two, his: "green is all met, but I didn't check
      // off everything"): marked is the builder's word; reviewed means the human signed AND every
      // declared reviewer did. A mark alone must never read as done.
      reviewed: !!state && names(by).includes("you") && names(reviewers).every((r) => names(by).includes(r)),
    });
  }
  return out;
}

/** The count a `::claims` block draws. Derived every time; stored nowhere. */
export function claimsOf(source) {
  const all = parseClaims(source);
  // MET IS MARKED **AND** PROVED — the same conjunction the registry row derives (`metClaims` in
  // autobot's blocks.cjs), so this bar can never again disagree with the row about the one number
  // both exist to report. An agent's mark with `by=` and no `note=` never counted as a mark
  // (RFC-075), so it is unchecked here too, not merely unproved.
  const names = (raw) => String(raw || "").split(/[|,]/).map((x) => x.trim()).filter(Boolean);
  const marked = all.filter(
    (c) => c.state === "met" && (names(c.by).includes("you") || !c.by || !!String(c.note || "").trim()),
  );
  const met = marked.filter((c) => c.proved).length;
  const unmet = all.filter((c) => c.state === "unmet").length;
  // THE GAP BETWEEN SAID AND SHOWN — how many marks are resting on nothing. This is the number
  // nobody could see: 24 of 41 marked met, 21 carrying nothing, while a green suite ran the whole
  // time. The evidence existed; it was never embedded, so every reader took one agent's word.
  const unproved = marked.length - met;
  const reviewed = all.filter((c) => c.reviewed).length;
  // THE THIRD AXIS. Marked is the builder's word; reviewed means it was signed; SPEC'D means a
  // defence stands that the change loop will run without anybody remembering to. A document whose
  // behavioural claims carry no specs is a document of commitments nothing defends — which is what
  // `settled` has to mean something against.
  const behavioral = all.filter((c) => c.kind === "behavioral");
  return {
    total: all.length,
    met,
    unmet,
    unproved,
    unchecked: all.length - met - unproved - unmet,
    reviewed,
    behavioral: behavioral.length,
    experiential: all.length - behavioral.length,
    specd: behavioral.filter((c) => c.hasSpec).length,
    owed: all.filter((c) => c.owed).length,
    claims: all,
  };
}

/** This claim, by the line it opens on — null when the line holds no claim. */
export function claimAt(source, line) {
  return parseClaims(source).find((x) => x.line === Number(line)) || null;
}

/** This claim's number, by its line. 0 when the line holds no claim. */
export function ordinalOf(source, line) {
  const c = parseClaims(source).find((x) => x.line === Number(line));
  return c ? c.n : 0;
}

// RFC-075 — THE RETROFIT: a leaf claim grows its container form so a proof can be written into it.
// Nobody retypes a statement to give it a proof — the leaf line is rewritten in place (`::` → `:::`)
// and the closing fence lands under an empty body line. Only a LEAF grows: a line that is already a
// container, or holds no claim, answers null — a no-op is not a change. The save path's fence
// normalizer re-widens outer containers if this claim sits inside one.
export function growProof(source, line) {
  const lines = String(source == null ? "" : source).split("\n");
  const i = Number(line) - 1;
  if (i < 0 || i >= lines.length) return null;
  const m = /^(\s*)(:{2,})claim\[/.exec(lines[i]);
  if (!m || m[2].length !== 2) return null; // not a claim, or already a container
  lines[i] = lines[i].replace("::claim[", ":::claim[");
  lines.splice(i + 1, 0, "", ":::");
  return lines.join("\n");
}

const claims = { parseClaims, claimsOf, ordinalOf, growProof, normalizeState, STATES };
export default claims;
