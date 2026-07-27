import React, { useRef, useEffect } from "react";
import { MergeView } from "@codemirror/merge";
import { EditorView, lineNumbers } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { oneDark } from "@codemirror/theme-one-dark";
import { langExt } from "../CodeView/languages";
import "./styles.scss";

// RFC-018 — before/after a change, side by side. The `diff` pane renderer, built on CodeMirror's merge
// view. base = the git-HEAD version, head = the working file (both real bytes from the plugin's
// getDiff). Read-only both sides for now (Phase 2); an editable right side folds in with the editor.
const DiffView = ({ base = "", head = "", language = "text" }) => {
  const host = useRef(null);

  useEffect(() => {
    if (!host.current) return undefined;
    const common = () => {
      const ext = [
        lineNumbers(),
        EditorView.editable.of(false),
        EditorState.readOnly.of(true),
        EditorView.lineWrapping,
        oneDark,
      ];
      const lang = langExt(language);
      if (lang) ext.push(lang);
      return ext;
    };

    const view = new MergeView({
      a: { doc: base, extensions: common() },
      b: { doc: head, extensions: common() },
      parent: host.current,
      collapseUnchanged: { margin: 3, minSize: 4 },
      gutter: true,
    });

    return () => view.destroy();
  }, [base, head, language]);

  return <div className="diff-view" ref={host} />;
};

export default DiffView;
