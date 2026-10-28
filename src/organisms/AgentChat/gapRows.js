import { stateOf as lifecycleStateOf, reasonOf, GROUP_OF } from "../../atoms/Markdown/blocks/lifecycleState";

// THE BAND'S GAP ROWS — the fourth registered kind, which had no surface anywhere.
//
// Arcs, RFCs and reports each got a tab; a gap got nothing, so the one kind written by an agent
// INTO SOMEBODY ELSE'S REPO — the kind whose whole purpose is to be found by a person who did not
// file it — was the only kind you could not see. His words, looking for them: *"I don't know where
// the fuck our gaps [are]. I only see arcs, RFC."*
//
// WHAT A GAP ROW HAS TO SAY, and it is not the same as the other kinds. A gap's state forks at the
// end — `resolved` needs a PROOF in the document, `rejected` carries a reason — so the two things
// worth knowing from the row are which ending it took and, when it took none, whether it is one
// block away from being closeable. `open · no proof yet` is a different situation from `open` with
// evidence already sitting in the file waiting for somebody to press, and nothing else shows it.

/** The id a gap row shows — the registry's, which is the identity. The path is a fallback only. */
export const gapIdFromPath = (path = "") => {
  const m = /\/(G-\d+|GAP-\d+)[^/]*\.md$/i.exec(String(path));
  return m ? m[1].toUpperCase() : "";
};

const titleOf = (text = "", path = "") => {
  const h = /^#\s+(.+)$/m.exec(String(text));
  if (h) return h[1].replace(/^(G|GAP)-\d+\s*[—\-–:]\s*/i, "").trim();
  const m = /\/([^/]*)\.md$/i.exec(String(path));
  return m ? m[1].replace(/-/g, " ") : "";
};

// Open first, because the band is a place to ACT and an open gap is the only kind of row here that
// is asking for anything. Then the ones that are one press from closing, then the endings.
const RANK = { open: 1, resolved: 2, rejected: 3, retired: 4, "": 5 };

export function gapRows(docs = []) {
  return docs
    .map((d) => {
      const row = d.row || null;
      const id = (row && row.id) || gapIdFromPath(d.path);
      if (!id) return null;
      const st = row && row.state ? row.state : null;
      const state = st ? lifecycleStateOf("gap", row) : "";
      return {
        key: d.path,
        path: d.path,
        id,
        title: (row && row.title) || titleOf(d.text, d.path),
        state,
        // THE TWO HALVES OF `resolved`, SEPARATELY. A gap that says it is resolved and has nothing
        // runnable in it is not resolved — and the row is the only place that distinction is
        // visible without opening the file.
        declared: !!(st && st.resolvedDeclared),
        hasProof: !!(st && st.hasProof),
        why: st ? String(st.rejectedWhy || "") : "",
        retiredAs: st ? String(st.retiredAs || "") : "",
        retireGroup: st ? GROUP_OF(st.retiredAs) : "",
      };
    })
    .filter(Boolean)
    // An ENDING leaves the active list; a PAUSE stays, showing its reason. Same rule as the RFC
    // drawer, because it is one rule about retirement and not a per-kind preference.
    .filter((r) => r.retireGroup !== "ending")
    .sort((a, b) => {
      const r = (RANK[a.state] ?? 9) - (RANK[b.state] ?? 9);
      if (r) return r;
      return String(a.id).localeCompare(String(b.id), undefined, { numeric: true });
    });
}

/**
 * The line on the right of a gap row — where it stands, and what it is waiting for.
 *
 * THE INTERESTING CASE IS `open` WITH A PROOF ALREADY IN IT: somebody fixed the thing and left the
 * evidence, and all that is missing is the press. That row says *"open · proof ready"*, which is an
 * invitation. The reverse — a `resolved=` written with nothing behind it — says what is missing
 * rather than reading as closed, because the state condition already refuses to call it resolved
 * and a row that said "resolved" there would be the surface disagreeing with the derivation.
 */
export const gapLine = (r) => {
  if (!r.state) return "";
  if (r.state === "retired") {
    const label = r.retiredAs ? (reasonOf(r.retiredAs) || {}).label || r.retiredAs : "";
    return label ? `retired — ${label}` : "retired";
  }
  if (r.state === "rejected") return r.why ? `declined — ${r.why}` : "declined";
  if (r.state === "resolved") return "resolved";
  if (r.declared) return "open · says resolved, no proof in it";
  if (r.hasProof) return "open · proof ready";
  return "open";
};

export default gapRows;
