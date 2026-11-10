// THE ORDER IS HELD TO THE TWO THINGS HE CAUGHT, because the first build of this failed both and
// they came out of one wrong idea — that "working" was a transient state with a group of its own.
//
//   *"It moved in front of you, which should have just added to the end of you."*
//   *"Why did it move away? It went back to where it was."*
//
// So: a tab he is in is never jumped over, and NOTHING EVER FALLS BACK. Most of the assertions
// below are about a tab that must not move.
import { tabOrder, used, ran, prune, emptyRanks } from "./tabOrder";

const ORDER = ["alpha", "beta", "gamma", "delta"];

describe("the strip is ordered by what he has been using", () => {
  it("is his dock order until something earns a place", () => {
    expect(tabOrder({ order: ORDER, ranks: emptyRanks() })).toEqual(ORDER);
    expect(tabOrder({ order: ORDER })).toEqual(ORDER);
  });

  it("puts the tab he opened at the front", () => {
    const r = used(emptyRanks(), "gamma");
    expect(tabOrder({ order: ORDER, ranks: r })).toEqual(["gamma", "alpha", "beta", "delta"]);
  });

  it("orders the tabs he has opened by how recently he opened them", () => {
    let r = used(emptyRanks(), "gamma");
    r = used(r, "delta");
    r = used(r, "beta");
    expect(tabOrder({ order: ORDER, ranks: r })).toEqual(["beta", "delta", "gamma", "alpha"]);
  });

  // ─── HIS FIRST COMPLAINT ─────────────────────────────────────────────────────────────────────
  it("a working agent lands BEHIND the tab he is in, never over it", () => {
    let r = used(emptyRanks(), "alpha"); // he is in alpha
    r = ran(r, "delta"); // delta starts working
    expect(tabOrder({ order: ORDER, ranks: r })).toEqual(["alpha", "delta", "beta", "gamma"]);
  });

  it("a working agent cannot climb over ANY tab he has opened, however long ago", () => {
    let r = used(emptyRanks(), "gamma");
    r = used(r, "alpha");
    r = ran(r, "delta");
    // both of his are ahead of the bot's own announcement about itself
    expect(tabOrder({ order: ORDER, ranks: r })).toEqual(["alpha", "gamma", "delta", "beta"]);
  });

  it("a second working agent lands behind the first, so nothing already forward moves", () => {
    let r = used(emptyRanks(), "alpha");
    r = ran(r, "delta");
    const first = tabOrder({ order: ORDER, ranks: r });
    r = ran(r, "beta");
    expect(tabOrder({ order: ORDER, ranks: r })).toEqual(["alpha", "delta", "beta", "gamma"]);
    // delta did not move when beta arrived
    expect(first.indexOf("delta")).toBe(1);
  });

  it("never swaps two agents that have come forward, whatever happens afterwards", () => {
    let r = ran(emptyRanks(), "gamma");
    r = ran(r, "beta");
    const before = tabOrder({ order: ORDER, ranks: r });
    // both announce themselves again, repeatedly — a flip must not re-rank anything
    r = ran(r, "gamma");
    r = ran(r, "beta");
    r = ran(r, "gamma");
    expect(tabOrder({ order: ORDER, ranks: r })).toEqual(before);
  });

  // ─── HIS SECOND COMPLAINT ────────────────────────────────────────────────────────────────────
  it("NOTHING FALLS BACK — there is no state an agent can reach that undoes its place", () => {
    let r = ran(emptyRanks(), "delta");
    const forward = tabOrder({ order: ORDER, ranks: r });
    expect(forward).toEqual(["delta", "alpha", "beta", "gamma"]);
    // the ranks are the whole state, and nothing in the module can lower one: finishing, going
    // idle and reloading all leave this list identical, which is the point.
    expect(tabOrder({ order: ORDER, ranks: r })).toEqual(forward);
    expect(tabOrder({ order: ORDER, ranks: JSON.parse(JSON.stringify(r)) })).toEqual(forward);
  });

  it("opening a tab retires the rank it earned by working, so the tiers cannot disagree", () => {
    let r = ran(emptyRanks(), "delta");
    r = ran(r, "beta");
    r = used(r, "beta"); // he opens the one that was working
    expect(r.ran.beta).toBeUndefined();
    expect(tabOrder({ order: ORDER, ranks: r })).toEqual(["beta", "delta", "alpha", "gamma"]);
  });

  // ─── MOVEMENT HE DID NOT CAUSE, AT THE MOMENT HE IS ABOUT TO PRESS ───────────────────────────
  it("holds completely still while his pointer is on the strip", () => {
    const last = ["alpha", "beta", "gamma", "delta"];
    const r = ran(emptyRanks(), "delta");
    expect(tabOrder({ order: ORDER, ranks: r, frozen: true, last })).toEqual(last);
    expect(tabOrder({ order: ORDER, ranks: r, frozen: false, last })).toEqual(["delta", "alpha", "beta", "gamma"]);
  });

  it("stays truthful while frozen — a tab that appeared is drawn, one that went away is not", () => {
    const last = ["delta", "alpha", "beta", "gamma"];
    const order = ["alpha", "beta", "gamma", "epsilon"]; // delta gone, epsilon new
    const held = tabOrder({ order, ranks: emptyRanks(), frozen: true, last });
    expect(held).toEqual(["alpha", "beta", "gamma", "epsilon"]);
    expect(held).not.toContain("delta");
  });

  it("falls back to his order when there is nothing to hold to", () => {
    expect(tabOrder({ order: ORDER, ranks: emptyRanks(), frozen: true, last: [] })).toEqual(ORDER);
  });

  // ─── HOUSEKEEPING ────────────────────────────────────────────────────────────────────────────
  it("forgets a project that no longer exists, and leaves the ranks alone when none has", () => {
    let r = used(emptyRanks(), "gone");
    r = ran(r, "beta");
    const pruned = prune(r, ORDER);
    expect(pruned.used.gone).toBeUndefined();
    expect(pruned.ran.beta).toBe(r.ran.beta);
    // UNCHANGED MEANS THE SAME OBJECT — the strip stores this on every change, and a new object
    // every render would be a write every render.
    expect(prune(pruned, ORDER)).toBe(pruned);
  });

  it("a rank for a project that is not on the strip changes nothing about the order", () => {
    const r = used(emptyRanks(), "vanished");
    expect(tabOrder({ order: ORDER, ranks: r })).toEqual(ORDER);
  });

  it("survives junk — no arguments, empty names, a half-written store", () => {
    expect(() => tabOrder()).not.toThrow();
    expect(tabOrder()).toEqual([]);
    expect(tabOrder({ order: [null, "", "alpha"], ranks: emptyRanks() })).toEqual(["alpha"]);
    expect(used(emptyRanks(), "")).toEqual(emptyRanks());
    expect(ran(emptyRanks(), null)).toEqual(emptyRanks());
    expect(tabOrder({ order: ORDER, ranks: { seq: 3 } })).toEqual(ORDER);
  });
});
