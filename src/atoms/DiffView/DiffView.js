import React, { useRef, useEffect } from "react";
import { MergeView } from "@codemirror/merge";
import { EditorView, lineNumbers } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { oneDark } from "@codemirror/theme-one-dark";
import { syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";
import { langExt } from "../CodeView/languages";
import "./styles.scss";

// RFC-018 — before/after a change, side by side. The `diff` pane renderer, built on CodeMirror's merge
// view. base = the git-HEAD version (always read-only), head = the working file. Pass `onChange` and
// the RIGHT side becomes a real editor — you edit the working file from inside the diff; the change
// bands live-update as you type. `dark` comes from the OWNING pane's theme family.
const DiffView = ({ base = "", head = "", language = "text", dark = true, onChange }) => {
  const host = useRef(null);
  // Latest onChange without rebuilding the editor per render.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const editable = !!onChange;

  useEffect(() => {
    if (!host.current) return undefined;
    const common = (readOnly) => {
      const ext = [lineNumbers(), EditorView.lineWrapping];
      if (readOnly) ext.push(EditorView.editable.of(false), EditorState.readOnly.of(true));
      if (dark) ext.push(oneDark);
      else ext.push(syntaxHighlighting(defaultHighlightStyle, { fallback: true }));
      const lang = langExt(language);
      if (lang) ext.push(lang);
      return ext;
    };
    const bExt = common(!editable);
    if (editable)
      bExt.push(
        EditorView.updateListener.of((u) => {
          if (u.docChanged && onChangeRef.current) onChangeRef.current(u.state.doc.toString());
        }),
      );

    const view = new MergeView({
      a: { doc: base, extensions: common(true) },
      b: { doc: head, extensions: bExt },
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
    // When EDITABLE, `head` is only the INITIAL doc — depending on it would tear the editor down (and
    // lose the cursor) on every keystroke the parent echoes back. Read-only keeps the old behavior.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, editable ? "" : head, language, dark, editable]);

  return <div className="diff-view" ref={host} />;
};

export default DiffView;
