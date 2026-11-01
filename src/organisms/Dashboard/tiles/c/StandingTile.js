import React from "react";
import { KIND_PLURAL } from "../../../DashboardC/dashboardC.data";
import { Ctx, open, useShelves, useTracks } from "./surface";

// ═══ WHERE EVERYTHING STANDS ═══════════════════════════════════════════════════════════════════
//
// WHERE THE MASS SITS: four tracks, one per kind, each one that kind's own lifecycle trail, with
// every document in every project as a dot at its station. Nothing to read — a pile at `draft` is
// a planning backlog, a pile at `built` is proof debt, a pile at `approved` on arcs is work nobody
// has planned. It is a picture rather than a number because the question is about SHAPE.
//
// THE SECTION HAS TO EXPLAIN ITSELF, and that is not decoration — it is the correction he gave it:
// *"I can't read the current… just make this section make sense, I don't understand what it
// means."* A field of coloured dots under a metaphor is readable only to whoever drew it. So the
// heading is in plain words, the key says what a dot IS before any are shown, and every station
// carries its count including the zeroes. None of that is to be re-interpreted.

/** ONE TRACK — a kind's trail, every document a dot at its station, all projects at once. */
const Track = ({ track }) => (
  <div className={`dbc-track dbc-track--${track.kind}`}>
    <div className="dbc-track__name">
      {KIND_PLURAL[track.kind]} <b>{track.total}</b>
      {track.unparsed ? <i> · {track.unparsed} the registry has no state for</i> : null}
    </div>
    <div className="dbc-track__rail">
      {track.stations.map((s) => (
        <div key={s.station} className={`dbc-stn${s.cards.length ? " has-mass" : ""}`}>
          <div className="dbc-stn__dots">
            {s.cards.slice(0, 18).map((c) => (
              <button
                type="button"
                key={c.key}
                className={`dbc-dot${c.press ? " is-press" : ""}${c.meter && c.meter.urgent ? " is-urgent" : ""}${
                  c.work ? " is-work" : ""
                }`}
                title={`${c.project ? `${c.project} · ` : ""}${c.id} — ${c.title || c.path}${c.line ? ` · ${c.line}` : ""}`}
                onClick={() => open(c)}
              />
            ))}
            {s.cards.length > 18 ? <span className="dbc-stn__more">+{s.cards.length - 18}</span> : null}
          </div>
          {/* THE TICK IS ITS OWN ELEMENT, not a pseudo on the station. As a `::after` it was
              positioned against the station box and landed in the middle of the station's own
              NAME — a dot sitting on the word "draft", which is what made the row unreadable. */}
          <span className="dbc-stn__tick" aria-hidden="true" />
          <div className="dbc-stn__foot">
            <span className="dbc-stn__name">{s.station}</span>
            {/* ZERO IS SAID OUT LOUD. A blank under a station could mean none, or could mean
                nobody measured it, and those are not the same answer. */}
            <b className="dbc-stn__n">{s.cards.length}</b>
          </div>
        </div>
      ))}
    </div>
  </div>
);

export default function StandingTileC({ data }) {
  const d = useShelves(data);
  const tracks = useTracks(d);
  if (!tracks.length) return null;
  return (
    <Ctx>
      <section className="dbc-current">
        {/* THE HEADING SAYS WHAT YOU ARE LOOKING AT, in words nobody has to be taught. "The
            current" was a metaphor about where the mass flows, and it cost him the section:
            *"I can't read the current… just make this section make sense, I don't understand
            what it means."* A title you have to decode is a title that fails the one reader. */}
        <h2>
          Where everything stands{" "}
          <i>every document in every project, parked at the step its lifecycle says it reached</i>
        </h2>
        {/* THE KEY IS PART OF THE SECTION, NOT A FOOTNOTE. A field of coloured dots means
            nothing until something says a dot is a document; it was readable only to whoever
            wrote it. */}
        <p className="dbc-current__key">
          <span>each dot is one document — press it to open · they travel left to right</span>
          <span className="dbc-key">
            <i className="dbc-dot is-press" /> waiting on your press
          </span>
          <span className="dbc-key">
            <i className="dbc-dot is-work" /> outstanding
          </span>
          <span className="dbc-key">
            <i className="dbc-dot" /> nothing owed
          </span>
        </p>
        {tracks.map((t) => (
          <Track key={t.kind} track={t} />
        ))}
      </section>
    </Ctx>
  );
}
