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

const FENCED = /^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1[^\n]*$/gm;
const unfenced = (src) => String(src || "").replace(FENCED, (m) => m.replace(/[^\n]/g, ""));

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
    out.push({
      n: out.length + 1,
      line: i + 1,
      statement: m[1].trim(),
      id: attrOf(attrs, "id"),
      state,
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
  const met = all.filter((c) => c.state === "met").length;
  const unmet = all.filter((c) => c.state === "unmet").length;
  const reviewed = all.filter((c) => c.reviewed).length;
  return { total: all.length, met, unmet, unchecked: all.length - met - unmet, reviewed, claims: all };
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
