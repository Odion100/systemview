// WHERE THE CLAIMS STAND, AND WHAT IS OWED ON EACH — the same composition `arcPlan` does for an
// arc's objectives, for a document's claims. No React in it, so every number here is provable.
//
// WHY IT EXISTS. `::claims` drew one bar and then eight chips along a header — `2 not met`,
// `2 marked, unproved`, `1 unchecked`, `3/5 spec'd`, `1 owed` — each of which is a count of rows
// you then could not see. The reader was told how many were wrong and never which. That is the
// same failure the arc map had, and the ledger is the same answer: the summary stays a summary,
// and every claim becomes a row that says its own state and what it owes, in a sentence.
//
// THE VOCABULARY IS THE DOCTRINE'S, unchanged — marked is a word, proved is evidence embedded,
// spec'd is a defence that re-runs without anyone remembering to, and met is marked AND proved.

/** The word a claim reads as. `unproved` is not a written state — it is marked with nothing behind it. */
export function wordOf(c) {
  if (!c.state) return "unchecked";
  if (c.state === "unmet") return "not met";
  if (c.proved) return c.reviewed ? "met · signed" : "met";
  return "unproved";
}

/** Which colour family the row takes — the ledger's five, no new ones. */
export function toneOf(c) {
  if (!c.state) return "open";
  if (c.state === "unmet") return "cycle";
  if (c.proved) return "done";
  return "blocked";
}

/**
 * WHAT THIS CLAIM OWES, in the sentence somebody acts on. Ordered worst-first within the claim,
 * the way `arcPlan.stoppersOf` orders an objective's: the costly one is a mark resting on nothing,
 * because it reads finished and is defended by nobody once the conversation ends.
 */
export function owesOf(c) {
  const out = [];
  if (c.state === "met" && !c.proved)
    out.push({
      kind: "blocked",
      text:
        c.kind === "experiential"
          ? "marked met with nothing shown — an experiential claim owes the evidence, even though it owes no spec"
          : "marked met with no proof in its body — the mark is one agent's word until the evidence is embedded",
    });
  // NO SPEC, AND IT SAYS SO IN AMBER. Two corrections live in these two lines. The words: the
  // LIVING SPEC is the claim carrying its proof — the whole arrangement — not the test inside it,
  // so calling the missing test "a living spec" named the wrong thing. And the colour: this was
  // grey, which reads as a note. A behavioural claim standing with no spec is defended by nobody
  // the moment the conversation ends, and that is a person-must-act condition, not a remark.
  if (c.owed && c.proved)
    out.push({ kind: "blocked", text: "no spec — nothing re-checks this once the conversation ends" });
  if (c.owed && !c.proved && c.kind === "behavioral")
    out.push({ kind: "blocked", text: "no spec — a proof that does not re-run defends nothing tomorrow" });
  // AN UNMET CLAIM OWES AN ACCOUNT — from an AGENT. An agent's word is only as good as what it
  // rests on, so `by=` with no `note=` is testimony. HIS press is its own evidence and his note
  // is optional (RFC-075); demanding one the instant he presses "not met" is a surface nagging
  // the one party it cannot nag.
  if (c.state === "unmet") {
    const his = String(c.by || "").split(/[|,]/).map((x) => x.trim()).includes("you");
    if (c.note) out.push({ kind: "cycle", text: `not met — ${c.note}` });
    else if (!his) out.push({ kind: "cycle", text: "not met, with no account of what happens instead" });
  }
  if (c.state && c.proved && !c.reviewed)
    out.push({ kind: "waiting", text: "proved, and nobody has signed it — a mark is the builder's own word" });
  return out;
}

/**
 * THE WHOLE PICTURE, from one parse.
 *
 *   rowsOf(claimsOf(source))
 *
 * `pct` is MET over total and nothing else — met being marked AND proved, which is the same
 * conjunction the registry row derives, so this bar and that row can never disagree about the one
 * number both exist to report.
 */
export function rowsOf(input) {
  const c = input || {};
  const claims = c.claims || [];
  return {
    total: claims.length,
    pct: claims.length ? Math.round((c.met / claims.length) * 100) : 0,
    met: c.met || 0,
    unmet: c.unmet || 0,
    unproved: c.unproved || 0,
    unchecked: c.unchecked || 0,
    reviewed: c.reviewed || 0,
    specd: c.specd || 0,
    behavioral: c.behavioral || 0,
    owed: c.owed || 0,
    rows: claims.map((x) => ({ ...x, word: wordOf(x), tone: toneOf(x), owes: owesOf(x) })),
  };
}

const claimRows = { rowsOf, wordOf, toneOf, owesOf };
export default claimRows;
