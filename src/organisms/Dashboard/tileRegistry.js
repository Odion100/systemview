// THE TILE REGISTRY — what can stand on the surface, and which versions of it exist.
//
// His design: *"some of these components are basically different versions of each other, some of
// them may not have another version… there would have to be some options on the component to
// switch the type if you want."* So a tile has a KIND (what it shows) and a VARIANT (whose
// version of it), and the variant switch is a control on the tile rather than a choice baked into
// the page.
//
// THE REGISTRY IS OPEN — his ruling. Anything in the window could become a tile later: the board,
// the lanes strip, a spec runner, a terminal. That is why `needs` exists: a tile declares whether
// it wants the surface's shared registry read, and a tile that wants nothing simply says so and
// brings its own data. A contract that assumed every tile is a dashboard section would have to be
// broken open the first time a terminal arrived.
//
// IT IS A PLAIN OBJECT, NOT A SIDE-EFFECT REGISTRATION. `registerTile()` called from each
// component's own file reads tidier and makes the inventory unknowable: what is on the surface
// would depend on what had been imported, which is the kind of answer you cannot grep for. One
// file, one list, and adding a tile is one entry plus its component.

/**
 * `needs` — what the surface must hand this tile.
 *
 *   "registry"  the shared read and derivation (`useDashboardData()`): rows, roots, owed, beat.
 *               The tile MUST read it from there and must not open its own.
 *   "none"      the tile fetches or owns whatever it shows. A terminal, a note pad, a chart.
 */
export const NEEDS = ["registry", "none"];

/**
 * One kind, with its variants in the order they should be offered.
 *
 * `variants` is an object so a layout can name one (`{kind:"owed", variant:"b"}`) and survive the
 * list being reordered — an index would silently repoint every saved layout the first time
 * somebody inserted a variant.
 *
 * `fallback` is the variant used when a layout names one that no longer exists. A saved layout
 * outlives the code it names, and a missing variant must degrade to a tile that still shows the
 * right KIND rather than to a hole — the hole reads as "nothing here", which is the lie this
 * surface may not tell.
 */
// THE ORDER IS THE PAGE'S OWN ORDER — head, owed, standing, reports, projects — because the
// picker is read while looking at a page, and a list in a different order makes you hunt for
// the row you are standing on. His catch: *"the header should be at the top, it should be in
// the original order. I thought I was trying to switch a header for a header."* All three
// candidates stack their sections in this order, so there is one answer and not three.
const KINDS = {
  head: {
    label: "The counts",
    hint: "what is waiting, expiring and outstanding, across everything",
    needs: "registry",
    fallback: "c",
    variants: {},
  },
  owed: {
    label: "What is owed",
    hint: "presses on one side, outstanding work on the other",
    needs: "registry",
    fallback: "c",
    variants: {},
  },
  standing: {
    label: "Where everything stands",
    hint: "every document on its lifecycle, across every project",
    needs: "registry",
    fallback: "b",
    variants: {},
  },
  reports: {
    label: "The reports",
    hint: "what is retiring, and when",
    needs: "registry",
    fallback: "b",
    variants: {},
  },
  projects: {
    label: "Per project",
    hint: "one block per project and what it holds",
    needs: "registry",
    fallback: "c",
    variants: {},
  },
};

/**
 * Add a variant of a kind. Called once per tile component, from the registry's own index — not
 * from the component's file, so the inventory stays readable in one place.
 *
 * `variant` is a stable key ("a", "b", "c", or a name); `label` is what the switch shows.
 */
export function addVariant(kind, variant, { label, Component }) {
  const k = KINDS[kind];
  if (!k) throw new Error(`no such tile kind: ${kind}`);
  if (!Component) throw new Error(`${kind}/${variant} has no component`);
  k.variants[variant] = { kind, variant, label, Component };
  return k.variants[variant];
}

/** Every kind, in offer order, with its variants — what the "add a tile" menu is built from. */
export const tileKinds = () =>
  Object.entries(KINDS).map(([kind, k]) => ({
    kind,
    label: k.label,
    hint: k.hint,
    needs: k.needs,
    variants: Object.values(k.variants),
  }));

/**
 * Resolve what a saved layout entry points at.
 *
 * Returns `{ kind, variant, label, Component, needs, substituted }`, or `null` when the KIND
 * itself is gone — which is the only case a layout cannot be honoured at all.
 *
 * `substituted` is true when the named variant was missing and the fallback stood in. The surface
 * says so on the tile rather than silently showing something he did not choose: a layout is his
 * instruction, and quietly serving a different answer to it is the same failure as a stale count.
 */
export function resolveTile(kind, variant) {
  const k = KINDS[kind];
  if (!k) return null;
  const want = k.variants[variant];
  if (want) return { ...want, needs: k.needs, kindLabel: k.label, substituted: false };
  const fell = k.variants[k.fallback] || Object.values(k.variants)[0];
  if (!fell) return null;
  return { ...fell, needs: k.needs, kindLabel: k.label, substituted: true, asked: variant };
}

/** Does this kind have more than one version — i.e. is the switch worth drawing at all. */
export const hasSiblings = (kind) => Object.keys((KINDS[kind] || { variants: {} }).variants).length > 1;

export default KINDS;
