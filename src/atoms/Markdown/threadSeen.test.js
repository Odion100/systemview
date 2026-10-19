import { readSeen, writeSeen, replyStamps, unseenCount, newestOf, seenKey } from "./threadSeen";

// RFC-071 — "it should be clear that there's updates on this thread." The badge has to mean NEW,
// not TOTAL: a total is a number you have already read, and a document in a meeting is mostly
// threads that are settled.
const store = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), map: m };
};

describe("what counts as new", () => {
  const src =
    ":::thread{id=t1}\nthe ask\n:::reply{author=you ts=100}\nfirst\n:::\n:::reply{author=buapi ts=200}\nsecond\n:::\n:::";

  it("reads every reply's stamp, written in the document or in the sidecar", () => {
    expect(replyStamps(src)).toEqual([100, 200]);
    expect(replyStamps(src, [{ ts: 300 }])).toEqual([100, 200, 300]);
  });

  it("a thread you have never opened shows its replies as new — you have not read them", () => {
    expect(unseenCount(replyStamps(src), 0)).toBe(2);
  });

  it("counts only what arrived after you last looked", () => {
    expect(unseenCount(replyStamps(src), 100)).toBe(1);
    expect(unseenCount(replyStamps(src), 200)).toBe(0);
  });

  it("an empty thread is never new", () => {
    expect(unseenCount([], 0)).toBe(0);
    expect(unseenCount(replyStamps(":::thread{id=t}\njust prose\n:::"), 0)).toBe(0);
  });
});

// SEEN IS PER READER, never written into the document: three people reading one plan have three
// different answers, and writing yours into the markdown would make everyone else's wrong AND
// dirty the file for every member each time you opened a thread.
describe("seen is remembered per reader, per document, per thread", () => {
  it("keys by document and thread, so the same thread id in two files does not share a state", () => {
    expect(seenKey("a.md", "t1")).not.toBe(seenKey("b.md", "t1"));
  });

  it("round-trips through the store", () => {
    const s = store();
    writeSeen(s, "a.md", "t1", 500);
    expect(readSeen(s, "a.md", "t1")).toBe(500);
    expect(readSeen(s, "a.md", "t2")).toBe(0);
  });

  it("a store that refuses to write shows everything as new rather than throwing in a document", () => {
    const hostile = {
      getItem: () => { throw new Error("nope"); },
      setItem: () => { throw new Error("nope"); },
    };
    expect(() => writeSeen(hostile, "a.md", "t1", 1)).not.toThrow();
    expect(readSeen(hostile, "a.md", "t1")).toBe(0);
  });

  it("marking seen uses the newest reply, so your own post does not stay lit", () => {
    expect(newestOf([100, 900, 300])).toBe(900);
    expect(unseenCount([100, 900, 300], newestOf([100, 900, 300]))).toBe(0);
  });
});
