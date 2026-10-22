import { behind, register, AHEAD } from "./lineUp";

const made = [];
const make = (key) => () => {
  made.push(key);
  return { key, label: key, start: () => ({ stop: () => {} }) };
};
const ORDER = ["a", "b", "c", "d", "e", "f"];

beforeEach(() => {
  made.length = 0;
  ORDER.forEach((k) => register(k, make(k)));
});

describe("what lines up behind the reply he pressed", () => {
  // GOING BACK TO THE BEGINNING MEANS LISTENING THROUGH. There is no technical reason to stop at
  // a handful — an item is a closure, not audio — so the default is the rest of the conversation.
  it("queues everything after the one he pressed, not a handful", () => {
    expect(behind("b", ORDER).map((i) => i.key)).toEqual(["c", "d", "e", "f"]);
    expect(behind("a", ORDER).map((i) => i.key)).toEqual(["b", "c", "d", "e", "f"]);
    expect(AHEAD).toBe(Infinity);
  });

  it("still takes a limit, for a caller that wants only the next few", () => {
    expect(behind("a", ORDER, 2).map((i) => i.key)).toEqual(["b", "c"]);
  });

  it("stops at the end of the conversation instead of wrapping", () => {
    expect(behind("e", ORDER).map((i) => i.key)).toEqual(["f"]);
    expect(behind("f", ORDER)).toEqual([]);
  });

  it("skips a row that has nothing speakable rather than stopping on it", () => {
    const order = ["a", "b", "c", "gap", "e", "f"];
    expect(behind("b", order).map((i) => i.key)).toEqual(["c", "e", "f"]);
  });

  it("gives nothing when the pressed row is not in the order it was handed", () => {
    expect(behind("zzz", ORDER)).toEqual([]);
  });

  it("builds an item per row it queues, and none for rows before it", () => {
    behind("d", ORDER);
    expect(made).toEqual(["e", "f"]); // nothing built for a, b, c
  });

  it("forgets a row that unmounted, so it cannot be queued from a stale render", () => {
    const off = register("zz", make("zz"));
    expect(behind("f", [...ORDER, "zz"]).map((i) => i.key)).toEqual(["zz"]);
    off();
    expect(behind("f", [...ORDER, "zz"])).toEqual([]);
  });

  it("holds no state between presses — the whole reason the last attempt broke", () => {
    expect(behind("a", ORDER).map((i) => i.key)).toEqual(["b", "c", "d", "e", "f"]);
    expect(behind("a", ORDER).map((i) => i.key)).toEqual(["b", "c", "d", "e", "f"]);
  });
});
