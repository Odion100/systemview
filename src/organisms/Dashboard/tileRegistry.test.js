import { addVariant, resolveTile, tileKinds, hasSiblings } from "./tileRegistry";

// A SAVED LAYOUT OUTLIVES THE CODE IT NAMES. These claims are all about that one fact: a layout
// is his instruction, written down weeks ago, and the registry has to keep honouring it while
// variants come and go — or degrade in a way that SAYS it degraded.

const Stub = () => null;

beforeAll(() => {
  addVariant("owed", "a", { label: "A · rows", Component: Stub });
  addVariant("owed", "c", { label: "C · cards", Component: Stub });
  addVariant("reports", "b", { label: "B · the stack", Component: Stub });
});

it("resolves a kind and variant to its component", () => {
  const t = resolveTile("owed", "a");
  expect(t.Component).toBe(Stub);
  expect(t.label).toBe("A · rows");
  expect(t.needs).toBe("registry");
  expect(t.substituted).toBe(false);
});

// A VARIANT THAT IS GONE MUST NOT LEAVE A HOLE. A hole reads as "nothing here", which is the one
// thing this surface may never say when there is something there.
it("falls back to the kind's default when the named variant is gone, and SAYS it substituted", () => {
  const t = resolveTile("owed", "b-that-never-existed");
  expect(t.Component).toBe(Stub);
  expect(t.substituted).toBe(true);
  expect(t.asked).toBe("b-that-never-existed");
  // the fallback is the kind's declared one, not whichever happened to register first
  expect(t.variant).toBe("c");
});

it("uses whatever variant exists when even the declared fallback is missing", () => {
  const t = resolveTile("reports", "nope");
  expect(t.variant).toBe("b");
  expect(t.substituted).toBe(true);
});

// A KIND THAT IS GONE IS THE ONE CASE THAT CANNOT BE HONOURED — and it answers null rather than
// guessing at a neighbouring kind, because showing him a different section than the one he placed
// is worse than showing him that the tile is missing.
it("answers null for a kind it does not have", () => {
  expect(resolveTile("terminal", "a")).toBeNull();
  expect(resolveTile("standing", "a")).toBeNull(); // registered kind, no variants yet
});

it("offers every kind for the add menu, with its variants and what it needs", () => {
  const kinds = tileKinds();
  const owed = kinds.find((k) => k.kind === "owed");
  expect(owed.label).toBe("What is owed");
  expect(owed.needs).toBe("registry");
  expect(owed.variants.map((v) => v.variant).sort()).toEqual(["a", "c"]);
  // a kind with nothing registered is still offered — the menu is the inventory, and hiding an
  // empty kind is how a tile nobody built becomes a tile nobody remembers was planned
  expect(kinds.map((k) => k.kind)).toContain("standing");
});

// THE SWITCH IS ONLY WORTH DRAWING WHERE THERE IS SOMETHING TO SWITCH TO.
it("knows which kinds have siblings", () => {
  expect(hasSiblings("owed")).toBe(true);
  expect(hasSiblings("reports")).toBe(false);
  expect(hasSiblings("nope")).toBe(false);
});

it("refuses a variant on a kind that does not exist, rather than inventing the kind", () => {
  expect(() => addVariant("ghost", "a", { label: "x", Component: Stub })).toThrow(/no such tile kind/);
  expect(() => addVariant("owed", "z", { label: "x" })).toThrow(/no component/);
});
