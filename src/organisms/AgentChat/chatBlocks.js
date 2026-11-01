// THE CHAT'S MARKDOWN HAS A HIERARCHY NOW — the two facts its parser used to throw away.
//
// His call, 2026-11-01, after a fix that only addressed code blocks: *"Are you stupid about the
// blocks, just the hue? Look at the chat. Look at the document's version of the markdown. Look at
// everything, all other markdown."* He was right, and what the look found was not styling:
//
//   · A HEADING'S LEVEL WAS PARSED AND DISCARDED. `H_RE` captures the hashes, the renderer used
//     only the text, and every level came out as one bold body-size line — the deliberate old
//     ruling was *"headings as bold lines, an h1 inside a bubble is absurd."* The premise is true
//     and the conclusion was too strong: 28px in a bubble is absurd, six levels collapsing into
//     one is not the only alternative. No stylesheet could ever have fixed it, because by the time
//     CSS saw the element the level was gone.
//   · A LIST'S NESTING WAS SWALLOWED BY `\s*`. The bullet pattern ate the indentation before
//     capturing, so a sub-point under a point rendered as its peer. The SAME defect the voice has
//     for the same reason (bullet regex ignores indentation) — one cause, two surfaces.
//
// Both live here as pure functions, away from the render, because a classifier is the half worth
// asserting: the chat's markdown runs inside `AgentChat.js` and a component that big is tested by
// what it delegates to.

/** A heading line, with the LEVEL kept. `null` when the line is not one. */
export function headingLevel(line) {
  const m = /^(#{1,6})\s+(.*)$/.exec(String(line == null ? "" : line));
  if (!m) return null;
  const text = m[2].trim();
  // `### ` with nothing after it is not a heading — it is a line of hashes, and promoting it to
  // one draws an empty bold row with spacing round it.
  if (!text) return null;
  return { level: m[1].length, text };
}

// ONE LEVEL IS TWO SPACES, and a tab is four. Markdown in the wild uses two or four spaces
// interchangeably for one step, so the step is read as "two spaces buys a level" and four spaces
// still lands on level 2 — generous in the direction that cannot invent a nesting nobody wrote.
const indentOf = (raw) => {
  const lead = /^[ \t]*/.exec(raw)[0];
  let n = 0;
  for (const ch of lead) n += ch === "\t" ? 4 : 1;
  return n;
};

/**
 * A list item, with its DEPTH. `null` when the line is not one.
 *
 * `depth` is 0-based and capped at 3: past three steps a bubble has no width left, and a
 * deeper indent is far more often a wrapped paste than a fourth level somebody meant.
 */
export function listItem(line) {
  const raw = String(line == null ? "" : line);
  const depth = Math.min(3, Math.floor(indentOf(raw) / 2));
  const ul = /^[ \t]*[-*+][ \t]+(.*)$/.exec(raw);
  if (ul) return { ordered: false, depth, text: ul[1], number: null };
  const ol = /^[ \t]*(\d{1,9})[.)][ \t]+(.*)$/.exec(raw);
  if (ol) return { ordered: true, depth, text: ol[2], number: Number(ol[1]) };
  return null;
}

/**
 * A flat run of items (each `{ordered, depth, text, number}`) as a TREE the renderer can walk.
 *
 * Returns `{ ordered, start, items: [{ text, children }] }` — `children` being the same shape, so
 * a nested list is rendered by the same code as the outer one.
 */
export function nestList(flat) {
  const rows = (flat || []).filter(Boolean);
  if (!rows.length) return null;
  const root = { ordered: !!rows[0].ordered, start: rows[0].ordered ? rows[0].number || 1 : null, items: [] };
  // THE STACK IS THE OPEN LISTS, OUTERMOST FIRST. A jump of more than one level is clamped to one:
  // hand-written markdown skips indents constantly, and honouring a jump means emitting empty
  // list wrappers with no item to hang them on.
  const stack = [root];
  for (const row of rows) {
    const want = Math.min(row.depth, stack.length - 1 + 1);
    while (stack.length - 1 > want) stack.pop();
    if (want > stack.length - 1) {
      const parent = stack[stack.length - 1];
      const host = parent.items[parent.items.length - 1];
      // An indented first item with no parent item to nest under belongs to the list above it, at
      // this level — there is nothing to be a child OF.
      if (!host) {
        stack[stack.length - 1].items.push({ text: row.text, ordered: row.ordered, children: null });
        continue;
      }
      host.children = { ordered: !!row.ordered, start: row.ordered ? row.number || 1 : null, items: [] };
      stack.push(host.children);
    }
    stack[stack.length - 1].items.push({ text: row.text, ordered: row.ordered, children: null });
  }
  return root;
}

/**
 * Does this item run belong to the list already open, or does it start a new one?
 *
 * A bullet run and a numbered run are different lists even back to back — but only at the SAME
 * depth. An ordered sub-list under a bulleted point is nesting, not a new top-level list, and
 * flushing there is what used to cut one list into three.
 */
export function startsNewList(open, row) {
  if (!open || !row) return true;
  if (row.depth > 0) return false;
  return !!open.ordered !== !!row.ordered;
}
