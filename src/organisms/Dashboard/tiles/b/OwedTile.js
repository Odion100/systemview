import React, { useMemo, useState } from "react";
import { groupOwed } from "../../../AgentChat/owed";
import { emptyWords } from "../../../DashboardB/dashboardB.data";
import { Ctx, HUES, Reading, floorOf, openBead } from "./floor";

// ─── WHAT NEEDS YOU ────────────────────────────────────────────────────────────────────────────
//
// The split is `owed.js`'s and the words are its words. PRESS means your signature finishes it;
// OUTSTANDING means nobody can press it away. Two unlike things, said as two, because that is the
// shape of the question he asked.
//
// ONE ROW PER DOCUMENT, never one per block — `groupOwed` is what does that, and it is the whole
// reason this list is readable: an arc with four obligations was four rows, so a list of nine read
// as nine places to go when it was four. The row carries the strongest one and the fold carries
// the rest, each opening at its own block.
//
// AND THE ARROW IS THE ONLY THING THAT TRAVELS — his ruling, 2026-11-06: *"Nothing should actually
// be clicked to travel, except an explicit symbol, like an arrow."* The row's own body folds (when
// there is something to fold) or reads; the arrow is a SIBLING of it, never a child, because a
// button inside a button is not markup. Same split the bead beside it already uses.
const Go = ({ label, onGo }) => (
  <button
    type="button"
    className="dbb-owed__go"
    title={`open ${label}`}
    aria-label={`open ${label}`}
    onClick={(e) => {
      e.stopPropagation();
      onGo();
    }}
  >
    →
  </button>
);

export default function OwedTile({ data }) {
  // WHICH DOCUMENTS ARE FANNED OPEN. Keyed by `groupOwed`'s key, which carries the project — so
  // opening alpha's RFC-001 does not open beta's.
  const [fold, setFold] = useState({});
  const floor = floorOf(data);

  // An owed row is about a DOCUMENT, so it opens through the same bead the tracks open — one door,
  // one line, one place that decides where a click lands.
  const byId = useMemo(() => {
    const m = {};
    (floor ? floor.beads : []).forEach((b) => (m[`${b.project}:${b.id}`] = b));
    return m;
  }, [floor]);

  if (!floor) return <Reading />;
  const { owed, measured } = floor;
  const open = data && data.open;
  const openOwed = (o) =>
    openBead(byId[`${o.project}:${o.id}`] ? { ...byId[`${o.project}:${o.id}`], line: o.line } : { project: o.project, path: o.path, line: o.line }, open);

  return (
    <Ctx>
      <section className="dbb-needs">
        {[
          { key: "press", title: "waiting on your press", sub: "your signature finishes it", rows: groupOwed(owed.press) },
          { key: "work", title: "outstanding", sub: "nobody can press these away", rows: groupOwed(owed.work) },
        ].map((col) => (
          <div key={col.key} className={`dbb-col dbb-col--${col.key}`}>
            <div className="dbb-col__head">
              <h2>{col.title}</h2>
              <span>{col.sub}</span>
            </div>
            {col.rows.length ? (
              <ul className="dbb-owed">
                {col.rows.map((o) => {
                  const face = (
                    <>
                      <i className="dbb-owed__dot" />
                      <span className="dbb-owed__id">{o.id}</span>
                      <span className="dbb-owed__says">{o.says}</span>
                      <span className="dbb-owed__tail">{o.n > 1 ? `+${o.n - 1} more` : o.tail}</span>
                      <span className="dbb-owed__proj">{o.project}</span>
                    </>
                  );
                  return (
                    <li key={o.key}>
                      <div className="dbb-owed__line">
                        {/* A ROW WITH ONE OBLIGATION HAS NOTHING TO FOLD, so its body is reading and
                            the arrow is the whole gesture — a button that only travelled was the
                            thing his ruling took out. */}
                        {o.n > 1 ? (
                          <button
                            type="button"
                            className="dbb-owed__row"
                            style={{ "--hue": HUES[o.kind] }}
                            aria-expanded={!!fold[o.key]}
                            onClick={() => setFold((f) => ({ ...f, [o.key]: !f[o.key] }))}
                          >
                            {face}
                          </button>
                        ) : (
                          <span className="dbb-owed__row" style={{ "--hue": HUES[o.kind] }}>
                            {face}
                          </span>
                        )}
                        <Go label={o.id} onGo={() => openOwed(o)} />
                      </div>
                      {o.n > 1 && fold[o.key] ? (
                        <ul className="dbb-owed__sub">
                          {o.items.map((x) => (
                            <li key={x.key}>
                              <div className="dbb-owed__line">
                                <span className="dbb-owed__subrow">
                                  <span className="dbb-owed__says">{x.says}</span>
                                  <span className="dbb-owed__tail">{x.tail}</span>
                                </span>
                                <Go label={`${o.id} · ${x.says}`} onGo={() => openOwed(x)} />
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : (
              // THREE NOTHINGS WEAR ONE BLANK SPACE and the column may never blur them: nothing
              // owed, nothing registered, nothing readable. `emptyWords` is the one place that
              // decides which, so the head and the columns cannot drift apart.
              <p className="dbb-col__none">{emptyWords(measured, "nothing", true)}</p>
            )}
          </div>
        ))}
      </section>
    </Ctx>
  );
}
