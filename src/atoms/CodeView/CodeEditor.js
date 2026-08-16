import React, { useRef, useEffect } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, lineNumbers, keymap, Decoration } from "@codemirror/view";
import { StateField, StateEffect } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";
import { oneDark } from "@codemirror/theme-one-dark";
import { langExt } from "./languages";
import "./styles.scss";

// RFC-018 Phase 4 — the EDITABLE CodeMirror (the editor we always wanted). Powers both the doc editor
// (replacing the plain textarea) and edit-any-file in a file pane. `value`/`onChange` is the whole
// contract — display vs edit is just which component (CodeView) you render. `dark` picks oneDark.
// A VISIBLE line-range mark, not just a text selection. Setting the selection was enough to scroll
// the pane, but browsers render an unfocused selection so faintly it reads as nothing at all — his
// report: "there's no box showing any selection". The read-only CodeView has always drawn a real
// line decoration for this; the editable pane needed the same thing, and the difference between the
// two was never a design decision, just a gap.
const setFocusRange = StateEffect.define();
const focusRangeField = StateField.define({
  create: () => Decoration.none,
  update(deco, tr) {
    for (const e of tr.effects) {
      if (!e.is(setFocusRange)) continue;
      if (!e.value) return Decoration.none;
      const [a, b] = e.value;
      const marks = [];
      for (let n = a; n <= b && n <= tr.state.doc.lines; n++)
        marks.push(Decoration.line({ class: "cm-sv-highlight" }).range(tr.state.doc.line(n).from));
      return Decoration.set(marks);
    }
    return deco.map(tr.changes);
  },
  provide: (f) => EditorView.decorations.from(f),
});

const CodeEditor = ({ value = "", language = "markdown", onChange, dark = false, focusLines = null }) => {
  const host = useRef(null);
  const viewRef = useRef(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Build the editor once per (language, theme); external value changes sync via a separate effect so
  // typing never tears down the view (which would drop the cursor).
  useEffect(() => {
    if (!host.current) return undefined;
    const listener = EditorView.updateListener.of((v) => {
      if (v.docChanged && onChangeRef.current) onChangeRef.current(v.state.doc.toString());
    });
    const ext = [
      lineNumbers(),
      history(),
      keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
      EditorView.lineWrapping,
      focusRangeField, // the visible line-range mark (see above)
      listener,
    ];
    const lang = langExt(language);
    if (lang) ext.push(lang);
    // Dark = oneDark (theme + its highlight style). Light = the classic COLORED light highlighting —
    // never the plain black-on-white CM default (a light editor still colors its syntax).
    if (dark) ext.push(oneDark);
    else ext.push(syntaxHighlighting(defaultHighlightStyle, { fallback: true }));

    const view = new EditorView({
      state: EditorState.create({ doc: value, extensions: ext }),
      parent: host.current,
    });
    viewRef.current = view;
    return () => { view.destroy(); viewRef.current = null; };
  // value intentionally excluded — synced below without a rebuild
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, dark]);

  useEffect(() => {
    const view = viewRef.current;
    if (view && value !== view.state.doc.toString()) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
    }
  }, [value]);

  // RFC-025 — `:file[path#L40-70]` opens the file AT a range. Select the lines and center them by
  // setting the editor's OWN scroller only. Never scrollIntoView: it walks up the DOM and scrolls
  // every scrollable ancestor, which is what used to yank a whole story to the middle.
  const focusKey = focusLines ? focusLines.join("-") : "";
  useEffect(() => {
    const view = viewRef.current;
    if (!view || !focusLines || !focusLines[0] || !value) return;
    const total = view.state.doc.lines;
    const a = Math.min(Math.max(1, focusLines[0]), total);
    const b = Math.min(Math.max(a, focusLines[1] || a), total);
    const from = view.state.doc.line(a).from;
    const to = view.state.doc.line(b).to;
    view.dispatch({ selection: { anchor: from, head: to }, effects: setFocusRange.of([a, b]) });
    // CENTRE IT — over several frames, not once. CodeMirror only measures the lines it has drawn and
    // ESTIMATES the rest, so a single scrollTop computed the instant a file loads lands somewhere
    // near the top and leaves you scrolling down to find your own selection (his report: "it didn't
    // scroll properly, I had to scroll down to see it"). Each pass brings the range closer, the real
    // heights replace the estimates, and the next pass corrects — a few frames and it's exact.
    let raf = 0;
    let passes = 0;
    const centre = () => {
      const h = view.scrollDOM.clientHeight;
      if (h) {
        const mid = (view.lineBlockAt(from).top + view.lineBlockAt(to).bottom) / 2;
        const max = Math.max(0, view.scrollDOM.scrollHeight - h);
        view.scrollDOM.scrollTop = Math.max(0, Math.min(max, mid - h / 2));
      }
      // Keep going a little past the point it looks settled: the pane can still be sizing (a panel
      // opening, the window laying out) after the document itself is done.
      if (++passes < 8) raf = requestAnimationFrame(centre);
    };
    centre();
    // THE FOCUSED LINES BECOME POINTABLE. Selecting and centring them was already here; what was
    // missing is that nothing could point AT them — the spotlight could find the pane, not the
    // range. This publishes a live rect for exactly those lines, recomputed on demand so it stays
    // right while the pane scrolls or the window resizes. It is the UI locating what the agent
    // named (`:file[path#L40-70]`); the agent still never sends a position.
    const rectOf = () => {
      const A = view.coordsAtPos(from);
      const B = view.coordsAtPos(to);
      if (!A || !B) return null;
      const box = view.scrollDOM.getBoundingClientRect();
      // Clipped to the visible pane — a range scrolled out of view must not draw a box off in space.
      const t = Math.max(box.top, Math.min(A.top, B.top));
      const bo = Math.min(box.bottom, Math.max(A.bottom, B.bottom));
      if (bo <= t) return null;
      return { left: box.left + 2, top: t, width: box.width - 4, height: bo - t };
    };
    window.__svCodeFocus = { path: null, rectOf };
    window.dispatchEvent(new CustomEvent("sv:codeFocused", { detail: { lines: [a, b] } }));
    return () => {
      if (raf) cancelAnimationFrame(raf);
      // Drop the published rect with the range it belonged to. A rect left behind from the LAST file
      // is worse than none: whatever points at it lands confidently on the wrong thing.
      if (window.__svCodeFocus && window.__svCodeFocus.rectOf === rectOf) window.__svCodeFocus = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey, value]);

  return <div className={`code-editor ${dark ? "code-editor--dark" : ""}`} ref={host} />;
};

export default CodeEditor;
