import React, { useRef, useEffect } from "react";
import ReactDOM from "react-dom";
import { EditorState } from "@codemirror/state";
import { EditorView, lineNumbers, keymap, Decoration, gutter, gutterLineClass, GutterMarker, WidgetType, MatchDecorator, ViewPlugin } from "@codemirror/view";
import { StateField, StateEffect, RangeSet, Prec } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";
import { oneDark } from "@codemirror/theme-one-dark";
import { langExt } from "./languages";
import { dictateInto, dictationSupported } from "./codeComments";
import { importBlocks, classifyHit, escapeRe } from "./codeNav";
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

// THE NUMBERS HAVE TO LOOK SELECTABLE, AND LOOK SELECTED. Dragging them picks a run (below), but
// with nothing marking them it was a feature only I could see — his words: "I don't see how I can
// select lines… I probably need to see a point or a cue over the lines." So every line in the
// selection lights its NUMBER, which is also what makes the right-click's `57-64` believable before
// you open the menu.
const selectedLineMarker = new (class extends GutterMarker {
  constructor() {
    super();
    this.elementClass = "cm-sv-selline";
  }
})();

// ── RFC-034 · COMMENTS ON CODE ─────────────────────────────────────────────────────────────────
// A thread hangs UNDER the run it's about, on the same block-widget machinery the "what was here"
// panel uses. Nothing is written into the file: the store is a sidecar (see codeComments.js), and
// the anchor is a line range and only a line range — his call, and the reason is that a range says
// exactly where the thread goes while a function name doesn't.
const setComments = StateEffect.define(); // { threads, on }
const setCommentHandlers = StateEffect.define(); // { addThread, addReply, removeThread }
const toggleThread = StateEffect.define(); // thread id
const composeIn = StateEffect.define(); // { id, record } | null — which thread has the reply box open
const setDraft = StateEffect.define(); // { from, to } | null

const when = (ts) => {
  const d = new Date(ts || 0);
  return isNaN(d.getTime()) ? "" : d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};
const rangeLabel = (from, to) => (from === to ? `${from}` : `${from}-${to}`);

// The reply FORM — the same shape a document thread's is (textarea, Post, Cancel, mic), because it
// is the same feature and should not need to be told apart. It is not part of a thread's resting
// state: you open it when you have something to say.
function replyForm({ placeholder, label, onPost, onCancel, record }) {
  const form = document.createElement("div");
  form.className = "cm-sv-thread__form";
  const ta = document.createElement("textarea");
  ta.className = "cm-sv-thread__input";
  ta.placeholder = placeholder;
  ta.rows = 2;
  let rec = null;
  const stopRec = () => {
    if (rec) {
      try { rec.stop(); } catch {}
      rec = null;
    }
  };
  const post = () => {
    const text = ta.value.trim();
    if (!text) return;
    stopRec();
    onPost(text);
  };
  ta.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      post();
    }
  });
  ta.addEventListener("mousedown", (e) => e.stopPropagation());
  form.appendChild(ta);

  const row = document.createElement("div");
  row.className = "cm-sv-thread__actions";
  const mk = (cls, text, fn) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = cls;
    b.textContent = text;
    b.addEventListener("mousedown", (e) => e.stopPropagation());
    b.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      fn();
    });
    return b;
  };
  row.appendChild(mk("cm-sv-thread__post", label, post));
  row.appendChild(mk("cm-sv-thread__cancel", "Cancel", () => { stopRec(); onCancel(); }));
  if (dictationSupported()) {
    const mic = mk("cm-sv-thread__mic", "🎙", () => {
      if (rec) {
        stopRec();
        mic.classList.remove("is-on");
        return;
      }
      rec = dictateInto(ta, (on) => {
        mic.classList.toggle("is-on", on);
        if (!on) rec = null;
      });
    });
    mic.title = "Dictate — press again to stop";
    row.appendChild(mic);
    // RECORD STRAIGHT AWAY when the menu said "record". His ask: "the recorder in the right-click
    // option. Boom. You click it, it starts recording your next comment."
    if (record)
      setTimeout(() => {
        rec = dictateInto(ta, (on) => {
          mic.classList.toggle("is-on", on);
          if (!on) rec = null;
        });
      }, 0);
  }
  form.appendChild(row);
  setTimeout(() => ta.focus(), 0);
  return form;
}

