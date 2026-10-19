import { tuckKey, readTucked, writeTucked } from "./pinTucked";

// Per READER and per DOCUMENT — the same split threadSeen makes, for the same reason: "I have put
// this aside" is not a fact about the document, and writing it into the file would dirty it for
// every member every time somebody tidied their own corner.
describe("remembering a tucked corner", () => {
  const store = {
    map: {},
    getItem(k) {
      return k in this.map ? this.map[k] : null;
    },
    setItem(k, v) {
      this.map[k] = String(v);
    },
    removeItem(k) {
      delete this.map[k];
    },
  };
  beforeEach(() => {
    store.map = {};
  });

  it("keys by document, so one corner is not every corner", () => {
    expect(tuckKey("RFCs/a.md")).not.toBe(tuckKey("RFCs/b.md"));
    writeTucked(store, "RFCs/a.md", true);
    expect(readTucked(store, "RFCs/a.md")).toBe(true);
    expect(readTucked(store, "RFCs/b.md")).toBe(false);
  });

  it("untucking forgets rather than writing a false", () => {
    writeTucked(store, "a.md", true);
    writeTucked(store, "a.md", false);
    expect(store.getItem(tuckKey("a.md"))).toBeNull();
    expect(readTucked(store, "a.md")).toBe(false);
  });

  // A reader that cannot remember shows the stack — wrong in the harmless direction, never a crash
  // in the middle of a document.
  it("a store that throws reads as not tucked, and writing is survivable", () => {
    const bad = {
      getItem() {
        throw new Error("denied");
      },
      setItem() {
        throw new Error("denied");
      },
      removeItem() {
        throw new Error("denied");
      },
    };
    expect(readTucked(bad, "a.md")).toBe(false);
    expect(() => writeTucked(bad, "a.md", true)).not.toThrow();
  });
});
