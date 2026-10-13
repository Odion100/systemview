// A COLOUR PICKER YOU CAN DRAG ACROSS — the one he already uses in BUStudio, in plain DOM so it can
// live beside a CodeMirror widget.
//
// WHY NOT `<input type="color">`, which was the first attempt and was wrong twice over:
//
//   1. IT CLOSED THE INSTANT IT WAS TOUCHED. The native dialog belongs to the input element, and the
//      input lived INSIDE the CodeMirror widget — so the first live edit rebuilt the widget's DOM,
//      detached the input, and the OS panel went with it. His words: *"why can't I select the color,
//      as soon as you try to click it, it closes."* Nothing about the picker was fixable from inside
//      the widget: anything that edits the document destroys its own picker.
//   2. IT CANNOT BE DRAGGED. *"You can only click a color and then close — you should be able to drag
//      across it until you're done."* Choosing a colour is a continuous gesture, and a dialog that
//      commits on click makes it a sequence of guesses.
//
// SO: THE POPOVER IS MOUNTED ON `document.body`, not in the widget. The widget can be rebuilt as often
// as CodeMirror likes — on every keystroke if it wants — and the open picker never notices, because it
// is not in that subtree. One singleton, because two open pickers would both be writing to one file.
//
// The surfaces, the drag mechanism and the styling are BUStudio's `design/ColorPicker.jsx` — one
// gesture he already has in his hands, not a second thing to learn. What is NOT borrowed is the
// output: BUStudio writes its own spec dialect (`#rrggbb@0.55`), and a code file needs the notation it
// already had. That is `colorTokens.formatColor`'s job and the caller's.

import { parseColor } from "./colorTokens";

// ---- HSV ↔ RGB, BUStudio's exactly (0–360, 0–1, 0–1 ↔ 0–255) --------------------------------
const hsvToRgb = (h, s, v) => {
  const f = (n) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return [f(5), f(3), f(1)].map((x) => Math.round(x * 255));
};
const rgbToHsv = (r0, g0, b0) => {
  const r = r0 / 255, g = g0 / 255, b = b0 / 255;
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = 0;
  if (d) {
    h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return [h, max ? d / max : 0, max];
};
const hex2 = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
const rgbHex = ([r, g, b]) => `#${hex2(r)}${hex2(g)}${hex2(b)}`;

const el = (tag, cls, style) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (style) Object.assign(n.style, style);
  return n;
};

// ONE AT A TIME. Two open pickers would both hold a stale offset into the same document and the
// second one to move would write over the first one's edit.
let live = null;
export const closeColorPicker = () => {
  if (live) live.destroy();
};

/**
 * @param anchor  the element to position beside (the swatch chip)
 * @param raw     the literal as written in the file — decides the notation on the way out
 * @param onPick  (hex, alpha) => void — called on RELEASE, once per gesture, not per frame
 * @param onPreview (hex, alpha) => void — called live during the drag, for anything cheap to repaint
 * @param onDone  () => void, when the picker closes
 */
