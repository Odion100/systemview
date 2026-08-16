import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { dracula } from "react-syntax-highlighter/dist/cjs/styles/prism";
import remarkGfm from "remark-gfm";
import remarkDirective from "remark-directive";
import remarkSvBlocks from "./directives";
import {
  MarkdownScopeProvider,
  MarkdownWriteProvider,
  MarkdownCommentsProvider,
  useMarkdownWrite,
  useInThread,
} from "./context";
import { useComments } from "./comments";
import { expectThread } from "./threadFocus";
import { namespaceOptions, testOptions, fileOptions, TEMPLATES } from "./menuOptions";
import ServiceContext from "../../ServiceContext";
import BLOCKS from "./registry";

import "./styles.scss";

// RFC-025 — this atom is the ONE renderer behind every markdown surface in the app: the
// Documentation tab, help topics, story markdown panes, story .md file panes, agent notes on test
// panes, and the codebase md preview. A block registered here appears in all of them at once.
//
// `scope`          — where the document is being read from (a story pane knows its target service);
//                    without it, blocks fall back to the /specs/… URL. See context.js.
// `onSourceChange` — the WRITE path. §4.6: the document is the source of truth, so an interactive
//                    block edits the markdown it came from. A surface that can save (the doc tab via
//                    saveDoc, a file pane via writeFile) passes this; one that can't (help topics
//                    are a code registry) passes nothing, and its checkboxes stay read-only.

// Rewrite one attribute inside a directive's `{…}` on a given source line. Used by input blocks so
// an answer lands in the document rather than in some parallel store (RFC-025 §4.6).
function setDirectiveAttr(source, line, key, value) {
  const lines = String(source).split("\n");
  const i = line - 1;
  if (i < 0 || i >= lines.length) return null;
  const row = lines[i];
  const braces = row.match(/\{([^}]*)\}/);
  // A null value REMOVES the attribute — un-answering a question has to leave the document looking
  // unanswered, not carrying `answer=` with nothing after it.
  if (value == null) {
    if (!braces) return null;
    const re = new RegExp(`(^|\\s)${key}=("[^"]*"|'[^']*'|[^\\s}]*)`);
    if (!re.test(braces[1])) return null;
    const inner = braces[1].replace(re, "").trim();
    const rebuilt = inner ? `{${inner}}` : "";
    const next2 = row.slice(0, braces.index) + rebuilt + row.slice(braces.index + braces[0].length);
    if (next2 === row) return null;
    lines[i] = next2;
    return lines.join("\n");
  }
  const pair = `${key}=${/[\s"']/.test(String(value)) ? JSON.stringify(String(value)) : value}`;
  let next;
  if (!braces) {
    next = `${row}{${pair}}`;
  } else {
    const inner = braces[1];
    const re = new RegExp(`(^|\\s)${key}=("[^"]*"|'[^']*'|[^\\s}]*)`);
    const updated = re.test(inner) ? inner.replace(re, `$1${pair}`) : `${inner} ${pair}`.trim();
    next = row.slice(0, braces.index) + `{${updated}}` + row.slice(braces.index + braces[0].length);
  }
  if (next === row) return null;
  lines[i] = next;
  return lines.join("\n");
}

// Every directive lands here as one element; the registry decides what it becomes.
const SvBlock = ({ dname, dtype, dattrs, dlabel, dline, dend, dsrc, children }) => {
  const attrs = useMemo(() => {
    try {
      return JSON.parse(dattrs || "{}") || {};
    } catch {
      return {};
    }
  }, [dattrs]);
  const entry = BLOCKS[dname];
  if (!entry) {
    // Unknown block: SAY so, and say WHAT. A document written against a newer vocabulary must never
    // silently lose a paragraph in an older UI (RFC-025 §8).
    return (
      <span
        className="md-chip md-chip--unknown"
        title={`"${dname}" isn't a block this version of SystemView knows — it may need an upgrade, or the name may be a typo.`}
      >
        <span className="md-chip__kind">unknown block</span>
        {dname}
      </span>
    );
  }
  const Component = entry.Component;
  const block = (
    <Component name={dname} kind={dtype} attrs={attrs} label={dlabel} line={dline} src={dsrc}>
      {children}
    </Component>
  );
  // An inline directive (`:ns[…]`) sits INSIDE a paragraph — its paragraph already carries the range,
  // and wrapping it in a div would break the line. A leaf or container block gets its own range, so
  // the document menu can target the block itself: "remove this thread", "insert after this chart".
  if (dtype === "inline" || !dline) return block;
  return (
    // `data-md-id` is the block's OWN id (`::question{id=pick}`) — the only stable address for one
    // block among several of the same kind, and the one thing a namespace or a file line-range
    // genuinely cannot express. It's what lets an agent point INSIDE an open document.
    <div
      className="md-block"
      data-md-start={dline}
      data-md-end={dend || dline}
      data-md-name={dname}
      data-md-kind={dtype}
      data-md-id={attrs.id || undefined}
    >
      {block}
    </div>
  );
};

