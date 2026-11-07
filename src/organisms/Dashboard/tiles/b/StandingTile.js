import React, { useState } from "react";
import Bead from "./Bead";
import { docKey } from "../../../AgentChat/owed";
import { KINDS } from "../../../DashboardB/dashboardB.data";
import { Ctx, HUES, Reading, floorOf, openBead, stationWord, trackForArc } from "./floor";

// ─── WHERE EVERYTHING IS STANDING ──────────────────────────────────────────────────────────────
//
// THE SECTION HE NAMED AS THE ONE HE LIKES — same markup per track, and two deliberate moves on
// top of it, both his (2026-11-06):
//
//   THE ORDER: arcs on top, then RFCs — *"they're a pair"* — then gaps. The data module still
//   hands tracks in its own order; the pairing is this section's reading of them.
//
//   THE ARC IS A FILTER: *"you should be able to click on arcs and it should filter all the RFCs
//   for that arc."* An arc bead's body publishes `arc` to the stack — everything BELOW this tile
//   narrows — and the RFC track right here narrows with it, because the RFCs are the pair he
//   named and they are standing directly under the arc he pressed.
//
// A DOCUMENT IS NOT A ROW, IT IS A THING STANDING SOMEWHERE. Eleven RFCs parked at `draft` and
// eleven parked at `built` are the same number and completely different situations: one means
// nothing is getting decided, the other means nothing is getting finished. A table shows one
// figure for both. So this is three TRACKS — the lifecycle trails themselves — with every document
// a bead at its own station, carrying a ring of its own progress and the mark of what it wants.
//
// THE EMPTY STATION IS THE WHOLE VALUE OF THE PICTURE: the distance between a crowded `draft` and
// an empty `settled` is the sentence "nothing is finishing", and no count says it.

// Arcs, then RFCs (they're a pair), then gaps — his order, stated as data.
const TRACK_ORDER = ["arc", "rfc", "gap"];

export default function StandingTile({ data, filter }) {
  const [openTrack, setOpenTrack] = useState("");
  const floor = floorOf(data);
  if (!floor) return <Reading />;
  const { beads } = floor;
  const open = (bead) => openBead(bead, data && data.open);
  // THE HELD ARC — this tile's own selection, a docKey so two projects' ARC-001s stay two arcs.
  const heldArc = (filter && (filter.mine || {}).arc) || "";
  const heldArcId = heldArc ? heldArc.split("\u0000")[1] || "" : "";
  const pickArc = filter ? (b) => filter.set("arc", docKey(b)) : null;
  const tracks = TRACK_ORDER.map((k) => floor.tracks.find((t) => t.kind === k))
    .filter(Boolean)
    .map((t) => trackForArc(t, heldArcId));
  return (
    <Ctx>
      <section className="dbb-flow">
        <div className="dbb-flow__head">
          <h2>where everything is standing</h2>
          <span>each kind on its own trail · a ring is that document's own progress · ⚑ a decision of yours · ⧗ a clock</span>
        </div>
        {tracks.map((t) => {
          const k = KINDS.find((x) => x.kind === t.kind);
          const alone = openTrack && openTrack !== t.kind;
          return (
            <div key={t.kind} className={`dbb-track dbb-track--${t.kind}${alone ? " is-dimmed" : ""}`} style={{ "--hue": HUES[t.kind] }}>
              <button
                type="button"
                className="dbb-track__name"
                onClick={() => setOpenTrack(openTrack === t.kind ? "" : t.kind)}
                title={k.blurb}
              >
                <i />
                <b>{k.label}</b>
                <span>{t.total}</span>
              </button>
              <div className="dbb-track__rail">
                {t.stations.map((s) => (
                  <div key={s.station} className={`dbb-station${s.beads.length ? "" : " is-empty"}`}>
                    <div className="dbb-station__cap">
                      <span className="dbb-station__word">{stationWord(s.station)}</span>
                      <span className="dbb-station__n">{s.beads.length}</span>
                    </div>
                    <div className="dbb-station__beads">
                      {s.beads.map((b) => (
                        <Bead
                          key={b.key}
                          bead={b}
                          onOpen={open}
                          // AN ARC BEAD IS THE FILTER — press it and the RFCs for that arc are
                          // what is left, here and below. Other kinds' beads publish nothing.
                          onPick={t.kind === "arc" && pickArc ? pickArc : undefined}
                          picked={t.kind === "arc" && !!heldArc && heldArc === docKey(b)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {!beads.length ? (
          <p className="dbb-flow__none">
            no documents are registered anywhere — which is not the same as nothing happening. A document is real
            when it carries a registration leaf and the shell has parsed it; until then nothing in this window can
            see it, including this page.
          </p>
        ) : null}
      </section>
    </Ctx>
  );
}