// A thread on a run of code. SUBTLE, and shaped like a document thread: what was said, and nothing
// else. No badge repeating the line numbers (they're the lines it's sitting under), no Reply button,
// no delete button — right-click is where all of that lives, the same as everywhere else here.
class ThreadWidget extends WidgetType {
  constructor(thread, handlers, composing, record) {
    super();
    this.thread = thread;
    this.handlers = handlers;
    this.composing = composing;
    this.record = record;
  }
  eq(other) {
    // Data only — the handlers are fresh closures every render.
    return (
      other.composing === this.composing &&
      other.record === this.record &&
      JSON.stringify(other.thread) === JSON.stringify(this.thread)
    );
  }
  // `view` is handed to toDOM — so closing the box is dispatched straight into editor state, with
  // no round trip through React to get back here.
  toDOM(view) {
    const t = this.thread;
    const h = this.handlers || {};
    const wrap = document.createElement("div");
    wrap.className = "cm-sv-thread";
    // RIGHT-CLICK THE COMMENT ITSELF — reply, record a reply, delete it. Without this the thread was
    // the one thing on the page with no menu on it.
    wrap.addEventListener("contextmenu", (e) => {
      if (!h.threadMenu) return;
      e.preventDefault();
      e.stopPropagation();
      h.threadMenu(e, t.id);
    });
    (t.replies || []).forEach((r, i) => {
      const row = document.createElement("div");
      const agent = r.author && r.author !== "you";
      row.className = `cm-sv-thread__reply${agent ? " cm-sv-thread__reply--agent" : ""}`;
      // NO BADGE. A comment is a note on some lines, not a threaded conversation with roles — the
      // word "reply" and a coloured chip were me copying a document thread's LOOK when he was
      // talking about how it behaves. Who wrote it and when live on the hover.
      const body = document.createElement("span");
      body.title = `${agent ? r.author : "you"} · ${when(r.ts)}`;
      body.className = "cm-sv-thread__text";
      // A REPLY IS CHAT MARKDOWN. Agents answer a note in the light markdown they use everywhere
      // else — bold, code, a :file chip, a ::diff — and it drew here as raw text, asterisks and all
      // (his call: "code comments need markdown just like the board did"). The pane hands over the
      // renderer (the bubble's, scoped to this project) and it mounts into the widget's node; the
      // widget unmounts it in destroy(). Without a renderer: textContent, never innerHTML.
      if (h.renderText) ReactDOM.render(h.renderText(r.text || ""), body);
      else body.textContent = r.text || "";
      row.appendChild(body);
      const del = document.createElement("button");
      del.type = "button";
      del.className = "cm-sv-thread__del";
      del.textContent = "×";
      del.title = "Delete this reply";
      del.addEventListener("mousedown", (e) => e.stopPropagation());
      del.addEventListener("click", (e) => {
        e.stopPropagation();
        if (h.removeReply) h.removeReply(t.id, i);
      });
      row.appendChild(del);
      wrap.appendChild(row);
    });
    if (this.composing)
      wrap.appendChild(
        replyForm({
          placeholder: "add to this comment…",
          label: "Save",
          record: this.record,
          onPost: (text) => h.addReply && h.addReply(t.id, text),
          onCancel: () => view.dispatch({ effects: composeIn.of(null) }),
        }),
      );
    return wrap;
  }
  destroy(dom) {
    // Every reply mounted a React tree into its text node — unmount them or they leak.
    dom.querySelectorAll(".cm-sv-thread__text").forEach((el) => ReactDOM.unmountComponentAtNode(el));
  }
  ignoreEvent() {
    // TRUE = the editor keeps its hands off. A textarea inside a widget needs its own keystrokes,
    // and the "what was here" panel (which is never typed into) is why that one differs.
    return true;
  }
}

// A comment being written on a run that has none yet — the form, and only the form.
class DraftWidget extends WidgetType {
  constructor(from, to, handlers, record) {
    super();
    this.from = from;
    this.to = to;
    this.handlers = handlers;
    this.record = record;
  }
  eq(other) {
    return other.from === this.from && other.to === this.to && other.record === this.record;
  }
  toDOM() {
    const h = this.handlers || {};
    const wrap = document.createElement("div");
    wrap.className = "cm-sv-thread cm-sv-thread--draft";
    wrap.appendChild(
      replyForm({
        placeholder: `comment on ${rangeLabel(this.from, this.to)}…`,
        label: "Comment",
        record: this.record,
        onPost: (text) => h.addThread && h.addThread(this.from, this.to, text),
        onCancel: () => h.cancelDraft && h.cancelDraft(),
      }),
    );
    return wrap;
  }
  ignoreEvent() {
    return true;
  }
}

