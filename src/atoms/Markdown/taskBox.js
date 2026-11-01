import React from "react";

// A LOOSE TASK LIST PUTS THE CHECKBOX ONE LEVEL DOWN, AND BOTH HALVES OF THE TASK ITEM MISSED IT.
//
// remark-gfm turns `- [ ] x` into `<li class="task-list-item"><input type=checkbox disabled>x</li>`
// — but only while the list is TIGHT. Separate the items with blank lines, or hang a paragraph of
// explanation under one, and the list goes LOOSE: every item's content is wrapped in a `<p>` and
// the input goes inside it. Reading the `<li>`'s own children then finds nothing.
//
// That cost two things at once on the first long checklist written here, and the invisible one is
// worse. Visibly: react-markdown's disabled input survived the filter and drew a second, dead
// checkbox beside the live one (his catch — *"clicking the outer one highlights the inner one, but
// the inner one is not clickable"*). Invisibly: with no input found, the item's state read as
// UNCHECKED for every row, so ticking a box would write `[x]` into the document and the box would
// come back empty — a control that silently refuses to hold what it was told.
//
// So both halves look one level deeper rather than assuming a tight list's shape. A checklist long
// enough to be worth writing is almost always loose, which is why this was never hit until a
// document had eleven items with a paragraph under each.

const isBoxNode = (n) => !!n && n.tagName === "input" && n.properties && n.properties.type === "checkbox";
const isBoxEl = (c) => React.isValidElement(c) && c.type === "input";
const isParaEl = (c) => React.isValidElement(c) && c.props && c.props.node && c.props.node.tagName === "p";

/**
 * The checkbox HAST node of a task item — tight or loose. Its `checked` property IS the item's
 * state, and there is no other record of it: `node.checked` does not survive the mdast→hast
 * conversion, so this is the only thing that can answer whether the box is ticked.
 */
export function findTaskBox(node) {
  const kids = (node && node.children) || [];
  for (const k of kids) {
    if (isBoxNode(k)) return k;
    if (k && k.tagName === "p") {
      const inner = (k.children || []).find(isBoxNode);
      if (inner) return inner;
    }
  }
  return null;
}

/**
 * The item's rendered children with react-markdown's disabled checkbox removed, wherever it sat.
 * Only the FIRST one goes: a task item's own box is the one GFM put at the front, and a checkbox
 * further in is somebody's content, not ours to delete.
 */
export function stripTaskBox(children) {
  const out = [];
  let dropped = false;
  for (const c of React.Children.toArray(children)) {
    if (!dropped && isBoxEl(c)) {
      dropped = true;
      continue;
    }
    if (!dropped && isParaEl(c)) {
      const inner = React.Children.toArray(c.props.children);
      const i = inner.findIndex(isBoxEl);
      if (i >= 0) {
        inner.splice(i, 1);
        out.push(React.cloneElement(c, {}, inner));
        dropped = true;
        continue;
      }
    }
    out.push(c);
  }
  return out;
}