// GFM already has checklist syntax, so a checklist needs NO new storage: toggling one rewrites the
// `- [ ]` on that source line and hands the whole document back to the surface to save. The line
// number comes from the mdast node's position, which is why this lives here and not in a block.
function toggleTaskLine(source, line) {
  const lines = String(source).split("\n");
  const i = line - 1;
  if (i < 0 || i >= lines.length) return null;
  const next = lines[i].replace(/^(\s*(?:[-*+]|\d+[.)])\s+)\[([ xX])\]/, (m, lead, mark) =>
    `${lead}[${mark === " " ? "x" : " "}]`
  );
  if (next === lines[i]) return null;
  lines[i] = next;
  return lines.join("\n");
}

// The margin affordance: hover any block in a document that can be saved and a 💬+ appears beside it;
// click and that block is wrapped in a thread, ready for your reply. This is what makes commenting
// something you do WHILE READING instead of a thing you have to plan — you don't have to decide in
// advance which paragraphs deserve a wrapper.
//
// It wraps by SOURCE LINE RANGE, which every rendered element carries (`node.position` survives the
// mdast→hast conversion). Only top-level blocks get the affordance: `position.start.column === 1`
// means "not nested inside a list item or another container", which keeps the margin quiet.
const Commentable = ({ node, tag: Tag, children, ...props }) => {
  const { threadable } = useMarkdownWrite();
  const inThread = useInThread();
  const pos = node && node.position;
  const canWrap =
    threadable && !inThread && pos && pos.start && pos.end && pos.start.column === 1 && pos.start.line;
  // THE LINE RANGE IS AN ADDRESS, NOT AN AFFORDANCE. The wrapper below is what makes a block
  // threadable; the range is what lets anything POINT at it — pointing at lines in a document has
  // to work on one you are only reading, which is most of them. So an unwrapped block carries the
  // range on the element itself.
  const addressable = pos && pos.start && pos.end && pos.start.column === 1 && pos.start.line;
  const lineAttrs =
    addressable && !canWrap ? { "data-md-start": pos.start.line, "data-md-end": pos.end.line } : {};
  // Void elements (hr) must not receive children — React hard-errors on it.
  const el =
    Tag === "hr" ? <Tag {...props} {...lineAttrs} /> : <Tag {...props} {...lineAttrs}>{children}</Tag>;
  if (!canWrap) return el;
  return (
    // The line range rides the DOM as data — that's how the right-click menu knows which block you
    // aimed at without React having to track the pointer. No hover 💬 in the margin anymore (his
    // call: an invisible corner button pushing left space, when right-click already starts threads).
    <div className="md-commentable" data-md-start={pos.start.line} data-md-end={pos.end.line}>
      {el}
    </div>
  );
};

// The right-click menu over a document. Everything it offers is an EDIT TO THE MARKDOWN — start a
// thread here, drop a block in below — because the document is the state; there is no side channel a
// menu could write to instead. It only appears where the surface can save, and it names the block you
// aimed at so you know what "here" means.
// Items that need no target write themselves; the rest open a DRAWER that asks the one question the
// block needs. `drawer` names the option list, `template` the block it writes.
// WRAPPERS go AROUND the block you right-clicked — that's what a container directive is for, and
// "insert an empty callout below" was never the thing you wanted from one.
const WRAPS = [
  { label: "Approval", open: ':::approval{ask="Approve this?"}' },
  { label: "Callout", open: ":::callout{type=info}" },
  { label: "Fold", open: ':::details{summary="Click to open"}' },
];

