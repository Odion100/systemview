import React, { useEffect, useRef, useState } from "react";
import { DashboardDataProvider, useDashboardData } from "./dashboardData";
import { resolveTile, tileKinds } from "./tileRegistry";
import PageLegend from "./PageLegend";
import "./tiles"; // registering the inventory is a side effect of importing it, once
import "./tileStack.scss";

// A PAGE IS A STACK, AND THE STACK IS INVISIBLE.
//
// His correction, and the whole shape of this file: *"They're supposed to just look like the
// blocks. They're supposed to configure together to look like the page exactly as the page was
// before… they're indented into the page, they're not flat with the pages, they have padding
// around them, they have border, radius. They're not components that fit together to make a
// page. They don't need a header."*
//
// So there is NO tile chrome. No frame, no gap, no card. The sections sit flush, one after
// another, and the same tiles in the same order reproduce the page they came from — which is
// exactly the test, since the page they came from is still running one tab away.
//
// THE CONTROLS LIVE IN A CORNER OF THE TILE, subtle, and only while the pointer is on it:
// *"on them themselves, somewhere in the right corner, there's going to be a subtle thing. Not
// some extra header."* Three things in that corner and no more — pick it up, change whose
// version this is, take it off.
//
// AND THE DROP IS A LINE. *"When you drag, a line would show. They'd be flush together anyway,
// and then the line would show where it is dropped — not necessarily a silhouette."* Flush
// blocks have no edges to read, so the line IS the feedback.

/**
 * THE CHOOSER — one menu, used for both adding a tile and swapping one.
 *
 * His call: *"Instead of sibling components, we could literally just take the same block we use
 * when adding a component and use that for switching which component you want. So you could
 * choose from anyone."* Two menus answering one question is two things to keep in step, and the
 * narrower one was answering the wrong question anyway: a corner that only offers SIBLINGS says
 * a tile may become another version of itself, when what he actually wants is to swap what is
 * in that slot for anything at all.
 */
