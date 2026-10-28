import { richParts } from "./rich";

describe("richParts — the two marks the page's own copy is allowed", () => {
  it("splits a backticked span out as code", () => {
    expect(richParts("the `::rfc` leaf")).toEqual([
      { t: "text", v: "the " },
      { t: "code", v: "::rfc" },
      { t: "text", v: " leaf" },
    ]);
  });
  it("splits a doubled-asterisk span out as bold", () => {
    expect(richParts("**a press writes the fact** it reads")).toEqual([
      { t: "bold", v: "a press writes the fact" },
      { t: "text", v: " it reads" },
    ]);
  });
  it("handles both in one string, in order", () => {
    expect(richParts("**no** timer moves `state`").map((p) => p.t)).toEqual(["bold", "text", "code"]);
  });
  it("plain prose is one part, and empties are dropped", () => {
    expect(richParts("just words")).toEqual([{ t: "text", v: "just words" }]);
  });
  it("an unclosed mark stays literal rather than eating the rest of the line", () => {
    expect(richParts("a `leaf that never closes")).toEqual([
      { t: "text", v: "a `leaf that never closes" },
    ]);
  });
  it("nothing in is nothing out", () => {
    expect(richParts(null)).toEqual([]);
    expect(richParts("")).toEqual([]);
  });
});
