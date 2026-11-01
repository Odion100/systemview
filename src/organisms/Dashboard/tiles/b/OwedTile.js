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
                {col.rows.map((o) => (
                  <li key={o.key}>
                    <button
                      type="button"
                      className="dbb-owed__row"
                      style={{ "--hue": HUES[o.kind] }}
                      aria-expanded={o.n > 1 ? !!fold[o.key] : undefined}
                      onClick={() => (o.n > 1 ? setFold((f) => ({ ...f, [o.key]: !f[o.key] })) : openOwed(o))}
                    >
                      <i className="dbb-owed__dot" />
                      <span className="dbb-owed__id">{o.id}</span>
                      <span className="dbb-owed__says">{o.says}</span>
                      <span className="dbb-owed__tail">{o.n > 1 ? `+${o.n - 1} more` : o.tail}</span>
                      <span className="dbb-owed__proj">{o.project}</span>
                    </button>
                    {o.n > 1 && fold[o.key] ? (
                      <ul className="dbb-owed__sub">
                        {o.items.map((x) => (
                          <li key={x.key}>
                            <button type="button" className="dbb-owed__subrow" onClick={() => openOwed(x)}>
                              <span className="dbb-owed__says">{x.says}</span>
                              <span className="dbb-owed__tail">{x.tail}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
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
