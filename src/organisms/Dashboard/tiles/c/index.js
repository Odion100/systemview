import HeadTileC from "./HeadTile";
import OwedTileC from "./OwedTile";
import StandingTileC from "./StandingTile";
import ProjectsTileC from "./ProjectsTile";

// THE SHELVES' TILES — C's four sections, in the order the page stacks them.
//
// One entry per variant, and nothing here registers itself: the registry is a plain list in
// `tileRegistry.js` and this is the inventory it reads, so what C offers is greppable in one
// place rather than depending on what happened to be imported.
//
// THE LABEL IS THE PAGE'S NAME, not the section's. A variant switch is asking *whose version of
// this*, and the kind's own label ("What is owed") is already on the tile — "The shelves" is the
// answer to the question the switch is actually asking.
export const TILES = [
  { kind: "head", variant: "c", label: "The shelves", Component: HeadTileC },
  { kind: "owed", variant: "c", label: "The shelves", Component: OwedTileC },
  { kind: "standing", variant: "c", label: "The shelves", Component: StandingTileC },
  { kind: "projects", variant: "c", label: "The shelves", Component: ProjectsTileC },
];

export { HeadTileC, OwedTileC, StandingTileC, ProjectsTileC };
export default TILES;