export const openColorPicker = ({ anchor, raw, onPick, onPreview, onDone }) => {
  closeColorPicker();
  const parsed = parseColor(raw) || { hex: "#000000", alpha: 1 };
  const n = parseInt(parsed.hex.slice(1), 16);
  let [h, s, v] = rgbToHsv((n >> 16) & 255, (n >> 8) & 255, n & 255);
  let a = parsed.alpha;

  const pop = el("div", "sv-cp");
  // POSITIONED IN VIEWPORT COORDINATES, and flipped when it would fall off the bottom — a code file
  // scrolls, so a colour on the last visible line is exactly where a picker opens off-screen and
  // reads as "it closed again".
  const r = anchor.getBoundingClientRect();
  const W = 212, H = 212;
  const left = Math.min(Math.max(8, r.left), window.innerWidth - W - 8);
  const below = r.bottom + 6;
  const top = below + H > window.innerHeight - 8 ? Math.max(8, r.top - H - 6) : below;
  Object.assign(pop.style, { left: `${left}px`, top: `${top}px` });

  const sv = el("div", "sv-cp__sv");
  const dot = el("i", "sv-cp__dot");
  sv.appendChild(dot);
  const hue = el("div", "sv-cp__hue");
  const hueThumb = el("i", "sv-cp__thumb");
  hue.appendChild(hueThumb);
  const alpha = el("div", "sv-cp__alpha");
  const alphaG = el("i", "sv-cp__alpha-g");
  const alphaThumb = el("i", "sv-cp__thumb");
  alpha.append(alphaG, alphaThumb);
  const row = el("div", "sv-cp__row");
  const hexIn = el("input", "sv-cp__hex");
  hexIn.spellcheck = false;
  const note = el("span", "sv-cp__note");
  row.append(hexIn, note);
  pop.append(sv, hue, alpha, row);

  const paint = () => {
    const rgb = hsvToRgb(h, s, v);
    const hex = rgbHex(rgb);
    const hueCss = rgbHex(hsvToRgb(h, 1, 1));
    sv.style.background = `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueCss})`;
    dot.style.left = `${s * 100}%`;
    dot.style.top = `${(1 - v) * 100}%`;
    dot.style.background = hex;
    hueThumb.style.left = `${(h / 360) * 100}%`;
    alphaG.style.background = `linear-gradient(to right, transparent, ${hex})`;
    alphaThumb.style.left = `${a * 100}%`;
    if (document.activeElement !== hexIn) hexIn.value = hex;
    // The notation is stated, because it is the thing that surprises: picking on `rgba(…)` writes
    // `rgba(…)` back, and he should be able to see that before he commits to it.
    note.textContent = parsed.kind ? parsed.kind.replace(/^hex\d$/, "hex") : "";
    return hex;
  };

  // ONE WRITE PER GESTURE, NOT PER FRAME — and this is a correctness fix, not an optimisation.
  //
  // His report (2026-10-05): *"whenever you move the slider… it just moves away down the page."* The
  // hue strip produces a distinct colour every pixel, so writing on each frame meant hundreds of
  // document edits per drag. One of the editor's effects is keyed on the document's value, so every
  // one of those edits rebuilt part of the editor, and the rebuild is what threw the scroller. The
  // same churn also raced the parent's state and reverted the pick.
  //
  // So the drag PREVIEWS and the release WRITES. He still watches the colour change live — the chip
  // and the picker's own surfaces repaint every frame — and the file receives exactly one edit, which
  // is also what he would want in an undo history.
  const preview = () => onPreview && onPreview(paint(), a);
  const commit = () => onPick && onPick(paint(), a);

  // ONE DRAG MECHANISM FOR ALL THREE SCALES — BUStudio's, including `setPointerCapture`, which is
  // what keeps the gesture alive when the pointer leaves the strip mid-drag. Without capture a fast
  // drag off the edge drops the colour wherever the pointer happened to exit.
  const drag = (node, fn) => {
    node.addEventListener("pointerdown", (e) => {
      if (e.button != null && e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      node.setPointerCapture?.(e.pointerId);
      const box = node.getBoundingClientRect();
      const at = (ev) =>
        fn(
          Math.max(0, Math.min(1, (ev.clientX - box.left) / box.width)),
          Math.max(0, Math.min(1, (ev.clientY - box.top) / box.height)),
        );
      at(e);
      const mv = (ev) => at(ev);
      const up = () => {
        node.removeEventListener("pointermove", mv);
        node.removeEventListener("pointerup", up);
        // THE GESTURE IS OVER — now the file hears about it, once.
        commit();
      };
      node.addEventListener("pointermove", mv);
      node.addEventListener("pointerup", up);
    });
  };

  drag(sv, (x, y) => { s = x; v = 1 - y; preview(); });
  drag(hue, (x) => { h = Math.round(x * 3600) / 10; preview(); });
  drag(alpha, (x) => { a = Math.round(x * 100) / 100; preview(); });

  hexIn.addEventListener("keydown", (e) => {
    e.stopPropagation(); // or the editor takes the keystroke and types into the file
    if (e.key === "Escape") return destroy();
    if (e.key !== "Enter") return;
    const p = parseColor(hexIn.value.trim());
    if (!p) return;
    const m = parseInt(p.hex.slice(1), 16);
    [h, s, v] = rgbToHsv((m >> 16) & 255, (m >> 8) & 255, m & 255);
    a = p.alpha;
    commit(); // typed and entered IS the gesture ending — write it
  });

  // The picker must not hand its clicks to the editor underneath — a click that reaches CodeMirror
  // moves the caret and blurs the picker, which looked exactly like "it closed again".
  pop.addEventListener("pointerdown", (e) => e.stopPropagation());
  pop.addEventListener("mousedown", (e) => e.stopPropagation());

  // CLOSE ON A CLICK OUTSIDE OR ESC — never on the first pick, which was the bug. `capture` so it is
  // seen before the editor swallows it, and `setTimeout` so the click that OPENED the picker does not
  // immediately close it in the same tick.
  const away = (e) => {
    if (!pop.contains(e.target) && e.target !== anchor && !anchor.contains(e.target)) destroy();
  };
  const esc = (e) => {
    if (e.key === "Escape") destroy();
  };
  let armed = false;
  const arm = setTimeout(() => {
    armed = true;
    document.addEventListener("pointerdown", away, true);
    document.addEventListener("keydown", esc, true);
  }, 0);

  function destroy() {
    clearTimeout(arm);
    if (armed) {
      document.removeEventListener("pointerdown", away, true);
      document.removeEventListener("keydown", esc, true);
    }
    pop.remove();
    if (live && live.pop === pop) live = null;
    onDone && onDone();
  }

  document.body.appendChild(pop);
  paint();
  live = { pop, destroy };
  return destroy;
};

export default openColorPicker;
