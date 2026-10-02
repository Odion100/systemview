// WHAT A LANE ROW SAYS, as a pure function — the single place a receipt is allowed to meet a verdict.
//
// Derivation answers "is this lane's work in the tree" three ways (api/index.js branchState):
//   in       blobs match, or the patch reverses cleanly
//   out      the patch applies FORWARD cleanly — proof of absence, nothing here to collide with
//   unknown  neither direction is clean: the tree has MOVED ON since the lane was cut
//
// `unknown` is honest and it is a dead end — which is how the row came to say "not brought in" about
// work that was already committed, one step from being applied twice. A RECEIPT (RFC-063) is what an
// agent recorded at the moment it brought the lane in: dated, naming the base, checkable.
//
// THE ORDERING IS THE SAFETY PROPERTY. A receipt may only answer `unknown`. It never outranks `out`,
// because `out` is proof and a receipt is a record — a receipt against proof is a receipt that is
// wrong. Keeping that rule in one tested function is the point of this file: if an agent could make a
// lane look landed when it is not, the human would delete work on its word.
const ri = (bs) => (bs && bs.applied && bs.applied.broughtIn) || null;

export const laneVerdict = (bs) => {
  if (!bs) return { state: "", receipt: null };
  const a = bs.applied || {};
  const receipt = ri(bs);
  if (bs.merged) return { state: "committed", receipt };
  if (a.verdict === "in") return { state: a.committed ? "committed" : "tree", receipt };
  // PROOF WINS. Deliberately returns the receipt anyway so a surface can say "a receipt claims this
  // was brought in, and the files say otherwise" rather than silently dropping a contradiction.
  if (a.verdict === "out") return { state: "out", receipt, contradicted: !!receipt };
  if (a.verdict === "unknown") return receipt ? { state: "answered", receipt } : { state: "unknown", receipt: null };
  return { state: "", receipt };
};

// The chip's words. `answered` is the only state whose text comes from data rather than a constant,
// because the whole value of a receipt is WHEN and against WHAT.
export const laneChip = (v, fmt = (ts) => new Date(ts).toISOString().slice(0, 10)) => {
  if (!v || !v.state) return null;
  if (v.state === "committed") return { text: "✓ committed", tone: "ok", title: "the branch's work is in history — deleting this lane can lose nothing" };
  if (v.state === "tree") return { text: "✓ in tree — uncommitted", tone: "warn", title: "the work is in the tree but not committed — delete the lane and the tree is the only copy left" };
  if (v.state === "answered") {
    const r = v.receipt || {};
    return {
      text: `brought in ${fmt(r.ts)}`,
      tone: "noted",
      title: `recorded as brought in${r.base ? ` at base ${r.base}` : ""}${r.repo ? ` in ${r.repo}` : ""}${r.by ? ` by ${r.by}` : ""} — the files have changed since, so this is a record rather than proof. Verify before deleting.`,
    };
  }
  if (v.state === "unknown")
    return { text: "? can't tell", tone: "unknown", title: "cannot tell: the files this lane touched have changed since it was cut, so its work neither matches nor cleanly re-applies. It may already be in. Check before deleting or re-applying." };
  if (v.state === "out" && v.contradicted)
    return { text: "⚠ receipt disagrees", tone: "unknown", title: "a receipt claims this was brought in, but the patch applies cleanly to this tree — so the work is NOT here. The proof wins; treat the receipt as wrong." };
  return null; // plain `out` wears no chip — absence is the row's default, not news
};

// WHAT THE DELETE CONFIRM SAYS — in this module, not in the markup, because the confirm and the chip
// answering differently about the same lane is how a surface comes to contradict itself. One decision,
// one test. `warn` is the only thing that should make the text red: real work would die.
export const laneConfirm = (bs, { worktree = false, fmt = (ts) => new Date(ts).toISOString().slice(0, 10) } = {}) => {
  const a = (bs && bs.applied) || {};
  const exists = !!(bs && bs.exists);
  const wt = worktree ? "; worktree still on disk" : "";
  if (!exists) return { warn: false, text: `no branch left — delete the lane's record${worktree ? " and worktree" : ""}?` };
  if (bs.merged) return { warn: false, text: `branch merged${worktree ? ", worktree still on disk" : ""} — delete the lane?` };
  const v = laneVerdict(bs);
  if (v.state === "committed") return { warn: false, text: `work brought in and committed — deleting loses nothing${wt}. Delete the lane?` };
  if (v.state === "tree") return { warn: false, text: `work is in the tree but NOT COMMITTED — delete this and the tree is the only copy left${wt}. Delete the lane?` };
  if (v.state === "answered") {
    const r = v.receipt || {};
    return { warn: false, text: `recorded as brought in ${fmt(r.ts)}${r.base ? ` at base ${r.base}` : ""} — the files have changed since, so this is a record rather than proof (${a.matching}/${a.total} still match). Delete the lane?` };
  }
  if (v.state === "unknown")
    return { warn: true, text: `can't tell whether this is in — the files it touched have changed since the lane was cut (${a.matching}/${a.total} still match). It may already be in your tree. Delete anyway?` };
  // `out` is PROOF of absence, so deleting really does destroy the only copy — warn, and say so
  // louder when a receipt disagrees, because somebody recorded bringing this in and the files say no.
  if (v.contradicted)
    return { warn: true, text: `a receipt says this was brought in, but the files say it is NOT here — the patch applies cleanly to your tree. Real work dies with it. Delete anyway?` };
  return { warn: true, text: a.matching > 0
    ? `branch not merged — only ${a.matching}/${a.total} of its files match the tree. Delete anyway?`
    : `branch not merged — real work dies with it. Delete anyway?` };
};
