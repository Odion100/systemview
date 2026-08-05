import React, { useRef, useEffect } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, lineNumbers, Decoration } from "@codemirror/view";
import { syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";
import { oneDark } from "@codemirror/theme-one-dark";
import { langExt } from "./languages";
import "./styles.scss";

// RFC-018 — read-only CodeMirror 6 view, mounted directly on core (no React wrapper: the @uiw React
// binding pulls a bare `react/jsx-runtime` import that CRA5/webpack can't resolve without ejecting).
// The renderer for `file`/`source`/(diff head) panes: real plugin bytes, syntax-highlit, framed.
// `highlight` = { lines:[a,b] } or { match:"str" } → scroll-to + line-range emphasis (RFC-011 instinct).

// Resolve a highlight descriptor to a 1-based [from,to] line range against the actual code.
function resolveRange(highlight, code) {
  if (!highlight) return null;
  if (Array.isArray(highlight.lines)) {
    const [a, b] = highlight.lines;
    if (a) return [a, b || a];
  }
  if (highlight.match) {
    const idx = code.split("\n").findIndex((l) => l.includes(highlight.match));
    if (idx > -1) return [idx + 1, idx + 1];
  }
  return null;
}

// A decorations extension that line-classes a [from,to] range — CSS paints the emphasis.
function highlightLines(range) {
  return EditorView.decorations.of((view) => {
    if (!range) return Decoration.none;
    const marks = [];
    const [from, to] = range;
    for (let n = from; n <= to && n <= view.state.doc.lines; n++) {
      marks.push(Decoration.line({ class: "cm-sv-highlight" }).range(view.state.doc.line(n).from));
    }
    return Decoration.set(marks);
  });
}

const CodeView = ({ code = "", language = "text", highlight, dark = true }) => {
  const host = useRef(null);
  // Key the rebuild on the VALUES, not object identity. PaneView hands us a fresh `highlight` object on
  // every render, so depending on it would tear down + recreate the editor on any stage change (pin,
  // width, ×) — and the mass reflow yanked scroll to the bottom. A stable string key kills that.
  const hlKey = highlight ? JSON.stringify(highlight) : "";

  useEffect(() => {
    if (!host.current) return undefined;
    const range = resolveRange(highlight, code);
    const extensions = [
      lineNumbers(),
      EditorView.editable.of(false),
      EditorState.readOnly.of(true),
      EditorView.lineWrapping,
    ];
    // Same theme contract as CodeEditor: dark = oneDark, light = the classic colored light highlighting.
    if (dark) extensions.push(oneDark);
    else extensions.push(syntaxHighlighting(defaultHighlightStyle, { fallback: true }));
    const lang = langExt(language);
    if (lang) extensions.push(lang);
    if (range) extensions.push(highlightLines(range));

    const view = new EditorView({
      state: EditorState.create({ doc: code, extensions }),
      parent: host.current,
    });

    // Center the highlighted line ONLY when the editor has its own scroll, and ONLY inside the editor's
    // own scroller. We deliberately do NOT use EditorView.scrollIntoView: it walks UP the DOM and scrolls
    // every scrollable ancestor (the .stage) to center the pane — that's the "switching stories/layout
    // yanks the whole story to the middle" bug. Setting scrollDOM.scrollTop directly touches only this
    // editor and never the stage. Deferred a frame so the scroller is laid out and measurable.
    let destroyed = false;
    if (range) {
      requestAnimationFrame(() => {
        if (destroyed || !view.scrollDOM) return;
        const scroller = view.scrollDOM;
        if (scroller.scrollHeight - scroller.clientHeight > 4) {
          // Center the MIDDLE of the range (not its first line) so the whole highlighted span sits
          // centered — otherwise range[0] centers and the rest of the range spills below.
          const midLine = Math.min(Math.floor((range[0] + range[1]) / 2), view.state.doc.lines);
          const pos = view.state.doc.line(midLine).from;
          const block = view.lineBlockAt(pos);
          const target = block.top - scroller.clientHeight / 2 + block.height / 2;
          scroller.scrollTop = Math.max(0, target);
        }
      });
    }

    return () => { destroyed = true; view.destroy(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, language, hlKey, dark]);

  return <div className={`code-view ${dark ? "" : "code-view--light"}`} ref={host} />;
};

export default CodeView;