// Threads the pane loaded, which of them are open, and the one being written. Same shape as
// hunkField above so the two read alike.
const commentField = StateField.define({
  create: () => ({ threads: [], on: false, openIds: [], composing: null, draft: null, handlers: null, deco: Decoration.none }),
  update(value, tr) {
    let { threads, on, openIds, composing, draft, handlers } = value;
    let touched = false;
    for (const e of tr.effects) {
      if (e.is(setCommentHandlers)) {
        handlers = e.value || null;
        touched = true;
      }
      if (e.is(setComments)) {
        const next = (e.value && e.value.threads) || [];
        // Snapshot the ids first: closing over `threads` itself (which this block reassigns) is the
        // loop-capture the hunk field above still trips the linter with.
        // WHICH ARE OPEN IS THE PANE'S, not ours: it arrives with the comments, so rebuilding the
        // editor (a dark/light flip does exactly that) can't quietly close them.
        openIds = (e.value && e.value.openIds) || [];
        // Posting closes the box it was posted from — you said your piece.
        composing = null;
        threads = next;
        on = !!(e.value && e.value.on);
        touched = true;
      }
      if (e.is(composeIn)) {
        composing = e.value || null;
        touched = true;
      }
      if (e.is(setDraft)) {
        draft = e.value || null;
        touched = true;
      }
    }
    if (!touched && !tr.docChanged) return value;
    const widgets = [];
    const at = (line) => Math.max(1, Math.min(line, tr.state.doc.lines));
    // ONE SET, MEANING "AGAINST THE DEFAULT". The file's default is showing (or hidden, if you used
    // the control at the top) and the 💬 on a line flips THAT comment the other way — so the icon
    // still toggles in both directions. It used to hold "open" ids, which meant that once the
    // default became showing, the icon had nowhere to move to and stopped doing anything.
    threads.forEach((t) => {
      const flipped = openIds.includes(t.id);
      if (on === flipped) return;
      widgets.push(
          Decoration.widget({
            widget: new ThreadWidget(
              t,
              handlers,
              !!composing && composing.id === t.id,
              !!composing && composing.id === t.id && !!composing.record,
            ),
            block: true,
            side: 1,
        }).range(tr.state.doc.line(at(t.to)).to),
      );
    });
    if (draft)
      widgets.push(
        Decoration.widget({
          widget: new DraftWidget(draft.from, draft.to, handlers, !!draft.record),
          block: true,
          side: 2,
        }).range(tr.state.doc.line(at(draft.to)).to),
      );
    return { threads, on, openIds, composing, draft, handlers, deco: Decoration.set(widgets, true) };
  },
  provide: (f) => EditorView.decorations.from(f, (v) => v.deco),
});

const commentedLineMarker = new (class extends GutterMarker {
  constructor() {
    super();
    this.elementClass = "cm-sv-hascomment";
  }
})();
// Both marks in one computed set, and it is deliberately computed OFF `commentField`: a gutter only
// redraws when the doc, the viewport, or a marker set it reads has changed — so with the 💬 baked
// into the line-number TEXT it appeared only if something else happened to force a redraw after the
// comments loaded. (Same family as the `lineMarkerChange` trap the change gutter hit.) A class on
// the number also keeps the icon out of the number's own width.
const selectedLineNumbers = gutterLineClass.compute(["selection", "doc", commentField], (state) => {
  const marks = [];
  const st = state.field(commentField, false);
  if (st)
    st.threads.forEach((t) => {
      if (t.from >= 1 && t.from <= state.doc.lines) marks.push(commentedLineMarker.range(state.doc.line(t.from).from));
    });
  const sel = state.selection.main;
  if (!sel.empty) {
    const a = state.doc.lineAt(sel.from).number;
    const b = state.doc.lineAt(sel.to).number;
    for (let n = a; n <= b; n++) marks.push(selectedLineMarker.range(state.doc.line(n).from));
  }
  // Decoration/marker sets want document order.
  marks.sort((x, y) => x.from - y.from);
  return RangeSet.of(marks, true);
});

class CommentMarker extends GutterMarker {
  constructor(count, isOpen, range) {
    super();
    this.count = count;
    this.isOpen = isOpen;
    this.range = range;
  }
  eq(other) {
    return other.count === this.count && other.isOpen === this.isOpen && other.range === this.range;
  }
  toDOM() {
    const el = document.createElement("div");
    el.className = `cm-sv-cmark${this.isOpen ? " is-open" : ""}`;
    el.textContent = this.count > 1 ? `💬${this.count}` : "💬";
    el.title = `${this.count} comment${this.count === 1 ? "" : "s"} on ${this.range} — click to read`;
    return el;
  }
}

// The 💬 column. Only ever drawn when comments are ON, so a file you're just reading is just a file.
const commentGutter = gutter({
  class: "cm-sv-cgutter",
  lineMarker(view, block) {
    const st = view.state.field(commentField, false);
    if (!st || !st.on || !st.threads.length) return null;
    const n = view.state.doc.lineAt(block.from).number;
    // On the run's FIRST line — one mark per thread, not one per line of it.
    const mine = st.threads.filter((t) => t.from === n);
    if (!mine.length) return null;
    const count = mine.reduce((k, t) => k + (t.replies || []).length, 0);
    const open = mine.some((t) => st.open.has(t.id));
    return new CommentMarker(count, open, rangeLabel(mine[0].from, mine[0].to));
  },
  // The same cache rule the change gutter learned the hard way: without this it renders its spacer
  // and nothing else, forever.
  lineMarkerChange: (update) =>
    update.startState.field(commentField, false) !== update.state.field(commentField, false),
  initialSpacer: () => new CommentMarker(1, false, "1"),
  domEventHandlers: {
    mousedown(view, block, e) {
      const st = view.state.field(commentField, false);
      if (!st || !st.on) return false;
      const n = view.state.doc.lineAt(block.from).number;
      const mine = st.threads.filter((t) => t.from === n);
      if (!mine.length) return false;
      e.preventDefault();
      view.dispatch({ effects: mine.map((t) => toggleThread.of(t.id)) });
      return true;
    },
  },
});

