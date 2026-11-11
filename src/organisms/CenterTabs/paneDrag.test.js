// THE DIVIDER'S CLAIMS. A pointer drag has no suite here — jsdom has no layout, so a row's box is
// all zeros and a fraction of it means nothing — which is exactly why the DECISION the drag makes
// is a pure function. These are the assertions that stand in for a hand on the divider.
import { sizesAfterDrag, dropPlan, bodyDropPlan, MIN_PANE } from "./paneDrag";

const ROW = { left: 100, width: 1000 }; // a 1000px row starting at x=100

describe("sizesAfterDrag — where the boundary lands", () => {
  it("an even pair follows the pointer", () => {
    expect(sizesAfterDrag({ sizes: [0.5, 0.5], divider: 0, x: 400, ...ROW })).toEqual([0.3, 0.7]);
    expect(sizesAfterDrag({ sizes: [0.5, 0.5], divider: 0, x: 800, ...ROW })).toEqual([0.7, 0.30000000000000004]);
  });

  it("the fractions always still sum to 1", () => {
    for (const x of [100, 150, 333, 600, 900, 1100]) {
      const next = sizesAfterDrag({ sizes: [0.4, 0.6], divider: 0, x, ...ROW });
      expect(next.reduce((a, n) => a + n, 0)).toBeCloseTo(1, 10);
    }
  });

  // THE FLOOR IS THE WHOLE POINT. Dragging to the very edge must leave the smallest pane rather
  // than either a 0px one (holding documents, with no strip to grab) or a snap back to the middle.
  it("dragging past the left edge stops at the floor instead of erasing the pane", () => {
    expect(sizesAfterDrag({ sizes: [0.5, 0.5], divider: 0, x: 0, ...ROW })).toEqual([MIN_PANE, 1 - MIN_PANE]);
    expect(sizesAfterDrag({ sizes: [0.5, 0.5], divider: 0, x: 100, ...ROW })).toEqual([MIN_PANE, 1 - MIN_PANE]);
  });
  it("dragging past the right edge stops at the floor on the other side", () => {
    const next = sizesAfterDrag({ sizes: [0.5, 0.5], divider: 0, x: 5000, ...ROW });
    expect(next[1]).toBeCloseTo(MIN_PANE, 10);
    expect(next[0]).toBeCloseTo(1 - MIN_PANE, 10);
  });

  // ONE BOUNDARY, NOT THE ROW. The pane outside the dragged pair keeps its exact fraction — a hand
  // on the second divider must not move the first pane.
  it("a three-pane row moves only the pair the divider sits between", () => {
    const next = sizesAfterDrag({ sizes: [0.25, 0.25, 0.5], divider: 1, x: 700, ...ROW });
    expect(next[0]).toBe(0.25); // untouched, exactly
    expect(next[1] + next[2]).toBeCloseTo(0.75, 10);
    expect(next[1]).toBeCloseTo(0.35, 10); // boundary at 60% of the row, 25% of which is pane 0
  });
  it("the floor on a middle divider is measured from the pair, not from the row", () => {
    const next = sizesAfterDrag({ sizes: [0.6, 0.2, 0.2], divider: 1, x: 100, ...ROW });
    expect(next[0]).toBe(0.6);
    expect(next[1]).toBeCloseTo(MIN_PANE, 10);
    expect(next[2]).toBeCloseTo(0.4 - MIN_PANE, 10);
  });

  // NULL IS THE HONEST ANSWER — the caller writes nothing, which is what keeps a meaningless drag
  // from snapping the layout to some invented default.
  it("refuses what cannot mean anything", () => {
    expect(sizesAfterDrag({ sizes: [1], divider: 0, x: 400, ...ROW })).toBe(null);
    expect(sizesAfterDrag({ sizes: [0.5, 0.5], divider: 1, x: 400, ...ROW })).toBe(null); // no such boundary
    expect(sizesAfterDrag({ sizes: [0.5, 0.5], divider: -1, x: 400, ...ROW })).toBe(null);
    expect(sizesAfterDrag({ sizes: [0.5, 0.5], divider: 0, x: 400, left: 0, width: 0 })).toBe(null);
    expect(sizesAfterDrag({ sizes: [0.5, 0.5], divider: 0, x: NaN, ...ROW })).toBe(null);
    expect(sizesAfterDrag({ sizes: [0.5, "x"], divider: 0, x: 400, ...ROW })).toBe(null);
    expect(sizesAfterDrag()).toBe(null);
  });
  it("a pair with no room for two minimums is left alone", () => {
    // 20% between them cannot hold two 12% panes, so there is no legal boundary to write.
    expect(sizesAfterDrag({ sizes: [0.8, 0.1, 0.1], divider: 1, x: 500, ...ROW })).toBe(null);
  });
});

describe("dropPlan — reorder, or cross the divider", () => {
  it("a drop inside the pane that holds the tab is a reorder", () => {
    expect(dropPlan({ from: 0, to: 0, key: "a", onKey: "b" })).toEqual({ verb: "reorder", before: "b" });
  });
  it("a drop past the tabs is a reorder to the end", () => {
    expect(dropPlan({ from: 1, to: 1, key: "a" })).toEqual({ verb: "reorder", before: null });
  });
  // THE SILENT ONE. moveTab finds a tab by key wherever it lives, so a cross-pane drop treated as
  // a reorder shuffles the document inside the pane he dragged it OUT of — nothing crosses, and
  // nothing says so.
  it("a drop on the other side's strip crosses, carrying where it lands", () => {
    expect(dropPlan({ from: 0, to: 1, key: "a", onKey: "z" })).toEqual({ verb: "cross", to: 1, before: "z" });
    expect(dropPlan({ from: 1, to: 0, key: "a" })).toEqual({ verb: "cross", to: 0, before: null });
  });
  it("a tab dropped on itself is not a move", () => {
    expect(dropPlan({ from: 0, to: 0, key: "a", onKey: "a" })).toBe(null);
  });
  it("refuses a tab no pane holds", () => {
    expect(dropPlan({ from: -1, to: 0, key: "a" })).toBe(null);
    expect(dropPlan({ from: 0, to: 0 })).toBe(null);
  });
});

describe("bodyDropPlan — the dark section is a target too", () => {
  it("a tab from the other side lands here", () => {
    expect(bodyDropPlan({ from: 0, to: 1, key: "a", panes: 2 })).toEqual({ verb: "cross", to: 1 });
  });
  // THE "DRAGGED OUT" GESTURE. Dropped back into its own body while that is the only body there
  // is, a tab is asking for a side of its own — which is the same verb the menu offers by name.
  it("dropped into its own side, with only one side, it earns a pane of its own", () => {
    expect(bodyDropPlan({ from: 0, to: 0, key: "a", panes: 1 })).toEqual({ verb: "split" });
  });
  it("dropped into its own side with a split already standing, the window does nothing", () => {
    expect(bodyDropPlan({ from: 1, to: 1, key: "a", panes: 2 })).toBe(null);
  });
  it("refuses a tab no pane holds", () => {
    expect(bodyDropPlan({ from: -1, to: 0, key: "a", panes: 1 })).toBe(null);
    expect(bodyDropPlan({ to: 0, key: "a", panes: 1 })).toBe(null);
    expect(bodyDropPlan()).toBe(null);
  });
});
