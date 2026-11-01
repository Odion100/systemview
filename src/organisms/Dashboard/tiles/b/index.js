import HeadTile from "./HeadTile";
import OwedTile from "./OwedTile";
import StandingTile from "./StandingTile";
import ReportsTile from "./ReportsTile";
import ProjectsTile from "./ProjectsTile";

// ─── B'S TILES ─────────────────────────────────────────────────────────────────────────────────
//
// The floor, taken apart along the lines it was already drawn on. Each section of
// `DashboardB.js` is now a component that takes ONE prop — `{ data }`, the surface's single
// registry read — and the page is composed from them rather than containing them.
//
// WHAT THE TILES GIVE UP: the read. None of these opens `documentsRegistry`, none runs an
// interval, none calls `hostFiles`. Three tiles on one surface each polling on their own
// 30-second timer would drift, and a head saying "4 approvals waiting" over a list showing three
// is worse than no surface at all.
//
// WHAT THEY KEEP: B's point of view. `floorFrom` still runs over `data.docs` and `data.roots` —
// that is the derivation this dashboard IS, and it is shared between the five so the whole
// surface answers from one pass and one `now` (see `floor.js`).
//
// THE LIST IS HERE AND NOT IN EACH COMPONENT'S FILE, for the reason `tileRegistry.js` gives: a
// `registerTile()` call at the bottom of each file reads tidier and makes the inventory depend on
// what happened to be imported, which is the kind of answer you cannot grep for.
export const TILES = [
  { kind: "head", variant: "b", label: "B · the tide", Component: HeadTile },
  { kind: "owed", variant: "b", label: "B · two columns", Component: OwedTile },
  // The one he named as the version he likes.
  { kind: "standing", variant: "b", label: "B · the tracks", Component: StandingTile },
  // B is the only dashboard that stands the reports up on their own, so this kind has no sibling.
  { kind: "reports", variant: "b", label: "B · the stacks", Component: ReportsTile },
  { kind: "projects", variant: "b", label: "B · the cards", Component: ProjectsTile },
];

export { HeadTile, OwedTile, StandingTile, ReportsTile, ProjectsTile };
export default TILES;