// `readOnly` is for the file EMBEDDED in a document: the stripes, the panel a stripe opens and the
// per-run staging all still work — those are git moves, not edits — but the text can't be typed
// into, because scrolling past a file in something you're reading shouldn't be a chance to change
// it by accident.
// SEARCH THAT ALSO TRACES CODE (his design, and the point of it is that it is ONE thing). The term
// lives in the pane; the editor marks every hit in the document and tells the ruler where they are.
// A hit that LOOKS LIKE A DEFINITION is marked differently and is what the jump aims at — no index,
// no parser, nothing to go stale: when the guess is wrong the honest list of hits is still right.
const setSearch = StateEffect.define();
// Where the hits are, and what each one IS — declaration, import (including a destructured one that
// spans lines), a plain use, or a word inside a string. The judging lives in codeNav.js so the pane's
// trace button and these marks can't drift apart.
const searchField = StateField.define({
  create: () => ({ term: "", hits: [], deco: Decoration.none }),
  update(cur, tr) {
    let term = cur.term;
    for (const e of tr.effects) if (e.is(setSearch)) term = e.value || "";
    if (!tr.docChanged && term === cur.term) return cur;
    if (!term) return { term: "", hits: [], deco: Decoration.none };
    const text = tr.state.doc.toString();
    const blocks = importBlocks(text);
    const re = new RegExp(`\\b${escapeRe(term)}\\b`, "g");
    const marks = [];
    const hits = [];
    let m;
    while ((m = re.exec(text))) {
      const line = tr.state.doc.lineAt(m.index);
      const info = classifyHit(text, blocks, term, m.index, line.text, m.index - line.from);
      const def = info.kind === "decl" || info.kind === "import";
      hits.push({
        from: m.index,
        to: m.index + m[0].length,
        line: line.number,
        def,
        kind: info.kind,
        spec: info.spec,
        name: info.name,
        word: info.word,
        str: !!info.str,
      });
      marks.push(
        Decoration.mark({
          class: `cm-sv-hit${def ? " cm-sv-hit--def" : ""}${info.str ? " cm-sv-hit--str" : ""}`,
        }).range(m.index, m.index + m[0].length),
      );
      if (m.index === re.lastIndex) re.lastIndex += 1; // paranoia against a zero-width match
    }
    return { term, hits, deco: Decoration.set(marks, true) };
  },
  provide: (f) => EditorView.decorations.from(f, (v) => v.deco),
});

