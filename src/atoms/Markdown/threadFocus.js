// When you start a thread from the margin, the document is rewritten and re-rendered — the new
// `:::thread` mounts as a brand-new component, with no way of knowing it was just created. This is
// the one-line handoff: the wrapper records the id it just wrote, the thread that mounts with that
// id opens itself with the reply box ready, and the note is consumed so a later re-render doesn't
// pop it open again.
let pending = null;

export function expectThread(id) {
  pending = id;
}

export function claimThread(id) {
  if (pending !== id) return false;
  pending = null;
  return true;
}
