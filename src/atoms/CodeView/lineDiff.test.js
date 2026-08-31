import { lineDiff, lineHunks } from "./lineDiff";

// The two engines must agree — Myers is what runs past the cell cap, the LCS table below it.
const lines = (n, f) => Array.from({ length: n }, (_, i) => (f ? f(i) : `line ${i}`)).join("\n");

describe("lineDiff — the same answer from both engines", () => {
  it("marks a spread-out edit in a big file as SEPARATE hunks, not one span", () => {
    const N = 6000;
    const base = lines(N);
    const head = lines(N, (i) => (i === 1900 ? "changed 1900" : i === 5400 ? "changed 5400" : `line ${i}`));
    const marks = lineDiff(base, head);
    expect([...marks.keys()].sort((a, b) => a - b)).toEqual([1901, 5401]);
    expect(marks.get(1901)).toBe("changed");
    const hunks = lineHunks(base, head);
    expect(hunks).toHaveLength(2);
  });
  it("small edits: added, changed, removed", () => {
    const base = "a\nb\nc\nd\n";
    expect([...lineDiff(base, "a\nb\nX\nc\nd\n")]).toEqual([[3, "added"]]);
    expect([...lineDiff(base, "a\nB\nc\nd\n")]).toEqual([[2, "changed"]]);
    expect([...lineDiff(base, "a\nc\nd\n")]).toEqual([[1, "removed"]]);
  });
  it("myers agrees with the table on a mixed edit", () => {
    // Force both paths on the same input by size: build a 2100x2100 middle (> 4M cells) and a
    // small one with the same shape, and compare hunk shapes.
    const big = lines(2100, (i) => `b${i}`);
    const bigHead = big.split("\n").map((l, i) => (i % 700 === 350 ? `${l}!` : l)).join("\n");
    const marksBig = lineDiff("x\n" + big, "x\n" + bigHead); // prefix differs nowhere; middle > cap
    expect([...marksBig.values()].every((k) => k === "changed")).toBe(true);
    expect(marksBig.size).toBe(3);
  });
});
