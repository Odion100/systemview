// JOINING WHAT WAS COMMITTED WITH WHAT IS STILL ON SCREEN — the send composes the input box (the
// segments dictation has already committed) with the live draft line (the sentence still arriving).
// Their sum IS the message: his rule, *"the simplest thing is just send whatever words are there."*
//
// THE FAILURE THIS EXISTS FOR (his report, 2026-10-10): *"my words are being repeated twice from the
// recorder."* A draft is a preview of the sentence being spoken, decoded asynchronously. If that
// decode starts on sentence N and resolves after N has committed into the input, the live line gets
// repainted with text that is already in the box — and `input + draft` then sends it twice.
//
// THE CAUSAL FIX IS IN THE HOST (`dictationBridge.cjs` drops a draft whose segment generation has
// advanced). This is the belt: a content check at the one place the two sources meet, so ANY
// mechanism that produces the same words in both — including one nobody has found — cannot double
// them on the way out. Two guards for one bug is right here, because the two are not the same guard:
// the host's is about causation, this one is about what is actually on screen.
//
// IT FAILS TOWARD KEEPING WORDS. Whisper never decodes the same audio identically, so an exact
// comparison would miss the real case; a loose one would eat words he actually said. So the overlap
// is measured in NORMALISED WORDS from the seam — the end of the input against the start of the
// draft — and only the overlapping run is dropped. No overlap, nothing lost. A sentence re-worded
// beyond recognition keeps both copies, which is the failure we can see and complain about rather
// than the one that silently deletes half a message.

// Punctuation and case are decoration the two decodes disagree about; they must not decide this.
const norm = (w) =>
  String(w || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}']+/gu, "");

const words = (s) =>
  String(s || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

/**
 * The overlap, in words, between the END of `a` and the START of `b` — the longest run that is the
 * same text seen twice. 0 when they do not meet.
 */
export function overlapWords(a, b) {
  const A = words(a).map(norm).filter(Boolean);
  const B = words(b).map(norm).filter(Boolean);
  const max = Math.min(A.length, B.length);
  // LONGEST FIRST. A short tail can match by accident — one repeated "the" is not a duplicated
  // sentence — so the longest run wins and single-word overlaps are refused below.
  for (let k = max; k > 0; k -= 1) {
    let same = true;
    for (let i = 0; i < k; i += 1) {
      if (A[A.length - k + i] !== B[i]) { same = false; break; }
    }
    if (same) return k;
  }
  return 0;
}

/**
 * The message to send: the committed input plus whatever of the draft is not already in it.
 * `minOverlap` is 2 because a single shared word is ordinary English, not a repeat.
 */
export function joinSpoken(input, draft, { minOverlap = 2 } = {}) {
  const head = String(input || "").trim();
  const tail = String(draft || "").trim();
  if (!head) return tail;
  if (!tail) return head;

  const k = overlapWords(head, tail);
  const t = words(tail);
  // THE WHOLE DRAFT IS ALREADY IN THE BOX — the exact case his report describes. Send the box.
  if (k >= t.length) return head;
  // A SINGLE-WORD SEAM IS NOT EVIDENCE. Keep both; a doubled word is cheap and a deleted clause is not.
  if (k < minOverlap) return `${head} ${tail}`;
  return `${head} ${t.slice(k).join(" ")}`;
}

export default joinSpoken;
