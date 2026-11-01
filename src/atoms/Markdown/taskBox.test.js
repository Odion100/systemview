import React from "react";
import { findTaskBox, stripTaskBox } from "./taskBox";

// THE CLAIMS THAT KEEP THE DOUBLE CHECKBOX FROM COMING BACK.
//
// The renderer itself cannot be mounted here — react-markdown is ESM and jest will not parse it —
// which is exactly why this pair is extracted: the shapes remark-gfm produces are small enough to
// hand-build, so the thing that was wrong is testable without the thing that could not be.
//
// The fixtures are the two shapes GFM actually emits, and the LOOSE one is the whole point: a
// checklist with a paragraph under each item is the normal case for a document worth checking off.

const box = (checked) => ({ tagName: "input", properties: { type: "checkbox", checked } });
const tight = (checked) => ({ children: [box(checked), { type: "text", value: " do the thing" }] });
const loose = (checked) => ({
  children: [{ tagName: "p", children: [box(checked), { type: "text", value: " do the thing" }] }],
});

// A stand-in for react-markdown's mapped <p>: a component carrying its hast `node` in props, which
// is the only thing that distinguishes it from any other element once it is rendered.
const Para = ({ children }) => <p>{children}</p>;
const para = (kids) => <Para node={{ tagName: "p" }}>{kids}</Para>;
const input = <input type="checkbox" disabled readOnly />;

describe("findTaskBox — the item's state, tight or loose", () => {
  it("finds the box in a tight item", () => {
    expect(findTaskBox(tight(false))).toBeTruthy();
  });

  it("finds the box in a LOOSE item, where it sits inside the paragraph", () => {
    expect(findTaskBox(loose(false))).toBeTruthy();
  });

  // THE INVISIBLE HALF OF THE BUG. Reading only the li's own children returned nothing for a loose
  // item, so `checked` fell to false — a ticked box rendered empty, and pressing it wrote `[x]`
  // into the document that the document then refused to show.
  it("reads CHECKED off a loose item rather than defaulting it to false", () => {
    expect(findTaskBox(loose(true)).properties.checked).toBe(true);
    expect(findTaskBox(tight(true)).properties.checked).toBe(true);
  });

  it("answers null for a list item that is not a task at all", () => {
    expect(findTaskBox({ children: [{ tagName: "p", children: [{ type: "text", value: "plain" }] }] })).toBe(null);
    expect(findTaskBox(null)).toBe(null);
  });
});

describe("stripTaskBox — one live checkbox, never two", () => {
  it("drops the disabled input when it is a direct child", () => {
    const out = stripTaskBox([input, "do the thing"]);
    expect(out.filter((c) => React.isValidElement(c) && c.type === "input")).toHaveLength(0);
    expect(out).toHaveLength(1);
  });

  // HIS CATCH, AS A CLAIM: eleven rows each drew two boxes — ours, live, and GFM's, dead.
  it("drops it from INSIDE the paragraph of a loose item", () => {
    const out = stripTaskBox([para([input, " do the thing"])]);
    expect(out).toHaveLength(1);
    const kids = React.Children.toArray(out[0].props.children);
    expect(kids.filter((c) => React.isValidElement(c) && c.type === "input")).toHaveLength(0);
    expect(kids).toContain(" do the thing");
  });

  it("keeps the paragraph itself — the content is not collateral", () => {
    const out = stripTaskBox([para([input, " text"]), para(["a second paragraph"])]);
    expect(out).toHaveLength(2);
  });

  // ONLY THE FIRST. A checkbox further into somebody's prose is their content; deleting it would
  // be this fix doing the same kind of damage it exists to undo.
  it("leaves a second checkbox alone", () => {
    const out = stripTaskBox([input, "text", input]);
    expect(out.filter((c) => React.isValidElement(c) && c.type === "input")).toHaveLength(1);
  });

  it("changes nothing when the item carries no checkbox", () => {
    const out = stripTaskBox(["just text"]);
    expect(out).toEqual(["just text"]);
  });
});
