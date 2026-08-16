import React, { useRef, useEffect } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, lineNumbers, keymap, Decoration, gutter, GutterMarker, WidgetType } from "@codemirror/view";
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

// CHANGE MARKS ALONG THE EDGE — what moved vs git HEAD, while you read the plain file. His ask:
// "so you don't have to always go to diff". Same shape as the focus range above: a StateField the
// pane refreshes, line decorations, CSS paints the stripe. Recomputed as you type, so a line you
// just edited marks itself immediately.
const setChangeMarks = StateEffect.define();
const changeMarkField = StateField.define({
  create: () => Decoration.none,
  update(deco, tr) {
    for (const e of tr.effects) {
      if (!e.is(setChangeMarks)) continue;
      const map = e.value;
      if (!map || !map.size) return Decoration.none;
      const marks = [];
      // Decoration.set wants them in document order, and a Map's insertion order isn't that.
      [...map.keys()]
        .sort((x, y) => x - y)
        .forEach((n) => {
          if (n < 1 || n > tr.state.doc.lines) return;
          const m = map.get(n);
          // TWO THINGS ON ONE STRIPE: colour is WHAT (added / changed / deleted below), width is
          // WHETHER IT'S STAGED — thick means it's in the index, thin means it isn't. That is what
          // the thick stripe was always for; it just wasn't wired to anything.
          const kind = typeof m === "string" ? m : m.kind;
          const staged = typeof m === "string" ? true : m.staged;
          marks.push(
            Decoration.line({
              class: `cm-sv-change cm-sv-change--${kind}${staged ? " cm-sv-change--staged" : ""}`,
            }).range(tr.state.doc.line(n).from),
          );
        });
      return Decoration.set(marks);
    }
    return deco.map(tr.changes);
  },
  provide: (f) => EditorView.decorations.from(f),
});

// CLICK THE STRIPE, SEE WHAT WAS THERE. The marks answered "this line moved"; the obvious next
// question is "moved from what", and the answer shouldn't cost you a trip to the diff view. The
// gutter carries a real hit target (pointer cursor, its own colour), and clicking it opens the
// BASE lines inline underneath — old text in place, the file still the file.
const setHunks = StateEffect.define();
// The pane's stage/unstage handler, carried IN THE STATE. It used to live in a module-level ref
// shared by every mounted CodeEditor, so whichever one rendered last owned it — the file pane's
// button rendered from one editor and then called into another editor's (empty) handler, and the
// click did nothing at all, silently.
const setStageHandler = StateEffect.define();
const toggleHunk = StateEffect.define();

// The one-word meaning of each colour, on the hover — a colour key nobody can find is not a key.
const KIND_SAYS = {
  added: "new since HEAD",
  changed: "changed since HEAD",
  removed: "lines deleted here",
};

