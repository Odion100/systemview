import React, { useRef, useEffect } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, lineNumbers, keymap } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";
import { oneDark } from "@codemirror/theme-one-dark";
import { langExt } from "./languages";
import "./styles.scss";

// RFC-018 Phase 4 — the EDITABLE CodeMirror (the editor we always wanted). Powers both the doc editor
// (replacing the plain textarea) and edit-any-file in a file pane. `value`/`onChange` is the whole
// contract — display vs edit is just which component (CodeView) you render. `dark` picks oneDark.
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
    view.dispatch({ selection: { anchor: from, head: to } });
    const top = view.lineBlockAt(from).top;
    const bottom = view.lineBlockAt(to).bottom;
    const mid = (top + bottom) / 2;
    view.scrollDOM.scrollTop = Math.max(0, mid - view.scrollDOM.clientHeight / 2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey, value]);

  return <div className={`code-editor ${dark ? "code-editor--dark" : ""}`} ref={host} />;
};

export default CodeEditor;
