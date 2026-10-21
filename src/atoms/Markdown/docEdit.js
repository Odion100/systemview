// FENCE WIDTHS AND THE WRAPPERS THAT WRITE THEM — the pure half of the document editor.
//
// LIFTED OUT OF `Markdown.js` TO BE PROVABLE AT ALL. Nothing that imports the markdown renderer
// can be mounted in jest: `react-markdown` ships ESM, CRA leaves node_modules untransformed, and
// the suite dies on `Unexpected token 'export'` before a single assertion runs. These functions
// are string-in, string-out and have no React in them, so moving them here is the difference
// between a rule that is tested and a rule that is asserted in a comment. `Markdown.js` imports
// them back and re-exports them, so every existing caller is untouched.

// A CONTAINER THAT IS GOING TO HOLD CHILDREN NEEDS ROOM FOR THEM BEFORE IT HAS ANY. The width
// below is computed from what a container currently CONTAINS, which is right for every block
// except the ones whose whole purpose is to be filled in later — and for those it is actively
// destructive:
//
//   A `:::thread` holds `:::reply` blocks. An EMPTY thread has no children, so the rule below
//   computed `max(3, 0 + 1)` = three colons — the same width as the replies it is about to hold.
//   The first reply posted into it then CLOSES it instead of nesting, and `api/reports.js` (which
//   correctly requires four) can never match it, so the thread renders perfectly, invites a reply,
//   and refuses every one.
//
// That is not theoretical. It took out two threads on RFC-072 and read as a haunting: threads
// hand-edited to four colons "reverted" to three, but ONLY the ones nobody had replied to yet —
// because a thread holding one reply has a child at depth three, computes to four, and survives.
// The ones that looked clobbered were simply the empty ones, narrowed on every write.
//
// So the floor is per KIND, and a thread's is four. It is not "one deeper to be safe": it is the
// width a thread needs to do the one thing a thread is for.
export const FLOOR = { thread: 4 };

export function normalizeFences(source) {
  const lines = String(source).split("\n");
  let inCode = false;
  const stack = [];
  const roots = [];
  for (let n = 0; n < lines.length; n++) {
    if (/^\s*(```|~~~)/.test(lines[n])) {
      inCode = !inCode;
      continue;
    }
    if (inCode) continue;
    const opens = /^\s*:{3,}\s*([a-zA-Z][a-zA-Z0-9-]*)/.exec(lines[n]);
    if (opens) {
      const node = { open: n, close: -1, children: [], kind: opens[1] };
      (stack.length ? stack[stack.length - 1].children : roots).push(node);
      stack.push(node);
    } else if (/^\s*:{3,}\s*$/.test(lines[n])) {
      if (!stack.length) return source; // unbalanced
      stack.pop().close = n;
    }
  }
  if (stack.length || inCode) return source; // unbalanced
  const apply = (node) => {
    let maxChild = 0;
    node.children.forEach((c) => {
      maxChild = Math.max(maxChild, apply(c));
    });
    const len = Math.max(FLOOR[node.kind] || 3, maxChild + 1);
    lines[node.open] = lines[node.open].replace(/:{3,}/, ":".repeat(len));
    lines[node.close] = lines[node.close].replace(/:{3,}/, ":".repeat(len));
    return len;
  };
  roots.forEach(apply);
  return lines.join("\n");
}

// Wrap a source LINE RANGE in any container directive — the general form of "start a thread here".
export function wrapLines(source, startLine, endLine, openLine, closeLine = ":::") {
  const lines = String(source).split("\n");
  const a = startLine - 1;
  const b = endLine - 1;
  if (a < 0 || b >= lines.length || b < a) return null;
  return normalizeFences(
    [
      ...lines.slice(0, a),
      openLine,
      ...lines.slice(a, b + 1),
      closeLine,
      "",
      ...lines.slice(b + 1),
    ].join("\n"),
  );
}

// Wrap a source LINE RANGE in a `:::thread{id=…}` container — this is "start a thread here", the
// click affordance in the margin. It's an ordinary document edit, not a new store: the wrapper lands
// in the markdown, so the thread travels with the text it's about and any editor sees it.
export function wrapLinesInThread(source, startLine, endLine) {
  const lines = String(source).split("\n");
  const a = startLine - 1;
  const b = endLine - 1;
  if (a < 0 || b >= lines.length || b < a) return null;
  // An id that can't collide with one already in the file, and stays stable once written.
  let n = 1;
  while (source.includes(`id=t${n}`)) n++;
  const before = lines.slice(0, a);
  const body = lines.slice(a, b + 1);
  const after = lines.slice(b + 1);
  // A container directive needs blank lines around it to parse as a block. normalizeFences settles
  // the widths — wrapping inside a columns/col (or any container) widens the enclosing fences.
  return normalizeFences(
    // FOUR, at birth. normalizeFences would widen it anyway now that threads carry a floor, but a
    // writer that emits a width it knows is wrong is a second place for this bug to come back.
    [...before, `::::thread{id=t${n}}`, ...body, "::::", "", ...after].join("\n"),
  );
}
