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
  it("a fresh window gets three pages, each a stack of its own tiles", () => {
    expect(loadPages(store()).map((p) => p.id)).toEqual(["ra", "rb", "rc"]);
    const ra = loadPages(store())[0];
    expect(ra.legacy).toBeUndefined();
    expect(ra.tiles.map((t) => `${t.kind}/${t.variant}`)).toEqual(["head/a", "owed/a", "standing/a"]);
  });

  // THE CANDIDATES ARE RETIRED, and his saved layout still names all three. Stripping the field
  // would leave three pages with no tiles on them, which is a worse answer than no page at all.
  it("drops a saved candidate page instead of emptying it", () => {
    const saved = JSON.stringify([
      { id: "a", label: "A · one track", legacy: "a", tiles: [] },
      { id: "rb", label: "B · the floor", tiles: [{ kind: "owed", variant: "b" }] },
    ]);
    const pages = loadPages(store({ "sv.dash.pages": saved }));
    expect(pages.map((p) => p.id)).toEqual(["rb"]);
  });

  // …but never at the cost of something he arranged. A legacy page carrying tiles never existed;
  // if one turns up it is kept as an ordinary page, because dropping his work is the one mistake
  // this migration must not make.
  it("keeps a legacy page that somehow has tiles on it", () => {
    const saved = JSON.stringify([{ id: "a", label: "A", legacy: "a", tiles: [{ kind: "head", variant: "c" }] }]);
    const pages = loadPages(store({ "sv.dash.pages": saved }));
    expect(pages).toEqual([{ id: "a", label: "A", tiles: [{ kind: "head", variant: "c" }] }]);
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
    expect(loadPick(DEFAULT_PAGES, store({ "sv.dash.pick": "rb" }))).toBe("rb");
    // A RETIRED CANDIDATE IS "gone" NOW — the remembered pick survives the retirement by failing
    // this test and landing on the first page, rather than selecting a page that cannot render.
    expect(loadPick(DEFAULT_PAGES, store({ "sv.dash.pick": "b" }))).toBe("ra");
    expect(loadPick(DEFAULT_PAGES, store({ "sv.dash.pick": "gone" }))).toBe("ra");
    expect(loadPick(DEFAULT_PAGES, broken)).toBe("ra");
  });
});

describe("adding and closing", () => {
  it("adding lands you on the new page — finding it yourself is the same action twice", () => {
    const { pages, pick } = addPage(DEFAULT_PAGES);
    expect(pages).toHaveLength(DEFAULT_PAGES.length + 1);
    expect(pick).toBe(pages[pages.length - 1].id);
    expect(pages[pages.length - 1].tiles).toEqual([]);
  });

  // THE ID IS DERIVED FROM WHAT IS TAKEN, not from the count — add, add, close the middle, add,
  // and a count-based id would mint one that already exists and two pages would be one page.
  it("never mints an id that is already taken", () => {
    let pages = addPage(addPage(DEFAULT_PAGES).pages).pages;
    const first = pages[DEFAULT_PAGES.length].id;
    pages = removePage(pages, first, "ra").pages;
    const next = addPage(pages).pages.map((p) => p.id);
    expect(new Set(next).size).toBe(next.length);
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
    expect(removePage(DEFAULT_PAGES, "rc", "rc").pick).toBe("rb");
    expect(removePage(DEFAULT_PAGES, "rb", "rb").pick).toBe("ra");
    // leftmost has no left neighbour, so it falls to the new first
    expect(removePage(DEFAULT_PAGES, "ra", "ra").pick).toBe("rb");
  });

  it("closing a page you are not on leaves you where you are", () => {
    expect(removePage(DEFAULT_PAGES, "ra", "rc").pick).toBe("rc");
  });

  it("closing a page that is not there changes nothing", () => {
    expect(removePage(DEFAULT_PAGES, "ghost", "ra").pages).toEqual(DEFAULT_PAGES);
  });
});

describe("reordering", () => {
  it("moves a page to sit where another one is", () => {
    expect(movePage(DEFAULT_PAGES, "rc", "ra").map((p) => p.id)).toEqual(["rc", "ra", "rb"]);
    expect(movePage(DEFAULT_PAGES, "ra", "rc").map((p) => p.id)).toEqual(["rb", "ra", "rc"]);
  });

  it("dropping past the end sends it last, and a no-op is a no-op", () => {
    expect(movePage(DEFAULT_PAGES, "ra", null).map((p) => p.id).pop()).toBe("ra");
    expect(movePage(DEFAULT_PAGES, "ra", "ra")).toEqual(DEFAULT_PAGES);
    expect(movePage(DEFAULT_PAGES, "ghost", "ra")).toEqual(DEFAULT_PAGES);
  });
});
