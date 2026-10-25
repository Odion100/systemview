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

// `::claim[the statement]{attrs}` — a leaf with a label. The label may hold anything but a newline;
// the attributes are optional until the first mark writes them.
const CLAIM = /^\s*::claim\[(.*)\](?:\{([^}]*)\})?\s*$/;

export const STATES = ["met", "unmet"];

const attrOf = (attrs, key) => {
  const m = new RegExp(`(?:^|\\s)${key}=("[^"]*"|[^\\s}]*)`).exec(attrs || "");
  return m ? m[1].replace(/^"|"$/g, "") : "";
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
    out.push({
      n: out.length + 1,
      line: i + 1,
      statement: m[1].trim(),
      id: attrOf(attrs, "id"),
      state: normalizeState(attrOf(attrs, "state")),
      by: attrOf(attrs, "by"),
      at: Number(attrOf(attrs, "at")) || 0,
      note: attrOf(attrs, "note"),
    });
  }
  return out;
}

/** The count a `::claims` block draws. Derived every time; stored nowhere. */
export function claimsOf(source) {
  const all = parseClaims(source);
  const met = all.filter((c) => c.state === "met").length;
  const unmet = all.filter((c) => c.state === "unmet").length;
  return { total: all.length, met, unmet, unchecked: all.length - met - unmet, claims: all };
}

/** This claim's number, by its line. 0 when the line holds no claim. */
export function ordinalOf(source, line) {
  const c = parseClaims(source).find((x) => x.line === Number(line));
  return c ? c.n : 0;
}

const claims = { parseClaims, claimsOf, ordinalOf, normalizeState, STATES };
export default claims;
