import { hits, overlaps, covered, rectOf, isDrag, MIN_DRAG } from "./boxHit";

const r = (top, bottom, left = 0, right = 100) => ({ top, bottom, left, right });
const block = (id, top, bottom) => ({ id, rect: r(top, bottom) });

const PARAS = [block("a", 0, 40), block("b", 40, 90), block("c", 90, 160), block("d", 160, 200)];

describe("what a dragged box grabbed", () => {
  it("takes whole blocks, so clipping a corner still gets the paragraph", () => {
    const box = { ...r(80, 100), left: 10, right: 60 }; // a few px of b, a few of c
    expect(hits(box, PARAS).map((b) => b.id)).toEqual(["b", "c"]);
  });

  it("comes back in document order whichever way it was dragged", () => {
    const box = rectOf({ x: 60, y: 150 }, { x: 10, y: 50 });
    expect(hits(box, PARAS).map((b) => b.id)).toEqual(["b", "c"]);
  });

  it("grabs one block when the box sits inside it", () => {
    const box = { ...r(50, 70), left: 20, right: 80 };
    expect(hits(box, PARAS).map((b) => b.id)).toEqual(["b"]);
  });

  // THE SLIVER RULE, and its exception. A box reaching down into the next paragraph should not drag
  // the one above it along by two pixels…
  it("drops a block it barely grazed when it has others", () => {
    const box = { ...r(38, 85), left: 10, right: 60 }; // 2px of a, most of b
    expect(hits(box, PARAS).map((b) => b.id)).toEqual(["b"]);
  });

  // …but a small, deliberate box must still grab the thing it is inside.
  it("keeps a graze when it is the only thing touched — precision must not return nothing", () => {
    const box = { ...r(0, 3), left: 10, right: 60 };
    expect(hits(box, PARAS).map((b) => b.id)).toEqual(["a"]);
  });

  it("returns nothing for a click, which is not a box", () => {
    expect(isDrag(rectOf({ x: 10, y: 10 }, { x: 12, y: 12 }))).toBe(false);
    expect(hits(rectOf({ x: 10, y: 10 }, { x: 12, y: 12 }), PARAS)).toEqual([]);
    expect(MIN_DRAG).toBe(6);
  });

  it("returns nothing when the box misses everything", () => {
    const box = { ...r(400, 500), left: 10, right: 60 };
    expect(hits(box, PARAS)).toEqual([]);
  });

  it("treats a touching edge as a miss, not a hit", () => {
    expect(overlaps(r(0, 40), r(40, 90))).toBe(false);
    expect(overlaps(r(0, 41), r(40, 90))).toBe(true);
  });

  it("measures coverage as the fraction of the block the box spans", () => {
    expect(covered(r(0, 25), r(0, 50))).toBeCloseTo(0.5);
    expect(covered(r(0, 100), r(0, 50))).toBeCloseTo(1);
  });

  it("carries whatever rode along with each block", () => {
    const withText = [{ id: "a", rect: r(0, 40), text: "hello", el: "node" }];
    const box = { ...r(5, 30), left: 0, right: 50 };
    expect(hits(box, withText)[0]).toMatchObject({ text: "hello", el: "node" });
  });
});
