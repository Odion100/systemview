import React, { useRef, useEffect } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, lineNumbers, keymap } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { oneDark } from "@codemirror/theme-one-dark";
import { langExt } from "./languages";
import "./styles.scss";

// RFC-018 Phase 4 — the EDITABLE CodeMirror (the editor we always wanted). Powers both the doc editor
// (replacing the plain textarea) and edit-any-file in a file pane. `value`/`onChange` is the whole
// contract — display vs edit is just which component (CodeView) you render. `dark` picks oneDark.
const CodeEditor = ({ value = "", language = "markdown", onChange, dark = false }) => {
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
    if (dark) ext.push(oneDark);

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

  return <div className={`code-editor ${dark ? "code-editor--dark" : ""}`} ref={host} />;
};

export default CodeEditor;