const Chooser = ({ onPick, onClose, where = "" }) => (
  // NO `onMouseLeave`. The add menu never closed on leave and must not start: a menu that
  // vanishes when the pointer crosses a gap on the way to the option you want is a menu you
  // cannot use. It closes on a pick or on cancel, and on nothing else.
  <div className={`tilestack__menu ${where}`}>
    {tileKinds().map((k) => (
      <div key={k.kind} className="tilestack__kind">
        <b>{k.label}</b>
        <i>{k.hint}</i>
        <span>
          {k.variants.length ? (
            k.variants.map((v) => (
              <button key={v.variant} type="button" onClick={() => onPick({ kind: k.kind, variant: v.variant })}>
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
    <button type="button" className="tilestack__cancel" onClick={onClose}>
      cancel
    </button>
  </div>
);

/** The corner: a grip, whose version this is, and a way to take it off. */
const Corner = ({ t, open, setOpen, onRemove, onGrab, onLetGo }) => (
  <div className={`tile__corner${open ? " is-open" : ""}`}>
    {/* THE GRIP IS WHAT YOU DRAG, not the tile. A draggable block swallows text selection, and
        these blocks are made of sentences he reads. */}
    <span className="tile__grip" title="Drag to reorder" draggable onDragStart={onGrab} onDragEnd={onLetGo} aria-hidden="true">
      ⠿
    </span>
    <button
      type="button"
      // A LAYOUT OUTLIVES THE CODE IT NAMES. When the version he placed is gone the fallback
      // stood in, and the corner says so rather than quietly serving something he did not
      // choose — a substitution nobody is told about is the same failure as a stale count.
      className={`tile__which${t.substituted ? " is-swapped" : ""}`}
      title={
        t.substituted
          ? `${t.kindLabel} — ${t.asked} is gone, showing ${t.label}. Press to put something else here.`
          : `${t.kindLabel} — ${t.label}. Press to put something else here.`
      }
      aria-label={`${t.kindLabel}: ${t.label}`}
      aria-expanded={open}
      onClick={() => setOpen(!open)}
    >
      {t.variant}
      {t.substituted ? <em aria-hidden="true">!</em> : null}
    </button>
    <button type="button" className="tile__off" title={`Take ${t.kindLabel} off the page`} aria-label={`Remove ${t.kindLabel}`} onClick={onRemove}>
      ×
    </button>
  </div>
);

/** The + at the foot of the page: the same chooser, opened from a different place. */
const AddTile = ({ onAdd }) => {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button type="button" className="tilestack__add" onClick={() => setOpen(true)}>
        + add a tile
      </button>
    );
  return (
    <Chooser
      onClose={() => setOpen(false)}
      onPick={(t) => {
        setOpen(false);
        onAdd(t);
      }}
    />
  );
};

/** The filter banner — the one thing the SHELL owns rather than any head. */
const Narrowed = ({ data }) => {
  if (!data || !data.filtering) return null;
  return (
    <div className="tilestack__narrowed">
      <b>showing only {(data.segment || {}).text || "a selection"}</b>
      <span>every tile on this page is narrowed to it</span>
      <button type="button" onClick={() => data.setOnly(data.only)}>
        show everything
      </button>
    </div>
  );
};

const Stack = ({ page, onChange }) => {
  const data = useDashboardData();
  const [drag, setDrag] = useState(-1);
  // WHICH TILE HAS THE CHOOSER OPEN, by index — one at a time, and held here rather than in each
  // corner so opening one closes the last.
  const [swap, setSwap] = useState(-1);
  // WHERE THE LINE IS: the index the carried tile would land at. Null while nothing is being
  // dragged, which is also what hides the line.
  const [at, setAt] = useState(null);
  const tiles = page.tiles || [];
  const write = (next) => onChange({ ...page, tiles: next });

  const drop = (to) => {
    const from = drag;
    setDrag(-1);
    setAt(null);
    if (from < 0 || to === null) return;
    const next = tiles.slice();
    const [carried] = next.splice(from, 1);
    // Landing after its own old position shifts by one once it is lifted out.
    next.splice(to > from ? to - 1 : to, 0, carried);
    write(next);
  };

  // THE LINE IS ITS OWN ELEMENT between blocks rather than a border on one of them: a border
  // would move the block it is on by its own width, and the point of flush blocks is that
  // nothing moves until the drop.
  const line = (i) => (at === i && drag >= 0 ? <div className="tilestack__line" aria-hidden="true" /> : null);

  // CARRYING A TILE PAST THE EDGE SCROLLS THE PAGE. His catch: *"drag doesn't scroll me up the
  // page, so you can't drag something from the bottom and put it to the top."* A page of four
  // full-height sections is several screens tall, so without this the only reachable drop is one
  // already on screen — which on this surface is usually the one it is already next to.
  //
  // It runs off a timer rather than off `dragover`, because the browser stops firing dragover
  // once the pointer stops moving — and holding still at the edge is exactly the gesture.
  const scroller = useRef(null);
  const speed = useRef(0);
  useEffect(() => {
    if (drag < 0) return undefined;
    const box = scroller.current;
    if (!box) return undefined;
    const t = setInterval(() => {
      if (speed.current) box.scrollTop += speed.current;
    }, 16);
    return () => {
      clearInterval(t);
      speed.current = 0;
    };
  }, [drag]);

  // The scrollable ancestor is the switcher's body, not this element — find it once, on grab.
  const findScroller = (el) => {
    let n = el;
    while (n && n !== document.body) {
      if (n.scrollHeight > n.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(n).overflowY)) return n;
      n = n.parentElement;
    }
    return null;
  };

  const edge = (e) => {
    const box = scroller.current;
    if (!box) return;
    const b = box.getBoundingClientRect();
    const ZONE = 64; // a comfortable thumb's width of edge, not a hairline
    const MAX = 18; // px per frame at the very edge
    if (e.clientY < b.top + ZONE) speed.current = -Math.ceil(MAX * ((b.top + ZONE - e.clientY) / ZONE));
    else if (e.clientY > b.bottom - ZONE) speed.current = Math.ceil(MAX * ((e.clientY - (b.bottom - ZONE)) / ZONE));
    else speed.current = 0;
  };

  return (
    <div
      className={`tilestack${drag >= 0 ? " is-dragging" : ""}`}
      onDragOver={(e) => {
        if (drag < 0) return;
        e.preventDefault();
        edge(e);
      }}
      onDrop={() => {
        speed.current = 0;
        drop(at);
      }}
    >
      <Narrowed data={data} />
      {tiles.map((entry, i) => {
        const t = resolveTile(entry.kind, entry.variant);
        return (
          <React.Fragment key={`${entry.kind}:${entry.variant}:${i}`}>
            {line(i)}
            <div
              className={`tile${drag === i ? " is-carried" : ""}`}
              onDragOver={(e) => {
                if (drag < 0) return;
                e.preventDefault();
                const b = e.currentTarget.getBoundingClientRect();
                setAt(e.clientY < b.top + b.height / 2 ? i : i + 1);
              }}
            >
              {t ? (
                <>
                  <Corner
                    t={t}
                    open={swap === i}
                    setOpen={(on) => setSwap(on ? i : -1)}
                    onGrab={(e) => {
                      scroller.current = findScroller(e.currentTarget);
                      setDrag(i);
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/sv-tile", String(i));
                    }}
                    onLetGo={() => {
                      speed.current = 0;
                      setDrag(-1);
                      setAt(null);
                    }}
                    onRemove={() => write(tiles.filter((_, j) => j !== i))}
                  />
                  {/* RENDERED BY THE TILE, not inside the corner's little box — the corner is a
                      20px-wide absolute element and a menu anchored to it could only ever be a
                      narrow popup. His instruction: it shows the same way as the add menu, the
                      length of the page. */}
                  {swap === i ? (
                    <Chooser
                      where="tilestack__menu--over"
                      onClose={() => setSwap(-1)}
                      // SWAPPING REPLACES THE SLOT, not just the variant — the chooser offers
                      // every kind, so what comes back may be a different thing entirely.
                      onPick={(next) => {
                        setSwap(-1);
                        write(tiles.map((x, j) => (j === i ? next : x)));
                      }}
                    />
                  ) : null}
                  <t.Component data={data} />
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
          </React.Fragment>
        );
      })}
      {line(tiles.length)}
      {!tiles.length ? <p className="tilestack__none">Nothing on this page yet.</p> : null}
      <AddTile onAdd={(t) => write([...tiles, t])} />
      {/* THE PAGE'S OWN FLOOR, on every page including an empty one. */}
      <PageLegend />
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
