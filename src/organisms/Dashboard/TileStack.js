import React, { useState } from "react";
import { DashboardDataProvider, useDashboardData } from "./dashboardData";
import { resolveTile, tileKinds, hasSiblings } from "./tileRegistry";
import "./tiles"; // registering the inventory is a side effect of importing it, once
import "./tileStack.scss";

// A PAGE IS A STACK — his ruling, emphatically: *"It's a fucking stack."* A vertical column of
// full-width tiles you reorder by dragging. No grid, no per-tile width, no resize handles.
//
// THE CONTROLS LIVE ON THE TILE, not in a mode. A tile's bar carries what it is, whose version
// of it, and a way to take it off; dragging is the tile itself. An edit mode would mean the
// surface has two states and the one you are in decides whether a press moves something — which
// is the sort of thing you discover by moving something you meant to read.

/** The bar on top of a tile: what it is, whose version, and the two controls. */
const TileBar = ({ t, onVariant, onRemove }) => {
  const [open, setOpen] = useState(false);
  const siblings = hasSiblings(t.kind);
  return (
    <div className="tile__bar">
      <b className="tile__kind">{t.kindLabel}</b>
      {siblings ? (
        <span className="tile__variant">
          <button type="button" className="tile__variant-face" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            {t.label} <i aria-hidden="true">⌄</i>
          </button>
          {open ? (
            <span className="tile__variant-pop" onMouseLeave={() => setOpen(false)}>
              {(tileKinds().find((k) => k.kind === t.kind) || { variants: [] }).variants.map((v) => (
                <button
                  key={v.variant}
                  type="button"
                  className={`tile__variant-pick${v.variant === t.variant ? " is-on" : ""}`}
                  onClick={() => {
                    setOpen(false);
                    onVariant(v.variant);
                  }}
                >
                  {v.label}
                </button>
              ))}
            </span>
          ) : null}
        </span>
      ) : (
        // A SWITCH OVER ONE OPTION IS FURNITURE. It says what it is and stops.
        <span className="tile__variant tile__variant--only">{t.label}</span>
      )}
      {/* A LAYOUT NAMING A VARIANT THAT IS GONE FELL BACK, and it says so rather than quietly
          serving something he did not choose. */}
      {t.substituted ? <em className="tile__swapped">{t.asked} is gone — showing {t.label}</em> : null}
      <button type="button" className="tile__drop" title="Take this tile off the page" aria-label={`Remove ${t.kindLabel}`} onClick={onRemove}>
        ×
      </button>
    </div>
  );
};

/** The menu of what can go on a page — every kind, every version of it. */
const AddTile = ({ onAdd }) => {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button type="button" className="tilestack__add" onClick={() => setOpen(true)}>
        + add a tile
      </button>
    );
  return (
    <div className="tilestack__menu">
      {tileKinds().map((k) => (
        <div key={k.kind} className="tilestack__kind">
          <b>{k.label}</b>
          <i>{k.hint}</i>
          <span>
            {k.variants.length ? (
              k.variants.map((v) => (
                <button
                  key={v.variant}
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onAdd({ kind: k.kind, variant: v.variant });
                  }}
                >
                  {v.label}
                </button>
              ))
            ) : (
              // A KIND WITH NOTHING BUILT IS STILL LISTED. Hiding it is how a tile nobody built
              // becomes a tile nobody remembers was planned.
              <em>nothing built yet</em>
            )}
          </span>
        </div>
      ))}
      <button type="button" className="tilestack__cancel" onClick={() => setOpen(false)}>
        cancel
      </button>
    </div>
  );
};

/** The filter banner — the one thing the SHELL owns rather than any head. */
const Narrowed = ({ data }) => {
  if (!data || !data.filtering) return null;
  return (
    <div className="tilestack__narrowed">
      <b>showing only {(data.segment || {}).text || "a selection"}</b>
      <span>every tile on this surface is narrowed to it</span>
      <button type="button" onClick={() => data.setOnly(data.only)}>
        show everything
      </button>
    </div>
  );
};

const Stack = ({ page, onChange }) => {
  const data = useDashboardData();
  const [drag, setDrag] = useState(-1);
  const tiles = page.tiles || [];
  const write = (next) => onChange({ ...page, tiles: next });

  const move = (from, to) => {
    if (from === to || from < 0 || to < 0) return;
    const next = tiles.slice();
    const [carried] = next.splice(from, 1);
    next.splice(to, 0, carried);
    write(next);
  };

  return (
    <div className="tilestack">
      <Narrowed data={data} />
      {tiles.map((entry, i) => {
        const t = resolveTile(entry.kind, entry.variant);
        return (
          <div
            key={`${entry.kind}:${i}`}
            className={`tile${drag === i ? " is-dragging" : ""}`}
            draggable
            onDragStart={(e) => {
              setDrag(i);
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/sv-tile", String(i));
            }}
            onDragEnd={() => setDrag(-1)}
            onDragOver={(e) => {
              if (e.dataTransfer.types.includes("text/sv-tile")) e.preventDefault();
            }}
            onDrop={(e) => {
              const from = Number(e.dataTransfer.getData("text/sv-tile"));
              if (Number.isNaN(from)) return;
              e.preventDefault();
              move(from, i);
            }}
          >
            {t ? (
              <>
                <TileBar
                  t={t}
                  onVariant={(variant) => write(tiles.map((x, j) => (j === i ? { ...x, variant } : x)))}
                  onRemove={() => write(tiles.filter((_, j) => j !== i))}
                />
                <div className="tile__body">
                  <t.Component data={data} />
                </div>
              </>
            ) : (
              // THE KIND ITSELF IS GONE — the only case a layout cannot be honoured at all. It
              // says which tile it was rather than leaving a hole, because a hole reads as
              // "nothing here" and there was something here.
              <div className="tile__missing">
                <b>{entry.kind}</b>
                <span>this kind of tile no longer exists — take it off, or put it back in the registry</span>
                <button type="button" onClick={() => write(tiles.filter((_, j) => j !== i))}>
                  remove
                </button>
              </div>
            )}
          </div>
        );
      })}
      {!tiles.length ? <p className="tilestack__none">Nothing on this page yet.</p> : null}
      <AddTile onAdd={(t) => write([...tiles, t])} />
    </div>
  );
};

/**
 * A page of tiles, with the surface's one read around it.
 *
 * The provider is HERE rather than around the whole switcher on purpose: a candidate page runs
 * its own read (it is the original, untouched), so mounting the shared one alongside it would
 * poll the hub twice to draw one page.
 */
export default function TileStack({ page, onChange }) {
  return (
    <DashboardDataProvider>
      <Stack page={page} onChange={onChange} />
    </DashboardDataProvider>
  );
}
