import { headingLevel, listItem, nestList, startsNewList } from "./chatBlocks";

// THE DEFECT THESE EXIST FOR: the chat's parser matched a heading, used the text and dropped the
// level, so `#` and `######` rendered identically — one bold body-size line. CSS could never have
// fixed it; the level was gone before a stylesheet saw the element.
describe("headingLevel — the level survives the parse", () => {
  it("keeps the level, not just the text", () => {
    expect(headingLevel("# One")).toEqual({ level: 1, text: "One" });
    expect(headingLevel("#### Four")).toEqual({ level: 4, text: "Four" });
    expect(headingLevel("###### Six")).toEqual({ level: 6, text: "Six" });
  });

  it("stops at six — seven hashes is prose about hashes", () => {
    expect(headingLevel("####### nope")).toBeNull();
  });

  it("is not a heading without a space, so a tag or an id stays prose", () => {
    expect(headingLevel("#3 in the list")).toBeNull();
    expect(headingLevel("#hashtag")).toBeNull();
  });

  // A bare row of hashes used to become a bold empty line with spacing round it — visible, and
  // about nothing.
  it("refuses a line of hashes with no words after it", () => {
    expect(headingLevel("###")).toBeNull();
    expect(headingLevel("###   ")).toBeNull();
  });

  it("takes neither null nor a non-string personally", () => {
    expect(headingLevel(null)).toBeNull();
    expect(headingLevel(undefined)).toBeNull();
  });
});

// THE SECOND DEFECT: `^\s*[-*+]\s+` swallowed the indentation before capturing, so a sub-point
// came out as a peer. The voice has the same bug from the same cause.
describe("listItem — the indentation is a depth, not whitespace to discard", () => {
  it("reads a top-level bullet at depth 0", () => {
    expect(listItem("- a point")).toEqual({ ordered: false, depth: 0, text: "a point", number: null });
  });

  it("reads two spaces as one level and four as two", () => {
    expect(listItem("  - under it").depth).toBe(1);
    expect(listItem("    - under that").depth).toBe(2);
  });

  it("counts a tab as four spaces", () => {
    expect(listItem("\t- tabbed").depth).toBe(2);
  });

  // Past three steps a bubble has no width left, and a deeper indent is far more often a pasted
  // block than a fourth level somebody meant.
  it("caps the depth at three", () => {
    expect(listItem("                    - very deep").depth).toBe(3);
  });

  it("keeps an ordered item's own number, for a list that does not start at one", () => {
    expect(listItem("3. third")).toEqual({ ordered: true, depth: 0, text: "third", number: 3 });
    expect(listItem("7) seventh").number).toBe(7);
  });

  it("is not a list item when the marker has no space after it", () => {
    expect(listItem("-no space")).toBeNull();
    expect(listItem("1.no space")).toBeNull();
  });

  it("does not read a sentence that happens to start with a word as a list", () => {
    expect(listItem("minus one is fine")).toBeNull();
  });
});

describe("nestList — a flat run becomes the tree the renderer walks", () => {
  const rows = (...lines) => lines.map(listItem);

  it("keeps a flat list flat", () => {
    const t = nestList(rows("- a", "- b"));
    expect(t.ordered).toBe(false);
    expect(t.items.map((i) => i.text)).toEqual(["a", "b"]);
    expect(t.items.every((i) => i.children === null)).toBe(true);
  });

  it("hangs an indented item off the item above it", () => {
    const t = nestList(rows("- a", "  - a1", "  - a2", "- b"));
    expect(t.items.map((i) => i.text)).toEqual(["a", "b"]);
    expect(t.items[0].children.items.map((i) => i.text)).toEqual(["a1", "a2"]);
    expect(t.items[1].children).toBeNull();
  });

  it("comes back OUT when the indent drops", () => {
    const t = nestList(rows("- a", "  - a1", "- b", "  - b1"));
    expect(t.items.map((i) => i.text)).toEqual(["a", "b"]);
    expect(t.items[0].children.items.map((i) => i.text)).toEqual(["a1"]);
    expect(t.items[1].children.items.map((i) => i.text)).toEqual(["b1"]);
  });

  // A numbered sub-list under a bulleted point is a real and common shape, and it is the one the
  // old flush-on-kind-change cut into three separate lists.
  it("lets a nested list be a different KIND from its parent", () => {
    const t = nestList(rows("- a", "  1. first", "  2. second"));
    expect(t.ordered).toBe(false);
    expect(t.items[0].children.ordered).toBe(true);
    expect(t.items[0].children.start).toBe(1);
  });

  it("carries the start number so a list beginning at 3 is not renumbered to 1", () => {
    expect(nestList(rows("3. three", "4. four")).start).toBe(3);
  });

  // Hand-written markdown skips indents constantly. Honouring a jump would mean emitting a list
  // wrapper with no item to hang it on.
  it("clamps a jump of more than one level", () => {
    const t = nestList(rows("- a", "      - way in"));
    expect(t.items[0].children.items.map((i) => i.text)).toEqual(["way in"]);
    expect(t.items[0].children.items[0].children).toBeNull();
  });

  // There is nothing to be a child OF, so it belongs to this level rather than opening a tier
  // whose parent does not exist.
  it("puts an indented FIRST item at the top level", () => {
    const t = nestList(rows("  - orphan", "- next"));
    expect(t.items.map((i) => i.text)).toEqual(["orphan", "next"]);
  });

  it("answers null for nothing, rather than an empty list wrapper", () => {
    expect(nestList([])).toBeNull();
    expect(nestList(null)).toBeNull();
    expect(nestList([null, undefined])).toBeNull();
  });
});

describe("startsNewList — when a run is a second list and when it is nesting", () => {
  const open = { ordered: false };

  it("starts a new list when the KIND changes at the top level", () => {
    expect(startsNewList(open, listItem("1. one"))).toBe(true);
    expect(startsNewList(open, listItem("- one"))).toBe(false);
  });

  // THE ONE THAT MATTERS: an indented item of the other kind is a SUB-list, and flushing there is
  // exactly what used to cut one list into three.
  it("never starts a new list for an indented item, whatever its kind", () => {
    expect(startsNewList(open, listItem("  1. one"))).toBe(false);
    expect(startsNewList(open, listItem("  - one"))).toBe(false);
  });

  it("starts one when nothing is open", () => {
    expect(startsNewList(null, listItem("- a"))).toBe(true);
  });
});
