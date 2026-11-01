import HeadTileA from "./HeadTile";
import OwedTileA from "./OwedTile";
import StandingTileA from "./StandingTile";

// ─── A'S TILES ─────────────────────────────────────────────────────────────────────────────────
//
// THE INVENTORY, IN ONE PLACE. `tileRegistry.js` is a plain object for a stated reason — *"what is
// on the surface would depend on what had been imported, which is the kind of answer you cannot
// grep for"* — so this file DECLARES what A has and registers nothing. The surface's own index
// calls `addVariant` over this list.
//
// WHAT A HAS, AND WHAT IT DOES NOT:
//
//   head      `.dba__top` — the gauge's segments, the reading line, and the fixtures switch, which
//             are one CSS grid and cannot be taken apart.
//   owed      `.dba__owed` — press and outstanding, two halves of one auto-fit grid.
//   standing  `.dba__flow` — the axis and every project lane, which share one grid and cannot be
//             split without the columns drifting out of line. Filed under `standing` rather than
//             `projects` because what it draws is every document on its lifecycle across every
//             project, which is `standing`'s own description.
//   projects  NOT HERE. A's lanes exist, but only under the axis that labels their columns.
//   reports   NOT HERE. A has no reports section — the stack lives inside each lane, as the
//             countdown at the end of that project's track, and a standalone one would be a
//             second answer about what is retiring.
export const TILES = [
  { kind: "head", variant: "a", label: "A — the masthead gauge", Component: HeadTileA },
  { kind: "owed", variant: "a", label: "A — press and outstanding", Component: OwedTileA },
  { kind: "standing", variant: "a", label: "A — one track per project", Component: StandingTileA },
];

export { HeadTileA, OwedTileA, StandingTileA };
export { DashboardAFold, useFold } from "./fold";
export default TILES;
