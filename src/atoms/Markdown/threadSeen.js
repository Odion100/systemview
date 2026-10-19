// RFC-071 — WHICH THREADS HAVE SOMETHING NEW IN THEM.
//
// His point, 2026-10-19: *"it should be clear that there's updates on this thread — on this
// section, that's the thread."* A thread badge that shows the TOTAL is a number you have already
// read; what you want to see from across the document is that somebody said something since you
// last looked. A document in a meeting is mostly threads you have already read.
//
// WHAT COUNTS AS SEEN, and why it is per reader rather than written into the file: "I have read
// this" is not a fact about the document — three people reading the same plan have three different
// answers, and writing yours into the markdown would make everyone else's wrong AND dirty the file
// for every member every time you opened a thread. So it lives in localStorage, keyed by document
// and thread.

export const seenKey = (docPath, id) => `sv.thread.seen.${docPath || "doc"}.${id}`;

export const readSeen = (store, docPath, id) => {
  try {
    return Number(store.getItem(seenKey(docPath, id))) || 0;
  } catch {
    return 0;
  }
};

export const writeSeen = (store, docPath, id, ts) => {
  try {
    store.setItem(seenKey(docPath, id), String(ts || Date.now()));
  } catch {
    // A reader that cannot remember what it has seen shows everything as new, which is wrong in
    // the harmless direction — never a crash in a document.
  }
};

// The replies written INTO the document carry `ts=` on their own directive; the sidecar's carry a
// `ts` field. One counter over both, because a thread can hold either.
export const replyStamps = (src = "", stored = []) => [
  ...[...String(src).matchAll(/^\s*:{3,}\s*reply\{[^}]*\bts=(\d+)/gm)].map((m) => Number(m[1])),
  ...(stored || []).map((r) => Number(r && r.ts) || 0),
];

// NEW = posted after you last opened this thread. A thread you have never opened shows its replies
// as new — that is the honest answer, not a special case: you have not read them.
export const unseenCount = (stamps = [], lastSeen = 0) =>
  (stamps || []).filter((ts) => ts > (lastSeen || 0)).length;

// YOUR OWN REPLY IS NOT NEWS TO YOU. Posting marks the thread seen at that moment, so the badge
// does not light up for the sentence you just wrote.
export const newestOf = (stamps = []) => (stamps || []).reduce((a, b) => (b > a ? b : a), 0);