// CLICK AN IMPORT, OPEN THAT FILE — the first of the three "navigate like an editor" jobs and the
// only cheap one: the path is already a string in the source, and this app already opens a file by
// path. No parser, no index. RELATIVE PATHS ONLY: a bare package name means node_modules, which the
// tree deliberately doesn't carry, and a link that opens nothing is worse than no link.
// `from "x"`, `require("x")`, `import("x")` — and the bare side-effect form `import "./styles.scss"`,
// which has no `from` and is exactly the line you click most in this codebase.
const IMPORT_RE = /(?:\bfrom\s*|\brequire\s*\(\s*|\bimport\s*\(\s*|\bimport\s+)(['"])([^'"\n]+)\1/g;
const importMarks = new MatchDecorator({
  regexp: IMPORT_RE,
  decorate: (add, from, _to, m) => {
    const spec = m[2];
    if (!/^[./]/.test(spec)) return; // bare specifier — nothing to open
    const at = from + m[0].indexOf(`${m[1]}${spec}${m[1]}`) + 1;
    add(
      at,
      at + spec.length,
      Decoration.mark({ class: "cm-sv-import", attributes: { title: `Open ${spec}` } }),
    );
  },
});
const importLinks = ViewPlugin.fromClass(
  class {
    constructor(view) {
      this.decorations = importMarks.createDeco(view);
    }
    update(u) {
      this.decorations = importMarks.updateDeco(u, this.decorations);
    }
  },
  { decorations: (v) => v.decorations },
);

const CodeEditor = ({
  value = "",
  language = "markdown",
  onChange,
  dark = false,
  focusLines = null,
  changeMarks = null,
  hunks = null,
  onStageHunk = null,
  readOnly = false,
  // RFC-034 — the file's threads, whether they're showing, and what to do when one is written.
  comments = null,
  commentsOn = false,
  onComment = null,
  commentDraft = null,
  commentCompose = null,
  // WHICH comments are open, held by the pane — editor state is rebuilt on a theme change and this
  // must not be what a dark/light flip throws away.
  commentOpen = null,
  onToggleComment = null,
  // The pane's own right-click over the code: it gets the selected line range, because "comment on
  // 57-64" is a thing only the pane can offer (it owns the menu and the store).
  onCodeMenu = null,
  // Clicking an import path hands the SPECIFIER up — resolving it against the file's own folder and
  // opening it belongs to whoever owns the files, not to the editor.
  onOpenPath = null,
  // The live search term, the tally handed back (so the pane can say "14 here"), and the word you
  // clicked — the pane owns the box, the editor owns the document.
  search = "",
  onSearchHits = null,
  onWordClick = null,
}) => {
  const host = useRef(null);
  const viewRef = useRef(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  // The menu handler goes in a ref for the same reason the stage handler went into editor STATE:
  // the extension is built once and would otherwise close over the first render's callback.
  const onCodeMenuRef = useRef(onCodeMenu);
  const onOpenPathRef = useRef(onOpenPath);
  onOpenPathRef.current = onOpenPath;
  const onWordClickRef = useRef(onWordClick);
  onWordClickRef.current = onWordClick;
  const onSearchHitsRef = useRef(onSearchHits);
  onSearchHitsRef.current = onSearchHits;
  onCodeMenuRef.current = onCodeMenu;
  const onToggleCommentRef = useRef(onToggleComment);
  onToggleCommentRef.current = onToggleComment;

  // Build the editor once per (language, theme); external value changes sync via a separate effect so
  // typing never tears down the view (which would drop the cursor).
  useEffect(() => {
    if (!host.current) return undefined;
    const listener = EditorView.updateListener.of((v) => {
      if (v.docChanged && onChangeRef.current) onChangeRef.current(v.state.doc.toString());
    });
    // DRAG THE NUMBERS TO PICK A RUN — his ask, and it does NOT come for free: CodeMirror's line
    // number gutter has no drag-select, so dragging it only made the BROWSER select the gutter's own
    // digits. That looked like a selection and was worth nothing to the menu, which is why picking a
    // range appeared broken while selecting the code worked.
    // The range the pointer means: the SELECTION when the pointer is inside it, otherwise the one
    // line under the pointer. Shared by both right-click paths so the numbers and the code can't
    // disagree about what you just picked.
    const rangeFor = (view, lineNo) => {
      const sel = view.state.selection.main;
      const from = view.state.doc.lineAt(sel.from).number;
      const to = view.state.doc.lineAt(sel.to).number;
      return sel.empty || lineNo < from || lineNo > to ? { from: lineNo, to: lineNo } : { from, to };
    };
    const numberDrag = lineNumbers({
      domEventHandlers: {
        mousedown(view, block, e) {
          // Same rule as in the content: a right-click must not collapse the run you just picked.
          if (e.button === 2) {
            e.preventDefault();
            return true;
          }
          if (e.button !== 0) return false;
          const start = view.state.doc.lineAt(block.from).number;
          // THE 💬 IS A BUTTON. It's drawn into the number itself, so its hit area is the left end of
          // that cell — click it and this line's comment opens or closes. (The top button opens all
          // of them; it was never supposed to be the only way in, and it never hides these.)
          const st = view.state.field(commentField, false);
          const mine = st && st.threads.filter((t) => t.from === start);
          if (mine && mine.length && onToggleCommentRef.current) {
            const box = e.currentTarget ? e.currentTarget.getBoundingClientRect() : block;
            const iconZone = box.left != null ? e.clientX - box.left < 16 : true;
            if (iconZone) {
              e.preventDefault();
              mine.forEach((t) => onToggleCommentRef.current(t.id));
              return true;
            }
          }
          const select = (a, b) => {
            const doc = view.state.doc;
            const lo = Math.max(1, Math.min(a, b));
            const hi = Math.min(doc.lines, Math.max(a, b));
            view.dispatch({ selection: { anchor: doc.line(lo).from, head: doc.line(hi).to } });
          };
          select(start, start);
          const left = view.contentDOM.getBoundingClientRect().left + 4;
          const move = (ev) => {
            const pos = view.posAtCoords({ x: left, y: ev.clientY });
            if (pos != null) select(start, view.state.doc.lineAt(pos).number);
          };
          const up = () => {
            window.removeEventListener("mousemove", move);
            window.removeEventListener("mouseup", up);
          };
          window.addEventListener("mousemove", move);
          window.addEventListener("mouseup", up);
          e.preventDefault();
          return true;
        },
      },
    });
    const ext = [
      numberDrag,
      selectedLineNumbers,
      history(),
      keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
      // ⌃D SEARCHES WHAT YOU ARE LOOKING AT — the keyboard half of the ⌘-click below, and the way
      // a search actually starts: highlight a name, press it, the box is already filled and focused.
      // With nothing selected it takes the word under the cursor, so it works from a bare caret too.
      // Highest precedence because the default (emacs) keymap spends Ctrl-D on delete-forward.
      Prec.highest(
        keymap.of(
          ["Ctrl-d", "Mod-d"].map((key) => ({
            key,
            run(view) {
              if (!onWordClickRef.current) return false;
              const { from, to } = view.state.selection.main;
              let word = from === to ? "" : view.state.doc.sliceString(from, to).trim();
              if (!word) {
                const line = view.state.doc.lineAt(from);
                const col = from - line.from;
                word = `${line.text.slice(0, col).match(/[\w$]*$/)[0]}${line.text.slice(col).match(/^[\w$]*/)[0]}`;
              }
              if (!word || /\n/.test(word)) return false;
              onWordClickRef.current(word, { focus: true });
              return true;
            },
          })),
        ),
      ),
      EditorView.lineWrapping,
      focusRangeField, // the visible line-range mark (see above)
      changeMarkField, // the vs-HEAD stripe down the edge
      hunkField, // what each stripe replaced, and which are open
      stripeClicks, // the stripe itself is the click target — no second gutter
      commentField, // RFC-034 — the file's comments and the one being written
      importLinks, // the import paths, marked as the links they already are
      searchField, // the term's hits, and which of them look like the definition
      EditorView.domEventHandlers({
        // OPEN WHAT THE PATH POINTS AT. On the mark itself, so ordinary clicking still puts the
        // cursor where you clicked everywhere else in the file.
        mousedown(e, view) {
          // ⌘/⌥-CLICK A NAME hands the word up: the pane puts it in the search box and the strip
          // fills with every place it lives. A plain click still just puts the cursor down — this is
          // the gesture your hands already have from an editor.
          if ((e.metaKey || e.altKey) && onWordClickRef.current && !e.target.closest(".cm-sv-import")) {
            const pos = view.posAtCoords({ x: e.clientX, y: e.clientY });
            if (pos != null) {
              const line = view.state.doc.lineAt(pos);
              const col = pos - line.from;
              const before = line.text.slice(0, col).match(/[\w$]*$/)[0];
              const after = line.text.slice(col).match(/^[\w$]*/)[0];
              const word = `${before}${after}`;
              if (word && !/^\d/.test(word)) {
                e.preventDefault();
                e.stopPropagation();
                onWordClickRef.current(word);
                return true;
              }
            }
          }
          // CLOSEST, NOT THE TARGET ITSELF. The syntax highlighter wraps its own span INSIDE the
          // mark, so the thing under the pointer is the colour span and a `classList.contains` on
          // the target matches nothing — the click silently did nothing at all.
          const el = e.target && e.target.closest && e.target.closest(".cm-sv-import");
          if (!el) return false;
          if (!onOpenPathRef.current) return false;
          e.preventDefault();
          e.stopPropagation();
          onOpenPathRef.current(el.textContent);
          return true;
        },
      }),
      EditorView.domEventHandlers({
        // A RIGHT-CLICK MUST NOT EAT THE SELECTION. CodeMirror moves the cursor on mousedown for any
        // button, so selecting 57-64 and right-clicking it collapsed the range a frame before the
        // menu asked what was selected — and the menu could only ever offer one line. His report:
        // "I thought I was supposed to be able to choose a range."
        mousedown(e) {
          if (e.button === 2) {
            e.preventDefault();
            return true;
          }
          return false;
        },
      }),
      listener,
    ];
    if (readOnly) ext.push(EditorView.editable.of(false), EditorState.readOnly.of(true));
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
    // ONE MENU, AND IT OPENS ANYWHERE IN THE FILE. `EditorView.domEventHandlers` only ever sees the
    // content, and a gutter handler only its own column — which left dead zones (the gap beside the
    // numbers, the stripe edge) where right-clicking did nothing at all. This sits on the editor
    // root, resolves the line from Y alone, and is the only context menu in here.
    const onMenu = (e) => {
      if (!onCodeMenuRef.current) return;
      const left = view.contentDOM.getBoundingClientRect().left + 4;
      const pos = view.posAtCoords({ x: left, y: e.clientY });
      if (pos == null) return;
      e.preventDefault();
      e.stopPropagation();
      onCodeMenuRef.current(e, rangeFor(view, view.state.doc.lineAt(pos).number));
    };
    view.dom.addEventListener("contextmenu", onMenu);
    return () => {
      view.dom.removeEventListener("contextmenu", onMenu);
      view.destroy();
      viewRef.current = null;
    };
  // value intentionally excluded — synced below without a rebuild
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, dark, readOnly]);

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

  // The threads, on the same terms: keyed on their CONTENT, so a reply lands without the pane
  // having to hand back a new array identity for every keystroke elsewhere.
  const commentKey = JSON.stringify([comments || [], commentOpen || []]);
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: [
        setComments.of({ threads: comments || [], on: !!commentsOn, openIds: commentOpen || [] }),
        setCommentHandlers.of(onComment || null),
      ],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commentKey, commentsOn, language, dark, onComment]);

  // Opening the composer is the PANE's move (a menu item, a button) but the widget lives in here —
  // so it's a PROP, like everything else, rather than an imperative handle reaching in.
  const draftKey = commentDraft ? `${commentDraft.from}-${commentDraft.to}-${commentDraft.record ? 1 : 0}` : "";
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ effects: setDraft.of(commentDraft || null) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey, language, dark]);

  // …and which thread is being replied to, by the same route.
  const composeKey = commentCompose ? `${commentCompose.id}-${commentCompose.record ? 1 : 0}` : "";
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ effects: composeIn.of(commentCompose || null) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [composeKey, language, dark]);

  // HOLD ⌘ AND THE CODE SAYS IT IS CLICKABLE. Without it the gesture is invisible — you have to
  // already know it exists. Whole content, not just the word under the pointer: the promise is
  // "clicking a name navigates now", and that is true of every name on screen.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return undefined;
    const on = (e) => {
      if (e.metaKey || e.altKey) view.dom.classList.add("cm-sv-cmd");
      else view.dom.classList.remove("cm-sv-cmd");
    };
    const off = () => view.dom.classList.remove("cm-sv-cmd");
    window.addEventListener("keydown", on);
    window.addEventListener("keyup", on);
    // Leaving the window while holding it would strand the cursor as a pointer forever.
    window.addEventListener("blur", off);
    return () => {
      window.removeEventListener("keydown", on);
      window.removeEventListener("keyup", on);
      window.removeEventListener("blur", off);
      off();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, dark, readOnly]);

  // The term goes IN as an effect; the tally comes back OUT so the pane's box can say how many are
  // in this file without counting them a second time.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ effects: setSearch.of(search || "") });
    const st = view.state.field(searchField, false);
    if (onSearchHitsRef.current) onSearchHitsRef.current(st ? st.hits : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, value, language, dark, readOnly]);

  // GETTING TO THE CHANGES — a tick per changed run down the right edge, and ‹ n/m › to walk them
  // in order. His ask, and his pick out of four: "the ruler + arrows". It lives HERE rather than in
  // the pane's header because a file embedded in a document is this same editor, so both surfaces
  // get it without a second implementation to keep in step.
  //
  // Built as plain DOM appended beside CodeMirror's own element: React renders an empty host and CM
  // owns the subtree it creates, so a sibling node is the one place a React child can't go.
  const hunkKey = hunks ? hunks.map((h) => `${h.from}-${h.to}${h.kind || ""}${h.staged ? "s" : ""}`).join(",") : "";
  useEffect(() => {
    const view = viewRef.current;
    const el = host.current;
    if (!view || !el) return;
    const runs = (hunks || []).slice().sort((a, b) => a.from - b.from);
    // The search rides the SAME strip — his ask, and the reason the strip earns its place: one
    // column that says where everything worth looking at is. One tick per line, not per hit, or a
    // word used four times on one line draws four marks on top of each other.
    const st = view.state.field(searchField, false);
    const byLine = new Map();
    ((st && st.hits) || []).forEach((h) => {
      const cur = byLine.get(h.line);
      if (!cur || (h.def && !cur.def)) byLine.set(h.line, h);
    });
    const found = [...byLine.values()].sort((a, b) => a.line - b.line);
    const ruler = document.createElement("div");
    ruler.className = "cm-sv-ruler";
    const steps = document.createElement("div");
    steps.className = "cm-sv-steps";
    if (!runs.length && !found.length) return; // nothing to point at: no strip, no furniture
    let at = -1; // which run we're standing on — -1 until you use it

    const centre = (a, b) => {
      const total = view.state.doc.lines;
      const from = view.state.doc.line(Math.min(Math.max(1, a), total)).from;
      const to = view.state.doc.line(Math.min(Math.max(1, b), total)).to;
      view.dispatch({ selection: { anchor: from, head: to }, effects: setFocusRange.of([a, b]) });
      // Same multi-pass centring the `#L40-70` jump uses — one pass lands short while CodeMirror is
      // still estimating the heights of lines it hasn't drawn.
      let passes = 0;
      const pass = () => {
        const h = view.scrollDOM.clientHeight;
        if (h) {
          const mid = (view.lineBlockAt(from).top + view.lineBlockAt(to).bottom) / 2;
          const max = Math.max(0, view.scrollDOM.scrollHeight - h);
          view.scrollDOM.scrollTop = Math.max(0, Math.min(max, mid - h / 2));
        }
        if (++passes < 6) requestAnimationFrame(pass);
      };
      pass();
    };

    const ticks = [];
    const draw = () => {
      ticks.forEach((t, i) => t.classList.toggle("cm-sv-tick--on", i === at));
      if (steps.firstChild) steps.firstChild.textContent = `${at < 0 ? "–" : at + 1}/${runs.length}`;
    };
    const go = (i) => {
      at = (i + runs.length) % runs.length; // wraps, so the arrows never dead-end
      centre(runs[at].from, runs[at].to);
      draw();
    };
    // LETTING GO OF ONE. The selected tick stays wide, and a mark you can turn on but not off is a
    // mark that ends up permanently on — his catch. Two ways out, both the obvious ones: press the
    // same tick again, or click back into the file.
    const clear = () => {
      if (at < 0) return;
      at = -1;
      draw();
    };

    const total = Math.max(1, view.state.doc.lines);
    runs.forEach((h, i) => {
      const t = document.createElement("i");
      // Colour says WHAT happened, exactly as the stripe on the line does — a tick is that stripe
      // seen from across the file, so it cannot speak a different language.
      const kind = h.kind === "added" || h.kind === "removed" ? h.kind : "changed";
      t.className = `cm-sv-tick cm-sv-tick--${kind}${h.staged ? " cm-sv-tick--staged" : ""}`;
      // Position AND SIZE by LINE, not by pixels: pixel heights aren't known for lines CodeMirror
      // hasn't drawn yet, and a ruler that shifts as you scroll is worse than no ruler. The height
      // is the run's share of the file, so a long block looks long ("is it sizing to the number of
      // lines?" — it is now).
      const span = Math.max(1, h.to - h.from + 1);
      t.style.top = `${((h.from - 1) / total) * 100}%`;
      t.style.height = `${(span / total) * 100}%`;
      const where = h.from === h.to ? `line ${h.from}` : `lines ${h.from}-${h.to} (${span})`;
      t.title = `${kind} — ${where}${h.staged ? " · staged" : ""}`;
      t.addEventListener("mousedown", (e) => {
        e.preventDefault(); // keep the editor's own selection out of it
        e.stopPropagation();
        if (at === i) clear();
        else go(i);
      });
      ticks.push(t);
      ruler.appendChild(t);
    });

    // The hits, on the inside edge of the strip so they never sit on top of a change.
    found.forEach((h) => {
      const t = document.createElement("i");
      t.className = `cm-sv-tick cm-sv-tick--hit${h.def ? " cm-sv-tick--hitdef" : ""}`;
      t.style.top = `${((h.line - 1) / total) * 100}%`;
      t.title = `${h.def ? "defined" : "used"} on line ${h.line}`;
      t.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        centre(h.line, h.line);
      });
      ruler.appendChild(t);
    });

    const label = document.createElement("span");
    label.textContent = `–/${runs.length}`;
    const prev = document.createElement("button");
    prev.type = "button";
    prev.textContent = "‹";
    prev.title = "Previous change (⌥↑)";
    const next = document.createElement("button");
    next.type = "button";
    next.textContent = "›";
    next.title = "Next change (⌥↓)";
    prev.addEventListener("mousedown", (e) => {
      e.preventDefault();
      go(at < 0 ? runs.length - 1 : at - 1);
    });
    next.addEventListener("mousedown", (e) => {
      e.preventDefault();
      go(at < 0 ? 0 : at + 1);
    });
    if (runs.length) steps.append(label, prev, next);

    // ⌥↓ / ⌥↑ — the keyboard half, on the editor's own dom so it only fires while you're in the file.
    const onKey = (e) => {
      if (!runs.length) return;
      if (!e.altKey || (e.key !== "ArrowDown" && e.key !== "ArrowUp")) return;
      e.preventDefault();
      if (e.key === "ArrowDown") go(at < 0 ? 0 : at + 1);
      else go(at < 0 ? runs.length - 1 : at - 1);
    };
    view.dom.addEventListener("keydown", onKey);
    // Clicking back into the file lets go of the tick too — you are reading the code again, not
    // standing on a change. Bound on the HOST, capture phase, above CodeMirror entirely: listeners
    // put on the content or the scroller never ran, because CodeMirror gets those events first and
    // does not pass them on. The ruler is a child of the host too, so its own clicks are excluded
    // rather than the tick clearing itself the instant it selects.
    const clickAway = (e) => {
      if (ruler.contains(e.target) || steps.contains(e.target)) return;
      clear();
    };
    el.addEventListener("mousedown", clickAway, true);

    el.appendChild(ruler);
    el.appendChild(steps);
    return () => {
      view.dom.removeEventListener("keydown", onKey);
      el.removeEventListener("mousedown", clickAway, true);
      ruler.remove();
      steps.remove();
    };
    // Rebuilt when the runs change (a save, a stage) or the editor itself is rebuilt (theme/language).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hunkKey, search, value, language, dark, readOnly]);

  // RFC-025 — `:file[path#L40-70]` opens the file AT a range. Select the lines and center them by
  // setting the editor's OWN scroller only. Never scrollIntoView: it walks up the DOM and scrolls
  // every scrollable ancestor, which is what used to yank a whole story to the middle.
  const focusKey = focusLines ? focusLines.join("-") : "";
  // WHY NOT `value`: this effect used to re-run on every change to the document, so with a range in
  // the URL (`?flines=29-29`, set by a `:file[path#L29]` chip or a click on the change ruler) EVERY
  // KEYSTROKE re-selected those lines and scrolled you back to them. His report: "anytime I edit a
  // file, some feature navigates me to the middle of the file." A focus range is a thing to honour
  // when it ARRIVES and when the document arrives — not something to re-apply while he types.
  const hasDoc = !!value;
  useEffect(() => {
    const view = viewRef.current;
    // LETTING GO IS ALSO A STATE. Setting a range marked the lines; clearing it did nothing at all,
    // because this effect only ever ran when there WAS a range — so the marks he was trying to
    // dismiss stayed on screen after the chip had gone.
    if (view && (!focusLines || !focusLines[0])) {
      view.dispatch({ effects: setFocusRange.of(null) });
      return;
    }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey, hasDoc]);

  return <div className={`code-editor ${dark ? "code-editor--dark" : ""}`} ref={host} />;
};

export default CodeEditor;
