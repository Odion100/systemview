import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { hits, isDrag, rectOf } from "./boxHit";

// DRAG A BOX AROUND SOMETHING AND HEAR JUST THAT. His: *"I don't want to listen to this whole thing
// again, I just want to listen to this part."*
//
// IT IS A BOX, NOT A TEXT SELECTION, and that was his design rather than a shortcut. A box grabs
// WHOLE BLOCKS, so it never has to be accurate — clip a corner and you get the paragraph. Dragging
// across characters would demand precision for a thing whose whole point is that you gestured at a
// region you wanted to hear.
//
// IT SHOWS WHAT IT CAUGHT, in a panel at the corner of the drag, sized to the text rather than to
// the rectangle. Boxing each block in place instead is the next thing to try — his idea, and
// probably better — but this stands on its own and is the point worth being able to come back to.
//
// AND IT IS TEMPORARY IN A WAY THAT TAKES ITSELF AWAY. *"It shows just moments, a little play button
// in the corner. And then you play it and then it goes away… as soon as you click away or anything,
// it would go away."* So: no dismiss button, no state to clean up, nothing left behind. A click
// elsewhere, a scroll, a key, the Escape — any of them and it is gone.
//
// WHAT IT DOES NOT DO IS OWN THE PLAYING. Pressing play hands the selection to the queue and the box
// disappears — the audio outlives the box, because *"you don't want to scroll away and turn it
// off"*. It goes to the FRONT of the line (`playFirst`), not the back: he selected it to hear it
// now, and nothing is removed or replaced to make room.
//
// SHIFT KEEPS THE BROWSER'S OWN SELECTION. Trading copy-on-drag away silently would be the worst
// kind of improvement, so the box only starts on a plain drag.
const BoxSelect = ({ scopeRef, blockSelector = "[data-row]", onPlay, className = "" }) => {
  const [box, setBox] = useState(null); // live drag rect, in scope coordinates
  const [caught, setCaught] = useState(null); // { anchor, text, count }
  const [place, setPlace] = useState(null); // where the panel actually fits, measured
  const panelRef = useRef(null);
  const from = useRef(null);
  const dragging = useRef(false);

  const clear = useCallback(() => {
    setBox(null);
    setCaught(null);
    setPlace(null);
    from.current = null;
    dragging.current = false;
  }, []);

  // THE BLOCKS, MEASURED IN THE SCOPE'S OWN COORDINATES. A scrolling container means viewport rects
  // are meaningless the moment it moves, so everything is expressed relative to the scope and the
  // overlay is positioned the same way.
  const blocksOf = useCallback(
    (scope) => {
      const base = scope.getBoundingClientRect();
      return Array.from(scope.querySelectorAll(blockSelector)).map((el) => {
        const b = el.getBoundingClientRect();
        return {
          el,
          text: String(el.textContent || "").trim(),
          rect: {
            left: b.left - base.left + scope.scrollLeft,
            right: b.right - base.left + scope.scrollLeft,
            top: b.top - base.top + scope.scrollTop,
            bottom: b.bottom - base.top + scope.scrollTop,
          },
        };
      });
    },
    [blockSelector],
  );

  const pointIn = (scope, e) => {
    const base = scope.getBoundingClientRect();
    return { x: e.clientX - base.left + scope.scrollLeft, y: e.clientY - base.top + scope.scrollTop };
  };

  useEffect(() => {
    const scope = scopeRef && scopeRef.current;
    if (!scope) return undefined;

    const onDown = (e) => {
      if (e.button !== 0 || e.shiftKey) return; // shift-drag stays the browser's
      // A press on something pressable is that thing's press, not the start of a box.
      // `closest` only exists on an Element — a mousedown can arrive with a non-element target, and
      // an unguarded call there takes the whole panel down.
      const t = e.target;
      if (t && typeof t.closest === "function" && t.closest("button, a, input, textarea, select, [contenteditable]")) return;
      clear();
      from.current = pointIn(scope, e);
      dragging.current = true;
    };

    const onMove = (e) => {
      if (!dragging.current || !from.current) return;
      const r = rectOf(from.current, pointIn(scope, e));
      if (!isDrag(r)) return;
      // Only once it IS a drag do we take the gesture off the browser — a click must stay a click.
      e.preventDefault();
      setBox(r);
    };

    const onUp = (e) => {
      if (!dragging.current) return;
      dragging.current = false;
      const start = from.current;
      from.current = null;
      if (!start) return clear();
      const r = rectOf(start, pointIn(scope, e));
      if (!isDrag(r)) return clear();
      const got = hits(r, blocksOf(scope));
      setBox(null);
      if (!got.length) return clear();
      const text = got
        .map((g) => g.text)
        .filter(Boolean)
        .join("\n\n");
      if (!text) return clear();
      // ONE RECT PER BLOCK, not one merged box. His correction: *"don't pop up to show the things
      // selected… it should just show multiple boxes."* The words are already on screen — marking
      // them where they are beats drawing a panel that repeats them, and it is the thing that makes
      // a range across a log legible: you SEE a box around the log row and adjust the drag.
      // IT SITS AT THE CORNER OF THE DRAG AND SIZES TO ITS CONTENT. Stretching the panel to the
      // whole drag rectangle made a tall sweep produce a mostly-empty box — *"an ugly thing that
      // popped up in front of you, taking up a lot of empty extra space."* The drag says WHERE,
      // the text says how big.
      // THE ANCHOR IS THE DRAG, NOT A FIXED SIDE. Both edges are kept so the panel can sit below it
      // or above it — see the placement effect: grabbing the last lines of the conversation left it
      // hanging past the bottom of the list, where it is clipped. *"If you try to grab the last few
      // lines, the play shows up too low."*
      setCaught({ anchor: { left: r.left, top: r.top, bottom: r.bottom }, text, count: got.length });
    };

    scope.addEventListener("mousedown", onDown);
    scope.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      scope.removeEventListener("mousedown", onDown);
      scope.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [scopeRef, blocksOf, clear]);

  // WHERE THE PANEL FITS, MEASURED RATHER THAN ASSUMED. Its height depends on how much was caught
  // (one line or the four-line clamp), so the only honest way to know whether it fits below the drag
  // is to measure it once it exists. Below by preference — that is where his hand finished — and
  // above when below would hang past the visible bottom of the list.
  useLayoutEffect(() => {
    if (!caught) {
      setPlace(null);
      return;
    }
    const scope = scopeRef && scopeRef.current;
    const panel = panelRef.current;
    if (!scope || !panel) return;
    const h = panel.getBoundingClientRect().height || 0;
    const w = panel.getBoundingClientRect().width || 0;
    const viewTop = scope.scrollTop;
    const viewBottom = scope.scrollTop + scope.clientHeight;
    let top = caught.anchor.bottom + 4;
    if (top + h > viewBottom - 2) {
      const above = caught.anchor.top - h - 4;
      // Above only if above actually fits; otherwise pin it inside the view rather than hanging out
      // of either end.
      top = above >= viewTop + 2 ? above : Math.max(viewTop + 2, viewBottom - h - 2);
    }
    const maxLeft = Math.max(0, scope.scrollLeft + scope.clientWidth - w - 4);
    setPlace({ top, left: Math.min(caught.anchor.left, maxLeft) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caught]);

  // ANYTHING ELSE HE DOES TAKES IT AWAY. Scrolling especially: the box is drawn at a scroll position
  // and would otherwise sit over the wrong words, which is worse than being gone.
  useEffect(() => {
    if (!caught) return undefined;
    const scope = scopeRef && scopeRef.current;
    const away = (e) => {
      if (e && e.target && e.target.closest && e.target.closest(".box-select__play")) return;
      clear();
    };
    const onKey = () => clear();
    window.addEventListener("mousedown", away, true);
    window.addEventListener("keydown", onKey, true);
    if (scope) scope.addEventListener("scroll", clear, { passive: true });
    return () => {
      window.removeEventListener("mousedown", away, true);
      window.removeEventListener("keydown", onKey, true);
      if (scope) scope.removeEventListener("scroll", clear);
    };
  }, [caught, scopeRef, clear]);

  if (!box && !caught) return null;
  const asStyle = (r) => ({
    left: r.left,
    top: r.top,
    width: Math.max(1, r.right - r.left),
    height: Math.max(1, r.bottom - r.top),
  });

  return (
    <div className={`box-select ${className}`.trim()} aria-hidden={!caught}>
      {box && !caught && <div className="box-select__band" style={asStyle(box)} />}
      {caught && (
        <div
          className="box-select__caught"
          ref={panelRef}
          // Hidden for the one frame before it has been measured — a panel that paints in the wrong
          // place and then jumps is worse than one that appears where it belongs.
          style={
            place
              ? { left: place.left, top: place.top }
              : { left: caught.anchor.left, top: caught.anchor.bottom + 4, visibility: "hidden" }
          }
        >
          {/* WHAT IT CAUGHT, SHOWN. *"The thing shows what's captured in the box with the play right
              there."* Seeing it is what makes an imprecise gesture safe — he can tell he grabbed the
              right part before pressing anything. */}
          <div className="box-select__text">{caught.text}</div>
          <button
            type="button"
            className="box-select__play"
            title={caught.count > 1 ? `Read these ${caught.count}` : "Read this"}
            aria-label="Read this selection"
            onClick={() => {
              const text = caught.text;
              clear(); // the box goes; the audio it started does not
              if (onPlay) onPlay(text);
            }}
          >
            ▶
          </button>
        </div>
      )}
    </div>
  );
};

export default BoxSelect;
