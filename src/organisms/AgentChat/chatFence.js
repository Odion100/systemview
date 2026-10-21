// WHAT A FENCE SAYS IT IS — one rule, lifted out so it can be proven.
//
// The chat's renderer lives in `AgentChat.js`, which imports the block registry and therefore
// `react-markdown` — ESM, untransformed by CRA, so nothing in that file can be reached from a
// test. The rule itself is a string in and a string out, so it lives here instead of being
// asserted in a comment.
//
// WHY IT MATTERS AT ALL. The opening line's info string was being discarded, so every fence in the
// chat rendered anonymous. That is invisible for a stack trace and actively misleading for the one
// case we write most: a fence holding our OWN block syntax. `::::thread` inside an unlabelled box
// reads as a block that failed to render rather than a sample shown deliberately — his words,
// *"what are you supposed to be rendering in it?"*. The label the author already typed is the only
// thing that settles it, and it was being thrown away.

/**
 * The language on a fence's opening line, or "" when it carries none.
 *
 * NO GUESSING. An unlabelled fence gets no tag: inventing a language would be a worse lie than
 * saying nothing, because the tag's whole job is to be trusted about what the box contains.
 */
export function fenceLangOf(line) {
  const m = /^\s*(?:```|~~~)\s*([A-Za-z0-9_+-]+)/.exec(String(line || ""));
  return m ? m[1] : "";
}

export default fenceLangOf;
