import React, { useRef, useEffect } from "react";
import { MergeView } from "@codemirror/merge";
import { EditorView, lineNumbers, Decoration } from "@codemirror/view";
import { EditorState, StateField, RangeSetBuilder } from "@codemirror/state";
import { oneDark } from "@codemirror/theme-one-dark";
import { syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";
import { langExt } from "../CodeView/languages";
import "./styles.scss";

// RFC-018 — before/after a change, side by side. The `diff` pane renderer, built on CodeMirror's merge
// view. base = the git-HEAD version (always read-only), head = the working file. Pass `onChange` and
// the RIGHT side becomes a real editor — you edit the working file from inside the diff; the change
// bands live-update as you type. `dark` comes from the OWNING pane's theme family.
// STAGED, BUT STILL VISIBLE. In the unstaged view the staged hunks stay on screen, faded (his:
// "you should still be able to see the staged changes, but fade it out") — `faded` is the list of
// hunks already in the index, in head lines (from/to) and base lines (baseFrom/baseTo), 1-based.
const fadedLines = (spans, pick) => {
  const set = new Set();
  (spans || []).forEach((h) => {
    const [a, b] = pick(h);
    for (let l = a; l <= b; l += 1) if (l >= 1) set.add(l);
  });
  return set;
};
const fadeField = (lines) =>
  StateField.define({
    create(state) {
      const b = new RangeSetBuilder();
      for (let l = 1; l <= state.doc.lines; l += 1)
        if (lines.has(l)) b.add(state.doc.line(l).from, state.doc.line(l).from, Decoration.line({ class: "diff-view__faded" }));
      return b.finish();
    },
    update(v, tr) {
      return tr.docChanged ? Decoration.none : v;
    },
    provide: (f) => EditorView.decorations.from(f),
  });

const DiffView = ({ base = "", head = "", language = "text", dark = true, onChange, faded = null }) => {
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
    const aExt = common(true);
    const bExt = common(!editable);
    if (faded && faded.length) {
      aExt.push(fadeField(fadedLines(faded, (h) => [h.baseFrom, h.baseTo])));
      bExt.push(fadeField(fadedLines(faded, (h) => [h.from, h.to])));
    }
    if (editable)
      bExt.push(
        EditorView.updateListener.of((u) => {
          if (u.docChanged && onChangeRef.current) onChangeRef.current(u.state.doc.toString());
        }),
      );

    const view = new MergeView({
      a: { doc: base, extensions: aExt },
      b: { doc: head, extensions: bExt },
      parent: host.current,
      collapseUnchanged: { margin: 3, minSize: 4 },
      gutter: true,
      // THE MERGE VIEW'S OWN DIFF GIVES UP EARLY. Its default scanLimit is 500: on a 6,000-line
      // file with edits spread across it (his AgentChat.js) it marked lines ~600 to the end as ONE
      // insertion, so every row read as changed and staged-vs-not was invisible. Scan far enough
      // to find the real edits; the timeout keeps a truly rewritten file from hanging the tab.
      diffConfig: { scanLimit: 20000, timeout: 2500 },
    });

    // A handle on the node, so a probe (or a test) can reach the two editors — measurement, never
    // rendering, goes through it.
    host.current.__svMerge = view;
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
    // The faded set only changes when staging changes — a rebuild then is fine.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, editable ? "" : head, language, dark, editable, JSON.stringify(faded || null)]);

  return <div className="diff-view" ref={host} />;
};

export default DiffView;
