import React, { useRef, useEffect } from "react";
import { MergeView } from "@codemirror/merge";
import { EditorView, lineNumbers } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { oneDark } from "@codemirror/theme-one-dark";
import { syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";
import { langExt } from "../CodeView/languages";
import "./styles.scss";

// RFC-018 — before/after a change, side by side. The `diff` pane renderer, built on CodeMirror's merge
// view. base = the git-HEAD version, head = the working file (both real bytes from the plugin's
// getDiff). Read-only both sides for now (Phase 2); an editable right side folds in with the editor.
// `dark` comes from the OWNING pane (per-pane theme); light mode keeps colored syntax.
const DiffView = ({ base = "", head = "", language = "text", dark = true }) => {
  const host = useRef(null);

  useEffect(() => {
    if (!host.current) return undefined;
    const common = () => {
      const ext = [
        lineNumbers(),
        EditorView.editable.of(false),
        EditorState.readOnly.of(true),
        EditorView.lineWrapping,
      ];
      if (dark) ext.push(oneDark);
      else ext.push(syntaxHighlighting(defaultHighlightStyle, { fallback: true }));
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

    // The split merge view scrolls its two editors independently — you can swipe one side and leave the
    // other behind, which is nonsense for a diff whose rows are aligned. Lock them together. The equality
    // guard is what breaks the feedback loop: mirroring makes the two scrollTops equal, so the reflected
    // scroll event early-returns instead of bouncing back.
    const a = view.a.scrollDOM;
    const b = view.b.scrollDOM;
    const sync = (from, to) => () => {
      if (to.scrollTop === from.scrollTop && to.scrollLeft === from.scrollLeft) return;
      to.scrollTop = from.scrollTop;
      to.scrollLeft = from.scrollLeft;
    };
    const syncAB = sync(a, b);
    const syncBA = sync(b, a);
    a.addEventListener("scroll", syncAB);
    b.addEventListener("scroll", syncBA);

    return () => {
      a.removeEventListener("scroll", syncAB);
      b.removeEventListener("scroll", syncBA);
      view.destroy();
    };
  }, [base, head, language, dark]);

  return <div className="diff-view" ref={host} />;
};

export default DiffView;