const INSERTS = [
  { label: "Question", text: "::question[Ask something]{options=yes|no}" },
  { label: "Checklist", text: "- [ ] first thing\n- [ ] second thing" },
  { label: "Runnable steps", drawer: "run" },
  { label: "Saved test", drawer: "test" },
  { label: "Logs", drawer: "logs" },
  { label: "Chart", drawer: "chart" },
  { label: "File", drawer: "file" },
  { label: "Diff", drawer: "diff" },
];

const DRAWER_TITLE = {
  run: "Which method should the steps call?",
  test: "Which saved test?",
  logs: "Logs for which namespace?",
  chart: "Which report?",
  file: "Which file?",
  diff: "Which changed file?",
};

// One drawer: the options for a block that needs a target, filtered as you type. It lives inside the
// menu rather than replacing it, so picking is one gesture and Back is always there.
const Drawer = ({ name, options, loading, onPick, onBack }) => {
  const [q, setQ] = useState("");
  const shown = options.filter((o) => !q || o.label.toLowerCase().includes(q.toLowerCase())).slice(0, 60);
  return (
    <>
      <button type="button" className="md-menu__back" onClick={onBack}>
        ‹ Back
      </button>
      <div className="md-menu__head">{DRAWER_TITLE[name] || "Pick one"}</div>
      <input
        className="md-menu__filter"
        autoFocus
        placeholder="filter…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onClick={(e) => e.stopPropagation()}
      />
      <div className="md-menu__list">
        {loading ? (
          <div className="md-menu__note">loading…</div>
        ) : !shown.length ? (
          <div className="md-menu__note">{options.length ? "nothing matches" : "nothing to pick — is a service connected?"}</div>
        ) : (
          shown.map((o) => (
            <button key={o.value} type="button" className="md-menu__item" onClick={() => onPick(o.value)}>
              {o.label}
              {o.kind ? <span className="md-menu__tag">{o.kind}</span> : null}
            </button>
          ))
        )}
      </div>
    </>
  );
};

const DocMenu = ({ at, onPick, onClose, canThread, openDrawer, drawer }) => {
  const [armed, setArmed] = useState(false); // two-step confirm on removal
  const rootRef = useRef(null);
  useEffect(() => {
    const inside = (e) => rootRef.current && e.target instanceof Node && rootRef.current.contains(e.target);
    const bye = (e) => {
      // Scrolling the LIST is how you reach the option you want — only a scroll of the page behind
      // the menu should dismiss it. (Capture-phase scroll fired for the drawer's own list too, so
      // the menu closed the instant you tried to scroll it.)
      if (inside(e)) return;
      onClose();
    };
    const esc = (e) => e.key === "Escape" && onClose();
    window.addEventListener("click", bye);
    window.addEventListener("scroll", bye, true);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("click", bye);
      window.removeEventListener("scroll", bye, true);
      window.removeEventListener("keydown", esc);
    };
  }, [onClose]);
  // Keep it on screen when you right-click near an edge.
  const style = {
    left: Math.min(at.x, window.innerWidth - 210),
    top: Math.min(at.y, window.innerHeight - 330),
  };
  // A drawer takes over the menu body: you're answering its question now, and Back returns.
  if (drawer)
    return (
      <div ref={rootRef} className="md-menu md-menu--drawer" style={style} onClick={(e) => e.stopPropagation()}>
        <Drawer
          name={drawer.name}
          options={drawer.options}
          loading={drawer.loading}
          onBack={() => openDrawer(null)}
          onPick={(value) => onPick({ kind: "insert-from", drawer: drawer.name, value })}
        />
      </div>
    );

  return (
    <div ref={rootRef} className="md-menu" style={style} onClick={(e) => e.stopPropagation()}>
      <div className="md-menu__head">{at.label}</div>
      {/* What you can do depends on WHAT YOU HIT. Inside a thread, the useful verb is removing it;
          on a plain block, starting one; on empty space, there's nothing to wrap — you can still
          insert, which lands at the end of the document. */}
      {at.block && at.block.kind === "container" ? (
        // A WRAPPER comes off without taking anything with it — the content was surrounded, not
        // absorbed — so this needs no confirmation step.
        <button type="button" className="md-menu__item md-menu__item--lead" onClick={() => onPick({ kind: "unwrap-block" })}>
          🗑 Remove this {at.block.name} <span className="md-menu__hint">keeps the content</span>
        </button>
      ) : at.block ? (
        // A LEAF block IS its content, so deleting one is armed first — a stray right-click shouldn't
        // take out the chart you were reading.
        <button
          type="button"
          className={`md-menu__item md-menu__item--lead${armed ? " md-menu__item--armed" : ""}`}
          onClick={() => (armed ? onPick({ kind: "remove" }) : setArmed(true))}
        >
          {armed ? `Really remove this ${at.block.name}?` : `🗑 Remove this ${at.block.name}`}
        </button>
      ) : null}
      {at.thread ? (
        <button type="button" className="md-menu__item md-menu__item--lead" onClick={() => onPick({ kind: "unthread" })}>
          💬 Remove this thread <span className="md-menu__hint">keeps the content</span>
        </button>
      ) : at.start && canThread ? (
        <button type="button" className="md-menu__item md-menu__item--lead" onClick={() => onPick({ kind: "thread" })}>
          💬 Start a thread here
        </button>
      ) : (
        <div className="md-menu__note">
          {at.start ? "Replies need a place to save — none here." : "Nothing to wrap here."}
        </div>
      )}
      {at.start ? (
        <>
          <div className="md-menu__sep">Wrap this in</div>
          {WRAPS.map((w) => (
            <button
              key={w.label}
              type="button"
              className="md-menu__item"
              onClick={() => onPick({ kind: "wrap", open: w.open })}
            >
              {w.label}
            </button>
          ))}
        </>
      ) : null}
      <div className="md-menu__sep">{at.start ? "Insert below" : "Insert at the end"}</div>
      {INSERTS.map((b) => (
        <button
          key={b.label}
          type="button"
          className="md-menu__item"
          onClick={() => (b.drawer ? openDrawer(b.drawer) : onPick({ kind: "insert", text: b.text }))}
        >
          {b.label}
          {b.drawer ? <span className="md-menu__more">›</span> : null}
        </button>
      ))}
    </div>
  );
};

