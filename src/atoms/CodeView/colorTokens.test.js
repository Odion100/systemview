import { parseColor, formatColor, findColors } from "./colorTokens";

describe("parseColor — every notation a colour is actually written in", () => {
  test("hex, all four lengths, and alpha is kept SEPARATE from the hex", () => {
    expect(parseColor("#fff")).toMatchObject({ hex: "#ffffff", alpha: 1, kind: "hex3" });
    expect(parseColor("#1E90FF")).toMatchObject({ hex: "#1e90ff", alpha: 1, kind: "hex6" });
    expect(parseColor("#80808080").hex).toBe("#808080");
    // a native colour input cannot show alpha, so folding it into the hex would silently make
    // everything opaque the first time he picked
    expect(parseColor("#80808080").alpha).toBeCloseTo(0.502, 2);
    expect(parseColor("#abc4").alpha).toBeCloseTo(0.267, 2);
  });

  test("rgb and rgba, comma and space forms, percentages and slash-alpha", () => {
    expect(parseColor("rgb(255, 0, 0)")).toMatchObject({ hex: "#ff0000", alpha: 1 });
    expect(parseColor("rgba(0,0,0,0.5)").alpha).toBe(0.5);
    expect(parseColor("rgb(255 0 0)").hex).toBe("#ff0000");
    expect(parseColor("rgb(255 0 0 / 0.25)").alpha).toBe(0.25);
    expect(parseColor("rgb(100%, 0%, 0%)").hex).toBe("#ff0000");
  });

  test("hsl and hsla round-trip to the right rgb", () => {
    expect(parseColor("hsl(0, 100%, 50%)").hex).toBe("#ff0000");
    expect(parseColor("hsl(120, 100%, 50%)").hex).toBe("#00ff00");
    expect(parseColor("hsl(240, 100%, 50%)").hex).toBe("#0000ff");
    expect(parseColor("hsla(0, 0%, 0%, 0.3)").alpha).toBe(0.3);
  });

  test("named colours resolve, and transparent keeps its zero alpha", () => {
    expect(parseColor("dodgerblue")).toMatchObject({ hex: "#1e90ff", kind: "named" });
    expect(parseColor("transparent").alpha).toBe(0);
  });

  test("nonsense is null, not a guess", () => {
    expect(parseColor("#ab")).toBeNull();
    expect(parseColor("rgb(1,2)")).toBeNull();
    expect(parseColor("")).toBeNull();
    expect(parseColor("borderRadius")).toBeNull();
  });
});

describe("findColors — what it decorates, and what it must leave alone", () => {
  test("finds colours wherever they sit, not just in declarations", () => {
    const src = `
      $brand: #1e90ff;
      const style = { color: "rgba(0,0,0,.6)", background: "#FFF" };
      const palette = ["#ff6347", "hsl(200, 50%, 40%)"];
      // the old value was dodgerblue
    `;
    expect(findColors(src).map((c) => c.raw)).toEqual([
      "#1e90ff", "rgba(0,0,0,.6)", "#FFF", "#ff6347", "hsl(200, 50%, 40%)", "dodgerblue",
    ]);
  });

  test("an 8-digit hex is ONE colour, not a 6-digit one with two digits left over", () => {
    const hits = findColors("border: 1px solid #aabbccdd;");
    expect(hits).toHaveLength(1);
    expect(hits[0].raw).toBe("#aabbccdd");
  });

  test("a colour name inside an identifier is NOT a colour", () => {
    // the failure that makes swatches worth ignoring: decorating the `red` in `borderRadius`
    expect(findColors("const borderRadius = 4; el.classList.add('is-greyed');")).toEqual([]);
    expect(findColors("background: red;").map((c) => c.raw)).toEqual(["red"]);
  });

  test("positions are exact, so a decoration can only land on the literal", () => {
    const src = "color: #abc;";
    const [c] = findColors(src);
    expect(src.slice(c.from, c.to)).toBe("#abc");
  });
});

describe("formatColor — a colour is written back in the notation it replaced", () => {
  test("hex stays the width it was, and only widens when it has to", () => {
    expect(formatColor("#aabbcc", { kind: "hex3" })).toBe("#abc");
    // #123456 has no 3-digit form; rounding to the nearest one would hand him a different colour
    expect(formatColor("#123456", { kind: "hex3" })).toBe("#123456");
    expect(formatColor("#1E90FF", { kind: "hex6" })).toBe("#1e90ff");
  });

  test("rgb stays rgb, and gains the a only when alpha is real", () => {
    expect(formatColor("#ff0000", { kind: "rgb" })).toBe("rgb(255, 0, 0)");
    expect(formatColor("#ff0000", { kind: "rgb", alpha: 0.5 })).toBe("rgba(255, 0, 0, 0.5)");
    expect(formatColor("#000000", { kind: "rgba", alpha: 1 })).toBe("rgba(0, 0, 0, 1)");
  });

  test("hsl stays hsl, and the round trip holds for the primaries", () => {
    expect(formatColor("#ff0000", { kind: "hsl" })).toBe("hsl(0, 100%, 50%)");
    expect(formatColor("#00ff00", { kind: "hsl" })).toBe("hsl(120, 100%, 50%)");
    expect(formatColor("#808080", { kind: "hsl" })).toBe("hsl(0, 0%, 50%)");
    expect(formatColor("#ff0000", { kind: "hsla", alpha: 0.2 })).toBe("hsla(0, 100%, 50%, 0.2)");
  });

  test("ALPHA SURVIVES AN EDIT — the picker cannot see it, so it must be carried through", () => {
    // pick a new colour on `rgba(0,0,0,.6)` and the .6 has to come out the other side
    const { kind, alpha } = parseColor("rgba(0,0,0,.6)");
    expect(formatColor("#112233", { kind, alpha })).toBe("rgba(17, 34, 51, 0.6)");
    const h8 = parseColor("#11223380");
    expect(formatColor("#445566", { kind: h8.kind, alpha: h8.alpha })).toBe("#44556680");
  });

  test("a named colour keeps its name only if the colour did not change", () => {
    expect(formatColor("#1e90ff", { kind: "named", name: "dodgerblue" })).toBe("dodgerblue");
    expect(formatColor("#1e90fe", { kind: "named", name: "dodgerblue" })).toBe("#1e90fe");
  });

  test("every notation round-trips unchanged when the colour is unchanged — no churn", () => {
    for (const raw of ["#abc", "#aabbcc", "#aabbccdd", "rgb(1, 2, 3)", "rgba(1, 2, 3, 0.5)", "hsl(200, 50%, 40%)", "dodgerblue"]) {
      const p = parseColor(raw);
      const back = formatColor(p.hex, p);
      // normalised spacing is allowed; a different VALUE or a different NOTATION is not
      expect(parseColor(back).hex).toBe(p.hex);
      expect(parseColor(back).alpha).toBeCloseTo(p.alpha, 2);
      expect(parseColor(back).kind).toBe(p.kind);
    }
  });
});
