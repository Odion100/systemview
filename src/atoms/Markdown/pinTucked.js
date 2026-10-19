// WHETHER THE UPDATE STACK IS TUCKED, PER DOCUMENT — and it is a per-READER fact, exactly like a
// thread's seen state: "I have put this aside" is not something the document should carry, because
// three people reading the same plan have three different answers and writing yours into the file
// would dirty it for every member every time you tidied your own corner.
//
// His report, 2026-10-19: *"every time a document updates, if you minimize the floating update
// panel it reopens. If you make it into a tab, it comes back. If I refresh the page, it doesn't
// keep the state."* Two bugs in one sentence — it was never persisted, and it re-opened itself on
// every change. The re-open was mine and it was wrong: the collapsed TAB is still on screen with
// its count, so staying tucked hides nothing. Only an empty corner would be a lie, and an empty
// corner means nobody is behind.
export const tuckKey = (docPath) => `sv.pin.tucked.${docPath || "doc"}`;

export const readTucked = (store, docPath) => {
  try {
    return store.getItem(tuckKey(docPath)) === "1";
  } catch {
    return false;
  }
};

export const writeTucked = (store, docPath, on) => {
  try {
    if (on) store.setItem(tuckKey(docPath), "1");
    else store.removeItem(tuckKey(docPath));
  } catch {
    // A reader that cannot remember its own corner shows the stack, which is wrong in the harmless
    // direction — never a crash in a document.
  }
};
