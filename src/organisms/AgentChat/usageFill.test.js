import { fillBar } from "./usageFill";

const bars = (...pairs) => pairs.map(([label, pct]) => ({ label, pct }));

describe("what the usage bar fills to", () => {
  it("is the highest meter, which is the one about to bite", () => {
    expect(fillBar(bars(["session", 20], ["all models", 71], ["fable", 44])).label).toBe("all models");
  });

  // HIS CATCH. One meter at 100 pins the bar full for hours, and a bar that cannot move stops
  // saying anything about the meters that still can.
  it("skips a meter at 100 and tracks the highest that is still under it", () => {
    const top = fillBar(bars(["session", 40], ["fable", 100], ["all models", 81]));
    expect(top.label).toBe("all models");
    expect(top.pct).toBe(81);
  });

  it("skips several at 100", () => {
    expect(fillBar(bars(["session", 100], ["fable", 100], ["all models", 12])).label).toBe("all models");
  });

  // FULL IS STILL THE TRUTH when there is nothing left that is not. Falling back to zero, or to
  // nothing, would make a genuinely spent plan read as spare capacity.
  it("fills to 100 when every meter is spent", () => {
    expect(fillBar(bars(["session", 100], ["fable", 100])).pct).toBe(100);
  });

  it("treats 99 as under and 100 as not — the boundary is exact", () => {
    expect(fillBar(bars(["session", 99], ["fable", 100])).pct).toBe(99);
    expect(fillBar(bars(["session", 100], ["fable", 100])).pct).toBe(100);
  });

  // AN EXPLICIT PICK IS HONOURED EVEN AT 100. He asked for that meter; quietly showing a different
  // one because this one is full is the surface overruling him, which is worse than a still bar.
  it("honours his chosen meter, full or not", () => {
    const b = bars(["session", 100], ["all models", 30]);
    expect(fillBar(b, "session").pct).toBe(100);
    expect(fillBar(b, "week").label).toBe("all models");
  });

  it("falls back to the default when his pick names a meter that is not there", () => {
    expect(fillBar(bars(["session", 40], ["all models", 100]), "fable").label).toBe("session");
  });

  it("answers null for no meters rather than throwing", () => {
    expect(fillBar([])).toBe(null);
    expect(fillBar(null)).toBe(null);
  });
});