class BaseLinesWidget extends WidgetType {
  constructor(lines, kind, now, staged, onStage) {
    super();
    this.lines = lines;
    this.kind = kind;
    this.now = now; // how many lines stand here NOW
    this.staged = staged;
    this.onStage = onStage;
  }
  eq(other) {
    // Data only — the callback is a fresh closure on every render and comparing it would rebuild
    // the panel constantly.
    return (
      other.kind === this.kind &&
      other.now === this.now &&
      other.staged === this.staged &&
      other.lines.join("\n") === this.lines.join("\n")
    );
  }
  toDOM() {
    const wrap = document.createElement("div");
    wrap.className = "cm-sv-was";
    // THE ACTION COMES FIRST, on its own row, and it says the word. A bare + in the corner of a
    // label is not a button you can find.
    if (this.onStage) {
      const bar = document.createElement("div");
      bar.className = "cm-sv-was__bar";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `cm-sv-was__stage${this.staged ? " is-unstage" : ""}`;
      btn.textContent = this.staged ? "− unstage" : "+ stage";
      btn.title = this.staged
        ? "Unstage just these lines — the rest of the file stays staged"
        : "Stage just these lines — the rest of the file stays as it is";
      btn.addEventListener("mousedown", (e) => e.stopPropagation());
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.onStage(this.staged);
      });
      bar.appendChild(btn);
      wrap.appendChild(bar);
    }
    const head = document.createElement("div");
    head.className = "cm-sv-was__head";
    // BOTH SIDES, always. "was 1 line" on a stripe that looks two rows tall reads as wrong even
    // when it's right — a wrapped line is one line. Saying 1 → 1 removes the argument.
    const n = (k) => `${k} line${k === 1 ? "" : "s"}`;
    head.textContent = !this.lines.length
      ? `new — nothing here at HEAD, ${n(this.now)} now`
      : this.kind === "removed"
        ? `deleted — ${n(this.lines.length)} were here`
        : `${n(this.lines.length)} → ${this.now} at HEAD`;
    // WHERE STAGED-VS-NOT LIVES NOW: here, not on the stripe. And it's actionable — this run can go
    // into the index on its own, without staging the rest of the file.
    const state = document.createElement("span");
    state.className = `cm-sv-was__state${this.staged ? " is-staged" : ""}`;
    state.textContent = this.staged ? "staged" : "not staged";
    head.appendChild(state);
    wrap.appendChild(head);
    this.lines.forEach((l) => {
      const row = document.createElement("div");
      row.className = "cm-sv-was__line";
      // textContent, never innerHTML — this is file content from someone's repo.
      row.textContent = l === "" ? " " : l;
      wrap.appendChild(row);
    });
    return wrap;
  }
  ignoreEvent() {
    return false;
  }
}

// One field holds both: the hunks the pane computed, and which of them are open.
const hunkField = StateField.define({
  create: () => ({ hunks: [], marks: null, open: new Set(), onStage: null, deco: Decoration.none }),
  update(value, tr) {
    let { hunks, marks, open, onStage } = value;
    let touched = false;
    for (const e of tr.effects) {
      if (e.is(setStageHandler)) {
        onStage = e.value || null;
        touched = true;
      }
      if (e.is(setChangeMarks)) {
        // The gutter reads the SAME per-line verdict the stripe does. It used to colour itself from
        // the hunk's first line and paint the whole run with it, so the two disagreed on screen —
        // green in one place, amber in the other, for the same rows.
        marks = e.value || null;
        touched = true;
      }
      if (e.is(setHunks)) {
        const next = e.value || [];
        // Keep what's open when the RUNS are the same (staging a hunk changes its badge, not its
        // position) and drop it only when the line numbers actually moved.
        const same =
          next.length === hunks.length && next.every((h, i) => hunks[i] && hunks[i].from === h.from);
        hunks = next;
        if (!same) open = new Set();
        touched = true;
      } else if (e.is(toggleHunk)) {
        open = new Set(open);
        if (open.has(e.value)) open.delete(e.value);
        else open.add(e.value);
        touched = true;
      }
    }
    if (!touched && !tr.docChanged) return value;
    const widgets = [];
    hunks.forEach((h) => {
      if (!open.has(h.from)) return;
      const line = Math.min(h.to, tr.state.doc.lines);
      if (line < 1) return;
      widgets.push(
        Decoration.widget({
          // How many lines stand here NOW — the other half of "was N lines".
          widget: new BaseLinesWidget(
            h.base,
            h.kind,
            h.to - h.from + 1,
            !!h.staged,
            onStage ? (unstage) => onStage(h, unstage) : null,
          ),
          block: true,
          side: 1,
        }).range(tr.state.doc.line(line).to),
      );
    });
    return { hunks, marks, open, onStage, deco: Decoration.set(widgets, true) };
  },
  provide: (f) => EditorView.decorations.from(f, (v) => v.deco),
});

class ChangeMarker extends GutterMarker {
  constructor(kind, isOpen, span, staged = true) {
    super();
    this.kind = kind;
    this.isOpen = isOpen;
    this.span = span || 1;
    this.staged = staged;
  }
  eq(other) {
    return (
      other.kind === this.kind &&
      other.isOpen === this.isOpen &&
      other.span === this.span &&
      other.staged === this.staged
    );
  }
  toDOM() {
    const el = document.createElement("div");
    el.className = `cm-sv-gutmark cm-sv-gutmark--${this.kind}${this.isOpen ? " is-open" : ""}`;
    // The colour key lives on the hover, and it says how big the run is — a tall stripe is often
    // ONE wrapped line, and the count settles that before it becomes a question.
    el.title = `${KIND_SAYS[this.kind] || "changed"} · ${this.span} line${this.span === 1 ? "" : "s"} — click to see what was here`;
    return el;
  }
}

