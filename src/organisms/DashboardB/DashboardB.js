import React, { useContext } from "react";
import "./styles.scss";
import ServiceContext from "../../ServiceContext";
import { DashboardDataProvider, useDashboardData } from "../Dashboard/dashboardData";
import { EVERY } from "../Dashboard/tiles/b/floor";
import { HeadTile, OwedTile, ProjectsTile, ReportsTile, StandingTile } from "../Dashboard/tiles/b";

// ─── THE FLOOR ─────────────────────────────────────────────────────────────────────────────────
//
// ONE PLACE FOR EVERY KIND OF THING AND ITS PROGRESS, ACROSS EVERY PROJECT. His ask, verbatim:
// *"the dashboard is about all the different kind of things, you know, arcs or RFCs, in their
// progress, and reports"* and *"to be able to see all the stuff that's waiting, all the projects
// going on at the same time."*
//
// THE POINT OF VIEW, committed to rather than hedged:
//
//   A DOCUMENT IS NOT A ROW, IT IS A THING STANDING SOMEWHERE. Every kind already has a lifecycle
//   trail, and the useful picture of a hundred documents is not their count — it is WHERE THEY ARE
//   STANDING. Eleven RFCs parked at `draft` and eleven parked at `built` are the same number and
//   completely different situations: one means nothing is getting decided, the other means nothing
//   is getting finished. A table shows one figure for both. So the middle of this page is three
//   TRACKS — the trails themselves — with every document a bead at its own station, carrying a
//   ring of its own progress and the mark of whatever it wants from him.
//
//   REPORTS ARE NOT ON A TRACK, BECAUSE REPORTS DO NOT PROGRESS — THEY AGE. Their trail is
//   `filed → retired` and the second station is their death. They arrive in a pile and the pile
//   drains, which is exactly the one visual he described: *"reports looking like a stack with
//   numbers, and then you click them and they expand out horizontally."* One stack per project,
//   because the other half of the ask is every project at once.
//
//   THE TOP IS ABOUT HIM, NOT ABOUT INVENTORY. The first thing on the page is what needs him,
//   split the way `owed.js` splits it — PRESS (your signature finishes it) and OUTSTANDING (nobody
//   can press it away) — because that is the question every pixel here is answering.
//
// THREE RULES IT IS BUILT TO:
//   1. IT DERIVES NOTHING NEW. Every number comes from the module that owns it, through
//      `dashboardB.data.js`. A second answer to "how far along is this arc" is how a surface starts
//      disagreeing with the drawer.
//   2. IT PRESSES NOTHING. Every bead, row and card OPENS ITS DOCUMENT, because that is where the
//      control lives — the facilitation ladder for an approval, the clock's keep-or-let-go on a
//      report's leaf. A list that signs for you is a list that decides for you.
//   3. IT NEVER CALLS AN UNMEASURED NOTHING A NOTHING. A zero over documents nobody could read is
//      not a zero, and the head says which it is.
//
// ─── AND NOW IT IS COMPOSED, NOT CONTAINED ─────────────────────────────────────────────────────
//
// This file used to be the page AND all five of its sections AND its own hub read. The sections
// are tiles now, in `../Dashboard/tiles/b`, each taking the surface's one read as a single prop —
// so the same five can stand on a configurable surface in any arrangement, beside another
// dashboard's version of the same kind. What is left here is the page: the provider, the box, and
// the order the five stand in.
//
// THE READ MOVED UP AND DID NOT MULTIPLY. `DashboardDataProvider` opens it once; no tile polls.
// Five tiles each on their own 30-second timer would drift apart within the minute, and a head
// saying "4 approvals waiting" over a list showing three is worse than no page at all.
export default function DashboardB() {
  return (
    <DashboardDataProvider every={EVERY}>
      <Floor />
    </DashboardDataProvider>
  );
}

function Floor() {
  const { SystemViewService } = useContext(ServiceContext);
  const data = useDashboardData() || {};
  // A HUB WITH NO REGISTRY DOOR AND A FIRST TICK LOOK THE SAME FROM THE READ — both are "nothing
  // has landed" — and they must not look the same on the page: one is a wait and the other is a
  // wall. The door is a property of the service, so it is asked of the service directly rather
  // than inferred from a silence.
  const noDoor = !(SystemViewService && SystemViewService.Agent && SystemViewService.Agent.documentsRegistry);

  // NOTHING HAS LANDED YET. An error is NOT this case — a read that failed still draws the page,
  // with its trouble said out loud in the head, because the empty floor underneath is then an
  // honest unmeasured nothing rather than a blank wait.
  if (!data.read && !data.error)
    return (
      <div className="dbb">
        <div className={`dbb-empty${noDoor ? " is-bad" : ""}`}>
          {noDoor ? "this hub has no document registry door — nothing here can be read" : "reading the registry…"}
        </div>
      </div>
    );

  return (
    <div className="dbb">
      <HeadTile data={data} />
      <OwedTile data={data} />
      <StandingTile data={data} />
      <ReportsTile data={data} />
      <ProjectsTile data={data} />
    </div>
  );
}
