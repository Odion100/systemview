import React, { useEffect, useMemo, useRef, useState } from "react";
import { DashboardDataProvider, useDashboardData } from "./dashboardData";
import { mergeAbove, filterKey, narrowData } from "./filters";
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
const Chooser = ({ onPick, onClose, where = "", current = null, dismissable = false }) => {
  // CLICKING OFF A FLOATING MENU CLOSES IT. Only the floating one: the menu at the foot sits in
  // the flow and is dismissed by cancel, the way it always was. `mousedown` rather than `click`
  // so it closes before whatever you were reaching for fires.
  const box = useRef(null);
  useEffect(() => {
    if (!dismissable) return undefined;
    const off = (e) => {
      if (box.current && !box.current.contains(e.target)) onClose();
    };
    const esc = (e) => e.key === "Escape" && onClose();
    document.addEventListener("mousedown", off, true);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", off, true);
      document.removeEventListener("keydown", esc);
    };
  }, [dismissable, onClose]);

  return (
    // NO `onMouseLeave`. The add menu never closed on leave and must not start: a menu that
    // vanishes when the pointer crosses a gap on the way to the option you want is a menu you
    // cannot use. It closes on a pick, on cancel, and — when it floats — on a click outside.
    <div className={`tilestack__menu ${where}`} ref={box}>
      {tileKinds().map((k) => (
        <div key={k.kind} className={`tilestack__kind${current && current.kind === k.kind ? " is-here" : ""}`}>
          <b>{k.label}</b>
          <i>{k.hint}</i>
          <span>
            {k.variants.length ? (
              k.variants.map((v) => {
                // WHICH ONE YOU ARE ON. Opening a picker over a tile without saying what is
                // already in that slot makes you guess, and the first guess is usually the row
                // you were already looking at.
                const here = current && current.kind === k.kind && current.variant === v.variant;
                return (
                  <button
                    key={v.variant}
                    type="button"
                    className={here ? "is-here" : undefined}
                    aria-current={here ? "true" : undefined}
                    onClick={() => onPick({ kind: k.kind, variant: v.variant })}
                  >
                    {v.label}
                  </button>
                );
              })
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
};

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

const Stack = ({ page, onChange }) => {
  const data = useDashboardData();
  const [drag, setDrag] = useState(-1);
  // WHICH TILE HAS THE CHOOSER OPEN, by index — one at a time, and held here rather than in each
  // corner so opening one closes the last.
  const [swap, setSwap] = useState(-1);
  // WHERE THE LINE IS: the index the carried tile would land at. Null while nothing is being
  // dragged, which is also what hides the line.
  const [at, setAt] = useState(null);
  // Memoised because `seen` below keys on it — `page.tiles || []` fresh each render would make
  // the per-tile narrowing recompute on every render for a page with no tiles yet.
  const tiles = useMemo(() => page.tiles || [], [page.tiles]);
  const write = (next) => onChange({ ...page, tiles: next });

  // WHAT EACH TILE HOLDS — index-aligned with the tiles, because the ruling is POSITIONAL: *"They
  // should be filtering everything below them."* A selection is `{ dimension: value }` or null,
  // and it travels WITH its tile through a drag (it is the tile's selection, not the slot's),
  // leaves with a removed tile, and clears when the slot is swapped for something else — a
  // selection the new tile never made must not keep narrowing the page under it.
  const [held, setHeld] = useState([]);
  const holdAt = (i, dim, val) =>
    setHeld((h) => {
      const next = h.slice();
      const mine = { ...(next[i] || {}) };
      // PRESSING THE HELD THING AGAIN LETS GO. A filter you cannot get out of is a trap.
      if (mine[dim] === val || val === null) delete mine[dim];
      else mine[dim] = val;
      next[i] = Object.keys(mine).length ? mine : null;
      return next;
    });
  const moveHeld = (from, to) =>
    setHeld((h) => {
      const next = h.slice();
      while (next.length < tiles.length) next.push(null);
      const [carried] = next.splice(from, 1);
      next.splice(to > from ? to - 1 : to, 0, carried);
      return next;
    });

  const drop = (to) => {
    const from = drag;
    setDrag(-1);
    setAt(null);
    if (from < 0 || to === null) return;
    const next = tiles.slice();
    const [carried] = next.splice(from, 1);
    // Landing after its own old position shifts by one once it is lifted out.
    next.splice(to > from ? to - 1 : to, 0, carried);
    moveHeld(from, to);
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

  // WHAT EACH TILE SEES — the world, narrowed by everything held ABOVE it (`mergeAbove`), so a
  // tile's press reaches every tile under it and never the one over it. Tiles standing under the
  // SAME merged filters share one narrowed object, which is what keeps the identity-keyed
  // derivation caches in the variants (floor.js, surface.js) warm — an unfiltered page is still
  // one object and one pass.
  const seen = useMemo(() => {
    const share = new Map();
    return tiles.map((_, i) => {
      const above = mergeAbove(held, i);
      const k = filterKey(above);
      if (!share.has(k)) share.set(k, narrowData(data, above));
      return { above, data: share.get(k) };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, held, tiles]);

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
                    onRemove={() => {
                      setHeld((h) => h.filter((_, j) => j !== i));
                      write(tiles.filter((_, j) => j !== i));
                    }}
                  />
                  {/* RENDERED BY THE TILE, not inside the corner's little box — the corner is a
                      20px-wide absolute element and a menu anchored to it could only ever be a
                      narrow popup. His instruction: it shows the same way as the add menu, the
                      length of the page. */}
                  {swap === i ? (
                    <Chooser
                      where="tilestack__menu--over"
                      dismissable
                      current={entry}
                      onClose={() => setSwap(-1)}
                      // SWAPPING REPLACES THE SLOT, not just the variant — the chooser offers
                      // every kind, so what comes back may be a different thing entirely.
                      onPick={(next) => {
                        setSwap(-1);
                        // The selection was the OLD tile's — the new one never made it, and a
                        // filter nobody visibly holds must not keep narrowing the page under it.
                        setHeld((h) => {
                          const n = h.slice();
                          n[i] = null;
                          return n;
                        });
                        write(tiles.map((x, j) => (j === i ? next : x)));
                      }}
                    />
                  ) : null}
                  {/* THE FILTER CONTRACT, positional: `above` is what every tile higher in the
                      stack holds, merged (nearest wins per dimension); `mine` is this tile's own
                      selection; `set(dimension, value)` publishes — same value again, or null,
                      lets go. A tile that offers no filter simply ignores the prop, and is still
                      narrowed by what stands above it, because `data` arrives already cut. */}
                  <t.Component
                    data={seen[i].data}
                    filter={{ above: seen[i].above, mine: held[i] || {}, set: (dim, val) => holdAt(i, dim, val) }}
                  />
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
