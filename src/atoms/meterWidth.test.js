import { fillStyle, pctStyle, MIN_SEGMENT_PX } from "./meterWidth";

// THE TWO FAILURES ARE OPPOSITE AND BOTH ARE LIES. A real segment rounded out of existence says
// zero about something that is not zero; a floor applied to a real zero draws a stub over
// nothing. Every claim here pins one or the other.

it("a tiny but real segment still gets drawn", () => {
  // 1 of 53 claims is 1.9% — three pixels on a 160px bar, and none at all on a lane row.
  const s = fillStyle(1, 53);
  expect(s.minWidth).toBe(MIN_SEGMENT_PX);
  expect(parseFloat(s.width)).toBeCloseTo(1.887, 2);
});

it("zero stays zero — a floor over an empty count is the same lie backwards", () => {
  expect(fillStyle(0, 53)).toEqual({ width: "0%", minWidth: 0 });
  // "no claims are unmet" must not render as a sliver of red
  expect(fillStyle(0, 0).minWidth).toBe(0);
});

it("survives a total of zero, a missing total, and junk", () => {
  for (const [n, t] of [[3, 0], [3, undefined], [undefined, 10], [null, null], ["x", "y"]]) {
    const s = fillStyle(n, t);
    expect(s.width).toMatch(/^[\d.]+%$/);
    expect(Number.isFinite(s.minWidth)).toBe(true);
  }
  expect(fillStyle(3, 0)).toEqual({ width: "0%", minWidth: 0 });
});

it("never runs past the end of the bar", () => {
  expect(fillStyle(9, 4).width).toBe("100%");
  expect(pctStyle(400).width).toBe("100%");
  expect(pctStyle(-20).width).toBe("0%");
});

it("a full segment is 100% and still carries the floor", () => {
  const s = fillStyle(53, 53);
  expect(s.width).toBe("100%");
  expect(s.minWidth).toBe(MIN_SEGMENT_PX);
});

// THE FLOOR IS PIXELS BECAUSE A PERCENTAGE MEANS SOMETHING DIFFERENT ON EVERY BAR — 2% of a lane
// row is under a pixel and 2% of a full-width meter is visible. Five call sites had each invented
// their own percentage floor and none was enough on the short bars.
it("the floor is a pixel count, not a percentage", () => {
  expect(MIN_SEGMENT_PX).toBe(10);
  expect(typeof fillStyle(1, 1000).minWidth).toBe("number");
});

it("takes a different floor where a bar is genuinely tiny", () => {
  expect(fillStyle(1, 100, { min: 4 }).minWidth).toBe(4);
});

// A PERCENTAGE ALONE CANNOT ANSWER "IS THIS REAL" — 0.0001% and 0% round the same — so a caller
// holding only a percentage has to say.
it("pctStyle floors what is really there and nothing else", () => {
  expect(pctStyle(0).minWidth).toBe(0);
  expect(pctStyle(0.0001).minWidth).toBe(MIN_SEGMENT_PX);
  expect(pctStyle(0, { nonZero: true }).minWidth).toBe(MIN_SEGMENT_PX);
  expect(pctStyle(40, { nonZero: false }).minWidth).toBe(0);
});