// ONE STRIPE, AND IT IS THE CLICK TARGET. There was a thin stripe on the line and a thick bar in a
// gutter beside it — two marks for one fact, which is the question he asked twice. The thin one is
// the one that reads, so the gutter is gone and the stripe itself takes the click: a hit zone over
// the line's left edge, resolved to the line, then to its hunk.
const STRIPE_HIT = 10; // px from the left edge of the content that count as "on the stripe"
const stripeClicks = EditorView.domEventHandlers({
  mousedown(e, view) {
    const state = view.state.field(hunkField, false);
    if (!state || !state.hunks.length) return false;
    const box = view.contentDOM.getBoundingClientRect();
    if (e.clientX - box.left > STRIPE_HIT) return false;
    const pos = view.posAtCoords({ x: box.left + STRIPE_HIT + 2, y: e.clientY });
    if (pos == null) return false;
    const n = view.state.doc.lineAt(pos).number;
    const h = state.hunks.find((x) => n >= x.from && n <= x.to);
    if (!h) return false;
    e.preventDefault();
    view.dispatch({ effects: toggleHunk.of(h.from) });
    return true;
  },
});

// eslint-disable-next-line no-unused-vars
const changeGutter = gutter({
  class: "cm-sv-changegutter",
  lineMarker(view, block) {
    const state = view.state.field(hunkField, false);
    if (!state) return null;
    const n = view.state.doc.lineAt(block.from).number;
    const h = state.hunks.find((x) => n >= x.from && n <= x.to);
    if (!h) return null;
    // Per LINE, like the stripe beside it — never the hunk's kind smeared over the whole run.
    const m = state.marks && state.marks.get(n);
    const kind = m ? (typeof m === "string" ? m : m.kind) : h.kind;
    const staged = m && typeof m !== "string" ? m.staged : true;
    return new ChangeMarker(kind, state.open.has(h.from), h.to - h.from + 1, staged);
  },
  // WITHOUT THIS THE GUTTER NEVER REDRAWS. `lineMarker` is cached per viewport; a gutter has no way
  // to know a StateField it reads has changed unless you tell it, so the hunks arriving after the
  // file loads produced exactly nothing — an empty gutter with only its spacer in it.
  lineMarkerChange: (update) =>
    update.startState.field(hunkField, false) !== update.state.field(hunkField, false),
  initialSpacer: () => new ChangeMarker("changed", false),
  domEventHandlers: {
    mousedown(view, block, e) {
      const state = view.state.field(hunkField, false);
      if (!state) return false;
      const n = view.state.doc.lineAt(block.from).number;
      const h = state.hunks.find((x) => n >= x.from && n <= x.to);
      if (!h) return false;
      e.preventDefault();
      view.dispatch({ effects: toggleHunk.of(h.from) });
      return true;
    },
  },
});

const CodeEditor = ({ value = "", language = "markdown", onChange, dark = false, focusLines = null, changeMarks = null, hunks = null, onStageHunk = null }) => {
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
      changeMarkField, // the vs-HEAD stripe down the edge
      hunkField, // what each stripe replaced, and which are open
      stripeClicks, // the stripe itself is the click target — no second gutter
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

  // Push the marks in whenever the pane recomputes them (a fresh file, or a keystroke that changed
  // which lines differ). Keyed on the CONTENT of the map, not its identity — the pane builds a new
  // Map every render and identity alone would dispatch on every keystroke regardless.
  const markKey = changeMarks ? [...changeMarks.entries()].join(",") : "";
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: [
        setChangeMarks.of(changeMarks),
        setHunks.of(hunks || []),
        setStageHandler.of(onStageHunk),
      ],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markKey, language, dark, onStageHunk]);

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
