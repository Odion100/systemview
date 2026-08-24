import React, { useState, useEffect, useRef, useContext, useMemo } from "react";
import { createPortal } from "react-dom";
import moment from "moment";
import { useHistory, useLocation, useParams } from "react-router-dom";
import ServiceContext from "../../ServiceContext";
import BLOCKS from "../../atoms/Markdown/registry";
import { MarkdownWriteProvider, MarkdownScopeProvider } from "../../atoms/Markdown/context";
import ReportLink from "../../atoms/Markdown/blocks/ReportLink";
import NsLink from "../../atoms/Markdown/blocks/NsLink";
import FileLink from "../../atoms/Markdown/blocks/FileLink";
import UiLink from "../../atoms/Markdown/blocks/UiLink";
import Markdown from "../../atoms/Markdown/Markdown";
import { spotlight, clearSpotlight, animationMode, setAnimationMode, MODES } from "../../spotlight";
import { resolveTarget, docRectOf, revealDocLines } from "../../spotlightTargets";
import { slotId, setNavDocked, useNavDock } from "./navDock";
import { hasHostDictation, startHostRecording } from "../../utils/hostDictation";
import Feed, { timeOf } from "../AgentWorkbench/Feed";
import useAgentSession from "../AgentWorkbench/useAgentSession";
import { CTX_WARN, CTX_DUE, tokensShort } from "../AgentWorkbench/feedRows";
import { visStyle } from "../AgentWorkbench/visitorColor";
import { canListTranscripts, listAgents, listTranscripts, transcriptTail } from "../../utils/hostAgent";
import CodebaseNav from "../CodebaseNav/CodebaseNav";
import { useAppDark } from "../../atoms/appTheme";
import loadServiceWithHeaders from "../../utils/loadService";
import { hostFiles, hasHostFiles } from "../../utils/hostFiles";
import SEND_ICON from "../../assets/send.png";
import "./styles.scss";

// RFC-028 — agent presence. SEVERAL bots, not one: every connected project has its own bot,
// visible at ALL times — you never switch namespaces to find a bot (it can switch namespaces for
// you eventually, not the other way around). Each bot: the chat icon wearing a small bot face, a
// truly transparent circle, its project label, its own remembered position. Presence is shown as
// it really is (offline included — unconditional for now, his call). DRAGGING and CLICKING are
// SEPARATE PARTS: the grip (shows on hover) drags and docks; the bubble itself only clicks.
const CLASSNAME = "agent-chat";
const EDGE = 18; // docked margin
const STACK = 78; // default vertical spacing per undragged bot

// CHAT MARKDOWN (his ask, 2026-08-09) — bubbles get LIGHT formatting: bold, italic, inline code,
// strikethrough, links, tight lists, quotes and fenced code. Deliberately NOT `atoms/Markdown`:
// that renderer is built for a PAGE — document-sized headings, block margins, its own code
// background, tables, the right-click Commentable wrapper — and every one of those fights a small
// colored bubble (which is why the first attempt at full markdown here looked wrong). Headings
// render as bold lines; tables, images and `::blocks` stay on the TV. That split is the point:
// bubbles carry light formatting, the TV carries the full vocabulary.
//
// Everything the markdown paints (code fills, quote bars, rules) uses `--md-ink`/`--md-line`,
// set per bubble kind in styles.scss — so the SAME styling sits correctly on his purple bubble,
// on agent bubbles, and on every per-visitor color without hand-tuning each one.
// REFERENCES IN A SENTENCE ARE HOW AN AGENT POINTS (his design call: "it's better to just keep it
// in the chat"). `:report[…]` was already a chip; `:file[…]`, `:ns[…]` and `:ui[…]` join it, and the
// same reference that renders as a chip is what the spotlight lights up. That is the whole pointing
// feature — no new verbs, and it works minimised because the bubble is the anchor.
const LINKISH =
  /:(report|file|ns|ui)\[([^\]]+)\](?:\{([^}]*)\})?|\[([^\]]+)\]\((\/[^)\s]+|https?:\/\/[^)\s]+)\)|(https?:\/\/[^\s]+)/g;

// The reference chips a bubble can carry. Deliberately the SAME components the markdown renderer
// uses — a `:file[…]` must mean the identical thing in a chat bubble and in a document, or agents
// have to learn two dialects for one idea.
// RFC-050 — inline references, now the registry's own. `help` and `diff` were missing for no reason
// other than that nobody had needed them in a bubble; a chat that carries the vocabulary carries all
// of it. Falls back to ReportLink for an unknown name, exactly as before.
const REF_BLOCKS = {
  report: ReportLink,
  ns: NsLink,
  file: FileLink,
  ui: UiLink,
  help: (BLOCKS.help && BLOCKS.help.Component) || ReportLink,
  diff: (BLOCKS.diff && BLOCKS.diff.Component) || ReportLink,
};
// The open door wants a language; without one the pane falls back to plain text and the file loses
// its highlighting for no reason other than which door opened it.
const langFromPath = (p = "") => {
  const ext = String(p).split(".").pop().toLowerCase();
  return (
    { js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript", ts: "typescript",
      tsx: "typescript", json: "json", md: "markdown", scss: "scss", css: "css", html: "html",
      yml: "yaml", yaml: "yaml", sh: "shell", py: "python" }[ext] || "text"
  );
};