// Remove a CONTAINER wrapper — thread, approval, callout, fold, tabs — keeping everything it
// wrapped. Deleting the two fence lines is the whole operation: the content was never moved INTO the
// block, it was surrounded by it, so removing the block must not remove the writing. (A thread's
// replies also stay in the sidecar under its id — unwrapping is not "delete the conversation".)
export function unwrapContainer(source, startLine, endLine, name) {
  const lines = String(source).split("\n");
  const a = startLine - 1;
  const b = endLine - 1;
  if (a < 0 || b >= lines.length || b <= a) return null;
  const open = name ? new RegExp(`^\\s*:{3,}\\s*${name}\\b`) : /^\s*:{3,}\s*[a-zA-Z]/;
  if (!open.test(lines[a])) return null;
  if (!/^\s*:{3,}\s*$/.test(lines[b])) return null;
  return [...lines.slice(0, a), ...lines.slice(a + 1, b), ...lines.slice(b + 1)].join("\n");
}

export const unwrapThread = (source, startLine, endLine) =>
  unwrapContainer(source, startLine, endLine, "thread");

// Delete a block's own source lines — how you remove one of OUR blocks (a chart, a logs view, a run)
// from a document. Only offered for directive blocks, never for prose: deleting a paragraph by
// right-clicking near it is the kind of easy mistake a document should not make possible.
export function removeLines(source, startLine, endLine) {
  const lines = String(source).split("\n");
  const a = startLine - 1;
  const b = endLine - 1;
  if (a < 0 || b >= lines.length || b < a) return null;
  const rest = [...lines.slice(0, a), ...lines.slice(b + 1)];
  // Don't leave the blank-line pair the block used to sit between.
  if (a > 0 && rest[a - 1] === "" && rest[a] === "") rest.splice(a, 1);
  return rest.join("\n");
}

