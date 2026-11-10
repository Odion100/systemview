// THE ORDERING IS HELD TO THE CONSTRAINT, NOT TO THE FEATURE. "Working agents come to the front"
// is the easy half and one line of sort would do it. What these assert is the half he actually
// asked for — *"it can't be fighting, I don't want to see constant switching"* — so every test
// below is about a tab that must NOT move.
import { tabOrder, beginRun, endRun, workingNow, glowing, AFTERGLOW_MS } from "./tabOrder";

const ORDER = ["alpha", "beta", "gamma", "delta"];
const T = 1_700_000_000_000;

describe("the working agents come to the front", () => {
  it("leaves his order alone when nobody is working", () => {
    expect(tabOrder({ order: ORDER, runs: {}, now: T })).toEqual(ORDER);
  });

  it("brings a working agent to the front and leaves the rest in his order", () => {
    const runs = beginRun({}, "gamma", T);
    expect(tabOrder({ order: ORDER, runs, now: T })).toEqual(["gamma", "alpha", "beta", "delta"]);
  });

  it("orders the front group by WHO STARTED FIRST, so a new one lands behind it and moves nobody", () => {
    let runs = beginRun({}, "delta", T);
    runs = beginRun(runs, "beta", T + 1000);
    expect(tabOrder({ order: ORDER, runs, now: T + 1000 })).toEqual(["delta", "beta", "alpha", "gamma"]);
    // a THIRD one starting goes to the back of the front group — delta and beta do not budge
    runs = beginRun(runs, "alpha", T + 2000);
    expect(tabOrder({ order: ORDER, runs, now: T + 2000 })).toEqual(["delta", "beta", "alpha", "gamma"]);
  });

  it("never swaps two working agents, however long one of them runs", () => {
    let runs = beginRun({}, "gamma", T);
    runs = beginRun(runs, "alpha", T + 500);
    const first = tabOrder({ order: ORDER, runs, now: T + 500 });
    // hours later, both still working — the order is the same order
    expect(tabOrder({ order: ORDER, runs, now: T + 6 * 3600_000 })).toEqual(first);
  });

  it("holds a finished agent's place through its afterglow, then lets it fall back", () => {
    let runs = beginRun({}, "delta", T);
    runs = endRun(runs, "delta", T + 1000);
    // STILL UP — a tab that moved because something ENDED is the least useful movement there is
    expect(tabOrder({ order: ORDER, runs, now: T + 1000 })).toEqual(["delta", "alpha", "beta", "gamma"]);
    expect(tabOrder({ order: ORDER, runs, now: T + 1000 + AFTERGLOW_MS - 1 })).toEqual(["delta", "alpha", "beta", "gamma"]);
    // and then back to his order, with nothing else disturbed
    expect(tabOrder({ order: ORDER, runs, now: T + 1000 + AFTERGLOW_MS + 1 })).toEqual(ORDER);
  });

  it("a restart inside its own afterglow keeps its old place instead of going to the back", () => {
    let runs = beginRun({}, "delta", T);
    runs = beginRun(runs, "beta", T + 1000);
    // delta flickers off and straight back on — it never left, so it does not re-arrive
    runs = endRun(runs, "delta", T + 2000);
    runs = beginRun(runs, "delta", T + 3000);
    expect(runs.delta.since).toBe(T);
    expect(tabOrder({ order: ORDER, runs, now: T + 3000 })).toEqual(["delta", "beta", "alpha", "gamma"]);
  });

  it("a restart AFTER the afterglow has run out is a real arrival", () => {
    let runs = beginRun({}, "delta", T);
    runs = endRun(runs, "delta", T);
    runs = beginRun(runs, "beta", T + 1000);
    const back = T + AFTERGLOW_MS + 5000;
    runs = beginRun(runs, "delta", back);
    expect(runs.delta.since).toBe(back);
    expect(tabOrder({ order: ORDER, runs, now: back })).toEqual(["beta", "delta", "alpha", "gamma"]);
  });

  it("ignores a repeated announcement — the same state twice changes nothing at all", () => {
    const runs = beginRun({}, "beta", T);
    expect(beginRun(runs, "beta", T + 9999)).toBe(runs);
    const quiet = endRun(runs, "beta", T);
    expect(endRun(quiet, "beta", T + 9999)).toBe(quiet);
  });

  it("holds completely still while he is on the strip", () => {
    const last = ["gamma", "alpha", "beta", "delta"];
    let runs = beginRun({}, "gamma", T);
    runs = beginRun(runs, "delta", T + 1000);
    // delta has started working and would normally be second. His pointer is on the strip, so no.
    expect(tabOrder({ order: ORDER, runs, now: T + 1000, frozen: true, last })).toEqual(last);
    // off the strip, it takes its place
    expect(tabOrder({ order: ORDER, runs, now: T + 1000, frozen: false, last })).toEqual(["gamma", "delta", "alpha", "beta"]);
  });

  it("stays truthful while frozen — a tab that appeared is drawn, one that went away is not", () => {
    const last = ["gamma", "alpha", "beta", "delta"];
    const order = ["alpha", "beta", "gamma", "epsilon"]; // delta gone, epsilon new
    const held = tabOrder({ order, runs: {}, now: T, frozen: true, last });
    expect(held).toEqual(["gamma", "alpha", "beta", "epsilon"]);
    expect(held).not.toContain("delta");
  });

  it("falls back to his order when there is nothing to hold to", () => {
    expect(tabOrder({ order: ORDER, runs: {}, now: T, frozen: true, last: [] })).toEqual(ORDER);
  });

  it("derives the working mark from the same runs the order comes from", () => {
    let runs = beginRun({}, "alpha", T);
    runs = beginRun(runs, "beta", T);
    expect([...workingNow(runs)].sort()).toEqual(["alpha", "beta"]);
    runs = endRun(runs, "beta", T);
    // THE DOT IS OFF THE MOMENT IT STOPS, even though the TAB keeps its place through the
    // afterglow — the mark is about what is happening, the place is about not jerking him around
    expect([...workingNow(runs)]).toEqual(["alpha"]);
    expect(tabOrder({ order: ORDER, runs, now: T })).toEqual(["alpha", "beta", "gamma", "delta"]);
  });

  it("only asks for a clock while something is actually counting down", () => {
    expect(glowing({}, T)).toBe(false);
    const working = beginRun({}, "alpha", T);
    expect(glowing(working, T)).toBe(false); // working forever needs no tick
    const quiet = endRun(working, "alpha", T);
    expect(glowing(quiet, T)).toBe(true);
    expect(glowing(quiet, T + AFTERGLOW_MS + 1)).toBe(false);
  });

  it("survives junk — no arguments, empty order, a run for a project that is gone", () => {
    expect(() => tabOrder()).not.toThrow();
    expect(tabOrder()).toEqual([]);
    expect(tabOrder({ order: [null, "", "alpha"], runs: {}, now: T })).toEqual(["alpha"]);
    expect(tabOrder({ order: ORDER, runs: beginRun({}, "vanished", T), now: T })).toEqual(ORDER);
  });
});