// Internal links (`/specs/…`) PUSH through the router — a chat link must never reload the page
// unless it genuinely leaves the app (http…), and those open a new tab.
function ChatLink({ href, children }) {
  const history = useHistory();
  const external = /^https?:\/\//i.test(href);
  const onClick = (e) => {
    e.stopPropagation();
    if (external) return;
    e.preventDefault();
    history.push(href);
  };
  return (
    <a
      className="md-chip md-chip--link"
      href={href}
      target={external ? "_blank" : undefined}
      rel="noreferrer"
      onClick={onClick}
    >
      <span className="md-chip__kind">link</span>
      {children}
    </a>
  );
}
// The link scanner — a FLAT array of strings and chip elements. The links collector depends on
// exactly this shape (it keeps the elements and drops the prose), so it stays its own function
// rather than getting folded into the markdown pass.
function renderChatText(text, kp = "l") {
  const out = [];
  let last = 0;
  let k = 0;
  let m;
  LINKISH.lastIndex = 0;
  while ((m = LINKISH.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined) {
      const attrs = {};
      const t = (m[3] || "").match(/title=(?:"([^"]*)"|'([^']*)'|([^\s}]+))/);
      if (t) attrs.title = t[1] || t[2] || t[3];
      const Ref = REF_BLOCKS[m[1]] || ReportLink;
      out.push(<Ref key={`${kp}${k++}`} label={m[2]} attrs={attrs} />);
    } else if (m[4] !== undefined) {
      out.push(
        <ChatLink key={`${kp}${k++}`} href={m[5]}>
          {m[4]}
        </ChatLink>,
      );
    } else {
      const short = m[6].replace(/^https?:\/\//, "").replace(/\/$/, "");
      out.push(
        <ChatLink key={`${kp}${k++}`} href={m[6]}>
          {short.length > 42 ? `${short.slice(0, 40)}…` : short}
        </ChatLink>,
      );
    }
    last = LINKISH.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

// INLINE marks. Conservative on purpose (his risk: old messages re-render through this, and a
// stray asterisk turning half a bubble bold is worse than no italics): `code` first so its
// contents are never re-parsed, **bold** with doubled stars only, ~~strike~~, and *italic* that
// refuses to match across whitespace edges. `_underscores_` are NOT italic — they're too common
// in identifiers and paths to gamble on.
const INLINE = /`([^`\n]+)`|\*\*([^*\n]+)\*\*|~~([^~\n]+)~~|\*([^\s*][^*\n]*[^\s*]|[^\s*])\*/g;

function renderInline(text, kp) {
  const out = [];
  let last = 0;
  let k = 0;
  let m;
  INLINE.lastIndex = 0;
  while ((m = INLINE.exec(text))) {
    if (m.index > last) out.push(...renderChatText(text.slice(last, m.index), `${kp}t${k++}-`));
    const key = `${kp}m${k++}`;
    if (m[1] !== undefined) out.push(<code key={key} className="chat-md__code">{m[1]}</code>);
    else if (m[2] !== undefined) out.push(<strong key={key}>{m[2]}</strong>);
    else if (m[3] !== undefined) out.push(<del key={key}>{m[3]}</del>);
    else out.push(<em key={key}>{m[4]}</em>);
    last = INLINE.lastIndex;
  }
  if (last < text.length) out.push(...renderChatText(text.slice(last), `${kp}t${k++}-`));
  return out;
}

const H_RE = /^(#{1,6})\s+(.*)$/;
const UL_RE = /^\s*[-*+]\s+(.*)$/;
const OL_RE = /^\s*(\d+)[.)]\s+(.*)$/;
const QUOTE_RE = /^\s*>\s?(.*)$/;

// TABLES (his call: "I do not think tables are too hard to do in these bubbles, just render it
// the right format for this section"). A table is only a table when a separator row PROVES it —
// otherwise a sentence with a pipe in it would turn into a one-cell grid. Alignment markers are
// honored because a stats column reads wrong left-aligned.
const splitRow = (line) => {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  return s.split("|").map((c) => c.trim());
};
// ONE dash is a legal separator cell — `:-:` is the shortest way to write a centered column, and
// demanding two silently degraded the ENTIRE table to raw pipes (found live: every table with a
// centered column). A colon alone still isn't a separator; a dash must be present.
const isTableSep = (line) =>
  !!line && line.indexOf("|") !== -1 && splitRow(line).every((c) => /^:?-+:?$/.test(c));
const alignOf = (c) => (/^:.*:$/.test(c) ? "center" : /:$/.test(c) ? "right" : undefined);

// Block pass: fenced code, headings (as bold lines — an h1 inside a bubble is absurd), tight
// lists, quotes, rules. Anything else is prose, and prose keeps its own newlines because the
// bubble is `white-space: pre-wrap`; blank lines become block spacing instead of dead height.
// RFC-050 — THE SAME BLOCKS THE TV RENDERS, in the chat. His call, once the chat started reading
// like a document: *"I think it can take interactive markdown elements — sometimes it's a report,
// sometimes you could just offer me a commit right in the chat, show me files."*
//
// The registry is the ONE implementation; the chat dispatches to it rather than growing its own
// copy of a commit block. What the chat keeps is its TYPOGRAPHY — his spacing, his bubbles — which
// is the thing he told me not to touch when I reached for `atoms/Markdown` wholesale. So: prose
// renders here, blocks render there, and there is only ever one CommitBlock in this codebase.
//
//   :file[cli/index.js]            inline, mid-sentence
//   ::commit{message="…"}          a leaf on its own line
//   :::approval{id=x} … :::        a container wrapping what is being decided
const LEAF_RE = /^\s*(:{2,3})([a-z][\w-]*)(?:\[([^\]]*)\])?(?:\{([^}]*)\})?\s*$/;
const INLINE_RE = /:([a-z][\w-]*)\[([^\]]*)\](?:\{([^}]*)\})?/;
// Attributes, parsed the way the directive syntax actually works: a quoted value may hold spaces
// and pipes, an unquoted one stops at the first space. Getting this wrong is what silently ate a
// `::question` on RFC-049, so the chat uses the same rule rather than a looser one.
export function parseAttrs(src) {
  const out = {};
  const re = /([\w-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s]+)))?/g;
  let m;
  while ((m = re.exec(String(src || "")))) {
    const [, k, dq, sq, bare] = m;
    out[k] = dq !== undefined ? dq : sq !== undefined ? sq : bare !== undefined ? bare : "true";
  }
  return out;
}

// One directive → one registry component. Unknown names render as the literal text they were, so a
// sentence that merely looks like a directive is never swallowed.
function SvChatBlock({ name, label, attrs, line, children }) {
  const [dark] = useAppDark();
  const entry = BLOCKS[name];
  if (!entry || !entry.Component) return null;
  const { Component } = entry;
  return (
    // `markdown` IS THE SCOPE THE BLOCK STYLES LIVE IN — and it re-declares the theme tokens as
    // LIGHT, because a DOCUMENT is explicitly light or dark rather than following the app. That is
    // right for the TV and wrong here: adding the class without its `--dark` twin is what pinned a
    // white card into a dark chat. A chat is not a document; it follows the app, like the panel
    // around it does.
    <div className={`chat-md__block markdown${dark ? " markdown--dark" : ""}`}>
      <Component label={label} attrs={attrs} line={line} node={null}>
        {children}
      </Component>
    </div>
  );
}

export function renderChatMessage(text) {
  const lines = String(text || "").split("\n");
  const out = [];
  let para = [];
  let list = null; // { ordered, items: [] }
  let fence = null; // { lines: [] }
  let k = 0;
  const flushPara = () => {
    if (!para.length) return;
    out.push(
      <span key={`p${k++}`} className="chat-md__p">
        {renderInline(para.join("\n"), `p${k}-`)}
      </span>,
    );
    para = [];
  };
  const flushList = () => {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    out.push(
      <Tag key={`l${k++}`} className="chat-md__list">
        {list.items.map((it, i) => (
          <li key={i}>{renderInline(it, `l${k}i${i}-`)}</li>
        ))}
      </Tag>,
    );
    list = null;
  };
  const flushAll = () => {
    flushPara();
    flushList();
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (fence) {
      if (/^\s*```/.test(line)) {
        out.push(
          <pre key={`f${k++}`} className="chat-md__fence">
            {fence.lines.join("\n")}
          </pre>,
        );
        fence = null;
      } else fence.lines.push(line);
      continue;
    }
    if (/^\s*```/.test(line)) {
      flushAll();
      fence = { lines: [] };
      continue;
    }
    // A table claims its own lines, so it is checked before the single-line block matchers.
    if (line.indexOf("|") !== -1 && isTableSep(lines[i + 1])) {
      flushAll();
      const head = splitRow(line);
      const aligns = splitRow(lines[i + 1]).map(alignOf);
      const rows = [];
      i += 2;
      while (i < lines.length && lines[i].trim() && lines[i].indexOf("|") !== -1) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      i--; // the loop's own increment lands on the line that ended the table
      const tk = k++;
      out.push(
        // A div, not a span: `<table>` is flow content and has no business inside phrasing.
        <div key={`tw${tk}`} className="chat-md__tablewrap">
          <table className="chat-md__table">
            <thead>
              <tr>
                {head.map((c, ci) => (
                  <th key={ci} style={aligns[ci] ? { textAlign: aligns[ci] } : undefined}>
                    {renderInline(c, `t${tk}h${ci}-`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri}>
                  {r.map((c, ci) => (
                    <td key={ci} style={aligns[ci] ? { textAlign: aligns[ci] } : undefined}>
                      {renderInline(c, `t${tk}r${ri}c${ci}-`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    // A DIRECTIVE ON ITS OWN LINE. `::commit{…}` is a leaf; `:::approval{…}` opens a container that
    // wraps whatever is being decided, and its body renders through this same function so a proposal
    // inside an approval still reads like the rest of the chat.
    const dir = line.match(LEAF_RE);
    if (dir && BLOCKS[dir[2]]) {
      flushAll();
      const [, fence, name, dlabel, dattrs] = dir;
      const attrs = parseAttrs(dattrs);
      let body = null;
      if (fence === ":::") {
        const close = [];
        let j = i + 1;
        for (; j < lines.length; j++) {
          if (lines[j].trim() === ":::") break;
          close.push(lines[j]);
        }
        body = close.join("\n");
        i = j; // the loop's own increment steps past the closing fence
      }
      out.push(
        <SvChatBlock key={`d${k++}`} name={name} label={dlabel || ""} attrs={attrs} line={i + 1}>
          {body ? renderChatMessage(body) : null}
        </SvChatBlock>,
      );
      continue;
    }
    const h = line.match(H_RE);
    const ul = line.match(UL_RE);
    const ol = line.match(OL_RE);
    const q = line.match(QUOTE_RE);
    if (ul || ol) {
      flushPara();
      const ordered = !!ol;
      if (list && list.ordered !== ordered) flushList();
      if (!list) list = { ordered, items: [] };
      list.items.push(ul ? ul[1] : ol[2]);
      continue;
    }
    flushList();
    if (h) {
      flushPara();
      out.push(
        <span key={`h${k++}`} className="chat-md__h">
          {renderInline(h[2], `h${k}-`)}
        </span>,
      );
    } else if (q) {
      flushPara();
      out.push(
        <span key={`q${k++}`} className="chat-md__quote">
          {renderInline(q[1], `q${k}-`)}
        </span>,
      );
    } else if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      flushPara();
      out.push(<span key={`r${k++}`} className="chat-md__rule" />);
    } else if (!line.trim()) {
      flushPara(); // a blank line ENDS a paragraph; spacing comes from CSS, not empty lines
    } else {
      para.push(line);
    }
  }
  // An unterminated fence still shows its content — a half-typed message shouldn't vanish.
  if (fence)
    out.push(
      <pre key={`f${k++}`} className="chat-md__fence">
        {fence.lines.join("\n")}
      </pre>,
    );
  flushAll();
  return out;
}

// How much of the screen a filled TV leaves under itself. Small on purpose — "fill" should reach
// the bottom, just not touch it.
const TV_BOTTOM_GAP = 12;

// The eight resize zones — sides drag one axis, corners both. mw/mh multiply dx/dy into the
// width/height delta; the cursor on each zone is the only handle chrome.
const RESIZE_ZONES = [
  { k: "n", mw: 0, mh: -1 }, { k: "s", mw: 0, mh: 1 },
  { k: "e", mw: 1, mh: 0 }, { k: "w", mw: -1, mh: 0 },
  { k: "ne", mw: 1, mh: -1 }, { k: "nw", mw: -1, mh: -1 },
  { k: "se", mw: 1, mh: 1 }, { k: "sw", mw: -1, mh: 1 },
];
// Double-click resets THE AXIS you clicked (his call: "one side at a time") — a side edge
// hands back its own dimension, a corner both. The reset callback receives (mw, mh) so the
// surface can flex just that axis.
const ResizeBorder = ({ start, onReset }) =>
  RESIZE_ZONES.map((z) => (
    <div
      key={z.k}
      className={`${CLASSNAME}__rz ${CLASSNAME}__rz--${z.k}`}
      title="Drag to resize · double-click for natural size"
      onPointerDown={start(z.mw, z.mh)}
      onDoubleClick={() => onReset(z.mw, z.mh)}
    />
  ));

// The input textarea grows with its content up to ~6 lines, then scrolls.
const autogrow = (el) => {
  el.style.height = "auto";
  el.style.height = `${Math.min(el.scrollHeight, 110)}px`;
};

// The cooking line. A SPECIFIC status from the agent shows verbatim — truth wins over theater.
// Only the generic "received" state earns the show: after a beat it cycles through cooking words,
// each with the animated ellipsis, so a working agent never reads as a dead one.
const COOKING = [
  "thinking",
  "cooking",
  "in the lab",
  "stirring the pot",
  "working on it",
  "chewing on it",
  "letting it simmer",
  "crunching",
  "putting it together",
  "still at it",
  "almost plated",
];
// Where the fullness meter points: agents self-compact their room around this record count
// (agents/chat.md); the meter exists because "aren't going to always remember" is true.
const COMPACT_MARK = 300;
// The context window is no longer a constant here — `work.state.ctxWindow` carries it, worked out
// from the model the session reports (see contextWindowFor in feedRows). The 200k that used to live
// on this line was wrong by five times for his sessions and pinned the bar at 100% permanently.
// Focus order across ALL bots — clicking any bot's window brings it above the others; the
// counter only ever climbs, so the last-touched bot is always on top.
let topZ = 8500;
// THE DOCK LINE (his ask, v2): double-click a bot and it joins a neat row along the header —
// anchored after the version chip, stopping short of the right-side buttons. The docked bots
// SPLIT the available width evenly ("space all across evenly, but have as much space as they
// want"): two docked sit wide apart, four tighten up, and every dock/undock re-spaces the whole
// line. The order survives reload (localStorage) — positions recompute for the window you have.
// A BOT HOLDS A SLOT NUMBER, not a place in a queue. The line has fixed positions; taking one is
// taking THAT one, and nobody else moves. Keeping an ordered array meant claiming a spot spliced
// everyone along it — drop into the middle and the whole line slid left, which is not what a line
// of slots does.
// Only bots actually ON SCREEN count.
const mountedBots = new Set();
// The margin a floating bot is clamped to, so it can never be dragged off the edge.
const DOCK_EDGE = 6; // he asked for five to seven
// The hub's one-hit button: every on-screen bot goes home to its own codebase card (RFC-038). The
// old meaning — file into a lane across the top of the window — is gone with the lane.
const dockAllBots = () => window.dispatchEvent(new Event("sv:dockAll"));
// Every visitor project gets ITS OWN color (his call: "everyone who's a visitor has the same
// color, so them cooking both is not as helpful") — a stable hash of the project code to a hue,
// steered off the home-agent green so a visitor never reads as the house. Same name = same color
// everywhere: bubbles, name tags, cooking lines, roster chips, system pills. It lives in the
// workbench now so the SESSION feed can wear the same colours — a peer agent turns up in a direct
// chat too, and it must be the same agent in both places.

// `claude-opus-5-20260101` is a build identifier; `opus-5` is a name. The chip shows the name and
// keeps the identifier on the hover, because the only time the date matters is when you are
// checking exactly which build answered.
//
// AGREED WITH AUTOBOT, character for character, so the two panels read as one system: strip the
// `claude-` prefix and the trailing date, and KEEP the `[1m]` marker — the long-context variant is
// a different thing to be talking to, not a build detail. The date is stripped even when the marker
// sits after it, which a naive `-\d{8}$` misses.
const shortModel = (m) =>
  String(m || "")
    .replace(/^claude-/, "")
    .replace(/-\d{8}(?=(\[|$))/, "")
    .replace(/-latest(?=(\[|$))/, "");

// Message-bubble time (his ask: "we need to see the time") — compact clock, full date on hover.
const msgTime = (ts) =>
  new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

// WHEN THIS SHOW WENT UP, beside the TV's title — in the language you actually think in about a
// show ("2 hours ago"), his call, and moment is already a dependency here. The absolute stamp stays
// on the hover, because "5 days ago" stops being useful the moment you need to match it to a commit.
const showWhen = (ts) => {
  if (!ts) return "";
  const m = moment(ts);
  return m.isValid() ? m.fromNow() : "";
};
// ...and the same moment as a real clock. BOTH ARE WANTED, at different times: "an hour ago" is how
// you think about a show, the actual time is how you match one to a commit — so the stamp switches
// instead of picking a side, and which side you left it on is remembered.
const showWhenAbs = (ts) => {
  if (!ts) return "";
  const m = moment(ts);
  return m.isValid() ? m.format("MMM D · h:mm A") : "";
};

function StatusLine({ status, visitor }) {
  const [i, setI] = useState(0);
  const generic = status === "received";
  useEffect(() => {
    setI(0);
    if (!generic) return;
    const t0 = setTimeout(() => setI(1), 2600);
    const iv = setInterval(() => setI((n) => (n === 0 ? 0 : (n % COOKING.length) + 1)), 2600);
    return () => {
      clearTimeout(t0);
      clearInterval(iv);
    };
  }, [status, generic]);
  const text = generic && i > 0 ? COOKING[i - 1] : status;
  // No key: the element persists and the WORD swaps in place — a remount re-ran the entrance
  // animation on every phrase change and read as blinking.
  // RFC-031 — a VISITOR cooking wears its plum and its name (his rule: you must be able to
  // tell WHO is cooking at a glance).
  return (
    <div
      className={`agent-chat__status${visitor ? " agent-chat__status--visitor" : ""}`}
      style={visStyle(visitor)}
    >
      {visitor ? `${visitor}: ${text}` : text}
      <span className="agent-chat__dots">
        <i />
        <i />
        <i />
      </span>
    </div>
  );
}

// THE DIRECT CHAT'S COOKING LINE — and it needs BOTH modes. His catch once the host wired
// `assistant.thinking` for real: *"all it shows is your thinking. It ain't showing the fucking
// cooking messages. There needs to still display an animation mode, even though we can have the new
// one here."* So: a SPECIFIC thing in flight ("reading CodePane.js", "moved the window /specs/x")
// shows verbatim, because truth beats theatre — but the moment there is nothing specific, or the
// only thing on offer is the bare word "thinking", it falls back to the room's cycling words. One
// frozen word for a whole turn is indistinguishable from a dead agent, which is the whole reason
// the room's line cycles in the first place.
// The WORDS, separated from the line that draws them, because two different surfaces draw them:
// the open panel's own line, and the closed bubble's peek — and the peek has always been a
// StatusLine. Handing it a CookLine instead swapped the markup underneath the peek's styling and
// drew an empty bubble, which is what he saw: *"it wasn't the word, it was empty."*
function useCookWord(doing, state) {
  const specific = doing && doing !== "thinking" ? doing : "";
  const [i, setI] = useState(0);
  useEffect(() => {
    if (specific) return undefined;
    setI(0);
    const t0 = setTimeout(() => setI(1), 2600);
    const iv = setInterval(() => setI((n) => (n === 0 ? 0 : (n % COOKING.length) + 1)), 2600);
    return () => {
      clearTimeout(t0);
      clearInterval(iv);
    };
  }, [specific]);
  return specific || (state === "waiting" ? "waiting on you" : i > 0 ? COOKING[i - 1] : "thinking");
}

function CookLine({ doing, state }) {
  const text = useCookWord(doing, state);
  // I TOOK THESE OUT MYSELF AND BLAMED HIM FOR IT — correcting the record, because the old comment
  // here claimed he had cut the trailing dots. He hadn't: *"I never rejected the dots on that line,
  // trust me."* What he actually objected to was the cooking line's LOOK changing wholesale, and I
  // over-read that into stripping an ornament he had never mentioned. Asked for directly now —
  // *"you might as well put those dancing ellipses at the end of the cooking message inside the
  // chat as well"* — and they earn their place: on a line naming a specific thing in flight, the
  // dots are the only signal separating "doing this" from "did this".
  //
  // The lesson worth more than the dots: a comment that attributes a decision to him is a claim
  // about what he said, and getting it wrong buries a wrong rule where the next session will obey it.
  return (
    <div className={`${CLASSNAME}__cooking ${CLASSNAME}__cooking--${state}`}>
      <span className={`${CLASSNAME}__cooking-dot`} />
      {text}
      {/* The room's dots, exactly as they are — *"just add it at the end. Be there. Don't change no
          style."* No modifier class, no resizing, nothing else on this line touched. */}
      <span className={`${CLASSNAME}__dots`}>
        <i />
        <i />
        <i />
      </span>
    </div>
  );
}

// A bot is FLOATING or PARKED in the hub (his call: "go to different windows knowing this agent
// is not in this window"). Parked = `sv.chatHidden.<pc>` — the bubble unmounts entirely; the hub
// (in the page header, next to the version) lists every bot and pulls parked ones back out.
const isParked = (pc) => {
  try { return localStorage.getItem(`sv.chatHidden.${pc}`) === "true"; } catch { return false; }
};
const setParked = (pc, parked) => {
  try { localStorage.setItem(`sv.chatHidden.${pc}`, String(parked)); } catch {}
  window.dispatchEvent(new CustomEvent("sv:botHub"));
};

export default function AgentChats() {
  const { connectedServices } = useContext(ServiceContext);
  const [, force] = useState(0);
  useEffect(() => {
    const on = () => force((n) => n + 1);
    window.addEventListener("sv:botHub", on);
    return () => window.removeEventListener("sv:botHub", on);
  }, []);
  const projects = useMemo(
    () => [...new Set((connectedServices || []).map((s) => s.projectCode))],
    [connectedServices],
  );
  return projects
    .filter((pc) => !isParked(pc))
    .map((pc, i) => <BotBubble key={pc} projectCode={pc} index={i} />);
}

// THE HUB — lives in the page header beside the version. Drops down to every agent bot: turn a
// floating one off (it leaves the window), pull a parked one back out.
export function BotHub() {
  const { connectedServices, SystemViewService } = useContext(ServiceContext);
  const [open, setOpen] = useState(false);
  const [, force] = useState(0);
  // The badge counts parked bots WITH SOMETHING GOING ON (his rule: a number just because
  // something is turned off is noise — an inactive parked bot earns no count). Active = its
  // agent is actually connected (live hold or file listener), polled like the bots poll.
  const [activeParked, setActiveParked] = useState(0);
  const projects = [...new Set((connectedServices || []).map((s) => s.projectCode))];
  // One dial for every bot on screen. READ, not remembered: it was seeded into state once at mount,
  // and at that moment the connection list is usually still empty — so it read `sv.anim.undefined`,
  // got the default, and sat there saying "subtle" no matter what was actually set. The setting
  // lives in localStorage; the dial just shows what's there.
  const hubAnim = animationMode(projects[0]);
  const projectsKey = projects.join("|");
  useEffect(() => {
    const on = () => force((n) => n + 1);
    window.addEventListener("sv:botHub", on);
    return () => window.removeEventListener("sv:botHub", on);
  }, []);
  useEffect(() => {
    let dead = false;
    const SystemView = SystemViewService && SystemViewService.SystemView;
    if (!SystemView) return undefined;
    const check = async () => {
      const parked = projectsKey.split("|").filter(Boolean).filter(isParked);
      let n = 0;
      for (const pc of parked) {
        try {
          const pres = await SystemView.chatPresence(pc);
          if (Object.values(pres || {}).some((e) => e && (e.live || e.listener))) n++;
        } catch {}
      }
      if (!dead) setActiveParked(n);
    };
    check();
    const t = setInterval(check, 15000);
    window.addEventListener("sv:botHub", check);
    return () => {
      dead = true;
      clearInterval(t);
      window.removeEventListener("sv:botHub", check);
    };
  }, [projectsKey, SystemViewService]);
  if (!projects.length) return null;
  return (
    <span className="bot-hub">
      <button
        type="button"
        className="bot-hub__btn"
        title="The agent hub — every bot lives here; parked ones wait here"
        onClick={() => setOpen(!open)}
      >
        🤖
        {activeParked > 0 && <span className="bot-hub__count">{activeParked}</span>}
      </button>
      {open && (
        <>
          <div className="bot-hub__overlay" onClick={() => setOpen(false)} />
          <div className="bot-hub__menu">
            {/* One hit, everyone goes home to their own codebase card (RFC-038). It used to line
                them up across the top of the window; that lane is gone. */}
            <button
              type="button"
              className="bot-hub__row bot-hub__row--dock-all"
              title="Send every agent home — into its own codebase card in the navigator"
              onClick={() => {
                dockAllBots();
                setOpen(false);
              }}
            >
              <span className="bot-hub__pc">dock them all</span>
              <span className="bot-hub__verb">dock all</span>
            </button>
            {/* ANIMATION LIVES HERE — his call: the on/off for animation belongs in the agent hub
                icon's options, not buried in one bot's right-click menu. It reads as a property of
                "agents on this screen", which is what it is. Applies to every project at once; the
                per-project store keeps working underneath for anyone who set one already. */}
            <div className="bot-hub__sep">animation</div>
            <div className="bot-hub__modes">
              {MODES.map((m) => (
                <button
                  type="button"
                  key={m}
                  className={`bot-hub__mode${hubAnim === m ? " bot-hub__mode--on" : ""}`}
                  title={
                    m === "off"
                      ? "Nothing moves"
                      : m === "subtle"
                        ? "The bot goes to what it names and says why"
                        : "Adds the connecting line and a label"
                  }
                  onClick={() => {
                    projects.forEach((pc) => setAnimationMode(pc, m));
                    force((n) => n + 1);
                  }}
                >
                  {m}
                </button>
              ))}
            </div>
            {projects.map((pc) => {
              const parked = isParked(pc);
              return (
                <button
                  type="button"
                  key={pc}
                  className="bot-hub__row"
                  title={parked ? "Pull this bot back out" : "Turn this bot off — it parks here"}
                  onClick={() => setParked(pc, !parked)}
                >
                  <span className={`bot-hub__state ${parked ? "bot-hub__state--off" : "bot-hub__state--on"}`} />
                  <span className="bot-hub__pc">{pc}</span>
                  <span className="bot-hub__verb">{parked ? "pull out" : "turn off"}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </span>
  );
}

function BotBubble({ projectCode, index }) {
  const location = useLocation();
  const history = useHistory();
  const { serviceId, moduleName, methodName, projectCode: routeProject } = useParams();
  const { SystemViewService, connectedServices } = useContext(ServiceContext);
  const { SystemView } = SystemViewService;
  const [open, setOpen] = useState(false);
  const [ctxMenu, setCtxMenu] = useState(false);
  const [messages, setMessages] = useState([]);
  // RFC-046 — WHAT IT IS DOING, in the conversation where he is already talking to it. His
  // correction after I built it as a fold in the navigation: *"there's a new agent in a section in
  // a navigation, and that's not what I meant by anything I said"* — he said he does not see the
  // agents work IN THE CONVERSATIONS. So the live feed lands at the bottom of this list, in the
  // silence between messages that was the actual complaint.
  //
  // TWO STREAMS, ONE PANEL, and they are different things: the room carries what an agent SAYS
  // (and works for a CLI agent with no host session at all); the session carries what it DOES.
  // With no host, or an agent that is only a CLI hold, `rows` is empty and this renders nothing —
  // which is the honest outcome, not a broken-looking box.
  // TALKING TO THE AGENT DIRECTLY, IN THIS BOX. His instruction, and the end of the CLI detour:
  // *"that chat now needs to be just a chat just like this — I should be talking over there to you,
  // not over here anymore."*
  //
  // Attach a conversation and this panel STOPS being a room and becomes the session: what you type
  // goes to the agent, not into `.systemview/chats`. The room keeps existing underneath for agents
  // talking to each other, unused by him — the CLI hold is a remnant from that moment, which is
  // exactly the handoff autobot and I settled (the resume click IS the handoff; the hold stands
  // down when the session claims the identity).
  //
  // ATTACHED IS A CHOICE, NOT A DEFAULT. Opening a panel must never silently start a Claude session
  // in a folder — that is a process, and a process you did not ask for is the thing this whole seam
  // exists to prevent.
  // ATTACHMENT IS THE PROJECT'S STATE, not this panel's. It survives navigation — losing your
  // conversation because you clicked a file is absurd — and it is readable by other surfaces, which
  // is how the codebase itself can say "no agent here yet" without knowing anything about the chat.
  const [attached, setAttached] = useState(() => {
    try { return localStorage.getItem(`sv.chat.attached.${projectCode}`) || null; } catch { return null; }
  });
  useEffect(() => {
    try {
      if (attached) localStorage.setItem(`sv.chat.attached.${projectCode}`, attached);
      else localStorage.removeItem(`sv.chat.attached.${projectCode}`);
    } catch {}
    window.dispatchEvent(new CustomEvent("sv:agentAttached", { detail: { projectCode, attached } }));
    // NO SELF-EVICTION. I wired attaching to kick this project's own identity, meaning to evict a
    // stale CLI hold — but `kick` is the ROOM's eviction, so every attach threw the home agent out
    // of its own room and wrote "systemview-test was kicked from the room" into the history. It
    // solved a problem that is already gone (holds), by breaking presence for the agent he is
    // actually talking to. If a double-answer ever shows up in practice, the fix belongs in the
    // hub — one identity, one live claim — not in a kick from the view that just attached.
  }, [attached, projectCode]);
  // Read inside the chat subscription, which is set up once and must not capture a stale value.
  const attachedRef = useRef(attached);
  attachedRef.current = attached;
  // The first prompt does not live behind a chat you have to open first (his catch: *"where is the
  // first prompt to you as a new user — do you have to try to open the chat to see it?"*). The
  // codebase asks, and this is the door it knocks on.
  useEffect(() => {
    const onAsk = (e) => {
      if (!e.detail || e.detail.projectCode !== projectCode) return;
      openRef.current = true;
      setOpen(true);
      setPicker(true);
    };
    window.addEventListener("sv:chooseConversation", onAsk);
    return () => window.removeEventListener("sv:chooseConversation", onAsk);
  }, [projectCode]);
  const [modelMenu, setModelMenu] = useState(false);
  const [picker, setPicker] = useState(false);
  const [sendErr, setSendErr] = useState("");
  const [transcripts, setTranscripts] = useState(null);
  // The last thing said in each conversation, so picking one is reading rather than guessing.
  const [tails, setTails] = useState({});
  const [live, setLive] = useState([]);
  // `attached` is one of: null (the room), "fresh", "live:<id>" (join a running session), or a
  // transcript id (resume a file). Joining passes NO resume — the session is already alive, and
  // asking the host to resume a live session would be asking it to start what is already started.
  const joining = typeof attached === "string" && attached.startsWith("live:");
  const attachedId = joining ? attached.slice(5) : attached;
  const work = useAgentSession({
    projectCode,
    // ATTACHED MEANS SUBSCRIBED, OPEN OR NOT. This used to be `open && !!attached` — a closed panel
    // cost nothing, which was the right trade when the bot showed nothing while minimised. It isn't
    // any more: minimised, the bot has to show the ring and the last line, and neither exists if
    // nobody is listening. His ask — *"when it's in minimization mode, one block that shows text and
    // commands right under the agent"* — is structurally impossible without this.
    enabled: !!attached,
    resume: !joining && attached && attached !== "fresh" ? attachedId : null,
    sessionId: attached && attached !== "fresh" ? attachedId : "agent",
  });
  const workRef = useRef(work);
  workRef.current = work;
  useEffect(() => {
    if (!picker) return;
    let dead = false;
    // Live first — a session already talking to him is the one he means, and joining it is not the
    // same act as resuming a file.
    listAgents().then((r) => !dead && setLive(r.filter((x) => x.projectCode === projectCode)));
    if (canListTranscripts())
      listTranscripts(projectCode).then(async (r) => {
        if (dead) return;
        setTranscripts(r);
        // Only the ones he can actually see — reading every transcript on disk to draw a list is
        // the kind of eager work that makes a picker feel broken.
        const rows = (r || []).slice(0, 8);
        const got = {};
        for (const t of rows) {
          if (dead) return;
          const tail = await transcriptTail(projectCode, t.sessionId, 2);
          const last = [...tail].reverse().find((m) => (m.text || "").trim());
          if (last) got[t.sessionId] = String(last.text).replace(/\s+/g, " ").slice(0, 120);
        }
        if (!dead) setTails(got);
      });
    else setTranscripts([]);
    return () => {
      dead = true;
    };
  }, [picker, projectCode]);
  // THE KICK (right-click a roster name) — the human's bouncer power; which visitor is targeted.
  const [kickTarget, setKickTarget] = useState(null);
  // WHO IS SUBSCRIBED to this conversation — the hub's list, not the transcript's memory. This is
  // the half that means "receives what is said here"; the transcript's own visitors are merely
  // who has spoken. Kept apart because he asked for exactly that distinction.
  const [subscribed, setSubscribed] = useState([]);
  const [addingVisitor, setAddingVisitor] = useState(false);
  const [newVisitor, setNewVisitor] = useState("");
  // Click-to-front: this bot's place in the focus order (see topZ above).
  const [z, setZ] = useState(8500);
  const bringToFront = () => setZ(++topZ);
  // Double-click the bot → take the lowest free slot and go there. Only THIS bot moves.
  // RFC-038 — DOCKING MEANS GOING HOME NOW, not parking at the edge of the window. Double-clicking
  // the face sends the agent back into its own codebase card; the arrow on the docked row (or
  // dragging it out) brings it back to floating. The header lane keeps configuration and loses
  // docking, which is his call: two docks was one too many.
  const dockHere = () => setNavDocked(projectCode, true);
  const navDocked = useNavDock(projectCode);
  // The slot is a DOM node owned by the nav, which mounts and unmounts on its own (the panel opens,
  // a filter hides the card, the page changes). So it is looked for on a slow tick rather than once
  // — and dropped the moment it leaves the document, which is what puts the bot back on the screen
  // instead of leaving it rendered into a detached node.
  const [slotEl, setSlotEl] = useState(null);
  useEffect(() => {
    if (!navDocked) return setSlotEl(null) || undefined;
    const look = () => {
      const el = document.getElementById(slotId(projectCode));
      setSlotEl((cur) => (cur === el ? cur : el || null));
    };
    look();
    const t = setInterval(look, 400);
    return () => clearInterval(t);
  }, [navDocked, projectCode]);
  // Dock-line membership: every relayout broadcast (a dock, an undock, dock-all, a window
  // resize, a reload) snaps this bot to its CURRENT slot in the CURRENT window width. Runs
  // once on mount too — that's what makes the line survive a reload.
  useEffect(() => {
    mountedBots.add(projectCode);
    // NOTHING GRAVITATES ON ITS OWN (his rule). A bot goes to the line when YOU put it there —
    // double-click, a drop on the line, or the hub's dock-all — and then it stays exactly where it
    // is. There used to be a broadcast that re-snapped every docked bot whenever anyone docked,
    // undocked or the window resized, so bots you had not touched kept sliding to new positions.
    // Where each one sits already survives a reload through `sv.chatPos`; it does not need to be
    // recomputed to be remembered.
    const dockAll = () => setNavDocked(projectCode, true);
    window.addEventListener("sv:dockAll", dockAll);
    return () => {
      mountedBots.delete(projectCode);
      window.removeEventListener("sv:dockAll", dockAll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectCode]);
  const inputRef = useRef(null);

  // VOICE — the mic (browser-native speech recognition). Press to listen, transcripts land in
  // the input (editable before send), press again to stop. Input only — no TTS, no duplex.
  const recRef = useRef(null);
  const [listening, setListening] = useState(false);
  // The minimised READING surface keeps itself at the bottom, but only when something new lands —
  // yanking it down on every poll would fight you every time you scrolled up to re-read.
  const peekCountRef = useRef(0);
  // The live wire: INTERIM transcripts stream into a visible line while you talk (his catch —
  // "no indication, the words just pop up"); finals commit into the input.
  const [interim, setInterim] = useState("");
  // A SEND PRESSED BEFORE ITS WORDS ARRIVED. Holds the moment he pressed it; the effect below fires
  // it as soon as the transcript lands. Short-lived on purpose — an intention from four seconds ago
  // is not an intention, and a stale one would send the NEXT thing he starts saying.
  // WHERE HIS LAST MESSAGE WENT. *"And if they get the message, I don't see it."* Delivery that only
  // the recipient can confirm is not observable, and this app is named for the opposite. The hub
  // answers the relay with exactly who it reached; this is that answer, kept so his own screen can
  // say it without him asking anyone.
  const [lastRelay, setLastRelay] = useState(null);
  // Names he has cleared off the spoke strip, and WHEN — cleared at a moment, not forever, so the
  // same agent speaking again puts them back. Forgetting permanently would make the strip lie in
  // the other direction.
  const [spokeCleared, setSpokeCleared] = useState({});
  const armedSend = useRef(0);
  const ARMED_WINDOW = 4000;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  // RFC-045 — INSIDE A HOST, THE HOST DICTATES. `webkitSpeechRecognition` exists in Electron and
  // never returns a result (the recogniser is a Chrome service), so `!!SR` is a false positive there
  // and this mic would look broken rather than absent. utils/hostDictation.js records with plain
  // MediaRecorder and hands the bytes over; the trade is that there are no interim words, so the
  // live line says "transcribing…" for the gap instead of pretending.
  const hostMicRef = useRef(null);
  const viaHostMic = hasHostDictation();
  const micSupported = !!SR || viaHostMic;
  // Text lands in the input AS YOU TALK now, one segment per pause — so this only closes the last
  // one and appends nothing itself.
  const commitSpoken = (text) => {
    setInput((cur) => (cur ? `${cur} ` : "") + text.trim());
    setInterim("");
    setTimeout(() => inputRef.current && autogrow(inputRef.current), 0);
  };
  const finishHostMic = async () => {
    const rec = hostMicRef.current;
    if (!rec) return;
    hostMicRef.current = null;
    setInterim("transcribing…");
    try {
      await rec.stop();
    } catch {}
    setListening(false);
    setInterim("");
  };
  const toggleMic = async () => {
    if (listening) {
      if (viaHostMic) return finishHostMic();
      try { if (recRef.current) recRef.current.stop(); } catch {}
      return;
    }
    if (viaHostMic) {
      try {
        hostMicRef.current = await startHostRecording({
          onDraft: (t) => setInterim(t),
          onSegment: commitSpoken,
        });
        setInterim("");
        setListening(true);
      } catch {
        setListening(false);
      }
      return;
    }
    try {
      const rec = new SR();
      rec.lang = navigator.language || "en-US";
      rec.interimResults = true;
      rec.continuous = true;
      rec.onresult = (e) => {
        let fin = "";
        let inter = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) fin += e.results[i][0].transcript;
          else inter += e.results[i][0].transcript;
        }
        if (fin) {
          setInput((cur) => (cur ? `${cur} ` : "") + fin.trim());
          setInterim("");
          setTimeout(() => inputRef.current && autogrow(inputRef.current), 0);
        } else {
          setInterim(inter);
        }
      };
      rec.onend = () => {
        setListening(false);
        setInterim("");
      };
      rec.onerror = () => {
        setListening(false);
        setInterim("");
      };
      recRef.current = rec;
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  };

  // THE TV — the show-and-tell surface beside the panel (his Canvas model): one show at a time,
  // auto-populates on a live `show` command, closable, and every show in the chat is a clickable
  // line that puts THAT show back on. Content rides IN the command record, so history is free.
  // THE CODEBASE, TRAVELLING WITH THE BOT (his ask). With the navigator collapsed into its corner
  // there was nowhere for `</>` to go: it focused a panel that isn't on screen, so pressing it did
  // nothing visible. Floating, it becomes one more panel hanging off the agent — the same tree, git
  // and terminal, beside the chat instead of across the window.
  // THE CODEBASE PANEL REMEMBERS, PER PROJECT. It did not, and that is the whole of "systemview-test
  // has no branch/staged/logs/commit in hover": autobot's CDP dump of his live window settled it —
  // five projects mount a `cbpanel-body` and every one of them has the tree, the vc pill, the commit
  // tab and the commit box; systemview-test mounts NO PANEL AT ALL. Nothing was missing from the
  // panel. The panel was closed, and `cbOpen` started `false` every time with nowhere to record that
  // he had opened it — so one project could sit closed while five sat open and look like a bug in
  // the five hundred lines underneath.
  //
  // Three theories died on that dump (docking, gitState, vcLens) and none of them were measured
  // before I said them. The measurement took one query.
  const cbOpenKey = `sv.chat.cbOpen.${projectCode}`;
  const [cbOpen, setCbOpen] = useState(() => {
    try {
      return localStorage.getItem(cbOpenKey) === "true";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(cbOpenKey, String(cbOpen));
    } catch {}
  }, [cbOpen, cbOpenKey]);
  // Resizable and double-click-to-reset like every other panel here. It should never have shipped
  // without this — his point, and it is the right one: these panels share `makeResize`/`resetSize`
  // and a `<ResizeBorder>`, so a new one that skips them is a panel that behaves differently for no
  // reason. (The real fix is one panel component they all use; noted, not done.)
  const [cbSize, setCbSize] = useState(() => {
    try {
      const v = JSON.parse(localStorage.getItem(`sv.cbSize.${projectCode}`));
      if (v && v.w && v.h) return v;
    } catch {}
    return { w: 320, h: 460 };
  });
  const [tv, setTv] = useState(null); // { id, text, label } — the show on screen
  const [tvOpen, setTvOpen] = useState(false);
  const [tvPick, setTvPick] = useState(false); // the title's picker, open or shut
  // Has the TV been given a height BY HAND? Until it has, the height flexes to the show. A stored
  // size means a past you already chose one, so that counts.
  const [tvSized, setTvSized] = useState(() => {
    try {
      return !!localStorage.getItem(`sv.tvSize.${projectCode}`);
    } catch {
      return false;
    }
  });
  // The TV follows the APP theme — the Markdown atom is deliberately theme-blind (a document
  // picks its own light/dark), so the app's state must be passed down explicitly.
  const [appDark] = useAppDark();
  const [presence, setPresence] = useState({});
  const [input, setInput] = useState("");
  // Unread = agent replies that arrived while the panel was closed (green count on the bubble).
  const [unread, setUnread] = useState(0);
  const openRef = useRef(false);
  // Position: null = the default dock (stacked bottom-right). Persisted per project. A saved spot
  // is CLAMPED back into the viewport on load — a bubble must never wake up stuck off-screen.
  const [pos, setPos] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(`sv.chatPos.${projectCode}`));
      if (!saved) return null;
      return {
        // Same padding on the way back in — a spot you were allowed to drag to must survive a
        // reload, and this was pulling saved positions back off the corner by 18.
        x: Math.max(DOCK_EDGE, Math.min(saved.x, window.innerWidth - 96 - DOCK_EDGE)),
        y: Math.max(DOCK_EDGE, Math.min(saved.y, window.innerHeight - 72 - DOCK_EDGE)),
      };
    } catch { return null; }
  });
  // WHERE IT IS SURVIVES A REFRESH — including where an errand walked it to. Only dragging used to
  // be written down, so a bot that had walked across the screen snapped back on reload, which is
  // what made the trip read as fake (his point: "if the agent actually moves, why are they not in
  // the spot when I refresh"). The gesture is still ephemeral; the bot's position isn't a gesture.
  useEffect(() => {
    if (!pos) return undefined;
    const t = setTimeout(() => {
      try { localStorage.setItem(`sv.chatPos.${projectCode}`, JSON.stringify(pos)); } catch {}
    }, 250);
    return () => clearTimeout(t);
  }, [pos, projectCode]);
  // How far the open assembly reaches beyond the bot: left (panel + TV + collector) and up (the
  // panel's height). The drag clamp reads this so the row can never be pushed off an edge.
  const extentRef = useRef(() => ({ left: 0, up: 0 }));
  const posRef = useRef(pos);
  posRef.current = pos;
  const listRef = useRef(null);
  const rootRef = useRef(null);
  const dragRef = useRef(null);
  const chat = "main";
  const p = (presence && presence[chat]) || { live: false, listener: false, status: null };

  // RFC-029 — THE EXECUTOR. Commands execute ONLY here, off the live push; loading history
  // renders old command lines but never re-executes them (the replay rule — a refresh must not
  // replay every place the agent ever sent you). Reads window.location, not the hook — a command
  // can arrive long after this closure was made.
  // PASSIVE ANIMATION — the UI animates what the agent was ALREADY doing. No new vocabulary, no
  // choreography from the agent, and it works retroactively: every agent already installed starts
  // pointing without changing a line of its behaviour. His example is the whole model — `nav <pc>
  // stats` already exists, and turning animation on just means you SEE the trip instead of the tab
  // snapping over.
  //
  // Ambient tone on purpose (his distinction, held as a rendering rule): the UI moving because a
  // test is running must not look like an agent deliberately pointing and saying something. If they
  // look the same you can't tell what the agent MEANT from what the system DID.
  //
  // Deferred a beat because most of these commands change the view first — pointing at where a pane
  // was about to be is pointing at nothing.
  const animateCommand = (cmd, args, label) => {
    const mode = animationMode(projectCode);
    if (mode === "off") return;
    // The command carries the path and the range in SEPARATE fields, so putting them back together is
    // what tells the difference between "point at the file" and "point at these lines in it". Without
    // it a `--file x#L20-30` resolved to the pane and drew a dashed box around the whole centre panel.
    const fileTarget = args.lines
      ? `${args.file}#L${args.lines[0]}-${args.lines[1] || args.lines[0]}`
      : args.file;
    const target =
      cmd === "nav" && args.stats
        ? { region: "reports" }
        : cmd === "nav" && args.file
          ? { file: fileTarget }
          : cmd === "nav" && args.report
            ? (args.lines ? { docLines: args.lines } : { region: "center" })
            : cmd === "nav" && args.tab
              ? { region: args.tab }
              : cmd === "nav" && args.namespace
                ? { namespace: args.namespace }
                : cmd === "highlight"
                  ? args.file
                    ? { file: fileTarget }
                    : { namespace: args.namespace }
                  : cmd === "show"
                    ? { region: "tv" }
                    : cmd === "act"
                      ? { region: args.run ? "center" : "scratchpad" }
                      : // REFRESH POINTS AT NOTHING. It reloads data; it isn't the agent showing you
                        // something, so there is nothing to look at and the bot shouldn't travel.
                        // Every other command names a thing on screen — this one names a chore.
                        null;
    if (!target) return;
    // Same errand the deliberate half uses — so the bot really does travel to the stats tab — but
    // ambient: dashed, and it says nothing. The trip is the message.
    // THE CALL-OUT. The command already writes its own sentence — "pulled up api/Chats.js#L320-334"
    // — and that sentence is exactly what the bot should be saying while it stands there. It was
    // being thrown away, so the bot travelled in silence with an empty dialogue box.
    setTimeout(() => enqueuePoint(target, label || null, "ambient"), 420);
  };

  // Which commands this tab has already run, and when it opened. Together they are the whole
  // replay rule: history never executes, and nothing executes twice no matter which path delivered it.
  const mountTsRef = useRef(Date.now());
  const execedRef = useRef(new Set());
  // Record ids whose side-effects (forward/showSaid/unread/animate) have already run — the
  // same-record-twice guard for the chat-updated handler; see the comment there.
  const seenRecordsRef = useRef(new Set());
  // Landing exactly where you already are must not cost a history entry — pressing the same
  // receipt five times should not mean five clicks of Back (his catch). Different destination:
  // push, as always.
  const go = (loc) => {
    const next = typeof loc === "string" ? loc : `${loc.pathname}${loc.search || ""}`;
    if (next === `${window.location.pathname}${window.location.search}`) return;
    history.push(loc);
  };
  const execCommand = (record, { replay = false } = {}) => {
    const { cmd, args = {}, label, say } = record || {};
    // PRESSING THE RECEIPT JUST TAKES YOU BACK THERE. The animation belongs to the agent arriving
    // and saying something; a receipt is a bookmark you're clicking yourself, and watching the bot
    // re-perform the whole trip every time you use one is noise. It clears any gesture standing in
    // the way and navigates. (The dedupe guards are only about pointing, so they go with it.)
    if (replay) {
      if (endErrandRef.current) endErrandRef.current();
      lastPointRef.current = { key: "", at: 0 };
      revealTriedRef.current.clear();
    } else {
      // The agent's own sentence wins over the generated label — `--say` is it saying what it MEANT,
      // the label is only a description of what the command did.
      animateCommand(cmd, args, say || label);
    }
    try {
      if (cmd === "nav") {
        if (args.stats) {
          // RFC-032 — walk the human to the Stats page. The URL push covers a fresh mount (Reports
          // reads its query on init); the event covers the already-standing-there case, where a
          // same-route push doesn't remount and the query init never re-runs.
          const s = args.stats;
          const sp = new URLSearchParams();
          if (s.service) sp.set("service", s.service);
          if (s.report && s.report !== "state") sp.set("report", s.report);
          if (s.range && s.range !== "all") sp.set("range", s.range);
          go({ pathname: `/reports/${projectCode}`, search: sp.toString() ? `?${sp}` : "" });
          window.dispatchEvent(
            new CustomEvent("sv:navStats", { detail: { projectCode, ...s } }),
          );
          return;
        }
        if (args.file) {
          // NAVIGATE. His distinction, and I kept blurring it: a `:file[…]` LINK reveals and
          // highlights in the tree; the COMMAND pulls the file up. So this writes the file params
          // itself — every one of them, in a single push — and sends no reveal at all. The reveal
          // was the churn: a second writer for the same intent, and the line range died in the gap
          // between them (twice, both times found by his view stamp rather than by me).
          const p = new URLSearchParams(window.location.search);
          if (!p.get("file")) {
            p.set("fnav", "files");
            p.set("ftab", p.get("tab") || "docs");
          }
          p.set("tab", "docs"); // the file IS the centre now — not selected behind the Stage
          p.delete("help");
          p.delete("rdoc"); // …and not behind a report either
          p.set("file", args.file);
          p.set("fproj", projectCode);
          // A FILE NEEDS A SERVICE TO COME FROM. The pane fetches through a connected service, and
          // with none it finds no host and CLOSES ITSELF — restoring the tab you came from, which
          // is why every attempt landed back on the Stage with nothing open. The earlier partial
          // success only worked because a different writer happened to supply `fsvc`.
          //
          // Prefer the service the human is standing in; otherwise this project's first one.
          const svc =
            (connectedServices || []).find(
              (x) => x.projectCode === projectCode && x.serviceId === serviceId,
            ) || (connectedServices || []).find((x) => x.projectCode === projectCode);
          if (svc) p.set("fsvc", svc.serviceId);
          p.set("flang", langFromPath(args.file));
          if (args.lines && args.lines[0]) p.set("flines", args.lines.join("-"));
          else p.delete("flines");
          const pathname = window.location.pathname.startsWith(`/specs/${projectCode}`)
            ? window.location.pathname
            : `/specs/${projectCode}`;
          go({ pathname, search: `?${p.toString()}` });
          return;
        }
        const params = new URLSearchParams(window.location.search);
        let pathname = window.location.pathname;
        // A command is scoped to THIS bot's project. If the human is standing on another
        // project's page, jump there first — found live: `nav --report` set rdoc while he stood
        // on BUApp, so a systemview-test report "opened" into a project that doesn't have it,
        // and nothing visibly happened.
        const inProject = pathname.startsWith(`/specs/${projectCode}`);
        if (args.namespace)
          pathname = `/specs/${projectCode}/${String(args.namespace).replace(/[./]+/g, "/")}`;
        else if (!inProject) pathname = `/specs/${projectCode}`;
        if (args.report) {
          params.set("tab", "reports");
          // Same rule as the TV hand-off: file params belonging to another project do not travel.
          if (params.get("fproj") && params.get("fproj") !== projectCode)
            ["file", "fproj", "fsvc", "flang", "flines", "fside"].forEach((k) => params.delete(k));
          // A RANGE MAY STILL BE GLUED TO THE PATH. Older CLIs (and anyone hand-writing a link)
          // send `report.md#L274-L378` whole, which then goes looking for a file literally called
          // that and finds nothing — the report just doesn't open. Split it here, and accept the
          // `#L274-L378` spelling as well as `#L274-378`.
          const m = String(args.report).match(/^(.*?)#L(\d+)(?:-L?(\d+))?$/i);
          params.set("rdoc", m ? m[1] : args.report);
          if (m && !args.lines) args.lines = [Number(m[2]), Number(m[3] || m[2])];
        }
        if (args.tab) params.set("tab", args.tab);
        if (args.help) params.set("help", args.help);
        go({ pathname, search: `?${params.toString()}` });
      } else if (cmd === "highlight") {
        // POINT, don't navigate — his rule: highlight and selection are two different commands.
        // The tree expands to the target, marks it, scrolls it into view; the center is untouched.
        if (args.file) {
          window.dispatchEvent(
            new CustomEvent("sv:revealInNav", {
              detail: { kind: "file", path: args.file, projectCode, lines: args.lines || null },
            }),
          );
        } else if (args.namespace) {
          const segs = String(args.namespace).split(/[./]+/).filter(Boolean);
          window.dispatchEvent(
            new CustomEvent("sv:revealInNav", {
              detail: {
                kind: "namespace",
                projectCode,
                serviceId: segs[0],
                moduleName: segs[1],
                methodName: segs[2],
              },
            }),
          );
        }
      } else if (cmd === "show") {
        // THE TV: auto-populates on a live show (his call), clears on --clear. Content is in the
        // record, so this needs nothing but state.
        if (args.clear) {
          setTv(null);
          setTvOpen(false);
        } else if (args.report) {
          // RFC-040 — A DOCUMENT-BACKED SHOW. The record carries a POINTER, not the text, so the
          // TV has to READ the file. This branch only ever tested `args.text`, so once reports
          // became documents a live push did nothing at all here: whatever you were last looking
          // at stayed up, and the new report was only findable through the picker. His words:
          // "every time a new report came before, it became the one you'd open up to."
          openShow(record.id, record.label || "show", null, record.ts, args);
        } else if (args.text) {
          setTv({ id: record.id, text: args.text, label: record.label || "show", ts: record.ts });
          setTvOpen(true);
        }
      } else if (cmd === "refresh") {
        window.dispatchEvent(
          new CustomEvent("sv:refresh", { detail: { scope: args.scope || "all" } }),
        );
      } else if (cmd === "act") {
        if (args.run) {
          // Press a :::run block's play in whatever document is open — no navigation; the block
          // matches by title and runs in place.
          window.dispatchEvent(
            new CustomEvent("sv:act", { detail: { kind: "run", target: args.run, projectCode } }),
          );
        } else if (args.test) {
          // The pending act survives a remount (the panel may need to navigate/refetch first);
          // TestPanel consumes it when it can see the matching saved test. 60s shelf life.
          try {
            sessionStorage.setItem(
              "sv.pendingAct",
              JSON.stringify({ target: args.test, projectCode, ts: Date.now() }),
            );
          } catch {}
          // The saved test lives in THIS bot's project — if the human is standing elsewhere,
          // walk them over (project level aggregates every saved test); the remounted panel
          // then consumes the pending act from its savedTests load.
          if (!window.location.pathname.startsWith(`/specs/${projectCode}`))
            go({ pathname: `/specs/${projectCode}`, search: window.location.search });
          window.dispatchEvent(new CustomEvent("sv:openScratchpad"));
          window.dispatchEvent(
            new CustomEvent("sv:act", {
              detail: { kind: "test", target: args.test, projectCode },
            }),
          );
        }
      }
    } catch {}
  };

  // A programmatic scroll fires a scroll EVENT, and the handler below reads that event to decide
  // whether he is still pinned to the bottom. Left ungated, our own pin could measure itself
  // mid-layout, decide he had scrolled away, and switch sticking off for the rest of the session —
  // one bad frame and the chat never follows anything again.
  const pinning = useRef(0);
  const scrollToEnd = () => {
    const el = listRef.current;
    if (!el) return;
    pinning.current = Date.now() + 300;
    el.scrollTop = el.scrollHeight;
  };
  // Opening the panel lands you at the LATEST message — the list mounts on open, so scroll after
  // it exists.

  // AND SO DOES ATTACHING. A resumed conversation arrives as a wall of replayed messages, and it
  // was landing him at the TOP of it — his catch: *"I have to scroll all the way from the top back
  // down to the bottom."* Nobody opens a conversation to read the beginning again.
  //
  // STICKY, NOT FORCED. Once it is open, new rows only pull the view down if he is ALREADY near the
  // bottom — yanking the scroll while he is reading something further up is the same disrespect in
  // the other direction. Attaching itself always lands at the end, because that is the arrival.
  // THE CLOSED BUBBLE HAS TO SPEAK FOR THE CONVERSATION HE IS ACTUALLY IN. Both the preview and the
  // cooking line still read the ROOM — his catch: *"the chat preview when the chat is closed is
  // currently coming from the old chat, not the new chat."* While attached, the session is the chat,
  // so it owns both. This is the first half of the teardown: the bubble stops depending on the room
  // before the room goes, rather than after, so nothing goes dark in between.
  const saidRows = attached
    ? work.rows.filter((r) => r.kind === "say" && !r.replay && String(r.text || "").trim())
    : [];
  const seenAt = (() => {
    try { return Number(localStorage.getItem(`sv.chatSeen.${projectCode}`)) || 0; } catch { return 0; }
  })();
  const freshSaid = saidRows.filter((r) => (r.ts || 0) > seenAt);
  // A replay row has no business raising an unread count — those are messages he has already read,
  // arriving again because he resumed the conversation.
  const sessionUnread = attached ? freshSaid.length : 0;
  // OPEN MEANS SEEN — for the SESSION'S rows, not only the room's. The room stamp lives in the
  // chat-message handler, which never fires for a reply that exists only in the session feed — so
  // a reply he watched land stayed "fresh" forever, and the instant he closed the panel the peek
  // popped up to show him the conversation he had just left. His catch: *"the preview shows right
  // after I close the chat — I was already in the chat, so there's no messages that I didn't see."*
  // While the panel is open, whatever the session says is read as it arrives — the rule the room
  // has always had (the handler stamps record.ts on every arrival while open). Stamped with the
  // ROW'S ts rather than the wall clock, so a bridge clock running ahead of ours can't leave the
  // newest message forever unread.
  const sawOpenRef = useRef(false);
  const [, seenBump] = React.useReducer((n) => n + 1, 0);
  useEffect(() => {
    const closing = sawOpenRef.current && !open;
    sawOpenRef.current = open;
    if (!open && !closing) return; // stamp while open, and once more at the moment of closing
    if (!saidRows.length) return;
    const last = saidRows[saidRows.length - 1].ts || 0;
    if (last > seenAt) {
      try { localStorage.setItem(`sv.chatSeen.${projectCode}`, String(last)); } catch {}
      // The close render already drew with the stale stamp — a write to localStorage repaints
      // nothing on its own, so nudge one re-render and the peek recomputes to empty.
      if (closing) seenBump();
    }
  });

  // The room's last words, for a project with no session. Newest last, capped — this is a holding
  // area, not a second inbox to live in.
  const roomTail = attached ? [] : messages.filter((m) => m.from === "agent" && !m.kind).slice(-12);

  const sessionWrite = useMemo(
    () => ({
      // CLICKABLE FOREVER, the same rule the TV has. He answered "lock once answered", I built it,
      // and then he changed his answer by clicking the other option — which is the argument. Taking
      // something back is a real answer, and a surface that forbids it just means the correction
      // arrives as a sentence instead, which is worse for both of us.
      editable: !!attached,
      setAttr: (line, key, value) => {
        if (!attached) return;
        // NAME WHAT WAS ANSWERED. `answered "157"` arrived on its own and meant nothing to either of
        // us — a value with no question attached is a receipt for a purchase you can't identify. The
        // block only hands back (line, key, value), so the question is found by looking for the
        // directive that owns this value among the rows on screen.
        let about = "";
        try {
          const rows = (workRef.current && workRef.current.rows) || [];
          for (const r of rows) {
            const hit = String(r.text || "")
              .split("\n")
              .find((l) => /^\s*(:{2,3})(question|approval|input)\b/.test(l) && (!value || l.includes(String(value))));
            if (hit) {
              const label = hit.match(/\[([^\]]+)\]/);
              const id = hit.match(/\bid=("?)([^"\s}]+)\1/);
              about = label ? label[1] : id ? id[2] : "";
              if (about) break;
            }
          }
        } catch {}
        const said = value ? `answered "${value}"` : `cleared the ${key || "answer"}`;
        work.send(about ? `${said} — ${about}` : said);
      },
    }),
    // `work.send` is stable (useCallback with no deps); `attached` is what actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [attached],
  );

  const stick = useRef(true);
  // ARRIVING IS ALWAYS THE BOTTOM. Opening the panel, switching chats, attaching a session — every
  // one of those is an arrival, and nobody arrives at a conversation to read the top of it.
  useEffect(() => {
    stick.current = true;
    scrollToEnd();
    const t = [10, 60, 200, 500].map((ms) => setTimeout(scrollToEnd, ms));
    return () => t.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, attached, chat]);
  // NEW ROWS PULL THE VIEW DOWN — in the ROOM as well as in a session. The old effect was gated on
  // `attached`, so the room's chat never followed a new message at all. That gate was the bug he
  // reported twice: *"it doesn't scroll down as new messages come in."*
  useEffect(() => {
    if (stick.current) scrollToEnd();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, work.rows.length]);
  // AND THE OTHER HALF: height that arrives AFTER the rows do. Markdown, file embeds, images and a
  // streaming answer all grow the list milliseconds — sometimes seconds — after React is finished,
  // so a one-shot scroll lands short and then just sits there. Following the content beats guessing
  // when it settles, which is what the old two-timeout version was doing.
  useEffect(() => {
    const el = listRef.current;
    if (!el) return undefined;
    // COALESCED TO ONE PER FRAME. `scrollToEnd` reads `scrollHeight`, which forces a synchronous
    // layout — and the MutationObserver below watches characterData across the whole subtree, so a
    // streaming answer fires it on every few characters. Un-throttled that is a forced reflow per
    // mutation over a list that can hold hundreds of messages, and the whole panel goes gummy: the
    // symptom he noticed was dictation showing interim words but taking a beat to commit them into
    // the input, on a feature neither of us had touched.
    let frame = 0;
    const bump = () => {
      if (!stick.current || frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (stick.current) scrollToEnd();
      });
    };
    // TWO OBSERVERS, because the list grows in two different ways and a count-based effect sees
    // NEITHER of them. Rows arriving is the easy case. The ones that were actually failing him:
    // a streamed answer growing character by character, an embed or image measuring itself late,
    // and the COOKING LINE appearing — *"when you're cooking, I don't see you cooking at the
    // bottom."* None of those change a message count, so nothing was firing.
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(bump) : null;
    if (ro) {
      ro.observe(el);
      Array.from(el.children).forEach((c) => ro.observe(c));
    }
    const mo =
      typeof MutationObserver !== "undefined"
        ? new MutationObserver((recs) => {
            if (ro)
              recs.forEach((r) =>
                Array.from(r.addedNodes).forEach((n) => n.nodeType === 1 && ro.observe(n)),
              );
            bump();
          })
        : null;
    if (mo) mo.observe(el, { childList: true, subtree: true, characterData: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      if (ro) ro.disconnect();
      if (mo) mo.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, attached]);

  useEffect(() => {
    if (!projectCode || !SystemView) return;
    let dead = false;
    const load = async () => {
      try {
        const [history, pres] = await Promise.all([
          SystemView.chatHistory(projectCode, chat, 200),
          SystemView.chatPresence(projectCode),
        ]);
        if (dead) return;
        setMessages(history || []);
        setPresence(pres || {});
        // The TV restores its LAST show from history (content rides in the record) — rendering
        // is passive, so replay is safe here, unlike nav. Open-state is the user's, persisted.
        const lastShow = [...(history || [])]
          .reverse()
          .find((m) => m.kind === "command" && m.cmd === "show" && m.args && m.args.text);
        if (lastShow) {
          // Prefer the CLICKED-UP state (silent TV interactions persist hub-side) — his
          // verdicts and answers must survive a reload, not reset to the pristine show.
          let text = lastShow.args.text;
          try {
            const saved = await SystemView.chatGetTv(projectCode, { chat });
            if (saved && saved.id === lastShow.id && saved.text) text = saved.text;
          } catch {}
          if (!dead) setTv({ id: lastShow.id, text, label: lastShow.label || "show", ts: lastShow.ts });
        }
        // Replies that landed since the last time this panel was open → the green count.
        let seen = 0;
        try { seen = Number(localStorage.getItem(`sv.chatSeen.${projectCode}`)) || 0; } catch {}
        setUnread((history || []).filter((m) => m.from === "agent" && m.ts > seen).length);
        setTimeout(scrollToEnd, 50);
      } catch {}
    };
    load();
    // Presence decays server-side by silence — poll often enough that a disconnect shows without a
    // refresh, and refetch the moment the window regains focus (you look, it's current).
    const refetchPresence = async () => {
      try {
        const pres = await SystemView.chatPresence(projectCode);
        if (!dead) setPresence(pres || {});
      } catch {
        // Unknown beats stale (his catch: a dead visit stayed painted through a hub restart) —
        // when the hub can't answer, show nothing as live; the next good poll repaints truth.
        if (!dead) setPresence({});
      }
    };
    // The thread must survive a lost socket (his catch: "I send a message and it doesn't show
    // until I refresh" — every hub restart drops the event subscriptions while the presence
    // POLL keeps painting, so the room looked half-alive). The same poll now also resyncs the
    // MESSAGE tail and merges by id — pushed events stay the fast path, the poll is the net.
    const resyncMessages = async () => {
      try {
        const hist = await SystemView.chatHistory(projectCode, chat, 200);
        if (dead || !Array.isArray(hist)) return;
        // AND COMMANDS RUN OFF THE POLL TOO. The socket is the fast path, not the only path: a hub
        // restart drops the subscription, and every command sent into that gap used to land in the
        // thread as a receipt and do nothing — "absolutely nothing happened", with the chat still
        // apparently working, which is the worst way for it to fail. The replay rule is intact:
        // only commands issued AFTER this tab loaded, and only once each, ever execute.
        for (const m of hist) {
          if (m.kind !== "command" || m.ts <= mountTsRef.current || execedRef.current.has(m.id)) continue;
          execedRef.current.add(m.id);
          execCommand(m);
        }
        setMessages((prev) => {
          if (
            prev.length &&
            hist.length &&
            prev[prev.length - 1].id === hist[hist.length - 1].id &&
            prev.length >= hist.length
          )
            return prev; // tail matches — no churn
          const seen = new Set(hist.map((m) => m.id));
          const extra = prev.filter((m) => !seen.has(m.id));
          return [...hist, ...extra].sort((a, b) => a.ts - b.ts);
        });
      } catch {}
    };
    const tick = () => {
      refetchPresence();
      resyncMessages();
    };
    const timer = setInterval(tick, 10000);
    window.addEventListener("focus", tick);
    const unsubMsg = SystemView.on(`chat-updated:${projectCode}`, (payload = {}) => {
      const { record } = payload;
      // NOT EVERY chat-updated CARRIES A RECORD. Saving TV state — which is what approving, wrapping
      // a block, or replying in a thread all do — broadcasts { tvEdit } with no record at all. This
      // read `record.id` unconditionally, threw inside a state updater, and took the whole app down
      // to a white page: every interactive block on the TV crashed the thing it was drawn on.
      if (!record || !record.id) return;
      // ONE RECORD, ONE SET OF CONSEQUENCES. The same record can arrive on this channel more than
      // once (the hub has several emit sites for a say, and a room served by its own process pushes
      // up as well). The LIST was already deduped by id — but the side-effects below were not, so a
      // double-emitted visitor message forwarded into the session TWICE: two echoes, two host
      // round-trips, four blocks on his screen ("you're getting four blocks, two of each, every
      // time you send a message"). Everything a record causes now runs exactly once.
      if (seenRecordsRef.current.has(record.id)) return;
      seenRecordsRef.current.add(record.id);
      setMessages((prev) => (prev.some((m) => m.id === record.id) ? prev : [...prev, record]));
      // A command MOVES the screen — that's its own notification; no unread count for it.
      if (record.kind === "command") {
        execedRef.current.add(record.id);
        execCommand(record);
      }
      // VISITING, IN THE NEW WORLD. An agent reaching this project through the CLI used to land in
      // the room and wait for its agent to be "joined" — a hold, an arming ritual, and a whole class
      // of "was anyone listening?". Attached, the conversation IS the agent, so the message goes
      // straight into the session, carrying who sent it. Skipping our own is what stops it talking
      // to itself: a message with no `as` is this project speaking, and forwarding that would loop.
      if (
        attachedRef.current &&
        record.from === "agent" &&
        !record.kind &&
        record.as &&
        record.as !== projectCode
      ) {
        try { workRef.current.send(String(record.text || ""), record.as); } catch {}
      }
      // AND THE HOME AGENT'S OWN MESSAGES ARE NOT INVISIBLE. This is the one that cost him the whole
      // evening: attached, the room is out of the panel, and a `systemview say` from this project's
      // own agent had nowhere on earth to render. He kept going back to look for a commit block that
      // was genuinely in the room and genuinely rendering — on a surface he was no longer looking at.
      // It is SHOWN, not sent: the session already IS this agent, so feeding it back to the model
      // would have it answering itself.
      else if (attachedRef.current && record.from === "agent" && !record.kind && !record.as) {
        try { workRef.current.showSaid(String(record.text || "")); } catch {}
      }
      // `!record.kind` restated, because the command branch above is no longer chained to this one:
      // a command moves the screen, which is its own notification, and must not raise unread.
      else if (record.from === "agent" && !record.kind && !openRef.current) setUnread((n) => n + 1);
      // THE MESSAGE ARRIVING IS WHAT ANIMATES (his correction: "do not make links and animation the
      // same thing"). An agent naming a thing in what it says IS the gesture — the bot goes there
      // as the words land. Clicking a chip afterwards is just a link, and stays one; he retracted
      // wanting a replay: "there's no reason to rerun it, I can just ask you to do it again".
      //
      // Live arrivals only. Loading history must never re-perform old gestures — the same replay
      // rule commands already follow.
      if (record.from === "agent" && !record.kind) animateMessage(record.text);
      if (openRef.current) {
        try { localStorage.setItem(`sv.chatSeen.${projectCode}`, String(record.ts)); } catch {}
      }
      setTimeout(scrollToEnd, 50);
    });
    const unsubStatus = SystemView.on(`chat-status:${projectCode}`, ({ statuses, text, as }) => {
      // Per-identity cooking: the emit carries the room's FULL set of lines. Legacy single-line
      // payloads (older hub) still work through the fallback.
      const lines = statuses || (text ? [{ as: as || null, text }] : []);
      setPresence((prev) => ({
        ...prev,
        [chat]: { ...(prev[chat] || {}), statuses: lines, status: text, statusAs: as || null },
      }));
    });
    // Presence PUSHES on join/leave/drain — the ring flips the moment it happens, no refresh.
    const unsubPresence = SystemView.on(`chat-presence:${projectCode}`, (pres) => {
      if (!dead && pres) setPresence(pres);
    });
    return () => {
      dead = true;
      clearInterval(timer);
      window.removeEventListener("focus", tick);
      if (unsubMsg) unsubMsg();
      if (unsubStatus) unsubStatus();
      if (unsubPresence) unsubPresence();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectCode, SystemView && true]);

  // ---- drag ANYWHERE on the bot — the cursor IS the handle (grab/grabbing), no visible grip.
  // Movement is the tell: past a small threshold it's a drag; under it, the click it always was.
  // The drag's trailing click is suppressed so a drop never toggles the panel.
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const suppressClickRef = useRef(false);
  // Drawn only while you are actually moving something: the dock line, so you can SEE the thing
  // bots gravitate to and where a drop will land, instead of inferring it from their behaviour.
  const [dragging, setDragging] = useState(false);
  const onBotPointerDown = (e) => {
    const el = rootRef.current;
    if (!el) return;
    // GRABBING THE BOT DOES NOT END THE GESTURE. It stops the bot FOLLOWING the target — from here
    // the human is placing it — but the dialogue box and the pointer stay, and the line redraws from
    // wherever they put it, because it is measured off the bot every frame. Moving the agent around
    // while it is still pointing is the whole ask.
    const errand = errandRef.current;
    if (errand && errand.follow) {
      clearInterval(errand.follow);
      errand.follow = null;
    }
    const r = el.getBoundingClientRect();
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: r.left, origY: r.top, w: r.width, h: r.height, moved: false };
    const move = (ev) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = ev.clientX - d.startX;
      const dy = ev.clientY - d.startY;
      if (!d.moved && Math.abs(dx) + Math.abs(dy) < 6) return;
      d.moved = true;
      // THE WHOLE ASSEMBLY STAYS ON SCREEN — the panel and the docked lane, not just the bot. The
      // panel hangs up-and-left off the bot, so its width and height decide how close to an edge the
      // bot may go. This is what makes flipping unnecessary: there is no position where the layout
      // would have to mirror itself to stay visible.
      // THE BOT MOVES FREELY — clamped by its OWN footprint and nothing else. Folding the open
      // panel's width and height into this limit meant that with the chat open the bot could not be
      // dragged below about a third of the screen: every drag ended up near the top, over the dock
      // line, and snapped into a slot. That was the gravitating. Where you put it is where it goes;
      // if the panel then doesn't fit, opening one is what adjusts, not the drag.
      setPos({
        x: clamp(d.origX + dx, DOCK_EDGE, Math.max(DOCK_EDGE, window.innerWidth - d.w - DOCK_EDGE)),
        y: clamp(d.origY + dy, DOCK_EDGE, Math.max(DOCK_EDGE, window.innerHeight - d.h - DOCK_EDGE)),
      });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      const d = dragRef.current;
      dragRef.current = null;
      setDragging(false);
      // The side settles HERE, once, on the drop — never mid-drag.
      if (posRef.current) setFlip(posRef.current.x > window.innerWidth / 2);
      if (!d || !d.moved) return;
      suppressClickRef.current = true;
      setTimeout(() => { suppressClickRef.current = false; }, 0);
      // NOTHING GRAVITATES. A drag lands where you let go — there is no lane to fall into any more:
      // docking is going home to the codebase card, which is a deliberate gesture (double-click the
      // face, the ↗ to come back out, or the hub's dock-all), never something a drag does to you.
      // Keep it on screen and remember where it is. No snapping of any kind.
      setPos((cur) => {
        if (!cur) return cur;
        let { x, y } = cur;
        const W = window.innerWidth;
        const H = window.innerHeight;
        const snapped = {
          x: clamp(x, DOCK_EDGE, W - d.w - DOCK_EDGE),
          y: clamp(y, DOCK_EDGE, H - d.h - DOCK_EDGE),
        };
        try { localStorage.setItem(`sv.chatPos.${projectCode}`, JSON.stringify(snapped)); } catch {}
        return snapped;
      });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const send = async () => {
    // SEND WHILE THE MIC IS STILL RUNNING (his ask: "I used to be able to just send and not have to
    // stop the recorder"). Host dictation commits at every pause, but the sentence you are in the
    // middle of has not committed yet — so sending forces that segment to finish and takes it along.
    // Without this, pressing send mid-breath silently drops your last few words.
    let spoken = "";
    if (listening && hostMicRef.current) {
      try {
        spoken = (await hostMicRef.current.flush()) || "";
      } catch {}
    }
    const text = [input.trim(), spoken.trim()].filter(Boolean).join(" ");
    // PRESSING SEND WHILE THE WORDS ARE STILL LANDING. His bug, and it wasted his time all session:
    // *"if I press send while the chat is building up — I can see the transcript building up, it
    // didn't go into the input yet — then it won't do anything, it'll just stay there and I'm
    // waiting."* Host dictation commits a segment ASYNCHRONOUSLY into the box, so there is a real
    // window where he has finished speaking, can SEE the words arriving, and the input is still
    // empty. `if (!text) return` threw that press away, and the transcript then landed in a box
    // nobody was going to send. A press is an intention, not a snapshot — so when the mic is live
    // and there is nothing yet, the send is ARMED and fires the moment the words arrive.
    if (!text) {
      if (listening || hostMicRef.current) armedSend.current = Date.now();
      return;
    }
    armedSend.current = 0;
    // Sending ends the dictation — you said what you had to say (his call). `onend` arrives a beat
    // later, so drop the flag HERE: otherwise the transcript panel hangs on screen after the
    // message is already gone, which reads as it popping up because you sent something.
    if (listening) {
      setListening(false);
      setInterim("");
      try { if (recRef.current) recRef.current.stop(); } catch {}
      if (hostMicRef.current) {
        const rec = hostMicRef.current;
        hostMicRef.current = null;
        rec.cancel(); // already flushed above — nothing left to transcribe
      }
    }
    setInput("");
    // SENDING IS AN ARRIVAL, and it is the one case that overrides sticking. Incoming messages are
    // sticky-only on purpose — they must never yank the view while he is reading further up. His
    // OWN message is the opposite: he just spoke, so the bottom is where he is, whatever the scroll
    // was doing a moment ago. His catch, exactly: *"like when I send a message, not when the
    // messages come through."* Once this flag is back on, the list observers carry the rest — the
    // echo row, the answer streaming in, and the cooking line under it.
    stick.current = true;
    scrollToEnd();
    // SENDING MEANS YOU'VE SEEN WHAT'S THERE. Without this, sending from the CLOSED chat left the
    // unread count standing — nothing stamps "seen" except opening the panel — so the next poll
    // recomputed it and shoved the new-message display back on screen the moment you sent. It read
    // as "the preview pops up because I sent a message", and that's exactly what was happening.
    setUnread(0);
    try { localStorage.setItem(`sv.chatSeen.${projectCode}`, String(Date.now())); } catch {}
    // Shrink the grown textarea back to one line — HERE, so every send path (Enter, the send
    // button, mic flows) resets it, not just the keyboard one.
    if (inputRef.current) inputRef.current.style.height = "auto";
    // The vantage point, stamped NOW — the reader arrives later, after you've moved on.
    // RFC-029: the THREE-SECTION breakdown (nav / center / scratchpad), mostly a URL decode —
    // "on stage" says WHICH report, "in the scratchpad" says which namespace it's pointed at.
    const params = new URLSearchParams(location.search);
    const nsSelected = [serviceId, moduleName, methodName].filter(Boolean).join("/") || null;
    // RFC-032 — standing on the Stats page stamps a stats-shaped view: which project's stats,
    // which tab, what time window, which service is focused. Agents read view.page first.
    const onStats = location.pathname.startsWith("/reports");
    const view = onStats ? {
      path: location.pathname + location.search,
      page: "stats",
      projectCode,
      stats: {
        project: decodeURIComponent(location.pathname.split("/")[2] || "") || null,
        report: params.get("report") || "state",
        range: params.get("range") || "all",
        service: params.get("service") || null,
      },
    } : {
      path: location.pathname + location.search,
      page: "specs",
      projectCode,
      nav: {
        lens: localStorage.getItem("sv.navTab") || "systemlynx",
        selected: nsSelected,
        open: localStorage.getItem("sv.navOpen") !== "false",
      },
      center: {
        tab: params.get("tab") || "docs",
        rdoc: params.get("rdoc") || null,
        openFile: params.get("file") || null,
        help: params.get("help") || null,
      },
      scratchpad: {
        open: localStorage.getItem("sv.scratchOpen") !== "false",
        namespace: nsSelected || projectCode,
      },
      // Legacy flat fields — existing hooks/agents already parse these; keep them true.
      namespace: { serviceId, moduleName, methodName },
      tab: params.get("tab") || "docs",
      openFile: params.get("file") || undefined,
      help: params.get("help") || undefined,
    };
    // ATTACHED? THEN THIS IS THE AGENT, NOT THE ROOM. Nothing is written to the chat file — the
    // conversation is the session's own transcript on disk, which is the whole point: one place the
    // conversation lives, and it is the same file whether it runs here or in a terminal.
    if (attached) {
      // A SEND THAT GOES NOWHERE MUST SAY SO. If the transport is not there, silently falling back
      // to the room would put his message in the place he just left — worse than an error.
      if (!workRef.current.send(text)) setSendErr("the session isn't accepting input — try 'back to the room' and re-attach");
      else setSendErr("");
      // …AND THE VISITORS STILL HEAR HIM. His catch: *"Autobot is in your room right now. He's not
      // going to get a notification that I'm talking. I've noticed that."* He had noticed correctly.
      // The fan-out used to live inside the room write, and an attached send deliberately writes
      // nothing to the room — so visiting worked room-to-room and did nothing in the one place he
      // actually talks to his agent. This writes nothing either; it only delivers. His rule was
      // never about the room: *"when I speak, it just means it should send a visitor message to the
      // other agent."* WHEN, not WHERE.
      // NO CLIENT-SIDE GATE. This said `if (subscribed.length)` and that was the bug that made his
      // test look like the feature was dead: `subscribed` is a list this panel FETCHED once, so an
      // empty or stale copy silently cancelled every relay while the hub knew perfectly well who
      // was subscribed. The roster said autobot was there, the hub agreed, and the browser's own
      // cached array — the only opinion that had no business deciding — said no. Same class as
      // every meter today: a local belief standing in for the authority. The hub owns the list; it
      // returns `relayed: 0` when nobody is subscribed, which costs nothing.
      SystemView.chatRelay(projectCode, { chat, text })
        .then((r) => r && r.to && r.to.length && setLastRelay({ to: r.to, ts: Date.now() }))
        .catch(() => {});
      setTimeout(scrollToEnd, 50);
      return;
    }
    try {
      // OPTIMISTIC: the returned record goes straight into the thread — your own message must
      // never depend on the push channel to become visible (his catch: send → nothing → refresh).
      const rec = await SystemView.chatSend(projectCode, { chat, from: "you", text, view });
      if (rec && rec.id)
        setMessages((prev) => (prev.some((m) => m.id === rec.id) ? prev : [...prev, rec]));
      setTimeout(scrollToEnd, 50);
    } catch {}
  };

  // …AND IT FIRES WHEN THE WORDS ARRIVE. The other half of the armed send: the press happened, the
  // input was empty, and a moment later dictation commits its segment. Watching `input` is the right
  // trigger because that IS the arrival — no timer guessing how long a transcript takes.
  const sendRef = useRef(null);
  sendRef.current = send;
  useEffect(() => {
    if (!armedSend.current) return;
    if (Date.now() - armedSend.current > ARMED_WINDOW) {
      armedSend.current = 0; // an intention this old is not an intention
      return;
    }
    if (!input.trim()) return;
    armedSend.current = 0; // clear BEFORE sending, or the send's own setInput re-enters this
    if (sendRef.current) sendRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input]);

  // RFC-031 — the roster: who's in this room besides its own agent, and where this project's
  // own agent is off visiting (both derived hub-side from real holds, so they can't lie).
  // ATTACHED, THE ROSTER IS THE SESSION'S. The hub's roster is built from real holds in a ROOM, and
  // a peer agent reaching into a session takes no hold anywhere — so on an attached chat `p.visitors`
  // is permanently empty and the strip said "nobody" while another agent was plainly talking. Who
  // has SPOKEN is the honest answer here (foldState collects it), and it is the same rule underneath:
  // you can always see who is in whose chat.
  // SPOKE LAPSES. His rule: *"spoke needs to just have a time lapse — disappear once the message
  // is not new in the chat."* So a bare "spoke" chip only stands while that turn is still near the
  // end of the conversation; after that the name is in the transcript, which is where history
  // belongs, and the strip goes back to naming who is actually here. Subscribed visitors never
  // lapse — they are present until removed.
  const SPOKE_TAIL = 12;
  // WHO SPOKE RECENTLY, AND WHERE THEIR LAST SENTENCE IS. The name alone would be trivia; the row
  // key is what makes the chip a way BACK to the thing it is telling you about — the one row you go
  // looking for after the fact ("who was that and what did they say"). Feed stamps `data-row` on a
  // visitor's turn for exactly this. Subscribed visitors are named at the top as presence and do not
  // repeat down here; this bar is only for people who are gone.
  const spokeMarks = attached
    ? (() => {
        const subs = new Set((subscribed || []).map((v) => (typeof v === "string" ? v : v && v.identity)));
        const seen = new Map();
        (work.rows || []).slice(-SPOKE_TAIL).forEach((r) => {
          if (r.as && !subs.has(r.as) && !(spokeCleared[r.as] && (r.ts || 0) <= spokeCleared[r.as]))
            seen.set(r.as, r.key);
        });
        return [...seen].map(([as, key]) => ({ as, key }));
      })()
    : [];
  // ONE VALUE, TWO SURFACES. This computed "who spoke recently" a SECOND time, separately from
  // `spokeMarks` above — so the dots on the agent's icon and the chips above the chat box were two
  // independent answers to the same question, and clearing a chip changed one of them. His words,
  // and they are the whole bug: *"they're not tied to the same value, and that's the problem."*
  // They are now: the strip and the pips read this, `subscribed` is the visitor list, and the two
  // never mix.
  const visitors = attached ? spokeMarks.map((m) => m.as) : p.visitors || [];
  // WHO IS IN THIS CONVERSATION — the subscription list, and nothing else. Attached, that is the
  // hub's list for this chat; in a room it is the room's. This is what the star reads.
  const inHere = attached
    ? (subscribed || []).map((v) => (typeof v === "string" ? v : v && v.identity)).filter(Boolean)
    : p.visitors || [];
  // The hub's subscription list, refreshed when the conversation changes hands.
  useEffect(() => {
    if (!attached) {
      setSubscribed([]);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const list = await SystemView.chatVisitors(projectCode);
        if (alive) setSubscribed(Array.isArray(list) ? list : []);
      } catch {}
    })();
    // …and it stays true. Fetching once meant the roster showed whatever was true at mount: remove a
    // visitor and the chip sat there claiming they were still listening. The hub announces every
    // change to the list now, so the strip is a live answer instead of a snapshot with a long shelf
    // life. Anything that says who is here has to move when who is here moves.
    const off = SystemView.on(`chat-visitors:${projectCode}`, (payload = {}) => {
      if (alive && Array.isArray(payload.visitors)) setSubscribed(payload.visitors);
    });
    return () => {
      alive = false;
      if (typeof off === "function") off();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attached, projectCode]);
  const visiting = p.visiting || [];
  // Visiting counts as LIVE (his rule: "if you're visiting other people then you're actually
  // live") — a real hold somewhere is a live agent, just not in this room right now.
  // BUSY (his design: the ring answers "if I send this right now, when does it land?"): the
  // home agent's cooking line is fresh but NO line is held — really working, head down, and a
  // message will WAIT until it checks back. Derived (status ts + hold flag), so it can't lie —
  // and it's the tell for an agent that didn't re-arm before cooking (agents/chat.md step 3).
  const busy =
    !p.live && (p.statuses || []).some((s) => !s.as) && !visiting.length;
  // THE RING WAS ANSWERING A QUESTION NOBODY IS ASKING ANY MORE. Every branch below reads the ROOM's
  // presence — a hub-side hold, a file listener, a status record — and an attached session has none
  // of those, so the bot sat permanently grey-and-offline while the agent it belongs to was right
  // there working. His catch: *"the different colors that the circle around the icon… that's going
  // based on the previous behavior. We got to fix that."*
  //
  // The question the ring answers is unchanged — IF I SPEAK RIGHT NOW, WHAT HAPPENS? — so the
  // answers keep their colours and only their source moves: green it answers, amber it is head down,
  // indigo it is waiting on YOU, grey it is gone. The room's rules stay for a project with no
  // conversation attached, which is still a real state.
  const sessionRing = attached
    ? work.state.exited
      ? "none"
      : work.state.state === "working"
      ? "busy"
      : work.state.state === "waiting"
      ? "asking"
      : work.live
      ? "live"
      : "none"
    : null;
  const ring = sessionRing || (p.live ? "live" : visiting.length ? "visiting" : busy ? "busy" : p.listener ? "listener" : "none");
  const sessionMode = sessionRing && { live: "LIVE", busy: "BUSY", asking: "ASKING", none: "OFFLINE" }[sessionRing];
  const mode = sessionMode || (p.live ? "LIVE" : visiting.length ? "VISITING" : busy ? "BUSY" : p.listener ? "FILE" : "OFFLINE");
  const sessionModeText = sessionRing
    ? sessionRing === "busy"
      ? `working — ${work.state.doing || "head down"}`
      : sessionRing === "asking"
      ? `waiting on you — ${work.state.doing || "needs an answer"}`
      : sessionRing === "live"
      ? visitors.length
        ? `in this conversation — ${visitors.join(" + ")} here too`
        : "in this conversation — answers now"
      : work.state.exited
      ? `this conversation ended — ${work.state.exited}`
      : "connecting to this conversation"
    : null;
  const modeText = sessionModeText || (p.live
    ? visitors.length
      ? `joined — ${visitors.join(" + ")} in the room too`
      : "joined — answers now"
    : visiting.length
    ? `live — visiting ${visiting.join(", ")}`
    : busy
    ? `head down cooking — ${p.pending ? `${p.pending} message${p.pending === 1 ? "" : "s"} waiting` : "has your messages"}; replies when it surfaces`
    : p.listener
    ? `hears you at its next turn — send freely, nothing is ever lost${p.pending ? ` · ${p.pending} waiting` : ""}`
    : `out right now — your message waits in the room for its next wake${p.pending ? ` · ${p.pending} waiting` : ""}`);
  // LEFT/RIGHT FLIPS, UP/DOWN DOES NOT (his call). Past the middle of the screen the row opens
  // leftward off the bot instead of rightward — otherwise a bot parked on the right has nowhere to
  // put a panel and everything gets shoved back inward. It settles on the DROP, not continuously,
  // so the layout doesn't swap sides under your cursor while you're still dragging.
  const [flip, setFlip] = useState(() => (pos ? pos.x > window.innerWidth / 2 : true));
  const leftHalf = !flip;
  // The panel always opens DOWNWARD off the bot — the bot is its top corner, wherever it sits.
  const topHalf = false;

  // THE COLLECTOR — every link/show in the room, resurfaceable (his ask). Opening it fetches
  // the WHOLE file (the thread itself caps at 200), then it's a pure lens over those records.
  // OPENING A REPORT MUST BRING HIS ANSWERS WITH IT. Both the links panel and the thread's 📺 line
  // used to put the record's PRISTINE text on the TV, so reopening a report he had already answered
  // showed it blank — his picks looked lost even though the hub still held every one of them. (Found
  // live, minutes after per-report state shipped: "I don't see my options that I just chose and
  // neither one anymore.") The mount-restore path already did this correctly; these two didn't.
  // RFC-040 — the project's plugin, reachable from openShow. A ref rather than the memo directly:
  // the memo is declared hundreds of lines below, and naming it in a dependency array up here is a
  // TDZ crash (the same shape that took every bot off the page once already).
  const projPluginRef = useRef(null);
  // Same naming the CLI and the Reports tab use — one rule for where a report lives.
  const reportPathFor = (name) =>
    `.systemview/report.${String(projectCode).replace(/[^a-zA-Z0-9._-]+/g, "-")}.${String(name)
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80)}.md`;
  const openShow = React.useCallback(
    async (id, label, pristineText, ts, report) => {
      let text = pristineText;
      let path = report && report.path;
      // A POINTER SHOW LIVES IN A FILE. Read the document, and remember where it came from so that
      // answering in it writes back to the document rather than into a chat record.
      if (report && projPluginRef.current) {
        try {
          const res = await projPluginRef.current.readFile({ path: report.path });
          text = res.content;
        } catch {
          text = `> This report points at \`${report.path}\` and the document could not be read.`;
        }
      } else {
        try {
          const saved = await SystemView.chatGetTv(projectCode, { chat, show: id });
          if (saved && saved.id === id && saved.text) text = saved.text;
        } catch {
          /* hub unreachable — the pristine copy is still the right thing to show */
        }
      }
      // WHEN you chose this one. The TV is sticky on purpose — you switch to a report and it stays
      // put — but a report pushed AFTER your pick should be what comes up next time you open the TV
      // ("if I switch, stay with me; but if a new one comes in, that's the one I'd see").
      setTv({ id, text, label: label || "show", ts, path, pickedAt: Date.now() });
      setTvOpen(true);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [SystemView, projectCode, chat],
  );
  // A REPORT ON SCREEN KEEPS ITSELF FRESH. His words: "I had to refresh to see your changes to the
  // report why is that" — because RFC-040 made a report a FILE and the TV read it exactly once, when
  // it opened. An agent editing that file while he watched changed nothing on his screen, and the
  // only way out was the one instruction this app never gets to give: reload the page.
  //
  // So the open document re-reads on a beat and repaints ONLY when the bytes actually changed —
  // an unconditional setTv would rebuild the markdown under him every few seconds and cost him his
  // scroll and any thread he had open.
  useEffect(() => {
    if (!tvOpen || !tv || !tv.path) return undefined;
    let dead = false;
    const id = tv.id;
    const reread = async () => {
      const plugin = projPluginRef.current;
      if (!plugin || dead || document.hidden) return;
      try {
        const res = await plugin.readFile({ path: tv.path });
        if (dead || typeof res.content !== "string") return;
        setTv((prev) =>
          prev && prev.id === id && prev.text !== res.content ? { ...prev, text: res.content } : prev,
        );
      } catch {
        /* the file may be mid-write, or the host may be down — the copy on screen stays */
      }
    };
    const t = setInterval(reread, 4000);
    window.addEventListener("focus", reread);
    return () => {
      dead = true;
      clearInterval(t);
      window.removeEventListener("focus", reread);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tvOpen, tv && tv.id, tv && tv.path]);
  // GRAB A PANEL BY ITS HEADER (his ask). The TV and the links panel are anchored beside the chat,
  // which is the right default but a bad prison — when both are open, or the chat is docked at an
  // edge, the useful place for a report is somewhere else on the screen. Each panel carries its own
  // offset from its anchored position: dragged from the header, persisted per project, and cleared
  // by the same double-click that already resets the size.
  //
  // A movement threshold keeps the header's existing double-click intact — under a few pixels this
  // never becomes a drag, so a double-click still lands as a double-click.
  // THE TV AND THE COLLECTOR DO NOT MOVE ON THEIR OWN. Dragging any header — bot, chat, TV,
  // links — moves the WHOLE assembly, which is what he asked for and what keeps the panels docked
  // to each other. Independent offsets are how a panel got thrown off the page and how the
  // collector stopped sitting next to the TV.
  const wholeThing = { off: { x: 0, y: 0 }, onPointerDown: onBotPointerDown, reset: () => {} };
  const tvDrag = wholeThing;
  const linksDrag = wholeThing;
  // Mirrors the stored setting so the menu shows a tick without re-reading storage on every render.
  const [anim, setAnim] = useState(() => animationMode(projectCode));
  // THE ERRAND — the bot physically goes to what it's pointing at and says its line. It stays there.
  // His words: "the agent icon that hovers around is supposed to be moving around and pointing
  // these things out, and they should have dialogue boxes." The overlay alone drew a box with
  // nobody attached to it; this is what makes it the AGENT pointing rather than the page blinking.
  //
  // It borrows the bot's own position state, so travel obeys everything dragging already does, and
  // it always restores where it was — an errand must never cost the human the spot they parked it.
  const [saying, setSaying] = useState(null); // the dialogue box: { text } while on an errand
  const errandRef = useRef(null); // { follow, startedAt }
  // NOTHING EXPIRES ON A CLOCK. His words: "the agent should stay there until the agent is moved, or
  // if the page is just in that state and nothing changes, the agent wasn't moved." A timer meant you
  // walked over, found the box already gone, and saw only the tail of it — which read as a blink.
  // The gesture ends when something CHANGES: a new point supersedes it, or the human touches the page.
  const endErrandRef = useRef(null);
  // `force` means the target itself is going away — closing the TV takes the pointer with it, and
  // no grace window applies, because there is nothing left to point at.
  const endErrand = React.useCallback((force) => {
    const e = errandRef.current;
    if (!e) return;
    // The reveal-and-retry path scrolls and expands things ~420ms in; a grace window keeps the
    // gesture from cancelling itself before it has finished arriving.
    if (!force && Date.now() - e.startedAt < 1200) return;
    if (e.follow) clearInterval(e.follow);
    errandRef.current = null;
    setSaying(null);
    // IT STAYS WHERE IT WALKED TO. Sending it back to where it started was the thing that made the
    // whole gesture read as fake — and it fought him: he dragged it mid-errand and the errand put it
    // back, so it was in two places. It's one bot that MOVED. Ending a gesture takes the pointer and
    // the dialogue away; it doesn't rewind the bot.
    clearSpotlight();
    lastPointRef.current = { key: "", at: 0 }; // the same target can be pointed at again
    // Gesture over — and the panel STAYS CLOSED (his call). Closing the dialogue is "I am done
    // with this", not "and now put the chat back up"; from where he is sitting the chat was closed
    // and he did not ask for it. The bot icon is right there when he wants it.
    setAnimating(false);
    wasOpenRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  endErrandRef.current = endErrand;
  const goPointRef = useRef(null); // the retry-after-reveal path calls back through this
  const revealTriedRef = useRef(new Set()); // one reveal attempt per target — never a retry loop
  const lastPointRef = useRef({ key: "", at: 0 });
  const goPoint = React.useCallback(
    (target, text, tone = "deliberate") => {
      const mode = animationMode(projectCode);
      if (mode === "off") return false;
      const pointKey = JSON.stringify(target || {});
      if (pointKey === lastPointRef.current.key && Date.now() - lastPointRef.current.at < holdFor(target, tone))
        return true; // already pointing at this — don't restart it under itself
      lastPointRef.current = { key: pointKey, at: Date.now() };
      const root = rootRef.current;
      // LINES IN A RENDERED DOCUMENT — a report or a markdown doc in preview. Same address as a
      // file range; different surface answering it. Blocks, not lines, so the box spans every block
      // the range touches, and it is a box rather than a bare pointer because a document block IS a
      // section — the thing the box was always for.
      if (target.docLines) {
        const [a, b] = target.docLines;
        const rectOf = docRectOf(a, b);
        if (!rectOf) {
          const fkey = `doc:${a}-${b}`;
          if (revealTriedRef.current.has(fkey)) return false;
          revealTriedRef.current.add(fkey);
          setTimeout(() => {
            revealTriedRef.current.delete(fkey);
            if (goPointRef.current) goPointRef.current(target, text, tone);
          }, 420);
          return true;
        }
        revealDocLines(a, b);
        spotlight({ rectOf, mode, tone, from: `[data-sv="bot"][data-sv-pc="${projectCode}"]`, hold: 0 });
        if (mode !== "off" && root) {
          const prev0 = errandRef.current;
          if (prev0 && prev0.follow) clearInterval(prev0.follow);
          const stand = () => {
            const bx = rectOf();
            const rr = root.getBoundingClientRect();
            if (!bx) return;
            setPos({
              x: Math.max(8, Math.min(window.innerWidth - rr.width - 8, bx.left - rr.width - 14)),
              y: Math.max(8, Math.min(window.innerHeight - rr.height - 8, bx.top + bx.height / 2 - rr.height / 2)),
            });
          };
          stand();
          if (text) setSaying({ text });
          errandRef.current = { follow: setInterval(stand, 120), startedAt: Date.now() };
        }
        return true;
      }
      // Lines inside a code editor have no stable element to hold — the editor virtualises them —
      // so the pane publishes a live rect for the focused range and we point at that instead.
      if (target.file && /#L\d/.test(String(target.file))) {
        const focus = window.__svCodeFocus;
        if (focus && typeof focus.rectOf === "function" && focus.rectOf()) {
          // The original pointing, unchanged. The outline he was seeing around the whole centre panel
          // came from the target losing its line range on the way here, not from this — fixing the
          // range and then also redrawing the gesture was one change too many.
          spotlight({ rectOf: focus.rectOf, mode, tone, from: `[data-sv="bot"][data-sv-pc="${projectCode}"]`, hold: 0, box: false, line: true });
          if (mode !== "off") {
            const r0 = focus.rectOf();
            if (r0 && root) {
              const prev0 = errandRef.current;
              if (prev0 && prev0.follow) clearInterval(prev0.follow);
              const stand = () => {
                const b = focus.rectOf();
                const rr = root.getBoundingClientRect();
                if (!b) return;
                setPos({
                  x: Math.max(8, Math.min(window.innerWidth - rr.width - 8, b.left - rr.width - 14)),
                  y: Math.max(8, Math.min(window.innerHeight - rr.height - 8, b.top + b.height / 2 - rr.height / 2)),
                });
              };
              stand();
              if (text) setSaying({ text });
              errandRef.current = { follow: setInterval(stand, 120), startedAt: Date.now() };
            }
          }
          return true;
        }
        // NOT READY YET, AND IT NEVER FALLS BACK TO THE PANEL. A line range that can't be found is
        // silence, not a box around the whole centre panel — that outline is exactly what he was
        // seeing, and it came from giving up on the range and pointing at the pane instead. The pane
        // announces when it has focused a range; wait for that, once, then point properly.
        const fkey = `focus:${target.file}`;
        if (revealTriedRef.current.has(fkey)) return false;
        revealTriedRef.current.add(fkey);
        const stop = () => {
          window.removeEventListener("sv:codeFocused", onFocused);
          clearTimeout(giveUp);
          revealTriedRef.current.delete(fkey);
        };
        const onFocused = () => {
          stop();
          lastPointRef.current = { key: "", at: 0 };
          if (goPointRef.current) goPointRef.current(target, text, tone);
        };
        const giveUp = setTimeout(stop, 6000); // the file never opened — say nothing at all
        window.addEventListener("sv:codeFocused", onFocused);
        return true;
      }
      let el = resolveTarget(target);
      if (!el && target.region) {
        // A COLLAPSED PANEL IS NOT "NOT THERE" (his correction). Open it, then point at it.
        const r = target.region;
        if (r === "tv") setTvOpen(true);
        else if (r === "links") setLinksOpen(true);
        else if (r === "chat") setOpen(true);
        else window.dispatchEvent(new CustomEvent("sv:openRegion", { detail: { region: r } }));
        const key = `open:${r}`;
        if (revealTriedRef.current.has(key)) return false;
        revealTriedRef.current.add(key);
        setTimeout(() => {
          revealTriedRef.current.delete(key);
          if (goPointRef.current) goPointRef.current(target, text, tone);
        }, 420);
        return true;
      }
      if (!el && (target.namespace || target.file)) {
        // Not on screen YET. Ask the navigator to expand to it, then try again — his note:
        // "why don't you navigate to right where the file is being highlighted".
        window.dispatchEvent(
          new CustomEvent("sv:revealInNav", {
            detail: target.file
              ? { kind: "file", projectCode, path: target.file }
              : {
                  kind: "namespace",
                  projectCode,
                  ...(() => {
                    const seg = String(target.namespace).split(/[./]+/).filter(Boolean);
                    return { serviceId: seg[0], moduleName: seg[1], methodName: seg[2] };
                  })(),
                },
          }),
        );
        const key = JSON.stringify(target);
        if (revealTriedRef.current.has(key)) return false; // asked once already; it isn't there
        revealTriedRef.current.add(key);
        setTimeout(() => {
          revealTriedRef.current.delete(key);
          if (goPointRef.current) goPointRef.current(target, text, tone);
        }, 420);
        return true;
      }
      if (!el) return false; // still nothing on screen — no errand, no gesture, no lie

      // THE BOT MOVING IS THE FEATURE, not an extra — so it travels in `subtle` too. The modes
      // differ in CHROME, not in whether the agent shows up: `subtle` is the bot going there,
      // saying its line, and a box on the target; `full` adds the connecting line and the label.
      // (Gating travel behind `full` would have meant the default shipped without the thing he
      // actually asked for.)
      const travels = mode !== "off";
      spotlight({ target: el, mode, tone, from: `[data-sv="bot"][data-sv-pc="${projectCode}"]`, hold: 0 });
      if (!travels) return true;
      // YOU CANNOT WALK TO SOMETHING YOU'RE CARRYING. The TV, the chat and the collector all hang
      // off the bot, so travelling to one moves it, which moves the target, which moves the bot —
      // it lands in roughly the right place and then walks itself into the bottom corner with the
      // TV off screen (his catch). For anything inside our own assembly: light it up, stand still.
      if (root && root.contains(el)) {
        const prev0 = errandRef.current;
        if (prev0 && prev0.follow) clearInterval(prev0.follow);
        if (text) setSaying({ text });
        // CLOSING THE THING ENDS THE GESTURE. He shut the TV without dismissing the pointer and was
        // left with a box drawn around nothing. Normally the ✕ ends it; here the target can vanish
        // on its own, so watch for that instead of waiting to be dismissed.
        const gone = setInterval(() => {
          if (!document.contains(el) && endErrandRef.current) endErrandRef.current(true);
        }, 200);
        errandRef.current = { follow: gone, startedAt: Date.now() };
        return true;
      }

      const prev = errandRef.current;
      if (prev && prev.follow) clearInterval(prev.follow);
      if (!root) return true;
      // Stand just outside the target rather than on top of it — a bot covering the thing it is
      // pointing at is worse than not pointing.
      const place = () => {
        const b2 = el.getBoundingClientRect();
        const rr = root.getBoundingClientRect();
        // Stand just outside the target, vertically CENTRED on it — the whole complaint was that it
        // hovered across without ever coming down to the thing.
        const x = Math.max(8, Math.min(window.innerWidth - rr.width - 8, b2.left - rr.width - 14));
        const y = Math.max(
          8,
          Math.min(window.innerHeight - rr.height - 8, b2.top + b2.height / 2 - rr.height / 2),
        );
        setPos({ x, y });
      };
      place();
      // Keep following while the gesture is live: panels expand, trees open, content reflows, and a
      // bot pointing at where something USED to be is worse than not pointing.
      const follow = setInterval(place, 120);
      if (text) setSaying({ text });
      // No expiry, and nowhere to go back to — the bot is wherever it last walked.
      errandRef.current = { follow, startedAt: Date.now() };
      return true;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectCode],
  );

  goPointRef.current = goPoint;

  // How long a gesture holds, by what it is. A region is already on screen and reads instantly; a
  // file or namespace has to be revealed first, so the eye arrives later than the command does.
  const holdFor = (target, tone) => (tone === "ambient" ? 5000 : 10000);

  // ONE AT A TIME, with a gap. Several references in one message used to fire on fixed timers, so
  // a slow reveal ran into the next gesture. The queue waits for each to finish instead of hoping.
  const queueRef = useRef([]);
  const runningRef = useRef(false);
  const [animating, setAnimating] = useState(false);
  const wasOpenRef = useRef(false);
  const pump = React.useCallback(() => {
    if (runningRef.current) return;
    const next = queueRef.current.shift();
    if (!next) {
      runningRef.current = false;
      // THE PANEL STAYS FOLDED WHILE THE BOT IS OUT THERE. Reopening it mid-gesture drops the whole
      // chat on top of the thing it just walked to — the trip is supposed to be an icon moving, not
      // a panel arriving. Whoever ends the errand gives the panel back.
      if (errandRef.current) return;
      setAnimating(false);
      if (wasOpenRef.current) {
        openRef.current = true;
        setOpen(true);
        wasOpenRef.current = false;
      }
      return;
    }
    runningRef.current = true;
    const drew = goPointRef.current(next.target, next.say, next.tone);
    const wait = drew ? holdFor(next.target, next.tone) + 600 : 0; // nothing drawn = no dead time
    setTimeout(() => {
      runningRef.current = false;
      pump();
    }, wait);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const enqueuePoint = React.useCallback(
    (target, say, tone = "deliberate") => {
      if (animationMode(projectCode) === "off") return;
      if (!runningRef.current && !queueRef.current.length) {
        // GET OUT OF THE WAY (his catch: "the new chat bubble was in the way"). The panel folds and
        // the unread/peek bubble is suppressed for the duration — then both come back as they were.
        wasOpenRef.current = openRef.current;
        openRef.current = false;
        setOpen(false);
        setAnimating(true);
      }
      queueRef.current.push({ target, say, tone });
      pump();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectCode, pump],
  );

  // Read the references OUT of what the agent just said, and walk them. This is the whole
  // deliberate half: the agent wrote an ordinary sentence, and the things it named are what get
  // pointed at, in the order it named them. It never sends positions and never scripts timing.
  //
  // Capped at three: a paragraph mentioning eight things shouldn't become a slideshow, and the
  // first few are what the sentence is actually about.
  const animateMessage = React.useCallback(
    (text) => {
      if (!text || animationMode(projectCode) === "off") return;
      const refs = [];
      const re = /:(file|ns|ui|report)\[([^\]]+)\]/g;
      let m;
      while ((m = re.exec(text)) && refs.length < 3) {
        const [, kind, value] = m;
        refs.push(
          kind === "ui"
            ? { target: { region: value.trim().toLowerCase() }, say: value }
            : kind === "ns"
              ? { target: { namespace: value }, say: value }
              : kind === "file"
                ? { target: { file: value }, say: value }
                : { target: { region: "center" }, say: value.split("/").pop() },
        );
      }
      // Spaced so each one reads as a separate point rather than a blur; anything that isn't on
      // screen is skipped silently by goPoint.
      refs.forEach((r) => enqueuePoint(r.target, r.say));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectCode, goPoint],
  );

  // Kept for the passive half and anything else that needs to send the bot somewhere. The event
  // carries WHAT and WHAT IT SAID; never where anything is (his rule).
  useEffect(() => {
    const onPoint = (e) => {
      const d = (e && e.detail) || {};
      if (d.projectCode) {
        if (d.projectCode !== projectCode) return;
      } else if (routeProject && routeProject !== projectCode) {
        // Unaddressed: the bot for the project the human is actually looking at answers it. Without
        // this every mounted bot would set off across the screen at once.
        return;
      }
      enqueuePoint(d.target, d.say);
    };
    window.addEventListener("sv:agentPoint", onPoint);
    return () => window.removeEventListener("sv:agentPoint", onPoint);
  }, [enqueuePoint, projectCode, routeProject]);

  // WHAT ENDS A GESTURE — and the list is deliberately short. Only the AGENT ends it: a new point
  // supersedes this one, or the page itself goes away. His rule, exactly: "if the page is just in
  // that state and nothing changes, the agent wasn't moved, the agent didn't get a message." So
  // clicking, typing and scrolling all leave it standing — you can work with it pointing at the
  // thing, which is the point of it staying. Scrolling doesn't even move it off target: the box is
  // measured every frame and follows.
  useEffect(() => {
    const bye = () => { if (endErrandRef.current) endErrandRef.current(); };
    window.addEventListener("sv:refresh", bye);
    return () => {
      window.removeEventListener("sv:refresh", bye);
      const e = errandRef.current;
      if (e && e.follow) clearInterval(e.follow);
    };
  }, []);
  const [linksOpen, setLinksOpen] = useState(false);
  const [linkQ, setLinkQ] = useState("");
  const [fullHist, setFullHist] = useState(null);
  // THE TV NEEDS THIS TOO, and that is why clicking the TV icon did nothing. Shows are found by
  // scanning the room's records — and this only ever loaded them for the LINKS panel. Attached, the
  // room is deliberately out of the panel, so `messages` is empty, so the show list is empty, so the
  // TV opened onto nothing and looked like a dead button. Every report he had ever pushed was still
  // on disk the whole time.
  // Loaded whenever the room's history is needed by anything: the links collector, the TV, or simply
  // being attached — a panel that cannot see its own room cannot show what is in it.
  useEffect(() => {
    if (!SystemView) return;
    if (!linksOpen && !tvOpen && !attached) return;
    let dead = false;
    (async () => {
      try {
        const all = await SystemView.chatHistory(projectCode, chat, 0);
        if (!dead) setFullHist(all || []);
      } catch {
        if (!dead) setFullHist([]);
      }
    })();
    return () => { dead = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linksOpen, tvOpen, attached, projectCode, chat, messages.length]);
  // Every show this room has had, newest first — what the TV's title picker lists. Unfiltered by
  // the collector's search box, because that box belongs to the collector.
  const shows = React.useMemo(() => {
    const src = fullHist || messages;
    // ONE ENTRY PER REPORT. A push writes a record, so pushing the same report three times wrote
    // three — and the picker listed records, so he opened a dropdown with three identical titles and
    // no way to tell which document he had been answering in. That was never a feature and nobody
    // asked for versions: THE NEWEST PUSH OF A TITLE IS THAT REPORT. The collector has worked this
    // way for a while; the picker was simply never taught the same rule.
    //
    // Deduped HERE, in the list, so it is true immediately for every record already in the room —
    // not only for pushes that happen after some hub restarts.
    const seen = new Set();
    return src
      .filter((m) => m.kind === "command" && m.cmd === "show" && m.args && m.args.report && !m.hidden)
      .slice()
      .reverse()
      .filter((m) => {
        const title = String(m.label || "show");
        if (seen.has(title)) return false;
        seen.add(title);
        return true;
      });
  }, [fullHist, messages]);
  // RFC-039 — take a show off the list. Optimistic locally so the row goes at once, then the hub
  // patches the record (hidden: true) and every open panel re-reads it.
  const [dropShow, setDropShow] = useState(0);
  // The verb lives on the hub, so a hub that hasn't restarted since this shipped doesn't have it —
  // and hiding a row locally that comes back on the next refresh is a lie. Say so instead.
  const canHide = !!(SystemView && SystemView.chatHide);
  const hideRecord = (id) => {
    setFullHist((cur) => (cur ? cur.map((m) => (m.id === id ? { ...m, hidden: true } : m)) : cur));
    setMessages((cur) => cur.map((m) => (m.id === id ? { ...m, hidden: true } : m)));
    if (SystemView && SystemView.chatHide)
      SystemView.chatHide(projectCode, { chat, id }).catch(() => {});
  };
  const collected = React.useMemo(() => {
    const src = fullHist || messages;
    const q = linkQ.trim().toLowerCase();
    const out = [];
    for (const m of src) {
      if (m.hidden) continue; // taken off the list by hand, or superseded by a re-push
      if (m.kind === "command") {
        if (m.cmd === "show" && m.args && m.args.report) {
          if (!q || String(m.label || "show").toLowerCase().includes(q) || String(m.args.text).toLowerCase().includes(q))
            out.push({ kind: "show", m, title: String(m.label || "show") });
        }
        continue;
      }
      if (m.kind === "system") continue;
      if (q && !String(m.text || "").toLowerCase().includes(q)) continue;
      // Chips only — renderChatText returns strings for prose and elements for links/reports.
      const parts = renderChatText(String(m.text || "")).filter((p) => typeof p !== "string");
      if (parts.length) out.push({ kind: "links", m, parts });
    }
    out.reverse(); // newest first — "I want that link again" is usually a recent one
    // A SHOW IS ITS TITLE, not its record. Iterating on a board is the behaviour we want from
    // agents, but every push wrote another record and the collector listed records — so one
    // systemlynx board appeared FOUR times, and re-showing an edit was indistinguishable from
    // sending something new. His call: no versions, no history to expand, nothing accumulating —
    // the newest push of a title simply IS that show. We are already walking newest-first, so the
    // first one we meet is the one that survives.
    const seenShow = new Set();
    return out.filter((e) => {
      if (e.kind !== "show") return true;
      if (seenShow.has(e.title)) return false;
      seenShow.add(e.title);
      return true;
    });
  }, [fullHist, messages, linkQ]);

  // RESIZABLE — the WHOLE border drags (his call after the corner hotzone failed him three
  // times): sides resize one axis, corners both, the cursor is the handle everywhere. One
  // generic resizer serves the chat panel AND the TV; sizes persist per project.
  const [size, setSize] = useState(() => {
    try {
      const s = JSON.parse(localStorage.getItem(`sv.chatSize.${projectCode}`));
      if (s && s.w && s.h) return s;
    } catch {}
    return { w: 340, h: 480 };
  });
  const [tvSize, setTvSize] = useState(() => {
    // THE DEFAULT IS THE CHAT'S HEIGHT, and it always was — 480, the same number the panel starts
    // at. What kept reopening tall was a SAVED value: the old double-click reset wrote
    // `innerHeight - 120` into storage, and that number outlived the fix, so every open restored
    // the bug's leftovers. Clear those once. Anything sized by hand from here is kept.
    try {
      const s = JSON.parse(localStorage.getItem(`sv.tvSize.${projectCode}`));
      if (s && s.w && s.h) {
        if (!localStorage.getItem("sv.tvSizePurged") && s.h > 520) {
          const fixed = { w: s.w, h: 480 };
          try { localStorage.setItem(`sv.tvSize.${projectCode}`, JSON.stringify(fixed)); } catch {}
          return fixed;
        }
        return s;
      }
    } catch {}
    return { w: 430, h: 480 };
  });
  // The cleanup above runs once per browser, not once per bot — several bots mount at a time and
  // the flag has to be set after they've all had their chance to read it, not by the first one in.
  useEffect(() => {
    const t = setTimeout(() => {
      try { localStorage.setItem("sv.tvSizePurged", "1"); } catch {}
    }, 2000);
    return () => clearTimeout(t);
  }, []);
  const makeResize = (getStart, apply, persistKey) => (mw, mh) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    const start = { x: e.clientX, y: e.clientY, ...getStart() };
    let latest = null;
    const move = (ev) => {
      // TWO DIFFERENT THINGS, and I've now confused them in both directions. FLEXING is the box
      // sizing itself to its content — that is height-only. DRAGGING is you choosing, and it has no
      // ceiling on either axis; 820 was a wall you could feel and never asked for.
      latest = {
        w: Math.min(window.innerWidth - 40, Math.max(240, start.w + mw * (ev.clientX - start.x))),
        h: Math.min(window.innerHeight - 40, Math.max(200, start.h + mh * (ev.clientY - start.y))),
      };
      apply(latest);
    };
    const up = () => {
      if (latest) {
        try { localStorage.setItem(persistKey, JSON.stringify(latest)); } catch {}
      }
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  // THE AGENT ADJUSTS. Opening the chat, then the TV, then the collector makes the row wider to
  // the RIGHT and taller DOWNWARD; if that would run off an edge the bot slides back so the whole
  // row stays on screen. This is what replaces flipping.
  useEffect(() => {
    if (!open) return;
    const ext = extentRef.current();
    const p0 = posRef.current;
    if (!p0) return;
    let { x, y } = p0;
    const overRight = x + 46 + ext.right - (window.innerWidth - DOCK_EDGE);
    const overLeft = DOCK_EDGE + ext.left - x;
    const overDown = y + 46 + ext.down - (window.innerHeight - DOCK_EDGE);
    if (overRight > 0) x -= overRight;
    if (overLeft > 0) x += overLeft;
    if (overDown > 0) y -= overDown;
    x = Math.max(DOCK_EDGE, x);
    y = Math.max(DOCK_EDGE, y);
    if (x !== p0.x || y !== p0.y) setPos({ x, y });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tvOpen, linksOpen, size.w, size.h, tvSize.w]);
  // The row hangs DOWN and to the RIGHT of the bot now, so those are the edges it can run off.
  // Which way the row reaches depends on the side it opens on — the clamp has to follow it, or the
  // bot gets held back from the edge it is actually free to sit against.
  extentRef.current = () => {
    if (!open) return { right: 0, left: 0, down: 0 };
    // The row is as wide as everything that's up: chat, links, TV, board.
    const wide =
      size.w +
      (tvOpen && tv ? tvSize.w + 20 : 0) +
      (linksOpen ? 320 : 0) +
      (boardOpen ? boardSize.w + 10 : 0) -
      46;
    return {
      right: flip ? 0 : wide,
      left: flip ? wide : 0,
      down: Math.min(size.h, window.innerHeight - 40) + 10,
    };
  };
  const panelResize = makeResize(() => size, setSize, `sv.chatSize.${projectCode}`);
  // Dragging an edge is you choosing a size — from then on it's yours, not the content's.
  const tvResize = makeResize(
    () => tvSize,
    (v) => {
      setTvSized(true);
      setTvSize(v);
    },
    `sv.tvSize.${projectCode}`,
  );
  // THE BOARD — his, not the app's. Notes to himself, things to tell an agent later, a running list
  // of what is wrong with something while he looks at it. One board per project, no naming
  // ceremony; it is a markdown document beside the project like everything else, so every block
  // already in this app works inside it.
  // NOTES ARE CARDS, newest on top, and the recorder stays at the top with them coming down under
  // it — his shape: "the recorder stays closer to the top, the previous ones get pushed down".
  const [boardOpen, setBoardOpen] = useState(false);
  // Resizable and double-click-to-reset, like every other panel here — his call: "just like the
  // other components".
  const [boardSize, setBoardSize] = useState(() => {
    try {
      const v = JSON.parse(localStorage.getItem(`sv.boardSize.${projectCode}`));
      if (v && v.w && v.h) return v;
    } catch {}
    return { w: 380, h: 420 };
  });
  const [board, setBoard] = useState(null); // null = not read yet · else [{ ts, text }]
  const [boardSaved, setBoardSaved] = useState(true);
  const [boardDraft, setBoardDraft] = useState("");
  // AN OPTIONAL TITLE. His: "sometimes I want a title so you know something" — the board is where he
  // accumulates thoughts for an agent to be pointed at later, and a word at the top is the cheapest
  // context there is. Subtle and skippable: with none it just says `board`.
  const [boardTitle, setBoardTitle] = useState("");
  const [titling, setTitling] = useState(false); // the title is a word until it is clicked
  const [boardRec, setBoardRec] = useState(false);
  const boardRecRef = useRef(null);
  const boardHostRef = useRef(null); // { rec, into } while the HOST is recording for a board box
  const boardDraftRef = useRef(null);
  const boardPath = ".systemview/boards/board.md";
  // THE BOARD IS A FILE, SO IT COMES FROM THE SHELL. It used to be read through whichever service
  // happened to be first for this project — which is why his notes vanished the moment a test
  // service was down: not lost, just asked for down a road that was closed. `.systemview/boards/
  // board.md` sits on disk the whole time. Same rule as the codebase: files are the host's.
  const boardPlugin = useMemo(
    () => (hasHostFiles() ? hostFiles(projectCode) : null),
    [projectCode],
  );
  useEffect(() => {
    projPluginRef.current = boardPlugin;
  }, [boardPlugin]);
  // ON DISK IT IS STILL ONE MARKDOWN FILE — cards are separated by an HTML comment carrying the
  // time. Invisible in any renderer, so the file reads like notes rather than like a database, and
  // every block this app has still works inside a card.
  // A card, and OPTIONALLY one answer from the agent under it — his ask: "you could make one
  // response to a note". It lives in the same file, right under the note it answers, so reading the
  // file is reading the conversation.
  // RFC-039 — A NOTE HOLDS A CONVERSATION. One reply that got REPLACED on the next write meant
  // nothing said back and forth survived ("I reply to you and then my reply goes on the note").
  // Replies are a list now, each stamped with who wrote it. `<!--reply-->` with no author is the
  // old single-reply form and still reads — as the agent's, which is the only thing it ever was.
  const parseBoard = (text) => {
    const out = [];
    String(text || "")
      .split(/<!--card (\d+)(?: by=([^\s>]+))?-->/)
      .forEach((part, i, arr) => {
        if (i % 3 !== 1) return;
        const by = arr[i + 1] || "";
        const bits = String(arr[i + 2] || "").split(/<!--reply(?: ([^>]*?))?-->/);
        const replies = [];
        for (let b = 1; b < bits.length; b += 2) {
          const attrs = String(bits[b] || "");
          const body = String(bits[b + 1] || "").trim();
          if (!body) continue;
          replies.push({
            by: (attrs.match(/by=([^\s]+)/) || [])[1] || "",
            ts: Number((attrs.match(/ts=(\d+)/) || [])[1]) || 0,
            text: body,
          });
        }
        out.push({ ts: Number(part), by, text: bits[0].trim(), replies });
      });
    return out;
  };
  // The title rides at the top as a plain `# heading`, before the first card — so the file opens as
  // a titled note anywhere else that reads markdown, and an untitled board has no heading at all
  // rather than an empty one.
  const parseTitle = (text) => {
    const head = String(text || "").split(/<!--card /)[0];
    const m = head.match(/^\s*#\s+(.+)\s*$/m);
    return m ? m[1].trim() : "";
  };
  const serializeBoard = (cards, title) =>
    `${title ? `# ${title}\n\n` : ""}${cards
      .map(
        (c) =>
          `<!--card ${c.ts}${c.by ? ` by=${c.by}` : ""}-->\n${c.text}\n` +
          (c.replies || [])
            .map((r) => `<!--reply${r.by ? ` by=${r.by}` : ""}${r.ts ? ` ts=${r.ts}` : ""}-->\n${r.text}\n`)
            .join(""),
      )
      .join("\n")}`;

  // EVERY TIME IT OPENS, not just the first — a reply written while the board was shut was invisible
  // until he reloaded the whole page, which is not a thing anyone should have to do to read an answer.
  useEffect(() => {
    if (!boardOpen || !boardPlugin) return undefined;
    let dead = false;
    (async () => {
      try {
        const res = await boardPlugin.readFile({ path: boardPath });
        if (!dead) {
          setBoard(parseBoard(res.content));
          setBoardTitle(parseTitle(res.content));
        }
      } catch {
        if (!dead) setBoard([]); // no board yet is the normal case, not an error
      }
    })();
    return () => {
      dead = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardOpen, boardPlugin]);

  const saveBoard = async (cards, title = boardTitle) => {
    setBoard(cards);
    setBoardSaved(false);
    if (!boardPlugin) return;
    try {
      // AN AGENT'S REPLY MUST SURVIVE HIS NEXT KEYSTROKE. The panel holds the whole board in memory
      // and writes the whole file, so a reply written by `systemview board --reply` between the
      // panel reading and the panel saving would simply vanish — which is exactly what happened the
      // first time I tried it. Replies are the agent's half and the UI never edits them, so re-read
      // and carry them over rather than trusting what was in memory.
      let keep = {};
      try {
        const fresh = await boardPlugin.readFile({ path: boardPath });
        parseBoard(fresh.content).forEach((c) => {
          if ((c.replies || []).length) keep[c.ts] = c.replies;
        });
      } catch {}
      // Union by (ts, text): an agent may have appended a reply since this panel read the file, and
      // he may have just written one that isn't on disk yet. Neither half gets to erase the other.
      cards = cards.map((c) => {
        const disk = keep[c.ts] || [];
        const mine = c.replies || [];
        if (!disk.length) return c;
        const seen = new Set(mine.map((r) => `${r.ts}|${r.text}`));
        const merged = [...disk.filter((r) => !seen.has(`${r.ts}|${r.text}`)), ...mine].sort(
          (a, b) => (a.ts || 0) - (b.ts || 0),
        );
        return { ...c, replies: merged };
      });
      // AN EMPTY BOARD TAKES ITS FILE WITH IT — the same rule the comment sidecars follow, so an
      // emptied board doesn't sit in `.systemview/` pretending to be something. A title alone still
      // counts as something on the board.
      if (!cards.length && !title && boardPlugin.deleteFile)
        await boardPlugin.deleteFile({ path: boardPath });
      else await boardPlugin.writeFile({ path: boardPath, content: serializeBoard(cards, title) });
      setBoardSaved(true);
    } catch {
      setBoardSaved(false);
    }
  };
  // The title saves itself a beat after you stop typing, like the notes do.
  const titleTimer = useRef(null);
  const writeTitle = (t) => {
    setBoardTitle(t);
    setBoardSaved(false);
    if (titleTimer.current) clearTimeout(titleTimer.current);
    titleTimer.current = setTimeout(() => saveBoard(board || [], t), 600);
  };
  // HIS REPLY, appended to the note's thread. Same save path as everything else here, so it merges
  // with whatever an agent wrote in the meantime rather than overwriting it.
  const addReply = (ts) => {
    const text = (replyDraft || "").trim();
    setReplying(0);
    setReplyDraft("");
    if (!text) return;
    saveBoard(
      (board || []).map((c) =>
        c.ts === ts ? { ...c, replies: [...(c.replies || []), { by: "you", ts: Date.now(), text }] } : c,
      ),
    );
  };
  const addCard = () => {
    const text = (boardDraft || "").trim();
    if (!text) return;
    // ADDING THE NOTE ENDS THE DICTATION — the same rule sending has in the chat: you said what you
    // had to say. Left running, the next thing spoken landed in an empty box behind a note that was
    // already on the board. The flag drops HERE rather than waiting for `onend`, which arrives a
    // beat late and leaves the transcript line hanging over a box you just emptied.
    if (boardRec) {
      setBoardRec(false);
      setBoardInterim("");
      try { if (boardRecRef.current) boardRecRef.current.stop(); } catch {}
    }
    setBoardDraft("");
    saveBoard([{ ts: Date.now(), text }, ...(board || [])]); // newest on top
  };
  // THE SAME MIC THE CHAT HAS, not a second kind. The first version wrote straight into the
  // textarea's DOM value — which is a CONTROLLED React input, so every render put the old value
  // back and the words appeared and then vanished. His report, and he was right that we have done
  // this before: interim words show ABOVE the box on their own line, finals commit INTO it.
  const [boardInterim, setBoardInterim] = useState("");
  // Clearing the whole board is two-step, the same as every other destructive thing in this app.
  const [boardArmed, setBoardArmed] = useState(false);
  // ORDER IS HIS. Cards arrive newest-first, but a board is a thing you arrange — so the stamp bar
  // on each card is a drag handle and dropping one on another puts it there. The saved file IS the
  // order, so what you arrange is what you come back to. A private MIME, the same trick the file
  // tree's drag uses, so nothing else on the page answers a card drag.
  const CARD_MIME = "application/x-systemview-card";
  const [dropCard, setDropCard] = useState(null);
  // A LONG NOTE IS CLAMPED UNTIL YOU SAY OTHERWISE — his rule, and the important half is the second
  // one: "I don't care that I can't see the whole thing, but I can't see it BY CHOICE."
  const [openCards, setOpenCards] = useState([]);
  // RFC-039 — his half of a note's thread: which card is being replied to, and the draft.
  const [replying, setReplying] = useState(0);
  const [replyDraft, setReplyDraft] = useState("");
  const [openReplies, setOpenReplies] = useState([]);
  const [copied, setCopied] = useState(0);
  const moveCard = (fromTs, toTs) => {
    if (!board || fromTs === toTs) return;
    const from = board.findIndex((c) => c.ts === fromTs);
    const to = board.findIndex((c) => c.ts === toTs);
    if (from < 0 || to < 0) return;
    const next = board.slice();
    const [card] = next.splice(from, 1);
    next.splice(to, 0, card);
    saveBoard(next);
  };
  useEffect(() => {
    if (boardOpen) return;
    setBoardArmed(false);
    // Unfolded notes are a READING state, not a saved one — closing the board puts them back, so it
    // always opens the same way instead of remembering a shape you can no longer see to undo.
    setOpenCards([]);
    setOpenReplies([]);
    setTitling(false);
    setReplying(0);
    setReplyDraft("");
  }, [boardOpen]);
  // ONE RECORDER, WHICHEVER BOX IS ASKING. Every input in this app takes voice — a new box without a
  // mic is a broken box, which is exactly what the note-reply box shipped as for about ten minutes.
  // `into` names the target ("note" = a new card, or a card's ts = a reply on that note), so the
  // finals land in the right draft and the mic can only be lit in one place at a time.
  const toggleBoardRec = (into = "note") => {
    if (boardHostRef.current) {
      const { rec, into: wasFor } = boardHostRef.current;
      boardHostRef.current = null;
      setBoardInterim("transcribing…");
      // The segments already landed in the box as he paused; stopping just closes the last one.
      rec
        .stop()
        .catch(() => {})
        .finally(() => {
          setBoardRec(false);
          setBoardInterim("");
        });
      if (wasFor === into) return;
    }
    if (boardRecRef.current) {
      const wasFor = boardRec;
      try { boardRecRef.current.stop(); } catch {}
      // Pressing the OTHER box's mic while this one is live moves the recorder there rather than
      // just switching it off — that reads as the button not working.
      if (wasFor === into) return;
    }
    const SRB = window.SpeechRecognition || window.webkitSpeechRecognition;
    const write = (txt) =>
      into === "note"
        ? setBoardDraft((cur) => (cur ? `${cur} ` : "") + txt)
        : setReplyDraft((cur) => (cur ? `${cur} ` : "") + txt);
    // Same host-first rule as the chat mic — the board's recorder is the same feature on another box.
    if (hasHostDictation()) {
      (async () => {
        try {
          const rec = await startHostRecording({
            onDraft: (t) => setBoardInterim(t),
            onSegment: (t) => {
              setBoardInterim("");
              write(t.trim());
            },
          });
          boardHostRef.current = { rec, into };
          setBoardRec(into);
          setBoardInterim("");
        } catch {
          setBoardRec(false);
        }
      })();
      return;
    }
    if (!SRB) return;
    try {
      const rec = new SRB();
      rec.lang = navigator.language || "en-US";
      rec.interimResults = true;
      rec.continuous = true;
      rec.onresult = (e) => {
        let fin = "";
        let inter = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) fin += e.results[i][0].transcript;
          else inter += e.results[i][0].transcript;
        }
        if (fin) {
          write(fin.trim());
          setBoardInterim("");
        } else setBoardInterim(inter);
      };
      const done = () => {
        boardRecRef.current = null;
        setBoardRec(false);
        setBoardInterim("");
      };
      rec.onend = done;
      rec.onerror = done;
      boardRecRef.current = rec;
      rec.start();
      setBoardRec(into);
    } catch {
      setBoardRec(false);
    }
  };

  // The TV's own box, so "fill the room below" can be measured from where the TV ACTUALLY starts.
  const tvElRef = useRef(null);
  // "2 minutes ago" has to AGE. Without a heartbeat it keeps saying whatever it said when the show
  // arrived until something unrelated re-renders — a relative time that never moves is worse than a
  // clock. Only while the TV is actually on screen.
  const [, ageTick] = useState(0);
  // Which face the stamp is showing — his, and it survives a reload.
  const [whenAbs, setWhenAbs] = useState(() => {
    try {
      return localStorage.getItem("sv.tvWhenAbs") === "true";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    if (!tvOpen || !tv) return undefined;
    const t = setInterval(() => ageTick((n) => n + 1), 60000);
    return () => clearInterval(t);
  }, [tvOpen, tv]);
  // Double-click any border → back to the original size (the same convention the page's panel
  // dividers use).
  const resetSize = (setter, def, key) => () => {
    setter(def);
    try { localStorage.setItem(key, JSON.stringify(def)); } catch {}
  };
  const panelReset = resetSize(setSize, { w: 340, h: 480 }, `sv.chatSize.${projectCode}`);
  const cbResize = makeResize(() => cbSize, setCbSize, `sv.cbSize.${projectCode}`);
  const cbReset = resetSize(setCbSize, { w: 320, h: 460 }, `sv.cbSize.${projectCode}`);
  const boardResize = makeResize(() => boardSize, setBoardSize, `sv.boardSize.${projectCode}`);
  const boardReset = resetSize(setBoardSize, { w: 380, h: 420 }, `sv.boardSize.${projectCode}`);
  // The TV's double-click means "give me my natural FLEX size" (his call, matching the story
  // panes) — PER AXIS: the edge you double-click hands back its own dimension (side = width,
  // top/bottom = height, corner = both), and the TV header flexes the whole thing at once.
  const tvReset = (mw = 1, mh = 1) => {
    // NATURAL HEIGHT IS THE CHAT'S HEIGHT, not the whole screen. It used to reset to
    // `innerHeight - 120` no matter what was on it, and since the TV hangs DOWNWARD off the bot
    // that ran straight off the bottom of the screen — a double-click on a short show made a
    // near-full-height box with nothing in it. Same size as the chat and the links by default;
    // dragging the edges is still how you make it bigger. Clamped to the room actually below.
    // AND IT TOGGLES. A double-click that always does the same thing is a dead end — you use it,
    // it isn't what you wanted, and there's nothing to undo it with but the mouse. Now the same
    // edge swings the other way: fit, fill, fit. Per axis, so a side toggles width and the top or
    // bottom toggles height, exactly like a single drag would.
    // MEASURED FROM THE TV, NOT FROM THE BOT. The room below was computed from the bot's own y with
    // a 40px allowance — but the TV hangs about 70px lower than that, so "fill" always overshot the
    // bottom of the screen by the difference and he dragged it back every single time. The element
    // knows where it starts; nothing else has to be kept in step with it.
    const tvTop = tvElRef.current
      ? tvElRef.current.getBoundingClientRect().top
      : ((pos && pos.y) || 0) + 72;
    const room = Math.max(240, Math.floor(window.innerHeight - tvTop - TV_BOTTOM_GAP));
    const fitW = Math.max(280, Math.min(window.innerWidth - size.w - 140, 1280));
    const fillW = Math.max(fitW, window.innerWidth - size.w - 80); // fill means fill
    const fitH = Math.min(size.h, room);
    const fillH = Math.max(fitH, room);
    const at = (a, b) => Math.abs(a - b) < 8;
    // FIT HANDS THE HEIGHT BACK TO THE SHOW. Not "the chat's height" as a number — no height at
    // all, so the box goes back to being as tall as what's on it, capped. Fill is a real number.
    if (mh && tvSized) {
      setTvSized(false);
      const back = { w: mw ? fitW : tvSize.w, h: fitH };
      setTvSize(back);
      try { localStorage.removeItem(`sv.tvSize.${projectCode}`); } catch {}
      return;
    }
    if (mh && !tvSized) setTvSized(true); // second double-click: fill, and that's a chosen size
    const nat = {
      w: mw ? (at(tvSize.w, fitW) ? fillW : fitW) : tvSize.w,
      h: mh ? fillH : tvSize.h,
    };
    setTvSize(nat);
    try { localStorage.setItem(`sv.tvSize.${projectCode}`, JSON.stringify(nat)); } catch {}
  };
  const style = pos
    ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto", zIndex: z }
    : { bottom: EDGE + index * STACK, zIndex: z };
  // In the dock line, the bot switches to compact mode: peeks hang BELOW in a slot-width pill
  // instead of sticking out sideways over the neighbor. MEMBERSHIP decides, not altitude — a
  // bot merely dragged near the top keeps its full-size peek (his catch: "close to the top, it
  // shrinks — it probably was good before").
  const docked = false; // the old top-of-window lane is gone — docking means the codebase card now
  // RFC-038 — IN THE NAV. `navDocked` is the intent; `inNav` is the fact, because the slot only
  // exists while that codebase card is on screen. If the panel is closed or the card unmounts, the
  // bot has nowhere to be and floats again rather than disappearing.
  const inNav = navDocked && !!slotEl;
  // Docked, the four icons are TABS over one surface — a 280px column cannot hold four boxes side
  // by side, and switching is a tab bar's whole job (his call, and better than what I proposed).
  // OPENING HAS TO SCROLL THE PANEL TO IT (his catch): several projects are stacked in that column,
  // so an agent expanding below the fold reads as nothing having happened. It lives HERE, not up by
  // the slot lookup, because it reads the four open-flags — declared further down, and reading one
  // above its declaration is a TDZ crash that takes the whole surface with it.
  const navShowing = navDocked && (open || boardOpen || linksOpen || tvOpen);
  useEffect(() => {
    if (!navShowing || !slotEl) return undefined;
    const t = setTimeout(() => {
      try { slotEl.scrollIntoView({ block: "nearest", behavior: "smooth" }); } catch {}
    }, 60);
    return () => clearTimeout(t);
  }, [navShowing, slotEl]);
  // THE NAVIGATOR COMING BACK PUTS THIS AWAY. It is the nav's stand-in, not a second copy of the
  // card — with both on screen he would be looking at the same tree twice.
  useEffect(() => {
    const onNav = (e) => {
      if (e && e.detail && e.detail.open) setCbOpen(false);
    };
    window.addEventListener("sv:navOpen", onNav);
    return () => window.removeEventListener("sv:navOpen", onNav);
  }, []);
  // HANDING OFF PUTS THE TV AWAY. Opening the file from inside a report is switching location, not
  // opening a second copy of the same thing — his call: "you're switching from one place to the
  // next". So a file chip pressed on the TV closes the TV behind it, and the report stays one press
  // away in the picker. Only when the TV is what you pressed it from.
  useEffect(() => {
    if (!tvOpen) return undefined;
    const handOff = () => setTvOpen(false);
    window.addEventListener("sv:openFileInNav", handOff);
    return () => window.removeEventListener("sv:openFileInNav", handOff);
  }, [tvOpen]);
  // The card's minimize/expand reaches the agent too — his catch: "it doesn't affect the new agent
  // section, everything was just showing each section minimized". Collapsing closes whatever tab is
  // up; expanding puts the chat back, which is what a section opening should look like.
  useEffect(() => {
    const onFold = (e) => {
      const d = (e && e.detail) || {};
      if (d.projectCode !== projectCode || !navDocked) return;
      if (d.collapse) {
        setOpen(false);
        openRef.current = false;
        setBoardOpen(false);
        setLinksOpen(false);
        setTvOpen(false);
      } else {
        setOpen(true);
        openRef.current = true;
      }
    };
    window.addEventListener("sv:navFold", onFold);
    return () => window.removeEventListener("sv:navFold", onFold);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectCode, navDocked]);
  // Which report the 📺 should put up: the newest one if it landed after your last pick, otherwise
  // whatever you were on. `shows` is already newest-first and deduped by title.
  const showToOpen = () => {
    if (!shows.length) return null;
    if (!tv) return shows[0];
    return (shows[0].ts || 0) > (tv.pickedAt || 0) ? shows[0] : null;
  };
  // Where the report on the TV lives on disk. Looked up rather than only remembered, the same rule
  // the save path follows — a TV opened by an older route carries no path of its own.
  const tvDocPath = (() => {
    if (!tv) return null;
    if (tv.path) return tv.path;
    const rec = shows.find((m) => m.id === tv.id);
    const a = rec && rec.args;
    return (a && (a.path || (a.report && reportPathFor(a.report)))) || null;
  })();
  const navPick = (which) => {
    const already =
      (which === "chat" && open) ||
      (which === "board" && boardOpen) ||
      (which === "links" && linksOpen) ||
      (which === "tv" && tvOpen);
    setOpen(which === "chat" && !already);
    openRef.current = which === "chat" && !already;
    setBoardOpen(which === "board" && !already);
    setLinksOpen(which === "links" && !already);
    const fresh = which === "tv" && !already ? showToOpen() : null;
    if (fresh) openShow(fresh.id, fresh.label, fresh.args.text, fresh.ts, fresh.args.report ? fresh.args : null);
    else setTvOpen(which === "tv" && !already);
    if (which === "chat" && !already) {
      setUnread(0);
      try { localStorage.setItem(`sv.chatSeen.${projectCode}`, String(Date.now())); } catch {}
    }
  };
  // THE WHOLE ROW TOGGLES, docked — his catch: "you got to click on the agent icon to expand, and
  // obviously you're supposed to be able to just click on the row just like the other rows."
  // `services` and `code` are one big button each; the agent row is a strip of controls, so instead
  // of making the strip a button it ignores clicks that landed ON a control and takes the rest.
  const navToggle = () => {
    if (navShowing) {
      setOpen(false);
      openRef.current = false;
      setBoardOpen(false);
      setLinksOpen(false);
      setTvOpen(false);
    } else navPick("chat");
  };
  const onNavRowClick = (e) => {
    if (!inNav) return;
    if (e.target.closest("button, [role='button'], input, textarea")) return; // a control did its job
    navToggle();
  };
  // THE ICONS LIVE ON THE RIGHT. They move out of the way only when something is actually in the
  // way — the message display or the live transcript, hanging on that same side. Flipping them by
  // screen half would move them for no reason half the time.
  // The session counts as a reason to show the peek, exactly like the room's status and unread did.
  const sessionCooking = attached && (work.state.state === "working" || work.state.state === "waiting");
  const peekCookWord = useCookWord(work.state.doing, work.state.state);
  // THE MINIMISED BRIEF — his ask, and it replaces the cooking word outright while attached:
  // *"when it's in minimization mode, can we have one block that just shows text and commands, one
  // line text and one line commands, right under the agent — that could replace the whole cooking
  // shit."* And he is right that it is better. A cycling cooking word is theatre: it proves the
  // clock is ticking and says nothing about the work. Two real lines — the last thing it SAID and
  // the last thing it DID — say both, and they are the same two facts the browser panel shows.
  // The cooking word survives only as the fallback for a turn that has produced neither yet.
  const brief = attached
    ? (() => {
        const firstLine = (t) => {
          const s = String(t || "")
            .split("\n")
            .map((x) => x.trim())
            .find((x) => x);
          return s || "";
        };
        let cmd = null;
        for (let i = work.rows.length - 1; i >= 0; i -= 1) {
          // NOT A REPLAYED ONE. Attaching replays the transcript, so the "last command" was
          // whatever this conversation did yesterday — and with the dots on it, a dead bot sat
          // there narrating old work as though it were happening now.
          if (work.rows[i].kind === "tool" && !work.rows[i].replay) {
            cmd = work.rows[i];
            break;
          }
        }
        const say = saidRows.length ? firstLine(saidRows[saidRows.length - 1].text) : "";
        return {
          say,
          cmd: cmd ? cmd.summary || cmd.tool : "",
          // A finished command is history; one still running is what it is doing NOW, and the
          // difference is the whole reason to show it.
          running: !!(cmd && cmd.state === "running"),
          kind: cmd && cmd.sv ? "sv" : "sh",
        };
      })()
    : null;
  // A BRIEF IS A LIVE THING OR IT IS NOTHING. His catch, about autobot's bot: *"I know he's not
  // cooking. There's no message. So why the fuck are they showing a message for him?"* — and he was
  // right: a bot with an attached-but-idle conversation drew the last thing that conversation ever
  // said, with dancing dots on it, forever. That is the stale-status bug wearing a new hat, and this
  // app has now shipped it five times. The brief exists ONLY while the session is actually working;
  // idle with replies waiting is the message display's job, and idle with nothing is NOTHING.
  const hasBrief = !!(sessionCooking && brief && (brief.say || brief.cmd));
  // UNATTACHED, THERE IS NOTHING TO PREVIEW. The room is no longer in the panel, so previewing its
  // messages offered him a door into a conversation that would not be there when he opened it.
  const peekUnread = attached ? sessionUnread : 0;
  // THE PEEK SHOWS ONLY WHEN IT HAS SOMETHING TO SAY. It was gated on `p.status` being truthy while
  // the lines inside were filtered for being blank — so a status that was present but EMPTY opened
  // an empty bubble and parked it at the top of his screen while nothing was happening. One list,
  // computed once, decides both whether to show and what to draw; there is no way for those two to
  // disagree now.
  const roomLines = (p.statuses && p.statuses.length ? p.statuses : [{ as: p.statusAs, text: p.status }])
    .filter((s) => s && String(s.text || "").trim());
  // ONE ANSWER TO "IS THERE ANYTHING TO SHOW". Every branch inside the bubble reads from this list,
  // and so does the gate that decides whether to draw it at all.
  const peekHas = hasBrief || sessionCooking || peekUnread > 0 || roomLines.length > 0;
  const peekShowing = !open && (listening || (!animating && peekHas));
  const iconsLeft = peekShowing && leftHalf;
  // The docked pill is 150px centred under a 46px bubble, so near either edge half of it lands off
  // screen — which is what you saw as the cooking line "going under the agent" in the corner.
  // Nudge it back inside. It still hangs under the bot, just not dead centre.
  const peekShift = (() => {
    if (!docked || !pos) return 0;
    // The reading thread is wider than the status pill — measure the one that's actually showing.
    const half = (!p.status && unread > 0 ? 300 : 150) / 2;
    const left = pos.x + 23 - half;
    const right = pos.x + 23 + half;
    if (left < DOCK_EDGE) return DOCK_EDGE - left;
    if (right > window.innerWidth - DOCK_EDGE) return window.innerWidth - DOCK_EDGE - right;
    return 0;
  })();
  // ONE ROW, IN HIS ORDER: chat, links, TV, board. Each side panel starts after whatever is ahead of
  // it, so opening all four reads left to right instead of piling on the same spot — which is why
  // the board looked like it couldn't be up at the same time as the TV: it was, directly on top of it.
  const LINKS_W = 300;
  const after = (px) =>
    inNav
      ? {}
      : flip
        ? { left: "auto", right: `calc(100% + ${10 + px}px)` }
        : { left: `calc(100% + ${10 + px}px)` };
  const linksAhead = linksOpen ? LINKS_W + 10 : 0;
  const boardAhead = linksAhead + (tvOpen && tv ? tvSize.w + 10 : 0);
  const cbAhead = boardAhead + (boardOpen ? boardSize.w + 10 : 0);
  // The project's own services, which is all a single card needs.
  const myServices = (connectedServices || []).filter((s) => s.projectCode === projectCode);
  const body = (
    <div
      ref={rootRef}
      className={`${CLASSNAME} ${topHalf ? `${CLASSNAME}--top` : ""} ${leftHalf ? `${CLASSNAME}--left` : ""} ${flip ? `${CLASSNAME}--flipx` : ""} ${docked ? `${CLASSNAME}--docked` : ""}${saying ? ` ${CLASSNAME}--errand` : ""}${iconsLeft ? ` ${CLASSNAME}--iconsleft` : ""}${inNav ? ` ${CLASSNAME}--innav` : ""}`}
      style={inNav ? undefined : style}
      // Touch any part of a bot — its bubble, panel, or TV — and it comes to the FRONT (his
      // ask: "if I click on it, I'm trying to be in that chat").
      onPointerDownCapture={bringToFront}
    >
      {/* The anchor also stands up for the COLLECTOR alone — the links table opens from the closed
          bot now, so it can't live behind the panel being open. */}
      {(open || linksOpen || boardOpen || cbOpen || (tvOpen && tv)) && (
        <div className={`${CLASSNAME}__panel-anchor`}>
        {/* THE CODEBASE PANEL — the real card, not a copy of it: same tree, same git, same terminal
            section, rendered here when the navigator is put away. Opening a file from it goes
            through the same event a `:file` chip uses, so the centre behaves identically. */}
        {cbOpen && (
          <div
            data-sv="codebase"
            className={`${CLASSNAME}__tv ${CLASSNAME}__cbpanel`}
            style={{ width: cbSize.w, height: cbSize.h, ...after(cbAhead) }}
          >
            <ResizeBorder start={cbResize} onReset={cbReset} />
            <div
              className={`${CLASSNAME}__tv-head ${CLASSNAME}__tv-head--grab`}
              title="Drag to move"
              onPointerDown={onBotPointerDown}
            >
              <span className={`${CLASSNAME}__tv-badge ${CLASSNAME}__cbpanel-badge`}>{"</>"}</span>
              <span className={`${CLASSNAME}__tv-title`}>{projectCode}</span>
              <button
                type="button"
                className={`${CLASSNAME}__close`}
                title="Put the codebase away"
                onClick={() => setCbOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className={`${CLASSNAME}__cbpanel-body`}>
              <CodebaseNav
                connectedServices={myServices}
                projectCode={projectCode}
                openFile={null}
                onOpenFile={(detail) =>
                  detail && window.dispatchEvent(new CustomEvent("sv:openFileInNav", { detail }))
                }
                theme={appDark ? "dark" : "light"}
                showHelp={false}
                // THIS PANEL IS DRAWN BY THE AGENT, so the agent must not dock into it. The card
                // renders a slot for a docked agent and the agent portals itself in — fine in the
                // side nav, circular here, and the rest of the card does not survive the move. It
                // is why the two projects with a live agent were the two missing the git bar.
                allowDock={false}
              />
            </div>
          </div>
        )}
        {/* THE BOARD. Plain and his: type, it saves itself, it is still there tomorrow. Markdown,
            so anything he pastes or writes can be a real block later — but nothing here renders it,
            because a notepad that reformats what you typed while you type is not a notepad. */}
        {boardOpen && (
          <div
            className={`${CLASSNAME}__board`}
            style={
              inNav
                ? { width: "auto", height: Math.min(boardSize.h, 420) }
                : { width: boardSize.w, height: boardSize.h, ...after(boardAhead) }
            }
          >
            <ResizeBorder start={boardResize} onReset={boardReset} />
            {/* THE HEADER IS THE HANDLE, like every other header here: dragging it moves the bot and
                everything hanging off it, so the board travels with the rest instead of being the
                one panel you cannot move. */}
            <div
              className={`${CLASSNAME}__board-head ${CLASSNAME}__tv-head--grab`}
              title="Drag to move"
              onPointerDown={onBotPointerDown}
            >
              <span className={`${CLASSNAME}__tv-badge`}>📋</span>
              {/* THE TITLE IS TEXT UNTIL YOU GO FOR IT. No field sitting there catching the eye and
                  no I-beam under the pointer — you click the words and only then is there an input,
                  already carrying what it said. */}
              {titling ? (
                <input
                  className={`${CLASSNAME}__board-title ${CLASSNAME}__board-title--edit`}
                  value={boardTitle}
                  placeholder="board"
                  spellCheck={false}
                  autoFocus
                  onPointerDown={(e) => e.stopPropagation()} // typing in it is not dragging the bot
                  onChange={(e) => writeTitle(e.target.value)}
                  onBlur={() => setTitling(false)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === "Escape") {
                      e.preventDefault();
                      setTitling(false);
                    }
                  }}
                />
              ) : (
                <span
                  className={`${CLASSNAME}__board-title ${CLASSNAME}__board-title--read${boardTitle ? "" : ` ${CLASSNAME}__board-title--unnamed`}`}
                  title="Click to name this board — optional, and it's the first thing an agent reads"
                  onClick={() => board !== null && setTitling(true)}
                >
                  {boardTitle || "board"}
                </span>
              )}
              <span className={`${CLASSNAME}__board-state`}>
                {board === null ? "opening…" : boardSaved ? "saved" : "saving…"}
              </span>
              {!!(board && board.length) && (
                <button
                  type="button"
                  className={`${CLASSNAME}__board-clear${boardArmed ? ` ${CLASSNAME}__board-clear--armed` : ""}`}
                  title="Take everything off the board"
                  onClick={() => {
                    if (!boardArmed) return setBoardArmed(true);
                    setBoardArmed(false);
                    saveBoard([]);
                  }}
                  onBlur={() => setBoardArmed(false)}
                >
                  {boardArmed ? "clear it all?" : "clear"}
                </button>
              )}
              <button
                type="button"
                className={`${CLASSNAME}__board-x`}
                title="Put the board away"
                onClick={() => setBoardOpen(false)}
              >
                ✕
              </button>
            </div>
            {/* THE RECORDER STAYS AT THE TOP and the notes come down under it — but only when it is
                the NOTE box being spoken into; a reply shows its transcript beside the reply. */}
            {boardRec === "note" && (
              <div className={`${CLASSNAME}__interim ${CLASSNAME}__board-interim`}>
                <span className={`${CLASSNAME}__interim-dot`} />
                {boardInterim || "listening…"}
              </div>
            )}
            <div className={`${CLASSNAME}__board-new`}>
              <textarea
                ref={boardDraftRef}
                className={`${CLASSNAME}__board-draft`}
                value={boardDraft}
                placeholder="a note to yourself · something to hand me later"
                spellCheck={false}
                disabled={board === null}
                onChange={(e) => setBoardDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    addCard();
                  }
                }}
              />
              <span className={`${CLASSNAME}__board-tools`}>
                {micSupported && (
                  <button
                    type="button"
                    className={`${CLASSNAME}__board-mic${boardRec === "note" ? ` ${CLASSNAME}__board-mic--on` : ""}`}
                    title={boardRec === "note" ? "Stop — the words stay in the box" : "Speak a note"}
                    onClick={() => toggleBoardRec("note")}
                  >
                    🎙
                  </button>
                )}
                <button
                  type="button"
                  className={`${CLASSNAME}__board-add`}
                  title="Put it on the board (⌘↵)"
                  disabled={!boardDraft.trim()}
                  onClick={addCard}
                >
                  add
                </button>
              </span>
            </div>
            <div className={`${CLASSNAME}__board-cards`}>
              {board === null ? (
                <div className={`${CLASSNAME}__board-note`}>opening…</div>
              ) : !board.length ? (
                <div className={`${CLASSNAME}__board-empty`}>
                  nothing on the board yet — speak one or type one
                </div>
              ) : (
                board.map((c) => (
                  <div
                    key={c.ts}
                    className={`${CLASSNAME}__board-card${dropCard === c.ts ? ` ${CLASSNAME}__board-card--drop` : ""}`}
                    onDragOver={(e) => {
                      if (![...e.dataTransfer.types].includes(CARD_MIME)) return;
                      e.preventDefault();
                      if (dropCard !== c.ts) setDropCard(c.ts);
                    }}
                    onDragLeave={() => dropCard === c.ts && setDropCard(null)}
                    onDrop={(e) => {
                      if (![...e.dataTransfer.types].includes(CARD_MIME)) return;
                      e.preventDefault();
                      setDropCard(null);
                      moveCard(Number(e.dataTransfer.getData(CARD_MIME)), c.ts);
                    }}
                  >
                    {/* The stamp bar is the handle — the body is a textarea, and dragging from it
                        would be selecting text, which is what you actually want there. */}
                    <div
                      className={`${CLASSNAME}__board-card-head`}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData(CARD_MIME, String(c.ts));
                      }}
                      onDragEnd={() => setDropCard(null)}
                    >
                      <span className={`${CLASSNAME}__board-when`}>{moment(c.ts).fromNow()}</span>
                      {/* An agent can leave a note now, so a note has to say whose it is. His own
                          carry no author at all — the board is his by default. */}
                      {c.by && (
                        <span className={`${CLASSNAME}__board-by`} title={`left by ${c.by}`}>
                          {c.by}
                        </span>
                      )}
                      {/* SEE IT ALL, COPY IT, OR HAND IT TO ME — the three things he reached for the
                          moment he actually used the board. */}
                      <button
                        type="button"
                        className={`${CLASSNAME}__board-act`}
                        title="Copy this note"
                        onClick={() => {
                          // SAY "copied" ONLY IF IT COPIED. The clipboard can refuse (an unfocused
                          // window, a permission), and a button that claims success either way is
                          // how you find out at the paste.
                          const done = (ok) => {
                            setCopied(ok ? c.ts : -c.ts);
                            setTimeout(() => setCopied(0), 1400);
                          };
                          try {
                            navigator.clipboard.writeText(c.text).then(() => done(true), () => done(false));
                          } catch {
                            done(false);
                          }
                        }}
                      >
                        {copied === c.ts ? "copied" : copied === -c.ts ? "can't copy" : "copy"}
                      </button>
                      <button
                        type="button"
                        className={`${CLASSNAME}__board-act`}
                        title="Put it in the chat box — you still press send"
                        onClick={() => {
                          // RFC-039 — A HANDED-OVER NOTE SAYS SO. It used to arrive as bare text,
                          // indistinguishable from something he'd just typed, so an agent read a
                          // three-week-old reminder as a live instruction. The marker is part of the
                          // message (it survives into the room's file, which is what an agent
                          // actually reads) and it carries WHEN the note was written, because a note
                          // from the board is a thing he wrote THEN and is handing over NOW.
                          const stamp = moment(c.ts).format("MMM D, h:mm A");
                          const handed = `[from my board — written ${stamp}]\n${c.text}`;
                          setInput((cur) => (cur ? `${cur}\n${handed}` : handed));
                          setOpen(true);
                          openRef.current = true;
                        }}
                      >
                        💬
                      </button>
                      <button
                        type="button"
                        className={`${CLASSNAME}__board-x`}
                        title="Take this note off the board"
                        onClick={() => saveBoard(board.filter((x) => x.ts !== c.ts))}
                      >
                        ×
                      </button>
                    </div>
                    {/* Editable in place — a note you cannot fix is a note you rewrite somewhere else. */}
                    {(() => {
                      const open = openCards.includes(c.ts);
                      // How many lines this note really needs at the card's width — a long single
                      // line wraps, so counting newlines alone would call it one line and hide the
                      // rest with nothing to say so.
                      const needed = c.text
                        .split("\n")
                        .reduce((n, l) => n + Math.max(1, Math.ceil(l.length / 44)), 0);
                      const hidden = Math.max(0, needed - 2);
                      return (
                        <>
                          <textarea
                            className={`${CLASSNAME}__board-card-text${open ? ` ${CLASSNAME}__board-card-text--open` : ""}`}
                            value={c.text}
                            spellCheck={false}
                            rows={open ? Math.max(2, needed) : 2}
                            onChange={(e) =>
                              saveBoard(board.map((x) => (x.ts === c.ts ? { ...x, text: e.target.value } : x)))
                            }
                          />
                          {/* SAY THAT THERE IS MORE. A clamp with no sign of it is just a note you
                              think you have read. The line itself opens it — the ▸ is not the only
                              way in. */}
                          {hidden > 0 && (
                            <button
                              type="button"
                              className={`${CLASSNAME}__board-more`}
                              onClick={() =>
                                setOpenCards((cur) =>
                                  cur.includes(c.ts) ? cur.filter((x) => x !== c.ts) : [...cur, c.ts],
                                )
                              }
                            >
                              {open ? "show less" : `${hidden} more line${hidden === 1 ? "" : "s"} — show it all`}
                            </button>
                          )}
                          {/* THE EXCHANGE. Every reply in the order it was written, his and the
                              agent's told apart by who wrote it, each folding on its own. */}
                          {(c.replies || []).map((r, ri) => {
                            const rKey = `${c.ts}:${r.ts || ri}`;
                            const rOpen = openReplies.includes(rKey);
                            const rNeeded = String(r.text)
                              .split("\n")
                              .reduce((n, l) => n + Math.max(1, Math.ceil(l.length / 44)), 0);
                            const rHidden = Math.max(0, rNeeded - 3);
                            const mine = r.by === "you";
                            return (
                              <div
                                key={rKey}
                                className={`${CLASSNAME}__board-reply${mine ? ` ${CLASSNAME}__board-reply--mine` : ""}`}
                              >
                                {/* WHO SAID IT — the project's own name, never the word "agent". */}
                                <span className={`${CLASSNAME}__board-reply-who`}>
                                  {mine ? "you" : r.by || projectCode}
                                </span>
                                <span
                                  className={`${CLASSNAME}__board-reply-text${rOpen ? ` ${CLASSNAME}__board-reply-text--open` : ""}`}
                                >
                                  {r.text}
                                </span>
                                {rHidden > 0 && (
                                  <button
                                    type="button"
                                    className={`${CLASSNAME}__board-more`}
                                    onClick={() =>
                                      setOpenReplies((cur) =>
                                        cur.includes(rKey) ? cur.filter((x) => x !== rKey) : [...cur, rKey],
                                      )
                                    }
                                  >
                                    {rOpen ? "show less" : `${rHidden} more line${rHidden === 1 ? "" : "s"} — show it all`}
                                  </button>
                                )}
                              </div>
                            );
                          })}
                          {/* HIS HALF OF THE THREAD — reply to your own note, or to the answer under
                              it. Enter sends, Escape puts it away; it stays out of sight until asked
                              for, because most notes never need one. */}
                          {replying === c.ts ? (
                            <>
                              {boardRec === c.ts && (
                                <div className={`${CLASSNAME}__interim ${CLASSNAME}__board-interim`}>
                                  <span className={`${CLASSNAME}__interim-dot`} />
                                  {boardInterim || "listening…"}
                                </div>
                              )}
                              {/* THE SAME COMPOSER THE BOARD ALREADY HAS — box, mic, button, one row,
                                  same classes. A reply is not a different kind of writing, so it does
                                  not get a different kind of input. */}
                              {/* A REPLY COMPOSER THAT LOOKS LIKE ONE: the box takes the width, the
                                  controls sit under it on one line — mic on the left, the way out and
                                  the send on the right where a send belongs. */}
                              <div className={`${CLASSNAME}__board-replybox`}>
                                <textarea
                                  className={`${CLASSNAME}__board-draft`}
                                  autoFocus
                                  rows={2}
                                  value={replyDraft}
                                  placeholder="reply…"
                                  spellCheck={false}
                                  onChange={(e) => setReplyDraft(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Escape") {
                                      e.preventDefault();
                                      if (boardRecRef.current) {
                                        try { boardRecRef.current.stop(); } catch {}
                                      }
                                      setReplying(0);
                                      setReplyDraft("");
                                    } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                                      e.preventDefault();
                                      addReply(c.ts);
                                    }
                                  }}
                                />
                                <div className={`${CLASSNAME}__board-replybar`}>
                                  <span className={`${CLASSNAME}__board-replybar-end`}>
                                    <button
                                      type="button"
                                      className={`${CLASSNAME}__board-act`}
                                      title="Never mind (esc)"
                                      onClick={() => {
                                        if (boardRecRef.current) {
                                          try { boardRecRef.current.stop(); } catch {}
                                        }
                                        setReplying(0);
                                        setReplyDraft("");
                                      }}
                                    >
                                      cancel
                                    </button>
                                    <button
                                      type="button"
                                      className={`${CLASSNAME}__board-send`}
                                      title="Put it under the note (⌘↵)"
                                      disabled={!replyDraft.trim()}
                                      onClick={() => addReply(c.ts)}
                                    >
                                      reply
                                    </button>
                                    {/* The recorder rides the far right end of the row — his call. */}
                                    {micSupported && (
                                      <button
                                        type="button"
                                        className={`${CLASSNAME}__board-mic${boardRec === c.ts ? ` ${CLASSNAME}__board-mic--on` : ""}`}
                                        title={boardRec === c.ts ? "Stop — the words stay in the box" : "Speak the reply"}
                                        onClick={() => toggleBoardRec(c.ts)}
                                      >
                                        🎙
                                      </button>
                                    )}
                                  </span>
                              </div>
                              </div>
                            </>
                          ) : (
                            <button
                              type="button"
                              className={`${CLASSNAME}__board-more`}
                              onClick={() => {
                                setReplyDraft("");
                                setReplying(c.ts);
                              }}
                            >
                              reply
                            </button>
                          )}
                        </>
                      );
                    })()}
                  </div>
                ))
              )}
            </div>
            {!boardPlugin && (
              <div className={`${CLASSNAME}__board-note`}>
                no live service for this project — the board can't be saved from here
              </div>
            )}
          </div>
        )}
        {/* THE TV — the show-and-tell surface beside the panel: one show at a time (the Canvas
            model), interactive markdown through the one renderer, full-border resizable.
            It stands on its own too: picking a show out of the links table with the chat closed
            has to actually put it ON, not shuffle the table sideways to make room for nothing. */}
        {/* A CONTROL MUST NEVER HAVE A STATE THAT DRAWS NOTHING. Open with nothing to show used to
            render literally nothing — no frame, no message — while the button flipped to "Close the
            TV". So it looked broken, twice: once when it did nothing, again when the second click
            silently closed the thing that was never on screen. An empty TV is a fine thing to be;
            an invisible one is not. It says it is empty and how to fill it. */}
        {tvOpen && !tv && (
          <div
            className={`${CLASSNAME}__tv ${CLASSNAME}__tv--empty`}
            style={{ width: tvSize.w, height: 120 }}
          >
            <div className={`${CLASSNAME}__tv-empty-line`}>nothing on the TV yet</div>
            <div className={`${CLASSNAME}__tv-empty-sub`}>
              a report put on screen here shows up on this TV — <code>systemview show {projectCode} …</code>
            </div>
            <button
              type="button"
              className={`${CLASSNAME}__tv-empty-close`}
              onClick={() => setTvOpen(false)}
            >
              close
            </button>
          </div>
        )}
        {tvOpen && tv && (
          <div
            data-sv="tv"
            ref={tvElRef}
            className={`${CLASSNAME}__tv`}
            style={{
              width: inNav ? "auto" : tvSize.w,
              ...after(linksAhead), // after the links list when that is up
              // FLEX BY DEFAULT, WITH A MAX — NOT A FIXED BOX. Until you size it yourself the height
              // is whatever the show needs: a two-line show is a two-line box. It grows with the
              // content up to the chat's height and scrolls inside past that. The cap governs the
              // AUTOMATIC size only; drag it and your number wins, over the cap included.
              ...(tvSized
                ? { height: tvSize.h }
                : { height: "auto", maxHeight: Math.min(size.h, window.innerHeight - 40) }),
              ...(tvDrag.off.x || tvDrag.off.y
                ? { transform: `translate(${tvDrag.off.x}px, ${tvDrag.off.y}px)` }
                : {}),
            }}
          >
            <ResizeBorder start={tvResize} onReset={tvReset} />
            {/* Drag the header to move the TV; double-click it for natural size AND back to its
                anchored spot beside the chat (one gesture undoes both kinds of fiddling). */}
            <div
              className={`${CLASSNAME}__tv-head ${CLASSNAME}__tv-head--grab`}
              title="Drag to move · double-click for natural size and position"
              onPointerDown={tvDrag.onPointerDown}
              onDoubleClick={() => {
                tvReset(1, 1);
                tvDrag.reset();
              }}
            >
              <span className={`${CLASSNAME}__tv-badge`}>📺</span>
              {/* THE TITLE IS THE PICKER, same as the reports tab: every show this room has ever
                  had is one click away, so a show that scrolled out of the thread isn't lost. */}
              <button
                type="button"
                className={`${CLASSNAME}__tv-title ${CLASSNAME}__tv-title--pick`}
                title="Pick a show"
                onPointerDown={(e) => e.stopPropagation()} // the header drags; the picker doesn't
                onClick={(e) => {
                  e.stopPropagation();
                  setTvPick((v) => !v);
                }}
              >
                {tv.label || "show"}
                <span className={`${CLASSNAME}__tv-caret`}>▾</span>
              </button>
              {showWhen(tv.ts) && (
                <button
                  type="button"
                  className={`${CLASSNAME}__tv-when`}
                  title={`${new Date(tv.ts).toLocaleString()} — click to switch`}
                  onPointerDown={(e) => e.stopPropagation()} // the header drags; this doesn't
                  // ...and two quick flips must not reach the header's double-click, which resets
                  // the TV's size and position. Switching a stamp back and forth is exactly the
                  // gesture that would trigger it.
                  onDoubleClick={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    setWhenAbs((v) => {
                      try {
                        localStorage.setItem("sv.tvWhenAbs", String(!v));
                      } catch {}
                      return !v;
                    });
                  }}
                >
                  {whenAbs ? showWhenAbs(tv.ts) : showWhen(tv.ts)}
                </button>
              )}
              {/* TAKE IT WITH YOU (his ask). A report is a document now, and the documents section
                  reads documents by path — so "put this on the big screen" is one press: point the
                  centre at the same file and close the TV behind it, the same hand-off a file chip
                  already does. Nothing is staged and nothing is copied; rdoc reads the file. */}
              {tvDocPath && (
                <button
                  type="button"
                  className={`${CLASSNAME}__tv-doc`}
                  title="Open this report in the documents section"
                  onPointerDown={(e) => e.stopPropagation()} // the header drags; this doesn't
                  onDoubleClick={(e) => e.stopPropagation()} // …and never resets the TV
                  onClick={(e) => {
                    e.stopPropagation();
                    const p = new URLSearchParams(window.location.search);
                    p.set("tab", "reports");
                    p.set("rdoc", tvDocPath);
                    p.delete("help");
                    // A REPORT BELONGS TO A PROJECT, and so do the file params sitting in the URL.
                    // Landing on this project's page while `file`/`fproj`/`fsvc` still point at
                    // another one leaves the nav showing a foreign file beside the report — which is
                    // what "my reports are not being transferred properly" looks like from outside.
                    if (p.get("fproj") && p.get("fproj") !== projectCode)
                      ["file", "fproj", "fsvc", "flang", "flines", "fside"].forEach((k) => p.delete(k));
                    const pathname = window.location.pathname.startsWith(`/specs/${projectCode}`)
                      ? window.location.pathname
                      : `/specs/${projectCode}`;
                    go({ pathname, search: `?${p.toString()}` });
                    setTvOpen(false);
                    if (endErrandRef.current) endErrandRef.current(true);
                  }}
                >
                  📄
                </button>
              )}
              <button
                type="button"
                className={`${CLASSNAME}__close`}
                title="Close the TV — any show line in the chat brings it back"
                // Closing the TV closes the gesture pointing at it, right here rather than a beat
                // later off a watcher — otherwise the connector line is left anchored to something
                // that no longer exists and shoots off across the screen.
                onClick={() => {
                  setTvOpen(false);
                  if (endErrandRef.current) endErrandRef.current(true);
                }}
              >
                ✕
              </button>
            </div>
            {tvPick && (
              <div className={`${CLASSNAME}__tv-picker`} onClick={(e) => e.stopPropagation()}>
                {shows.length === 0 ? (
                  <div className={`${CLASSNAME}__tv-pick-empty`}>no shows in this room yet</div>
                ) : (
                  shows.map((s) => (
                    <button
                      type="button"
                      key={s.id}
                      className={`${CLASSNAME}__tv-pick-item${tv && tv.id === s.id ? " is-on" : ""}`}
                      onClick={() => {
                        setTvPick(false);
                        openShow(s.id, s.label, s.args.text, s.ts, s.args.report ? s.args : null);
                      }}
                    >
                      <span className={`${CLASSNAME}__tv-pick-name`}>{s.label || "show"}</span>
                      <span className={`${CLASSNAME}__tv-pick-time`}>{msgTime(s.ts)}</span>
                    </button>
                  ))
                )}
              </div>
            )}
            <div className={`${CLASSNAME}__tv-body`}>
              {/* The TV is INTERACTIVE-COMPLETE — and clicks are SILENT (his flow: "when I'm
                  done I'll jump back in the chat and say I responded"). Every interaction
                  writes the clicked-up show to the hub's TV-state file quietly — no chat echo
                  per click — and the agent reads the answers from there when he announces.
                  A writable surface also means right-click works here. */}
              <Markdown
                dark={appDark}
                scope={{ projectCode }}
                commentKey={`tv-${projectCode}`}
                onSourceChange={(next) => {
                  setTv((cur) => (cur ? { ...cur, text: next } : cur));
                  // RFC-040 — a document-backed report saves to the DOCUMENT. His answers then
                  // outlive the room: compaction, a hidden record, a re-push, none of them can
                  // reach them. Records that predate this still write through the hub.
                  //
                  // THE PATH IS LOOKED UP, NOT ONLY REMEMBERED. Relying on what openShow stored
                  // meant a TV opened before this shipped (or restored by any other route) had no
                  // path, so his answers went to the record and the DOCUMENT stayed behind — he
                  // opened the file and found four of his replies missing. Ask the show record.
                  const rec = shows.find((m) => m.id === tv.id);
                  const docPath = tv.path || (rec && rec.args && (rec.args.path || (rec.args.report && reportPathFor(rec.args.report))));
                  if (docPath && projPluginRef.current) {
                    projPluginRef.current.writeFile({ path: docPath, content: next }).catch(() => {});
                    // The record's fallback copy tracks the document while it still exists, so the
                    // two can never show different versions of the same report again.
                    SystemView.chatSetTv(projectCode, {
                      chat,
                      state: { id: tv.id, label: tv.label || "show", text: next },
                    }).catch(() => {});
                    return;
                  }
                  SystemView.chatSetTv(projectCode, {
                    chat,
                    state: { id: tv.id, label: tv.label || "show", text: next },
                  }).catch(() => {});
                }}
              >
                {tv.text}
              </Markdown>
            </div>
          </div>
        )}
        {/* THE COLLECTOR (his ask: "I want that link again") — a side panel like the TV: every
            link chip and 📺 show ever sent in this room, newest first, still clickable. A lens
            over the room's file — no new storage. Slides beside the TV when both are open. */}
        {linksOpen && (
          <div
            data-sv="links"
            className={`${CLASSNAME}__tv ${CLASSNAME}__links`}
            style={{
              width: inNav ? "auto" : LINKS_W,
              height: Math.min(inNav ? 420 : 480, window.innerHeight - 120),
              // First out of the chat — the TV and the board start after it.
              ...after(0),
              ...(linksDrag.off.x || linksDrag.off.y
                ? { transform: `translate(${linksDrag.off.x}px, ${linksDrag.off.y}px)` }
                : {}),
            }}
          >
            <div
              className={`${CLASSNAME}__tv-head ${CLASSNAME}__tv-head--grab`}
              title="Drag to move · double-click to put it back"
              onPointerDown={linksDrag.onPointerDown}
              onDoubleClick={linksDrag.reset}
            >
              <span className={`${CLASSNAME}__tv-badge`}>🔗</span>
              <span className={`${CLASSNAME}__tv-title`}>links & shows</span>
              <button
                type="button"
                className={`${CLASSNAME}__close`}
                title="Close"
                onClick={() => {
                  setLinksOpen(false);
                  if (endErrandRef.current) endErrandRef.current(true);
                }}
              >
                ✕
              </button>
            </div>
            <input
              className={`${CLASSNAME}__links-filter`}
              placeholder="filter…"
              value={linkQ}
              onChange={(e) => setLinkQ(e.target.value)}
            />
            <div className={`${CLASSNAME}__links-body`}>
              {collected.length === 0 ? (
                <div className={`${CLASSNAME}__links-empty`}>
                  {linkQ ? "nothing matches" : "no links or shows in this room yet"}
                </div>
              ) : (
                collected.map((e) =>
                  e.kind === "show" ? (
                    <div key={e.m.id} className={`${CLASSNAME}__links-item ${CLASSNAME}__links-item--show`}>
                      <button
                        type="button"
                        className={`${CLASSNAME}__links-open`}
                        title="Put this show back on the TV"
                        onClick={() => openShow(e.m.id, e.m.label, e.m.args.text, e.m.ts, e.m.args.report ? e.m.args : null)}
                      >
                        <span>📺 {e.m.label || "show"}</span>
                      </button>
                      <span className={`${CLASSNAME}__links-time`}>{msgTime(e.m.ts)}</span>
                      {/* HIS ASK, in his words: "I need to be able to delete shit." Two-step, and it
                          takes it off the LIST — the record stays in the room, because the
                          transcript is the account of what happened. */}
                      <button
                        type="button"
                        className={`${CLASSNAME}__links-x${dropShow === e.m.id ? ` ${CLASSNAME}__links-x--armed` : ""}`}
                        disabled={!canHide}
                        title={
                          !canHide
                            ? "this hub predates the verb — restart it and this works"
                            : dropShow === e.m.id
                              ? "Take it off the list?"
                              : "Take this off the list"
                        }
                        onBlur={() => setDropShow(0)}
                        onClick={() => {
                          if (dropShow !== e.m.id) return setDropShow(e.m.id);
                          setDropShow(0);
                          hideRecord(e.m.id);
                        }}
                      >
                        {dropShow === e.m.id ? "remove?" : "✕"}
                      </button>
                    </div>
                  ) : (
                    <div key={e.m.id} className={`${CLASSNAME}__links-item`}>
                      <span className={`${CLASSNAME}__links-chips`}>{e.parts}</span>
                      <span className={`${CLASSNAME}__links-time`}>{msgTime(e.m.ts)}</span>
                    </div>
                  ),
                )
              )}
            </div>
          </div>
        )}
        {open && (
        <div
          data-sv="chat"
          className={`${CLASSNAME}__panel`}
          // A free-parked bubble may not have the panel's height of room on its open side — cap
          // to the space that actually exists so it never runs off the top or bottom.
          // Docked, the COLUMN decides the width — a stored 340 would hang out over the nav's edge.
          style={
            inNav
              ? { width: "auto", height: Math.min(size.h, 420) }
              : {
                  width: size.w,
                  height: size.h,
                  // It keeps the height you gave it. Tying the cap to how close the bot was to an
                  // edge is what squeezed the panel as you moved down and cut its bottom off.
                  maxHeight: window.innerHeight - 40,
                }
          }
        >
          <ResizeBorder start={panelResize} onReset={panelReset} />
          {/* The open chat drags by its HEADER (his ask) — same move/dock behavior as dragging
              the bot; buttons in the header stay clickable. */}
          <div
            className={`${CLASSNAME}__head`}
            onPointerDown={(e) => {
              if (e.target.closest("button")) return;
              onBotPointerDown(e);
            }}
          >
            {/* the state chip explains itself on hover (his ask: help text next to it) */}
            <span className={`${CLASSNAME}__mode ${CLASSNAME}__mode--${ring}`} title={modeText}>{mode}</span>
            <span className={`${CLASSNAME}__title`}>{projectCode}</span>
            <span className={`${CLASSNAME}__presence`}>{modeText}</span>
            {/* The collector's button used to live here as well as on the bot. One door, one
                handle — it's beside the name tag now, where it's reachable whether or not the chat
                is open, which is the only place that works for a panel you may want without one. */}
            {/* The one door the strip used to hold: switch conversation, or start another. It lives
                in the header now, where a control you use rarely belongs. */}
            {/* COMPACT, the way Claude compacts — not the way the room does. The room's compaction
                is SystemView folding its own message file; a conversation's compaction is the model
                summarising itself, and only the session can do it. The browser's panel proved the
                transport passes the command through, so this is the same act from here. */}
            {work.hosted && attached && (
              <button
                type="button"
                className={`${CLASSNAME}__swap`}
                title={
                  work.state.ctx
                    ? `Compact this conversation — ${tokensShort(work.state.ctx)} in context`
                    : "Compact this conversation"
                }
                onClick={() => work.compact()}
              >
                ⤵
              </button>
            )}
            {work.hosted && attached && (
              <button
                type="button"
                className={`${CLASSNAME}__swap`}
                title="Switch conversation"
                onClick={() => setPicker(true)}
              >
                ⇅
              </button>
            )}
            {/* STOP, in the header with the other window controls. The transport has always had
                `interrupt`; nothing was calling it, so anything you started — a compaction you did
                not mean, a long tool run — had no way out from here. It sits beside the close
                button because that is where the controls for THIS WINDOW live; hanging it off the
                cooking line put a text button in the middle of a sentence. */}
            {attached && (work.state.state === "working" || work.state.state === "waiting") && (
              <button
                type="button"
                className={`${CLASSNAME}__stop`}
                title="Stop what it's doing"
                onClick={() => work.interrupt()}
              >
                <span className={`${CLASSNAME}__stop-sq`} />
              </button>
            )}
            {/* WHICH MODEL IS ANSWERING — always, not only when the bar goes red. His catch:
                *"I have no other way of seeing which agent is being used."* It was buried in a
                tooltip and in the red label, so at every healthy moment the one fact he most wanted
                was invisible. Short form on purpose — `opus-5`, not `claude-opus-5-20260101` — the
                full string is a build identifier, not a name you read at a glance.
                SWITCHING is not wired yet and this deliberately does not pretend to offer it: the
                shell has no primitive for it and I asked autobot rather than guessing. A control
                that looks live and does nothing is the class of lie this panel has already told
                twice tonight. */}
            {attached && work.state.model && (
              work.models && work.models.length ? (
                <span className={`${CLASSNAME}__model-wrap`}>
                  <button
                    type="button"
                    className={`${CLASSNAME}__model ${CLASSNAME}__model--pick${
                      work.switching ? ` ${CLASSNAME}__model--switching` : ""
                    }`}
                    title={`${work.state.model} — click to switch`}
                    onClick={() => setModelMenu((v) => !v)}
                  >
                    {work.switching ? `${shortModel(work.switching)}…` : shortModel(work.state.model)}
                  </button>
                  {modelMenu && (
                    <>
                      <div className={`${CLASSNAME}__ctx-overlay`} onClick={() => setModelMenu(false)} />
                      <div className={`${CLASSNAME}__model-menu`}>
                        {work.models.map((m) => {
                          const val = m.value || m.resolvedModel;
                          const shown = shortModel(m.resolvedModel || m.value);
                          // A BEST GUESS AT WHICH ONE IS RUNNING, and treated as exactly that. The
                          // panel only learns the model from a `session.started`, which arrives at
                          // the START OF THE NEXT TURN — so between a switch and the next answer
                          // this belief is knowingly stale. Match on either name the row carries,
                          // because `value` ("opus[1m]") and `resolvedModel`
                          // ("claude-opus-5[1m]") are both legitimate spellings of the same thing.
                          const mine = shortModel(work.state.model);
                          const current = !!mine && (mine === shown || mine === shortModel(val));
                          return (
                            <button
                              key={val}
                              type="button"
                              className={`${CLASSNAME}__model-item${
                                current ? ` ${CLASSNAME}__model-item--current` : ""
                              }`}
                              title={m.description || m.resolvedModel || val}
                              onClick={() => {
                                setModelMenu(false);
                                // ALWAYS SWITCH — never refuse because we believe it is already
                                // selected. His catch, and it is the sharpest kind of bug: the
                                // belief was stale (he had switched from the terminal, so no
                                // confirming event had arrived), the wrong row was marked current,
                                // and marking it current was what made it UNCLICKABLE. So the one
                                // row he needed became the one row that would not respond. A
                                // control disabled by a guess is worse than a control that does
                                // nothing, because it refuses in silence. Re-selecting the model
                                // you are already on is harmless — the host no-ops it — so there
                                // is nothing to protect against here. The tick stays as
                                // information; it stops being a gate.
                                work.switchModel(val);
                              }}
                            >
                              <span className={`${CLASSNAME}__model-item-name`}>
                                {m.displayName || shown}
                              </span>
                              <span className={`${CLASSNAME}__model-item-id`}>{shown}</span>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </span>
              ) : (
                <span className={`${CLASSNAME}__model`} title={`${work.state.model} — this shell cannot switch models yet`}>
                  {shortModel(work.state.model)}
                </span>
              )
            )}
            <button
              type="button"
              className={`${CLASSNAME}__close`}
              onClick={() => {
                openRef.current = false;
                setOpen(false);
              }}
            >
              ✕
            </button>
          </div>
          {/* The fullness meter — a hairline under the header: how close this room is to the
              ~300-record compaction mark. Agents are supposed to self-compact; this is how the
              human SEES when one hasn't. */}
          {/* THE BAR HAS TO MEAN WHAT IT SHOWS. Attached, this is the CONVERSATION's fullness —
              the last turn's input tokens against the model's window — not SystemView's 300-record
              room rule, which describes a different thing entirely. His words: *"I don't know how
              to trust the bar."* Two bars measuring two different things wearing one look is
              exactly how a bar stops being trustworthy, so only one of them is ever drawn. */}
          {attached && work.state.ctx > 0 && work.state.ctxWindow > 0 && (
            <div
              className={`${CLASSNAME}__meter`}
              title={`context ${tokensShort(work.state.ctx)} of ~${tokensShort(work.state.ctxWindow)} — ${
                work.state.ctx >= work.state.ctxWindow * CTX_DUE
                  ? "compact now"
                  : work.state.ctx >= work.state.ctxWindow * CTX_WARN
                  ? "compact soon"
                  : "healthy"
              }${work.state.model ? ` · ${work.state.model}` : ""}`}
            >
              <div
                className={`${CLASSNAME}__meter-fill${
                  work.state.ctx >= work.state.ctxWindow * CTX_DUE
                    ? ` ${CLASSNAME}__meter-fill--due`
                    : work.state.ctx >= work.state.ctxWindow * CTX_WARN
                    ? ` ${CLASSNAME}__meter-fill--warn`
                    : ""
                }`}
                style={{ width: `${Math.min(100, (work.state.ctx / work.state.ctxWindow) * 100)}%` }}
              />
              {/* A CLAIM THIS LOUD SHOWS ITS WORKING. He has told me three times the bar goes red
                  when he presses stop, and three times I could not reproduce it — so the honest fix
                  is not another guess about the trigger, it is making the bar unable to say
                  "compact now" without showing the two numbers it divided to get there. Hidden
                  behind a hover, the evidence may as well not exist: *"I don't know how to trust
                  it."* Only when it is due — a healthy bar is a hairline and should stay one. */}
              {work.state.ctx >= work.state.ctxWindow * CTX_DUE && (
                <span className={`${CLASSNAME}__meter-why`}>
                  {tokensShort(work.state.ctx)} / {tokensShort(work.state.ctxWindow)}
                  {work.state.model ? ` · ${shortModel(work.state.model)}` : ""}
                </span>
              )}
            </div>
          )}
          {!attached && p.records > 0 && (
            // THE OTHER BAR, AND IT HAS TO SAY SO. This one counts the ROOM's records, and it
            // solved the red-bar mystery he reported four times: the moment attachment drops (a
            // restart, a stop), the token ruler above disappears and THIS bar takes its exact
            // place — same hairline, same colours — sitting at 90%+ forever, because a session
            // compaction cannot lower a room's record count. He read it as "you need a compaction
            // right after we just did one." Ground truth at the time: 77k of 1M. So the same rule
            // the token meter already obeys applies here — a loud claim shows its working. Once
            // it is warm the bar says "272 / ~300 records · room" on its face, and the two bars
            // can never be mistaken for each other again.
            <div
              className={`${CLASSNAME}__meter`}
              title={`${p.records} records in this room — agents compact around ${COMPACT_MARK}. Not the session's context.`}
            >
              <div
                className={`${CLASSNAME}__meter-fill${
                  p.records >= COMPACT_MARK
                    ? ` ${CLASSNAME}__meter-fill--due`
                    : p.records >= COMPACT_MARK * 0.8
                    ? ` ${CLASSNAME}__meter-fill--warn`
                    : ""
                }`}
                style={{ width: `${Math.min(100, (p.records / COMPACT_MARK) * 100)}%` }}
              />
              {p.records >= COMPACT_MARK * 0.8 && (
                <span className={`${CLASSNAME}__meter-why`}>
                  {p.records} / ~{COMPACT_MARK} records · room
                </span>
              )}
            </div>
          )}
          {/* HIS PLAN LIMITS, beside the context bar — his ask, with its own condition attached:
              *"I need to be updated on my usage… like there's a bar at the top that shows
              compaction. But only if it's not extra work — if it's extra work I'll just wait until
              I ask for it."* It is not extra work: `/usage` already prints these numbers and that
              printout already arrives in this feed, so this is the last one that went past, read
              rather than fetched. Nothing polls and nothing costs a turn.
              AND IT SAYS WHEN IT WAS TRUE. A free reading is a stale reading — it only moves when
              /usage runs — so the stamp is on its face, not in a tooltip. Four meter lies died
              today and every one of them was a number that could not answer "as of when"; this one
              answers before being asked. */}
          {attached && work.state.usage && work.state.usage.bars.length > 0 && (
            <div className={`${CLASSNAME}__usage`}>
              {work.state.usage.bars.map((b) => (
                <div
                  key={b.label}
                  className={`${CLASSNAME}__usage-row`}
                  title={`${b.label} — ${b.pct}% used${b.resets ? ` · resets ${b.resets}` : ""}`}
                >
                  <span className={`${CLASSNAME}__usage-label`}>{b.label}</span>
                  <span className={`${CLASSNAME}__usage-bar`}>
                    <span
                      className={`${CLASSNAME}__usage-fill${
                        b.pct >= 90
                          ? ` ${CLASSNAME}__usage-fill--due`
                          : b.pct >= 75
                          ? ` ${CLASSNAME}__usage-fill--warn`
                          : ""
                      }`}
                      style={{ width: `${b.pct}%` }}
                    />
                  </span>
                  <span className={`${CLASSNAME}__usage-pct`}>{b.pct}%</span>
                </div>
              ))}
              <div className={`${CLASSNAME}__usage-as-of`}>
                {work.state.usage.ts ? `as of ${timeOf(work.state.usage.ts)}` : "as of the last /usage"}
                {work.state.usage.bars[0] && work.state.usage.bars[0].resets
                  ? ` · session resets ${work.state.usage.bars[0].resets}`
                  : ""}
              </div>
            </div>
          )}
          {/* RFC-031 — the roster: every identity currently holding a line in THIS room. ALWAYS
              visible (his catch: with the strip hidden, "nobody else here" was indistinguishable
              from "did they come back?" — old name-tagged bubbles read as presence). Right-click
              a visitor = the kick menu; the × on the chip is the same bounce. */}
          {(
            <div className={`${CLASSNAME}__roster`}>
              {/* ATTACHED, THIS IS NOT A ROOM AND NOBODY CAN BE KICKED OUT OF IT. A peer agent that
                  messaged a session holds no line anywhere, so `chatKick` would report success and
                  change nothing — a control that looks live and does nothing, the same class of lie
                  as an unanswerable permission prompt. The strip still names everyone, because
                  who is in whose chat is always on screen; it just stops offering a door that isn't
                  there. */}
              {attached ? "in this conversation: " : "in the room: "}
              {attached ? (
                <span className={`${CLASSNAME}__roster-name ${CLASSNAME}__roster-name--home`}>{projectCode}</span>
              ) : (p.live || p.listener) ? (
                <span className={`${CLASSNAME}__roster-name ${CLASSNAME}__roster-name--home`}>{projectCode}</span>
              ) : (
                <span className={`${CLASSNAME}__roster-empty`}>nobody — the agent is out</span>
              )}
              {/* VISITING IS A SUBSCRIPTION, SPOKE IS HISTORY — his distinction, and the two look
                  different because they ARE different. A visitor on the list receives what is said
                  here (the hub sends it; they hold nothing), and the ✕ finally means something
                  real: unsubscribe. Someone who merely spoke fades and lapses on its own. */}
              {attached &&
                subscribed.map((v) => (
                  <span
                    key={`sub-${v.identity}`}
                    className={`${CLASSNAME}__roster-name ${CLASSNAME}__roster-name--visiting`}
                    style={visStyle(v.identity)}
                    title={`${v.identity} is visiting — receives what is said here${v.by === "human" ? " (you added them)" : ""}`}
                  >
                    {v.identity}
                    <button
                      type="button"
                      className={`${CLASSNAME}__roster-x`}
                      title={`Stop sending ${v.identity} this conversation`}
                      onClick={async (e) => {
                        e.stopPropagation();
                        try {
                          await SystemView.chatRemoveVisitor(projectCode, { identity: v.identity });
                          setSubscribed((cur) => cur.filter((x) => x.identity !== v.identity));
                        } catch {}
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              {/* ＋ ADD SOMEONE — his ask: pull an agent into a conversation it never entered. */}
              {attached && (
                <span className={`${CLASSNAME}__roster-add`}>
                  {addingVisitor ? (
                    <input
                      autoFocus
                      className={`${CLASSNAME}__roster-add-input`}
                      placeholder="project code"
                      value={newVisitor}
                      onChange={(e) => setNewVisitor(e.target.value)}
                      onBlur={() => { setAddingVisitor(false); setNewVisitor(""); }}
                      onKeyDown={async (e) => {
                        if (e.key === "Escape") { setAddingVisitor(false); setNewVisitor(""); }
                        if (e.key !== "Enter") return;
                        const id = newVisitor.trim();
                        if (!id) return;
                        try {
                          const res = await SystemView.chatAddVisitor(projectCode, { identity: id });
                          if (res && res.added)
                            setSubscribed((cur) =>
                              cur.some((x) => x.identity === id) ? cur : [{ identity: id, by: "human", ts: Date.now() }, ...cur],
                            );
                        } catch {}
                        setAddingVisitor(false);
                        setNewVisitor("");
                      }}
                    />
                  ) : (
                    <button type="button" className={`${CLASSNAME}__roster-add-btn`} title="Add an agent as a visitor" onClick={() => setAddingVisitor(true)}>
                      +
                    </button>
                  )}
                </span>
              )}
              {/* SPOKE IS NOT PRESENCE AND IT DOES NOT BELONG UP HERE — his call, and he is right
                  that a faded name beside the live ones was spooky: *"as far as visits, that's all
                  I should show at the top."* Someone speaking once is a thing that HAPPENED, so it
                  lives at the bottom of the conversation as a passing note you can click, not in
                  the strip that answers "who is here". See __spokebar below. */}
              {visitors.map((v) =>
                attached ? null : (
                  <span
                    key={v}
                    className={`${CLASSNAME}__roster-name`}
                    style={visStyle(v)}
                    title="Right-click to kick out"
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setKickTarget(v);
                    }}
                  >
                    {v}
                    {/* the ✕ right on the chip — visitors are listed at the top, so the bounce is too */}
                    <button
                      type="button"
                      className={`${CLASSNAME}__roster-x`}
                      title={`Kick ${v} out`}
                      onClick={async (e) => {
                        e.stopPropagation();
                        try {
                          await SystemView.chatKick(projectCode, { identity: v });
                        } catch {}
                      }}
                    >
                      ×
                    </button>
                  </span>
                ),
              )}
              {kickTarget && (
                <>
                  <div className={`${CLASSNAME}__ctx-overlay`} onClick={() => setKickTarget(null)} />
                  <button
                    type="button"
                    className={`${CLASSNAME}__roster-kick`}
                    onClick={async () => {
                      try {
                        await SystemView.chatKick(projectCode, { identity: kickTarget });
                      } catch {}
                      setKickTarget(null);
                    }}
                  >
                    Kick {kickTarget} out
                  </button>
                </>
              )}
            </div>
          )}
          <div
            className={`${CLASSNAME}__list`}
            ref={listRef}
            onScroll={(e) => {
              // Our own pin does not get a vote on whether he scrolled away.
              if (Date.now() < pinning.current) return;
              const el = e.currentTarget;
              stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
            }}
          >
            {/* THE ROOM IS GONE FROM THE PANEL. Not hidden behind a session — gone. His call once
                visiting worked: *"I don't need to see that old chat between me and you anymore, I
                don't need to see this whole back-to-the-room and resume shit at the bottom. If none
                of the chats are set up, what I need to see is a prompt to attach an agent."* The
                hub subscription stays — commands still move his window, and other agents still
                reach this project — but the CONVERSATION is the session now, and a panel with no
                session says so instead of offering a second inbox. */}
            {!attached && (
              <div className={`${CLASSNAME}__nobody`}>
                <div className={`${CLASSNAME}__nobody-line`}>No agent here yet.</div>
                <div className={`${CLASSNAME}__nobody-sub`}>
                  {work.hosted
                    ? "Pick up a conversation from this folder, or start a new one."
                    : "This window isn't running inside the browser, so there's nothing to attach to."}
                </div>
                {/* NOTHING GOES MISSING IN THE HANDOVER. With the room out of the panel, a message
                    another agent sent to a project that has no session yet would have had nowhere
                    to appear at all. It is not shown here — this is a door, not an inbox — but it
                    is COUNTED, so the handover never silently swallows anything. */}
                {/* AND THEY ARE READABLE. Counting them was not enough — a message you are told
                    about but cannot read is worse than one you never heard of. The room shows here
                    and ONLY here: under the prompt, on a project that has no conversation yet. The
                    moment one is attached this is gone and the session is the chat. */}
                {roomTail.length > 0 && (
                  <div className={`${CLASSNAME}__waiting`}>
                    <div className={`${CLASSNAME}__nobody-waiting`}>
                      {`${roomTail.length} message${roomTail.length === 1 ? "" : "s"} arrived before there was a conversation to put them in`}
                    </div>
                    {roomTail.map((m) => (
                      <div key={m.id} className={`${CLASSNAME}__waiting-msg`}>
                        {m.as && m.as !== projectCode && (
                          <span className={`${CLASSNAME}__waiting-who`} style={visStyle(m.as)}>{m.as}</span>
                        )}
                        {/* SCOPED, so the blocks inside actually have a project to read from. Every
                            ::file / ::diff / ::image resolves its folder from `scope.projectCode`, and
                            three of the four places that render chat markdown had no provider above
                            them — so the same block that worked in the session panel drew its
                            empty-handed state in the room, which reads as "interactive markdown is
                            broken". It was not broken; it was unaddressed. (autobot found this.) */}
                        <MarkdownScopeProvider value={{ projectCode }}>
                          {/* SCOPED, so the blocks inside actually have a project to read from. Every
                          ::file / ::diff / ::image resolves its folder from `scope.projectCode`, and
                          three of the four places that render chat markdown had no provider above
                          them — so the same block that worked in the session panel drew its
                          empty-handed state in the room, which reads as "interactive markdown is
                          broken". It was not broken; it was unaddressed. (autobot found this.) */}
                      <MarkdownScopeProvider value={{ projectCode }}>
                        {renderChatMessage(String(m.text || ""))}
                      </MarkdownScopeProvider>
                        </MarkdownScopeProvider>
                      </div>
                    ))}
                  </div>
                )}
                {work.hosted && (
                  <button type="button" className={`${CLASSNAME}__nobody-btn`} onClick={() => setPicker(true)}>
                    Choose a conversation
                  </button>
                )}
              </div>
            )}
            {/* ATTACHED MEANS ATTACHED. The room's history is not shown behind the session — his
                catch, and he is right: *"why are you keeping that conversation behind it? … wouldn't
                the whole window transfer over?"* Two conversations stacked in one panel is exactly
                the double-tracking this is meant to end. Detach and the room comes back untouched. */}
            {/* THE WORK, under the words. A tool call is one line you can open; a file it wrote
                carries a door into the diff; a permission it needs is a control right here. */}
            {attached && (
              <div className={`${CLASSNAME}__work ${CLASSNAME}__work--only`}>
                {/* PROVE IT IS THE SAME CONVERSATION, without making him ask. A resume continues the
                    transcript but does NOT replay it as events, so a resumed session starts with an
                    empty feed — which reads exactly like a broken one. Until the host can hand back
                    the transcript's own messages, say that instead of showing nothing. */}
                {!work.rows.length && (
                  <div className={`${CLASSNAME}__work-note`}>
                    {attached === "fresh"
                      ? "new conversation — say something"
                      : `${work.state.state}…`}
                  </div>
                )}
                {/* RFC-050 — THE WRITE CHANNEL, and why it is a message rather than a file edit.
                    On the TV an input block writes its answer into the source document; a session's
                    transcript is not ours to rewrite. So answering SAYS the answer — the agent
                    reads it through the same path as everything else he types, which is exactly the
                    burden he asked me to avoid: *"make sure it's something that doesn't burden you
                    guys on how you read the response."* The block keeps its own optimistic state,
                    so it still looks answered the moment he clicks. */}
                {/* A BLOCK IN AN AGENT'S CHAT BELONGS TO THAT AGENT'S PROJECT. Without this the
                    scope falls back to the URL — `/specs` with nothing selected has no project at
                    all — so every ::commit I offered him drew the empty-handed message *"no live
                    service with file access — connect one, or name it with {project=…}"*. The chat
                    has always known whose chat it is; it simply never said so to the blocks inside
                    it. Same for ::file, ::diff and anything else that reads a repo. */}
                <MarkdownScopeProvider value={{ projectCode }}>
                  <MarkdownWriteProvider value={sessionWrite}>
                    <Feed rows={work.rows} answered={work.answered} onAnswer={work.answer} renderText={renderChatMessage} />
                  </MarkdownWriteProvider>
                </MarkdownScopeProvider>
              </div>
            )}
            {!attached && work.rows.length > 0 && (
              <div className={`${CLASSNAME}__work`}>
                <Feed rows={work.rows} answered={work.answered} onAnswer={work.answer} />
              </div>
            )}
            {/* The ROOM's cooking lines, and only while there is no session. Attached, the session
                owns that line and it lives outside the scroll — two of them stacked would be the
                same status said twice by two different authorities. */}
            {!attached &&
              roomLines.map((s) => (
                <StatusLine
                  key={s.as || "home"}
                  status={s.text}
                  visitor={s.as && s.as !== projectCode ? s.as : null}
                />
              ))}
          </div>
          {/* COOKING, in the direct chat — OUTSIDE the scroll, on purpose. His call: *"cooking should
              be sticky, she shouldn't scroll away from it."* It was the last row inside the feed, so
              it scrolled off the moment he read back through anything. Sticky positioning cannot
              save it there — a sticky element can never travel past the bottom of its containing
              block, and it WAS the bottom of it — so the line lives between the feed and the input
              instead. The one line that says whether anything is happening is the one line he must
              never have to go looking for. It names the tool in flight and falls back to the room's
              cycling words when there is nothing specific to name. */}
          {attached && (work.state.state === "working" || work.state.state === "waiting") && (
            <CookLine doing={work.state.doing} state={work.state.state} />
          )}
          {/* While the mic listens: the words appear HERE as you speak (interim), then commit
              into the input as they finalize. The line itself is the recording indicator. */}
          {listening && (
            <div className={`${CLASSNAME}__interim`}>
              <span className={`${CLASSNAME}__interim-dot`} />
              {interim || "listening…"}
            </div>
          )}
          {/* THE BUTTON HE ASKED FOR — one press to stop talking through the room and start talking
              to the agent itself. Closed, it is a single line; open, it is the conversations already
              on disk for this project's folder. */}
          {/* THE STRIP ONLY EXISTS WHEN THERE IS A CHOICE TO MAKE. Attached, it said "resumed ·
              ready · back to the room" under every conversation, forever — three facts he does not
              need and one door to a place that no longer exists. It shows while choosing, and while
              something is genuinely wrong; otherwise the bottom of the panel is the input box. */}
          {work.hosted && (!attached || picker || work.err || sendErr) && (
            <div className={`${CLASSNAME}__attach`}>
              {attached && !picker ? (
                <>
                  {work.err && <span className={`${CLASSNAME}__attach-note`}>{work.err}</span>}
                  {sendErr && <span className={`${CLASSNAME}__attach-note`}>{sendErr}</span>}
                </>
              ) : picker ? (
                <div className={`${CLASSNAME}__attach-list`}>
                  {/* WHOSE CONVERSATIONS THESE ARE, said out loud. His catch: *"it's kind of hard to
                      tell which conversation belongs to who."* They belong to a FOLDER, not to an
                      agent — every session in this list ran in this project's directory — and saying
                      so is the whole answer, because the ambiguity was never between two agents in
                      one folder, it was not knowing which folder he was looking at. */}
                  {/* RUNNING NOW, FIRST. These are the browser's own sessions — the agent he is
                      already talking to in the browser panel is in here, and picking it makes this
                      panel a second view of that one conversation rather than a second conversation. */}
                  {live.length > 0 && (
                    <>
                      <span className={`${CLASSNAME}__attach-note`}>running now in the browser</span>
                      {live.map((l) => {
                        const named = (transcripts || []).find(
                          (t) => t.sessionId === l.sessionId || t.sessionId === l.sdkSessionId,
                        );
                        return (
                          <button
                            key={l.key || l.sessionId}
                            type="button"
                            className={`${CLASSNAME}__attach-row`}
                            title={`${l.sessionId}${l.cwd ? ` · ${l.cwd}` : ""}`}
                            onClick={() => {
                              setAttached(`live:${l.sessionId}`);
                              setPicker(false);
                            }}
                          >
                            {(named && named.about) || l.sessionId}
                            <span className={`${CLASSNAME}__attach-live`}> · live</span>
                          </button>
                        );
                      })}
                    </>
                  )}
                  <span className={`${CLASSNAME}__attach-note`}>{`conversations in ${projectCode}`}</span>
                  {transcripts === null && <span className={`${CLASSNAME}__attach-note`}>reading…</span>}
                  {transcripts && !transcripts.length && (
                    <span className={`${CLASSNAME}__attach-note`}>no conversations on disk for this folder yet</span>
                  )}
                  {(transcripts || []).map((t) => (
                    <button
                      key={t.sessionId}
                      type="button"
                      className={`${CLASSNAME}__attach-row`}
                      title={t.sessionId}
                      onClick={() => {
                        setAttached(t.sessionId);
                        setPicker(false);
                      }}
                    >
                      <span className={`${CLASSNAME}__attach-title`}>{t.about || t.sessionId}</span>
                      {/* WHEN, and WHAT WAS LAST SAID. Two facts that turn a list of names into a
                          list he can choose from without opening each one to find out. */}
                      <span className={`${CLASSNAME}__attach-when`}>
                        {t.lastActive ? moment(t.lastActive).fromNow() : ""}
                      </span>
                      {tails[t.sessionId] && (
                        <span className={`${CLASSNAME}__attach-tail`}>{tails[t.sessionId]}</span>
                      )}
                      {/* Touched in the last few minutes = something is probably still using it,
                          which for this room is almost certainly the agent he is talking to right
                          now. A hint, never a lock — nothing here can prove a process is alive. */}
                      {t.lastActive && Date.now() - t.lastActive < 5 * 60 * 1000 && (
                        <span className={`${CLASSNAME}__attach-live`}> · live now</span>
                      )}
                    </button>
                  ))}
                  <button
                    type="button"
                    className={`${CLASSNAME}__attach-btn`}
                    onClick={() => {
                      setAttached("fresh");
                      setPicker(false);
                    }}
                  >
                    start fresh
                  </button>
                </div>
              ) : (
                <button type="button" className={`${CLASSNAME}__attach-btn`} onClick={() => setPicker(true)}>
                  talk to the agent directly
                </button>
              )}
            </div>
          )}
          {/* SPOKE, AT THE BOTTOM, WHERE HE PUT IT. His call, twice: *"let's get rid of that spoke
              shit, that shit is spooky — you shouldn't put that at the top. You should put it like
              a bar at the bottom above the chat box… and it could say it, and you could click it and
              navigate to it in the chat."* Someone speaking once is a thing that HAPPENED, not
              presence — so it sits at the edge of the conversation as a passing note with a way back
              to the sentence, and it lapses on its own once that turn is no longer near the end.
              The comment upstairs promised this bar for a while before it existed; a promise a file
              makes and does not keep is worse than no comment, so it exists now. */}
          {/* SENT → WHO. One line, under the conversation, naming the visitors his last message
              actually reached. It is the hub's own answer to the relay, not a guess by this panel. */}
          {attached && lastRelay && lastRelay.to.length > 0 && (
            <div className={`${CLASSNAME}__relayed`}>
              <span className={`${CLASSNAME}__relayed-mark`}>→</span>
              {lastRelay.to.map((v) => (
                <span key={v} className={`${CLASSNAME}__relayed-name`} style={visStyle(v)}>
                  {v}
                </span>
              ))}
              <span className={`${CLASSNAME}__relayed-when`}>{timeOf(lastRelay.ts)}</span>
            </div>
          )}
          {attached && spokeMarks.length > 0 && (
            <div className={`${CLASSNAME}__spokebar`}>
              <span className={`${CLASSNAME}__spokebar-label`}>spoke</span>
              {spokeMarks.map((m) => (
                <span key={m.as} className={`${CLASSNAME}__spokebar-chip`}>
                  <button
                    type="button"
                    className={`${CLASSNAME}__spokebar-name`}
                    style={visStyle(m.as)}
                    title={`Jump to what ${m.as} said`}
                    onClick={() => {
                      const el = document.querySelector(`[data-row="${m.key}"]`);
                      if (el && el.scrollIntoView) el.scrollIntoView({ behavior: "smooth", block: "center" });
                    }}
                  >
                    {m.as}
                  </button>
                  {/* CLEARABLE, so the two strips can be told apart by USING them — his ask, and the
                      right test: this ✕ only forgets that someone spoke. If a name vanishes from
                      here and the top strip is unchanged, the top strip is the subscription list,
                      which is the claim. A distinction you cannot check is a distinction nobody
                      believes, and he has had reason not to believe this one all day. */}
                  <button
                    type="button"
                    className={`${CLASSNAME}__spokebar-x`}
                    title={`Clear — forget that ${m.as} spoke (does not change who is visiting)`}
                    onClick={() => setSpokeCleared((cur) => ({ ...cur, [m.as]: Date.now() }))}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className={`${CLASSNAME}__inputrow`}>
            {/* A textarea that WRAPS and GROWS (to ~6 lines, then scrolls). Enter sends,
                Shift+Enter breaks a line — chat conventions. */}
            <textarea
              ref={inputRef}
              className={`${CLASSNAME}__input`}
              rows={1}
              value={input}
              placeholder={p.live ? "the agent is in — talk" : "message (delivered at the agent's next turn)"}
              onChange={(e) => {
                setInput(e.target.value);
                autogrow(e.target);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            {micSupported && (
              <button
                type="button"
                className={`${CLASSNAME}__mic ${listening ? `${CLASSNAME}__mic--on` : ""}`}
                title={listening ? "Stop listening" : "Dictate — speech goes into the input"}
                onClick={toggleMic}
              >
                🎙
              </button>
            )}
            <button
              type="button"
              className={`${CLASSNAME}__send`}
              onClick={send}
              disabled={!input.trim() && !listening}
              title="Send"
            >
              <img src={SEND_ICON} alt="send" />
            </button>
          </div>
        </div>
        )}
        </div>
      )}
      {/* PEEK — the closed bubble still talks: while cooking, the status sticks out beside it;
          when a reply lands unseen, a green preview of the message does. Click = open. */}
      {/* WHAT YOU'RE SAYING, AS YOU SAY IT — committed words solid, the ones still being heard
          faded behind them. It exists only while the mic is live: the second you send, it's gone,
          because a panel hanging around after you've spoken is just something in your way. */}
      {!open && listening && (
        <div
          className={`${CLASSNAME}__peek ${CLASSNAME}__peek--mic ${leftHalf ? `${CLASSNAME}__peek--right` : ""}`}
          style={peekShift ? { marginLeft: peekShift } : undefined}
        >
          {/* PINNED TO WHAT YOU'RE SAYING NOW. Once the transcript passes the box height the newest
              words fall below the fold, and nobody scrolls a box while they're mid-sentence — the
              whole point is watching your own message. It rides the bottom as you talk. */}
          <div
            className={`${CLASSNAME}__mic-text`}
            ref={(el) => {
              if (el) el.scrollTop = el.scrollHeight;
            }}
          >
            {input}
            {input && interim ? " " : ""}
            <i>{interim}</i>
            {!input && !interim && "listening…"}
          </div>
          <div className={`${CLASSNAME}__mic-actions`}>
            <button
              type="button"
              className={`${CLASSNAME}__mic-btn`}
              title="Stop and throw it away"
              onClick={() => {
                try { if (recRef.current) recRef.current.stop(); } catch {}
                // …and a HOST recording, which is a different object entirely: without this the ✕
                // cleared the words on screen and left the microphone running.
                if (hostMicRef.current) {
                  const rec = hostMicRef.current;
                  hostMicRef.current = null;
                  rec.cancel();
                  setListening(false);
                }
                setInput("");
                setInterim("");
              }}
            >
              ✕
            </button>
            <button
              type="button"
              className={`${CLASSNAME}__mic-btn ${CLASSNAME}__mic-btn--send`}
              title="Send it — the chat stays closed"
              // LIVE MIC COUNTS AS SOMETHING TO SEND. The words you are saying right now have not
              // committed yet, so an input-only check greys the button out mid-sentence — which is
              // exactly what "I can't even use the recorder when the chat is closed" was.
              disabled={!input.trim() && !listening}
              onClick={send}
            >
              send
            </button>
          </div>
        </div>
      )}
      {/* THE THIRD TIME THIS EXACT BUG: gated on one thing, drawn from another. The gate asked the
          ROOM (`p.status`, `unread`) and the body drew from the SESSION (`peekUnread`), so every
          project with old room messages and no attached conversation opened a bubble under its bot
          with NOTHING IN IT — six of them on his screen at once, which is the "extra row when it's
          minimised" he asked me to get rid of. `peekHas` is now the single answer to both questions,
          so there is no way for them to disagree again. */}
      {!open && !animating && !listening && peekHas && (
        <div
          className={`${CLASSNAME}__peek ${peekUnread > 0 && !(hasBrief && sessionCooking) ? `${CLASSNAME}__peek--thread` : ""} ${leftHalf ? `${CLASSNAME}__peek--right` : ""}`}
          style={peekShift ? { marginLeft: peekShift } : undefined}
          onClick={() => {
            openRef.current = true;
            setOpen(true);
            setUnread(0);
            try { localStorage.setItem(`sv.chatSeen.${projectCode}`, String(Date.now())); } catch {}
          }}
        >
          {/* WHILE IT IS WORKING, THE BRIEF WINS. These are two different jobs wearing one slot: the
              message display is for coming BACK to a pile of replies, the brief is for watching work
              happen. Ranking unread first meant the brief almost never appeared — every sentence the
              agent finishes is itself an unread, so a working agent went straight back to the pile
              view. Working ⇒ show what it is doing; quiet with replies waiting ⇒ show the replies. */}
          {!peekUnread || (hasBrief && sessionCooking) ? (
            // Closed ≠ blind (his ask: the peek shows MORE): a closed chat still tells you what is
            // being worked on. ATTACHED, that sentence comes from the session — the same words the
            // open panel shows — instead of the room's hub status, so there is one answer to "is
            // anything happening" whether the panel is open, closed or docked.
            hasBrief ? (
              // TWO LINES, NOT A CYCLING WORD. Text on top because that is the thing he is waiting
              // for; the command under it in the same plum the panel uses, so a SystemView action
              // and a shell line read as themselves here too. Each is ONE line and clipped — this
              // is a brief, and a brief that wraps to four lines is a panel he did not open.
              <div className={`${CLASSNAME}__brief`}>
                {brief.say && <div className={`${CLASSNAME}__brief-say`}>{brief.say}</div>}
                {/* THE DOTS BELONG TO THE SECOND ROW, and to ALL of them — his correction, twice
                    over. First I put them on both rows: *"I didn't say the ellipsis is on both rows.
                    I said the second row."* Then, on the row itself: *"it's only on the green ones…
                    they can all have dancing dots matching their color at the end."* So the gate on
                    `running` comes off, and the colour is `currentColor` — inherited from the line
                    they end, so a green command's dots are green and a neutral one's are neutral,
                    with no second colour rule to keep in sync. The words clip and the dots do NOT:
                    inside the clipping box a long command pushes them off the end. */}
                {brief.cmd && (
                  <div
                    className={`${CLASSNAME}__brief-cmd${
                      brief.running ? ` ${CLASSNAME}__brief-cmd--running` : ""
                    }${brief.kind === "sv" ? ` ${CLASSNAME}__brief-cmd--sv` : ""}`}
                  >
                    <span className={`${CLASSNAME}__brief-text`}>{brief.cmd}</span>
                    <span className={`${CLASSNAME}__dots`}>
                      <i />
                      <i />
                      <i />
                    </span>
                  </div>
                )}
                {/* Only when there is nothing real yet — a turn that has started and produced
                    neither a sentence nor a command still has to prove it is alive. */}
                {!brief.say && !brief.cmd && sessionCooking && <StatusLine status={peekCookWord} />}
              </div>
            ) : sessionCooking ? (
              // THE PEEK'S OWN COMPONENT, unchanged — only where the sentence comes from changed.
              <StatusLine status={peekCookWord} />
            ) : (
              roomLines.map((s) => (
                <StatusLine
                  key={s.as || "home"}
                  status={s.text}
                  visitor={s.as && s.as !== projectCode ? s.as : null}
                />
              ))
            )
          ) : (
            // NEW MESSAGES, SHOWN PROPERLY. This is a DISPLAY upgrade, not a chat (his words: "it's
            // for displaying the new messages, it's not for chatting"). What was wrong was never the
            // click — clicking into the chat is the point — it was that the display itself stayed
            // preview-shaped: one clamped line of the newest reply. Now it's the actual messages
            // that came in, in the chat's own colours, scrollable, at a size you can read.
            <>
              {/* CLOSE IT WITHOUT OPENING ANYTHING (his ask). The display sits there until you deal
                  with it one way or the other — read it and dismiss, or click through into the chat.
                  This ✕ is the first of those, so it must not bubble into the open-the-chat click. */}
              <button
                type="button"
                className={`${CLASSNAME}__peek-x`}
                title="Read it — close without opening the chat"
                onClick={(e) => {
                  e.stopPropagation();
                  setUnread(0);
                  try { localStorage.setItem(`sv.chatSeen.${projectCode}`, String(Date.now())); } catch {}
                }}
              >
                ✕
              </button>
            <div
              className={`${CLASSNAME}__peek-thread`}
              // STARTS AT THE TOP. A chat pane rides the bottom because you're following a
              // conversation; this is something you READ, and you read from the beginning — landing
              // at the end meant scrolling up before you could start (his catch).
              ref={(el) => {
                if (el && peekCountRef.current !== messages.length) {
                  peekCountRef.current = messages.length;
                  el.scrollTop = 0;
                }
              }}
            >
              {/* THE NEW REPLIES, NOTHING ELSE. Not the thread and not your own messages — this is
                  what just came in while the chat was shut. Several if several landed, scrolls if
                  one is long. Everything before it is what opening the chat is for. */}
              {(() => {
                // What landed since you last looked — replies AND the commands that moved your
                // screen, in the order they happened. Commands don't count toward the unread badge
                // (moving the screen is its own notification), but leaving them out of the display
                // left holes in the story: "pulled up X" then a reply about X, with the X missing.
                let seenTs = 0;
                try { seenTs = Number(localStorage.getItem(`sv.chatSeen.${projectCode}`)) || 0; } catch {}
                // ATTACHED, the new replies are the SESSION's — the room is not the conversation he
                // is in, so previewing it would show him someone else's chat.
                if (attached) {
                  const shownSaid = freshSaid.length ? freshSaid : saidRows.slice(-1);
                  if (!shownSaid.length) return <div className={`${CLASSNAME}__peek-row`}>new reply</div>;
                  return shownSaid.map((r, i) => (
                    <div key={r.key || i} className={`${CLASSNAME}__peek-row`}>
                      {/* SCOPED, so the blocks inside actually have a project to read from. Every
                          ::file / ::diff / ::image resolves its folder from `scope.projectCode`, and
                          three of the four places that render chat markdown had no provider above
                          them — so the same block that worked in the session panel drew its
                          empty-handed state in the room, which reads as "interactive markdown is
                          broken". It was not broken; it was unaddressed. (autobot found this.) */}
                      <MarkdownScopeProvider value={{ projectCode }}>
                        {renderChatMessage(String(r.text || ""))}
                      </MarkdownScopeProvider>
                    </div>
                  ));
                }
                const mine = messages.filter((m) => m.from === "agent");
                const fresh = mine.filter((m) => (m.ts || 0) > seenTs);
                const shown = fresh.length ? fresh : mine.slice(-1);
                if (!shown.length) return <div className={`${CLASSNAME}__peek-row`}>new reply</div>;
                return shown.map((m, i) =>
                  m.kind === "command" ? (
                    // The same receipt you get in the panel — a command is a thing that happened,
                    // not a message, so it reads as a line rather than a bubble.
                    <div
                      key={m.id || i}
                      className={`${CLASSNAME}__peek-cmd${
                        m.cmd === "show" ? ` ${CLASSNAME}__peek-cmd--show` : ""
                      }`}
                    >
                      <span className={`${CLASSNAME}__cmd-arrow`}>{m.cmd === "show" ? "📺" : "→"}</span>{" "}
                      {m.label || m.cmd}
                    </div>
                  ) : (
                    <div key={m.id || i} className={`${CLASSNAME}__peek-row`}>
                      {/* Same renderer the panel uses — a reply that came through as bold, a table,
                          a code block or a :file chip must read the same here as it does in the
                          chat. Plain text made the display a downgrade of the message it showed. */}
                      {renderChatMessage(String(m.text || ""))}
                    </div>
                  )
                );
              })()}
            </div>
            </>
          )}
        </div>
      )}
      {/* THE DIALOGUE BOX — the bot's speech while it's on an errand. Deliberately its own thing
          rather than the peek: the peek is status and unread replies, this is "I am pointing at
          that and here is what I'm saying about it". It never persists — the errand clears it. */}
      {saying && (
        <div className={`${CLASSNAME}__say ${leftHalf ? `${CLASSNAME}__say--right` : ""}`}>
          {saying.text}
          {/* THE X IS HOW IT ENDS. Nothing else does — not a click on the page, not a keystroke, not
              scrolling. You dismiss it when you are done with it, the same way you would close
              anything else that is deliberately in your way. */}
          <button
            type="button"
            className={`${CLASSNAME}__say-x`}
            title="Done with this"
            onClick={() => endErrandRef.current && endErrandRef.current()}
          >
            ✕
          </button>
        </div>
      )}
      {/* Right-click the bot → the little menu; "turn off" parks it in the header hub. */}
      {ctxMenu && (
        <>
          <div className={`${CLASSNAME}__ctx-overlay`} onClick={() => setCtxMenu(false)} onContextMenu={(e) => { e.preventDefault(); setCtxMenu(false); }} />
          <div className={`${CLASSNAME}__ctx ${topHalf ? `${CLASSNAME}__ctx--below` : ""}`}>
            <button
              type="button"
              className={`${CLASSNAME}__ctx-item`}
              onClick={() => {
                setCtxMenu(false);
                openRef.current = false;
                setOpen(false);
                setParked(projectCode, true);
              }}
            >
              Turn off — park in the hub
            </button>
          </div>
        </>
      )}
      {/* WHICH bot. Several projects are open at once, each with its own icon in the DOM, and a bare
          [data-sv="bot"] lookup finds whichever mounted first — so the line came out of buAPI's icon
          while systemview-test was the one talking. */}
      <div
        data-sv="bot"
        data-sv-pc={projectCode}
        className={`${CLASSNAME}__bot${inNav ? ` ${CLASSNAME}__bot--row` : ""}`}
        onPointerDown={onBotPointerDown}
        onClick={onNavRowClick}
        onContextMenu={(e) => {
          e.preventDefault();
          setCtxMenu(true);
        }}
      >
        {/* THE SECTION'S OWN CHEVRON, docked — `services` and `code` each have one and the agent
            did not, so its row read as a different kind of thing than the sections around it. Same
            open/closed meaning: it shows whether a surface is up. */}
        {inNav && (
          <span
            className={`${CLASSNAME}__navchev`}
            role="button"
            title={navShowing ? "Collapse the agent" : "Expand the agent"}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              navToggle();
            }}
          >
            {navShowing ? "▾" : "▸"}
          </span>
        )}
        <button
          type="button"
          className={`${CLASSNAME}__fab ${CLASSNAME}__fab--${ring}`}
          title={`${projectCode} — ${modeText}${unread ? ` — ${unread} waiting` : ""} — drag to move, release near an edge to dock`}
          // DOCKING BELONGS TO THE FACE, not to the whole bot. It used to sit on the container, so
          // a double-click that landed on the name tag or on one of the icons beside it docked the
          // agent as if you'd hit the icon itself.
          onDoubleClick={dockHere}
          onClick={() => {
            if (suppressClickRef.current) return; // a drag is not a click
            // THE BOT IS THE MASTER SWITCH. Anything open — chat, TV, collector — and one click on
            // the bot puts all of it away. Closing three panels with three clicks isn't closing,
            // it's tidying. The icons beside the name tag are how you toggle one on its own.
            if (open || tvOpen || linksOpen || boardOpen || cbOpen) {
              openRef.current = false;
              setOpen(false);
              setTvOpen(false);
              setLinksOpen(false);
              setBoardOpen(false);
              setCbOpen(false);
              if (endErrandRef.current) endErrandRef.current(true);
              return;
            }
            const next = !open;
            openRef.current = next;
            setOpen(next);
            if (next) {
              setUnread(0);
              try { localStorage.setItem(`sv.chatSeen.${projectCode}`, String(Date.now())); } catch {}
            }
          }}
        >
          <span className={`${CLASSNAME}__face`}>🤖</span>
          {/* SOMEONE ELSE IS IN HERE. A visit was only ever visible once you opened the panel and
              read the roster — so an agent talking to another agent looked, from across the screen,
              exactly like an agent talking to nobody. One pip per visitor in that visitor's own
              colour, on the opposite shoulder from the unread count so the two never collide. */}
          {visitors.length > 0 && (
            <span className={`${CLASSNAME}__vis-pips`} title={`${visitors.join(", ")} in this conversation`}>
              {visitors.slice(0, 3).map((v) => (
                <span key={v} className={`${CLASSNAME}__vis-pip`} style={visStyle(v)} />
              ))}
            </span>
          )}
          {/* The badge counts the SAME thing the peek previews. Counting the room while previewing
              the session would put a number on the bubble that nothing inside it explains. */}
          {peekUnread > 0 && !animating && <span className={`${CLASSNAME}__unread`}>{peekUnread}</span>}
          {/* THE STAR IS VISITING, NOT SPEAKING — his correction, and it is the last knot in this:
              *"the big circle with the star is tied to 'in this conversation'. Stop showing it
              because visitor spoke, visitor spoke."* It was reading the same value as the dots, so
              clearing two spoke chips took the star down with them — a badge that means
              "someone is subscribed to this conversation" cannot be extinguished by forgetting that
              they once talked.
              Two facts, two sources, and now they finally match the two shapes on screen: the small
              dots say who SPOKE, this says who is IN HERE. */}
          {inHere.length > 0 && (
            <span
              className={`${CLASSNAME}__visitors-badge`}
              title={`in this conversation: ${inHere.join(", ")}`}
            >
              ✦{inHere.length > 1 ? inHere.length : ""}
            </span>
          )}
        </button>
        <span className={`${CLASSNAME}__label`}>{projectCode}</span>
        {/* RECORD WITHOUT OPENING (his ask) — a mic beside the name tag on the CLOSED bot. Talk,
            watch the words appear see-through next to it, send from there. The panel never opens. */}
        {/* THE PANELS LIVE HERE NOW — permanently beside the name tag, open or closed. Things close
            themselves (a gesture ends, a show is dismissed), so there has to be one fixed place to
            open them again, and it can't be inside the chat that you may not have open. This is
            also why the chat header no longer carries a links button: same door, two handles. */}
        <button
          type="button"
          className={`${CLASSNAME}__minichat${open ? ` ${CLASSNAME}__minichat--on` : ""}`}
          title={open ? "Close the chat" : "Open the chat"}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            if (inNav) return navPick("chat"); // docked, the icons are tabs
            const next = !open;
            openRef.current = next;
            setOpen(next);
            if (next) {
              setUnread(0);
              try { localStorage.setItem(`sv.chatSeen.${projectCode}`, String(Date.now())); } catch {}
            }
          }}
        >
          💬
        </button>
        <button
          type="button"
          className={`${CLASSNAME}__minitv${tvOpen ? ` ${CLASSNAME}__minitv--on` : ""}`}
          title={tvOpen ? "Close the TV" : "Open the TV"}
          onPointerDown={(e) => e.stopPropagation()} // the bot drags; this button does not
          onClick={(e) => {
            e.stopPropagation();
            if (inNav) return navPick("tv"); // docked, the icons are tabs
            if (tvOpen) {
              setTvOpen(false);
              if (endErrandRef.current) endErrandRef.current(true);
              return;
            }
            // Nothing on it yet — or something newer has landed since you last picked.
            const fresh = showToOpen();
            if (fresh)
              openShow(fresh.id, fresh.label, fresh.args.text, fresh.ts, fresh.args.report ? fresh.args : null);
            else setTvOpen(true);
          }}
        >
          📺
        </button>
        <button
          type="button"
          className={`${CLASSNAME}__minilink${linksOpen ? ` ${CLASSNAME}__minilink--on` : ""}`}
          title="Links & shows sent in this room"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            if (inNav) return navPick("links"); // docked, the icons are tabs
            setLinksOpen((v) => !v);
          }}
        >
          🔗
        </button>
        {/* ALWAYS THERE. It used to disappear the moment the chat opened — on the grounds that the
            input row has its own mic — but this is the row he reaches for, and a control that moves
            depending on what else is open is a control you have to look for. */}
        {micSupported && (
          <button
            type="button"
            className={`${CLASSNAME}__minimic${listening ? ` ${CLASSNAME}__minimic--on` : ""}`}
            title={listening ? "Stop recording" : "Record a message"}
            onPointerDown={(e) => e.stopPropagation()} // the bot drags; this button does not
            onClick={(e) => {
              e.stopPropagation();
              toggleMic();
            }}
          >
            🎙
          </button>
        )}
        {/* THE CODEBASE, from the name tag — his ask, after the recorder. `</>` because that's what
            code looks like, and it's the one button here that opens something outside the bot: one
            click brings the tree up, the next puts it away. */}
        <button
          type="button"
          className={`${CLASSNAME}__minicode`}
          title="The codebase — open it, click again to put it away"
          onPointerDown={(e) => e.stopPropagation()} // the bot drags; this button does not
          onClick={(e) => {
            e.stopPropagation();
            // THE NAVIGATOR MAY NOT BE THERE. Collapsed into its corner, focusing it is a no-op you
            // can't see — so a floating bot shows the codebase itself instead, and only hands the
            // job to the nav when the nav is actually on screen.
            let navShut = false;
            try { navShut = localStorage.getItem("sv.navOpen") === "false"; } catch {}
            if (navShut && !inNav) {
              setCbOpen((v) => !v);
              return;
            }
            // WHICH codebase — this bot's project. Without it the nav had nothing to focus, which
            // is why pressing it looked like nothing happening at all.
            window.dispatchEvent(new CustomEvent("sv:codebase", { detail: { projectCode } }));
          }}
        >
          &lt;/&gt;
        </button>
        {/* THE BOARD — 📋, his ask, next to the rest. One press opens it, one puts it away. */}
        <button
          type="button"
          className={`${CLASSNAME}__miniboard${boardOpen ? ` ${CLASSNAME}__miniboard--on` : ""}`}
          title={boardOpen ? "Close the board" : "Your board — notes, reminders, things to hand me later"}
          onPointerDown={(e) => e.stopPropagation()} // the bot drags; this button does not
          onClick={(e) => {
            e.stopPropagation();
            if (inNav) return navPick("board"); // docked, the icons are tabs
            setBoardOpen((v) => !v);
          }}
        >
          📋
        </button>
        {/* PULL IT BACK OUT. Dragging the row works too, but a gesture you have to already know is
            not a way out — the arrow says there is one. */}
        {inNav && (
          <button
            type="button"
            className={`${CLASSNAME}__pullout`}
            title="Pull the agent out of the codebase"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              // COME OUT WHERE YOU WENT IN (his ask). Undocking used to drop the bot back at whatever
              // corner it was floating in before, which is usually nowhere near the codebase you were
              // just reading — so pulling it out looked like it had vanished. It lands beside its own
              // card instead, and that position is remembered like any other.
              try {
                const r = slotEl && slotEl.getBoundingClientRect();
                if (r) {
                  const p2 = {
                    x: Math.min(Math.max(12, r.right + 14), window.innerWidth - 70),
                    y: Math.min(Math.max(12, r.top - 6), window.innerHeight - 90),
                  };
                  setPos(p2);
                  try { localStorage.setItem(`sv.chatPos.${projectCode}`, JSON.stringify(p2)); } catch {}
                }
              } catch {}
              setNavDocked(projectCode, false);
            }}
          >
            ↗
          </button>
        )}
      </div>
    </div>
  );
  // RFC-038 — the same bot, rendered somewhere else. A portal rather than a second component, so
  // nothing about its state (the chat, the board, the TV, presence, the roster) is rebuilt or lost
  // by going home.
  return inNav ? createPortal(body, slotEl) : body;
}
