import React, { useState } from "react";
import Bead from "./Bead";
import { KINDS } from "../../../DashboardB/dashboardB.data";
import { Ctx, HUES, Reading, floorOf, openBead, stationWord } from "./floor";

// ─── WHERE EVERYTHING IS STANDING ──────────────────────────────────────────────────────────────
//
// THE SECTION HE NAMED AS THE ONE HE LIKES, so nothing about it moved: same markup, same classes,
// same order, same words.
//
// A DOCUMENT IS NOT A ROW, IT IS A THING STANDING SOMEWHERE. Eleven RFCs parked at `draft` and
// eleven parked at `built` are the same number and completely different situations: one means
// nothing is getting decided, the other means nothing is getting finished. A table shows one
// figure for both. So this is three TRACKS — the lifecycle trails themselves — with every document
// a bead at its own station, carrying a ring of its own progress and the mark of what it wants.
//
// THE EMPTY STATION IS THE WHOLE VALUE OF THE PICTURE: the distance between a crowded `draft` and
// an empty `settled` is the sentence "nothing is finishing", and no count says it.
export default function StandingTile({ data }) {
  const [openTrack, setOpenTrack] = useState("");
  const floor = floorOf(data);
  if (!floor) return <Reading />;
  const { tracks, beads } = floor;
  const open = (bead) => openBead(bead, data && data.open);
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
                        <Bead key={b.key} bead={b} onOpen={open} />
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