// Append text INSIDE a container directive, just before its closing fence — how a reply is written
// into the thread it belongs to. Finds the matching close by counting nested opens, so a thread
// holding tabs or a callout still gets its reply in the right place.
export function appendInsideContainer(source, openLine, text) {
  const lines = String(source).split("\n");
  const i = openLine - 1;
  if (i < 0 || i >= lines.length) return null;
  const open = lines[i].match(/^(\s*)(:{3,})(\s*[a-zA-Z].*)$/);
  if (!open) return null;
  // Find the matching close.
  let depth = 0;
  let closeAt = -1;
  for (let n = i; n < lines.length; n++) {
    if (/^\s*:{3,}\s*[a-zA-Z]/.test(lines[n])) depth++;
    else if (/^\s*:{3,}\s*$/.test(lines[n])) {
      depth--;
      if (depth === 0) {
        closeAt = n;
        break;
      }
    }
  }
  if (closeAt < 0) return null;

  const body = [...lines.slice(0, closeAt), ...String(text).split("\n"), ...lines.slice(closeAt)];
  // normalizeFences settles every width in one pass: the thread widens over its new reply, AND any
  // container enclosing the thread (a col, a callout) widens over the thread. The old local widening
  // fixed only the first hop and broke inside columns.
  return normalizeFences(body.join("\n"));
}

// Remove a container that STARTS on this line, fence and contents — used to delete one reply.
export function removeContainerAt(source, openLine) {
  const lines = String(source).split("\n");
  const i = openLine - 1;
  if (i < 0 || i >= lines.length) return null;
  if (!/^\s*:{3,}\s*[a-zA-Z]/.test(lines[i])) return null;
  let depth = 0;
  for (let n = i; n < lines.length; n++) {
    if (/^\s*:{3,}\s*[a-zA-Z]/.test(lines[n])) depth++;
    else if (/^\s*:{3,}\s*$/.test(lines[n])) {
      depth--;
      if (depth === 0) return [...lines.slice(0, i), ...lines.slice(n + 1)].join("\n");
    }
  }
  return null;
}

// Drop a block into the source after a given line, with the blank lines a directive needs to parse.
export function insertAfterLine(source, line, text) {
  const lines = String(source).split("\n");
  const i = Math.min(Math.max(line, 0), lines.length);
  return normalizeFences(
    [...lines.slice(0, i), "", ...String(text).split("\n"), ...lines.slice(i)].join("\n"),
  );
}

