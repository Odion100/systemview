import { loadPages, savePages, loadPick, addPage, removePage, movePage, DEFAULT_PAGES } from "./pages";

// A fake store, because the real one is a browser global and these claims are about what happens
// when it holds junk, holds nothing, or throws.
const store = (initial = {}) => {
  const m = { ...initial };
  return {
    getItem: (k) => (k in m ? m[k] : null),
    setItem: (k, v) => {
      m[k] = String(v);
    },
    _m: m,
  };
};
const broken = {
  getItem: () => {
    throw new Error("private mode");
  },
  setItem: () => {
    throw new Error("private mode");
  },
};

describe("reading a saved layout", () => {
  it("a fresh window gets the three candidates, each whole on its own page", () => {
    expect(loadPages(store()).map((p) => p.id)).toEqual(["a", "b", "c"]);
    expect(loadPages(store())[0].legacy).toBe("a");
  });

  // A LAYOUT THAT CANNOT BE PARSED IS NOT A LAYOUT. Every one of these means "I do not know what
  // he arranged", and the honest answer to that is the default — never an empty strip, which is a
  // surface with no pages and no way back.
  it("falls back to the default on junk, on an empty list, and on a store that throws", () => {
    for (const bad of ["{{{", "null", "[]", '"a string"', "[1,2,3]", '[{"no":"id"}]']) {
      expect(loadPages(store({ "sv.dash.pages": bad }))).toEqual(DEFAULT_PAGES);
    }
    expect(loadPages(broken)).toEqual(DEFAULT_PAGES);
    expect(loadPages(undefined)).toEqual(DEFAULT_PAGES);
  });

  it("keeps the pages it can read and drops the entries it cannot", () => {
    const saved = JSON.stringify([{ id: "x", label: "Mine", tiles: [{ kind: "owed", variant: "c" }, null, { nope: 1 }] }, {}]);
    const pages = loadPages(store({ "sv.dash.pages": saved }));
    expect(pages).toHaveLength(1);
    expect(pages[0].tiles).toEqual([{ kind: "owed", variant: "c" }]);
  });

  it("saving never throws, even where it cannot save", () => {
    expect(() => savePages(DEFAULT_PAGES, broken)).not.toThrow();
    const s = store();
    savePages([{ id: "x", label: "X", tiles: [] }], s);
    expect(loadPages(s)[0].id).toBe("x");
  });

  it("the remembered page has to still exist, or you land on the first", () => {
    expect(loadPick(DEFAULT_PAGES, store({ "sv.dash.pick": "b" }))).toBe("b");
    expect(loadPick(DEFAULT_PAGES, store({ "sv.dash.pick": "gone" }))).toBe("a");
    expect(loadPick(DEFAULT_PAGES, broken)).toBe("a");
  });
});

describe("adding and closing", () => {
  it("adding lands you on the new page — finding it yourself is the same action twice", () => {
    const { pages, pick } = addPage(DEFAULT_PAGES);
    expect(pages).toHaveLength(4);
    expect(pick).toBe(pages[3].id);
    expect(pages[3].tiles).toEqual([]);
  });

  // THE ID IS DERIVED FROM WHAT IS TAKEN, not from the count — add, add, close the middle, add,
  // and a count-based id would mint one that already exists and two pages would be one page.
  it("never mints an id that is already taken", () => {
    let pages = addPage(addPage(DEFAULT_PAGES).pages).pages; // p4, p5
    pages = removePage(pages, "p4", "a").pages;
    const next = addPage(pages).pages.map((p) => p.id);
    expect(new Set(next).size).toBe(next.length);
    expect(next).toContain("p5");
  });

  // A SURFACE WITH NO PAGES HAS NOTHING TO DRAW AND NO WAY BACK, and the refusal lives here
  // rather than in the renderer — a rule enforced only where it is painted is one refactor from
  // being gone.
  it("refuses to close the last page, and says why", () => {
    const one = [{ id: "only", label: "Only", tiles: [] }];
    const out = removePage(one, "only", "only");
    expect(out.pages).toEqual(one);
    expect(out.refused).toMatch(/last page/);
  });

  it("closing the page you are on lands you on its neighbour, not back at the start", () => {
    expect(removePage(DEFAULT_PAGES, "c", "c").pick).toBe("b");
    expect(removePage(DEFAULT_PAGES, "b", "b").pick).toBe("a");
    // leftmost has no left neighbour, so it falls to the new first
    expect(removePage(DEFAULT_PAGES, "a", "a").pick).toBe("b");
  });

  it("closing a page you are not on leaves you where you are", () => {
    expect(removePage(DEFAULT_PAGES, "a", "c").pick).toBe("c");
  });

  it("closing a page that is not there changes nothing", () => {
    expect(removePage(DEFAULT_PAGES, "ghost", "a").pages).toEqual(DEFAULT_PAGES);
  });
});

describe("reordering", () => {
  it("moves a page to sit where another one is", () => {
    expect(movePage(DEFAULT_PAGES, "c", "a").map((p) => p.id)).toEqual(["c", "a", "b"]);
    expect(movePage(DEFAULT_PAGES, "a", "c").map((p) => p.id)).toEqual(["b", "a", "c"]);
  });

  it("dropping past the end sends it last, and a no-op is a no-op", () => {
    expect(movePage(DEFAULT_PAGES, "a", null).map((p) => p.id)).toEqual(["b", "c", "a"]);
    expect(movePage(DEFAULT_PAGES, "a", "a")).toEqual(DEFAULT_PAGES);
    expect(movePage(DEFAULT_PAGES, "ghost", "a")).toEqual(DEFAULT_PAGES);
  });
});
