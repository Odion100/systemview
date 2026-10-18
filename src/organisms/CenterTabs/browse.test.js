// THE BROWSE BRAIN'S CLAIMS — the pure half of the + door's navigation. The popup has no rendering
// suite, so the brain carries the proof: what a typed string means, how entries rank, how a pick
// joins back on.
import { browseSplit, browseMatch, browseJoin } from "./browse";

describe("browseSplit — what the typed string means", () => {
  it("empty input is recents' moment, not a listing", () => {
    expect(browseSplit("")).toEqual({ dir: null, frag: "", machine: false });
    expect(browseSplit("   ")).toEqual({ dir: null, frag: "", machine: false });
  });
  it("no slash filters the project root", () => {
    expect(browseSplit("src")).toEqual({ dir: ".", frag: "src", machine: false });
  });
  it("a relative path lists its folder and filters by the tail", () => {
    expect(browseSplit("src/at")).toEqual({ dir: "src", frag: "at", machine: false });
    expect(browseSplit("src/")).toEqual({ dir: "src", frag: "", machine: false });
  });
  it("~ and absolute paths go through the machine door", () => {
    expect(browseSplit("~")).toEqual({ dir: "~", frag: "", machine: true });
    expect(browseSplit("~/Sys")).toEqual({ dir: "~", frag: "Sys", machine: true });
    expect(browseSplit("/usr")).toEqual({ dir: "/", frag: "usr", machine: true });
    expect(browseSplit("/a/b/c")).toEqual({ dir: "/a/b", frag: "c", machine: true });
  });
});

describe("browseMatch — dirs first, prefix beats substring, capped", () => {
  const E = [
    { name: "zebra.js", dir: false },
    { name: "atoms", dir: true },
    { name: "chat.js", dir: false },
    { name: "static", dir: true },
  ];
  it("no fragment keeps everything, dirs leading", () => {
    expect(browseMatch(E, "").map((e) => e.name)).toEqual(["atoms", "static", "chat.js", "zebra.js"]);
  });
  it("prefix matches outrank substring matches", () => {
    expect(browseMatch(E, "at").map((e) => e.name)).toEqual(["atoms", "static", "chat.js"]);
  });
  it("non-matches drop and the cap holds", () => {
    expect(browseMatch(E, "zzz")).toEqual([]);
    const many = Array.from({ length: 30 }, (_, i) => ({ name: `f${i}`, dir: false }));
    expect(browseMatch(many, "", 12)).toHaveLength(12);
  });
});

describe("browseJoin — the pick keeps the typed address form", () => {
  it("project root, folder, filesystem root, home", () => {
    expect(browseJoin(".", "src")).toBe("src");
    expect(browseJoin("src", "atoms")).toBe("src/atoms");
    expect(browseJoin("/", "usr")).toBe("/usr");
    expect(browseJoin("~", "Systemly")).toBe("~/Systemly");
  });
});