// FENCE NORMALIZER — the one rule of container directives is that an outer fence must be LONGER
// than every fence inside it. Writers used to enforce this locally (widen a thread when a reply
// lands) and missed the enclosing containers entirely: starting a thread INSIDE a `:::col` wrote a
// same-length fence, the parser closed the col early, and raw colons leaked into the render. This
// pass rebuilds every container's fence bottom-up (children + 1, min 3) over the whole document, so
// any structurally-sound write comes out consistent no matter how deep it landed. Fences inside
// code blocks are examples, not structure — untouched. An unbalanced document is returned as-is:
// guessing at repair could eat someone's writing.
export function normalizeFences(source) {
  const lines = String(source).split("\n");
  let inCode = false;
  const stack = [];
  const roots = [];
  for (let n = 0; n < lines.length; n++) {
    if (/^\s*(```|~~~)/.test(lines[n])) {
      inCode = !inCode;
      continue;
    }
    if (inCode) continue;
    if (/^\s*:{3,}\s*[a-zA-Z]/.test(lines[n])) {
      const node = { open: n, close: -1, children: [] };
      (stack.length ? stack[stack.length - 1].children : roots).push(node);
      stack.push(node);
    } else if (/^\s*:{3,}\s*$/.test(lines[n])) {
      if (!stack.length) return source; // unbalanced
      stack.pop().close = n;
    }
  }
  if (stack.length || inCode) return source; // unbalanced
  const apply = (node) => {
    let maxChild = 0;
    node.children.forEach((c) => {
      maxChild = Math.max(maxChild, apply(c));
    });
    const len = Math.max(3, maxChild + 1);
    lines[node.open] = lines[node.open].replace(/:{3,}/, ":".repeat(len));
    lines[node.close] = lines[node.close].replace(/:{3,}/, ":".repeat(len));
    return len;
  };
  roots.forEach(apply);
  return lines.join("\n");
}

// Wrap a source LINE RANGE in any container directive — the general form of "start a thread here".
export function wrapLines(source, startLine, endLine, openLine, closeLine = ":::") {
  const lines = String(source).split("\n");
  const a = startLine - 1;
  const b = endLine - 1;
  if (a < 0 || b >= lines.length || b < a) return null;
  return normalizeFences(
    [
      ...lines.slice(0, a),
      openLine,
      ...lines.slice(a, b + 1),
      closeLine,
      "",
      ...lines.slice(b + 1),
    ].join("\n"),
  );
}

// Wrap a source LINE RANGE in a `:::thread{id=…}` container — this is "start a thread here", the
// click affordance in the margin. It's an ordinary document edit, not a new store: the wrapper lands
// in the markdown, so the thread travels with the text it's about and any editor sees it.
export function wrapLinesInThread(source, startLine, endLine) {
  const lines = String(source).split("\n");
  const a = startLine - 1;
  const b = endLine - 1;
  if (a < 0 || b >= lines.length || b < a) return null;
  // An id that can't collide with one already in the file, and stays stable once written.
  let n = 1;
  while (source.includes(`id=t${n}`)) n++;
  const before = lines.slice(0, a);
  const body = lines.slice(a, b + 1);
  const after = lines.slice(b + 1);
  // A container directive needs blank lines around it to parse as a block. normalizeFences settles
  // the widths — wrapping inside a columns/col (or any container) widens the enclosing fences.
  return normalizeFences(
    [...before, `:::thread{id=t${n}}`, ...body, ":::", "", ...after].join("\n"),
  );
}

const Markdown = ({ children, dark = false, scope = null, onSourceChange = null, commentKey = null }) => {
  const source = typeof children === "string" ? children : "";
  const editable = typeof onSourceChange === "function";
  const [menu, setMenu] = useState(null); // the right-click menu: {x, y, start, end, label}
  const [drawer, setDrawer] = useState(null); // an open drawer: {name, options, loading}
  const { connectedServices = [] } = useContext(ServiceContext);

  // The handler reads the CURRENT source/callback through a ref, so its identity never changes.
  // Without this the `components` map is rebuilt on every edit, and since React treats a new
  // function as a NEW COMPONENT TYPE, every <li>/<code> subtree unmounts and remounts mid-edit.
  const live = useRef({ source, onSourceChange, editable });
  live.current = { source, onSourceChange, editable };
  const onToggle = useCallback((line) => {
    const { source: src, onSourceChange: save, editable: can } = live.current;
    if (!can) return;
    const next = toggleTaskLine(src, line);
    if (next != null) save(next);
  }, []);

  const setAttr = useCallback((line, key, value) => {
    const { source: src, onSourceChange: save, editable: can } = live.current;
    if (!can || !line) return;
    const next = setDirectiveAttr(src, line, key, value);
    if (next != null) save(next);
  }, []);
  const startThread = useCallback((from, to) => {
    const { source: src, onSourceChange: save, editable: can } = live.current;
    if (!can || !from) return;
    const next = wrapLinesInThread(src, from, to || from);
    if (next == null) return;
    // Whatever id the wrapper just claimed is the one that should open itself.
    const m = next.slice(0).match(/:::thread\{id=(t\d+)\}/g);
    const id = m && m.length ? m[m.length - 1].match(/id=(t\d+)/)[1] : null;
    if (id) expectThread(id);
    save(next);
  }, []);
  // One sidecar read per document, shared by every `:::thread` in it.
  const comments = useComments(commentKey, scope && scope.projectCode);
  // Starting a thread needs BOTH a document to write the wrapper into and a store to keep replies in.
  const threadable = editable && !!commentKey && comments.writable;
  // Writing a reply INTO the thread it belongs to, and deleting one — the document is the store.
  const appendInside = useCallback((openLine, text) => {
    const { source: src, onSourceChange: save, editable: can } = live.current;
    if (!can || !openLine) return;
    const next = appendInsideContainer(src, openLine, text);
    if (next != null) save(next);
  }, []);
  const removeBlock = useCallback((openLine) => {
    const { source: src, onSourceChange: save, editable: can } = live.current;
    if (!can || !openLine) return;
    const next = removeContainerAt(src, openLine);
    if (next != null) save(next);
  }, []);
  const writeApi = useMemo(
    () => ({ editable, setAttr, startThread, threadable, appendInside, removeBlock }),
    [editable, setAttr, startThread, threadable, appendInside, removeBlock]
  );

  const components = useMemo(
    () => ({
      svblock: SvBlock,
      // Every top-level block gets the start-a-thread affordance in its margin.
      p: (p) => <Commentable tag="p" {...p} />,
      h1: (p) => <Commentable tag="h1" {...p} />,
      h2: (p) => <Commentable tag="h2" {...p} />,
      h3: (p) => <Commentable tag="h3" {...p} />,
      h4: (p) => <Commentable tag="h4" {...p} />,
      h5: (p) => <Commentable tag="h5" {...p} />,
      h6: (p) => <Commentable tag="h6" {...p} />,
      table: (p) => <Commentable tag="table" {...p} />,
      blockquote: (p) => <Commentable tag="blockquote" {...p} />,
      ul: (p) => <Commentable tag="ul" {...p} />,
      ol: (p) => <Commentable tag="ol" {...p} />,
      // CODE FENCES and dividers are blocks too (his catch: "I can't wrap code blocks — it
      // says document") — the fence's pre carries the full source range like any paragraph.
      pre: (p) => <Commentable tag="pre" {...p} />,
      hr: (p) => <Commentable tag="hr" {...p} />,
      // A task-list item. GOTCHA: the `node` here is the HAST node, not mdast — remark-gfm has
      // already turned `- [ ]` into `<li class="task-list-item"><input type=checkbox disabled>`, so
      // `node.checked` does NOT exist. Read the state off that input child, and drop react-markdown's
      // rendered (disabled) input in favour of a live one. `node.position` survives the mdast→hast
      // conversion, which is what gives us the source line to write back to.
      li({ node, children, className, ...props }) {
        const classes = ((node && node.properties && node.properties.className) || []).join(" ");
        const box =
          node && (node.children || []).find((c) => c.tagName === "input" && c.properties && c.properties.type === "checkbox");
        if (classes.includes("task-list-item") || box) {
          const checked = !!(box && box.properties && box.properties.checked);
          const line = node.position && node.position.start && node.position.start.line;
          const rest = React.Children.toArray(children).filter(
            (c) => !(React.isValidElement(c) && c.type === "input")
          );
          return (
            <li className={`md-task${checked ? " md-task--done" : ""}${editable ? " md-task--live" : ""}`}>
              <input
                type="checkbox"
                className="md-task__box"
                checked={checked}
                disabled={!editable}
                onChange={() => onToggle(line)}
                title={editable ? "Toggling this edits the document" : "Read-only here — this surface has nothing to save to"}
              />
              <span className="md-task__text">{rest}</span>
            </li>
          );
        }
        return (
          <li className={className} {...props}>
            {children}
          </li>
        );
      },
      code({ node, inline, className, children, ...props }) {
        const match = /language-(\w+)/.exec(className || "");
        // A ```markdown fence is almost always us SHOWING the source of a block, and Prism's markdown
        // grammar breaks exactly that: it splits a list bullet onto its own line, so a nested-list
        // example (how assertions are written) rendered as stray dashes. Show it verbatim instead —
        // there is nothing worth colouring in a two-line snippet of our own syntax.
        if (!inline && match && /^(markdown|md)$/i.test(match[1]))
          return <pre className="md-code-plain">{String(children).replace(/\n$/, "")}</pre>;
        return !inline && match ? (
          <SyntaxHighlighter
            children={String(children).replace(/\n$/, "")}
            style={dracula}
            language={match[1]}
            PreTag="div"
            {...props}
          />
        ) : (
          <code className={className} {...props}>
            {children}
          </code>
        );
      },
    }),
    [editable, onToggle]
  );

  // RIGHT-CLICK anywhere in a document you can save. The block you aimed at comes off the DOM
  // (`data-md-start/end`, written by Commentable), so the menu acts on that block rather than on a
  // vague "current position". Where the surface can't save, the browser's own menu is left alone.
  const openMenu = (e) => {
    // The menu owns the WHOLE document, not just the blocks it can act on — landing on the browser's
    // menu in the gaps made the feature feel broken. Off a block, it still offers to insert.
    if (!editable) return;
    e.preventDefault();
    const el = e.target.closest ? e.target : e.target.parentElement;
    const host = el && el.closest("[data-md-start]");
    const threadEl = el && el.closest('[data-md-name="thread"]');
    const thread = threadEl
      ? { start: Number(threadEl.getAttribute("data-md-start")), end: Number(threadEl.getAttribute("data-md-end")) }
      : null;
    // The innermost OUR-BLOCK under the pointer (a chart, a run, a logs view) — removable, unlike
    // prose. A thread is handled separately: it unwraps rather than deletes.
    const blockEl = el && el.closest("[data-md-name]");
    const block =
      blockEl && blockEl.getAttribute("data-md-name") !== "thread"
        ? {
            name: blockEl.getAttribute("data-md-name"),
            kind: blockEl.getAttribute("data-md-kind"),
            start: Number(blockEl.getAttribute("data-md-start")),
            end: Number(blockEl.getAttribute("data-md-end")),
          }
        : null;
    const start = host ? Number(host.getAttribute("data-md-start")) : 0;
    const end = host ? Number(host.getAttribute("data-md-end")) : 0;
    const label = host
      ? (host.innerText || "").trim().split("\n")[0].slice(0, 34) || `line ${start}`
      : "document";
    setMenu({ x: e.clientX, y: e.clientY, start, end, label, thread, block });
  };

  const pickMenu = (choice) => {
    const { source: src, onSourceChange: save } = live.current;
    if (!menu) return;
    // Off a block, "below" means the end of the document.
    const at = menu.end || src.split("\n").length;
    if (choice.kind === "thread") startThread(menu.start, menu.end);
    else if (choice.kind === "unthread") {
      const next = menu.thread && unwrapThread(src, menu.thread.start, menu.thread.end);
      if (next != null) save(next);
    } else if (choice.kind === "unwrap-block") {
      const next = menu.block && unwrapContainer(src, menu.block.start, menu.block.end, menu.block.name);
      if (next != null) save(next);
    } else if (choice.kind === "remove") {
      const next = menu.block && removeLines(src, menu.block.start, menu.block.end);
      if (next != null) save(next);
    } else if (choice.kind === "wrap") {
      const next = wrapLines(src, menu.start, menu.end, choice.open);
      if (next != null) save(next);
    } else if (choice.kind === "insert") save(insertAfterLine(src, at, choice.text));
    else if (choice.kind === "insert-from") {
      const make = TEMPLATES[choice.drawer];
      if (make) save(insertAfterLine(src, at, make(choice.value)));
    }
    setMenu(null);
    setDrawer(null);
  };

  // A drawer's options are read live when it opens — namespaces off the connection tree, files from
  // the project's plugin. Opening the menu shouldn't cost a round trip; opening a drawer can.
  const openDrawer = (name) => {
    if (!name) return setDrawer(null);
    if (name === "chart") {
      setDrawer({
        name,
        options: ["throughput", "errors", "latency"].map((v) => ({ label: v, value: v })),
      });
      return;
    }
    // Options come from the document's own project when it has one; a document that doesn't (the hub,
    // a help topic) falls back to the first connected project, the same rule the embeds use.
    const project = (scope && scope.projectCode) || (connectedServices[0] || {}).projectCode;
    const mine = connectedServices.filter((s) => !project || s.projectCode === project);
    if (name === "logs") setDrawer({ name, options: namespaceOptions(mine) });
    else if (name === "run") setDrawer({ name, options: namespaceOptions(mine).filter((o) => o.kind === "method") });
    else if (name === "test") setDrawer({ name, options: testOptions(mine) });
    else if (name === "file" || name === "diff") {
      setDrawer({ name, options: [], loading: true });
      fileOptions(mine, { changed: name === "diff" }).then((options) =>
        setDrawer((d) => (d && d.name === name ? { ...d, options, loading: false } : d))
      );
    }
  };

  return (
    <MarkdownScopeProvider value={scope}>
      <MarkdownWriteProvider value={writeApi}>
      <MarkdownCommentsProvider value={comments}>
      <div className={`markdown${dark ? " markdown--dark" : ""}`} onContextMenu={openMenu}>
        {menu ? (
          <DocMenu
            at={menu}
            canThread={threadable}
            drawer={drawer}
            openDrawer={openDrawer}
            onPick={pickMenu}
            onClose={() => {
              setMenu(null);
              setDrawer(null);
            }}
          />
        ) : null}
        <ReactMarkdown
          // NOTE: no rehype-raw — raw HTML stays off. Directives are the only extension point, which
          // is what keeps agent- and disk-authored markdown from being an injection surface.
          remarkPlugins={[remarkGfm, remarkDirective, remarkSvBlocks]}
          components={components}
        >
          {children}
        </ReactMarkdown>
      </div>
      </MarkdownCommentsProvider>
      </MarkdownWriteProvider>
    </MarkdownScopeProvider>
  );
};

export default Markdown;
