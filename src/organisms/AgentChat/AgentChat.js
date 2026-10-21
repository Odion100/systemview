import React, { useState, useEffect, useRef, useContext, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import moment from "moment";
import { useHistory, useLocation, useParams } from "react-router-dom";
import ServiceContext from "../../ServiceContext";
import BLOCKS from "../../atoms/Markdown/registry";
import { createInterimStore, InterimLine, MicText } from "./interimStore";
import { laneVerdict, laneChip, laneReceipt, laneConfirm } from "./laneVerdict";
import { MarkdownWriteProvider, MarkdownScopeProvider } from "../../atoms/Markdown/context";
import ReportLink from "../../atoms/Markdown/blocks/ReportLink";
import useWallPanel from "../WallPanel/useWallPanel";
import { onCodePage, openReportInPanel } from "../../atoms/Markdown/openRef";
import NsLink from "../../atoms/Markdown/blocks/NsLink";
import FileLink from "../../atoms/Markdown/blocks/FileLink";
import BranchBlock from "../../atoms/Markdown/blocks/BranchBlock";
import UiLink from "../../atoms/Markdown/blocks/UiLink";
import Markdown from "../../atoms/Markdown/Markdown";
import { spotlight, clearSpotlight, animationMode, setAnimationMode, MODES } from "../../spotlight";
import { resolveTarget, docRectOf, revealDocLines } from "../../spotlightTargets";
import { slotId, setNavDocked, useNavDock, isNavDocked, railId, spotId, placeInDock, setDockOrder, useDockOrder, dockOrder, orderProjects } from "./navDock";
import { hasHostDictation, startHostRecording } from "../../utils/hostDictation";
import VoiceMode from "../../molecules/SpeakReply/VoiceMode";
import Feed, { timeOf } from "../AgentWorkbench/Feed";
import useAgentSession from "../AgentWorkbench/useAgentSession";
import { CTX_WARN, CTX_DUE, tokensShort, parseUsageLines, foldEvents } from "../AgentWorkbench/feedRows";
import { visStyle } from "../AgentWorkbench/visitorColor";
import { formatReceipt } from "../AgentWorkbench/cmdReceipt";
import { readImagesFrom, readImageFile, hasImages } from "../../utils/imageAttach";
import { canListTranscripts, listAgents, listTranscripts, transcriptTail } from "../../utils/hostAgent";
import CodebaseNav from "../CodebaseNav/CodebaseNav";
import { useAppDark } from "../../atoms/appTheme";
import loadServiceWithHeaders from "../../utils/loadService";
import { hostFiles, hasHostFiles } from "../../utils/hostFiles";
// eslint-disable-next-line import/no-cycle
import Board from "../Board/Board";
import { hasHostJobs, jobRuns, rateJobRun } from "../../utils/hostJobs";
import { bandTabs, bandLabel, readBandTab, writeBand, TAB_KEY } from "./bandTabs";
import { deleteReport as deleteReportFile, reportIndexSets, listReports } from "../../utils/reportOps";
import SEND_ICON from "../../assets/send.png";
import { LINKISH, shortUrl, collectLinks, pathHref } from "./chatLinks";
import { joinSpoken } from "./spokenJoin";
import "./styles.scss";

// RFC-028 — agent presence. SEVERAL bots, not one: every connected project has its own bot,
// visible at ALL times — you never switch namespaces to find a bot (it can switch namespaces for
// you eventually, not the other way around). Each bot: the chat icon wearing a small bot face, a
// truly transparent circle, its project label, its own remembered position. Presence is shown as
// it really is (offline included — unconditional for now, his call). DRAGGING and CLICKING are
// SEPARATE PARTS: the grip (shows on hover) drags and docks; the bubble itself only clicks.
const CLASSNAME = "agent-chat";
// THE HOST'S SLASH COMMANDS — one list, two doors: the `/` panel beside the board, and the popup
// that opens the moment you type `/` in the composer (his ask: *"typing / should bring up the
// list"*). The host does not publish which commands it has, so this is the set it is known to
// answer; a command typed that is not here still sends — the list suggests, it never gates.
// ONLY WHAT ACTUALLY RUNS. /context, /cost, /status, /help, /model are terminal-local: sent through
// a session they arrive at the model as text (measured — he pressed /usage twice and watched
// "running…" forever). /usage is answered by the hub running the CLI; /compact the SDK handles.
// Skills come from the host's supportedCommands() once it exposes them — the list, not this one.
const SLASH_COMMANDS = [
  { cmd: "/usage", what: "plan limits — session and week, with reset times" },
  { cmd: "/compact", what: "summarise and free the context" },
];
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
// The grammar itself lives in `chatLinks` — the collector and this renderer have to mean the same
// thing by "a link", so there is one copy of it and both read from there.

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
// SAME ORIGIN IS NOT EXTERNAL. `/^https?:\/\//` called every absolute URL external — including
// links to THIS app, which is the form every link an agent writes takes (`http://localhost:3000/
// specs/...`, because that is what it copies out of the address bar). So the app's own links
// opened a SECOND tab and reloaded the whole app instead of routing in place: his report,
// *"there's several links that are not working."* They "worked" the way a new browser window is
// a working link.
//
// The test is the ORIGIN, not the scheme: our own origin routes through the router with its path,
// anything else opens away in a new tab. A malformed href falls through to external rather than
// throwing inside a render.
const sameOrigin = (href) => {
  if (!/^https?:\/\//i.test(href)) return true; // a bare path is ours by definition
  try {
    return new URL(href, window.location.origin).origin === window.location.origin;
  } catch {
    return false;
  }
};
// What the router should be handed: our own links carry only path + query + hash, never the origin
// (history.push with a full URL pushes a literal, unmatched route and lands on a blank page).
const routerPath = (href) => {
  try {
    const u = new URL(href, window.location.origin);
    return `${u.pathname}${u.search}${u.hash}`;
  } catch {
    return href;
  }
};
function ChatLink({ href, children }) {
  const history = useHistory();
  const external = !sameOrigin(href);
  const onClick = (e) => {
    e.stopPropagation();
    if (external) return;
    e.preventDefault();
    history.push(routerPath(href));
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
// The link scanner — a FLAT array of strings and chip elements, for the BUBBLE. The collector no
// longer reads this shape (it used to, and keeping React elements was what forced it to group a
// message's links into one row); it scans the same grammar through `chatLinks.linkRefs` and gets
// plain descriptors back, so one link is one row and a row can be deduped.
function renderChatText(text, kp = "l") {
  const out = [];
  let last = 0;
  let k = 0;
  let m;
  LINKISH.lastIndex = 0;
  while ((m = LINKISH.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined) {
      // THE WHOLE ATTRIBUTE BAG, not one key of it. This read `title` and dropped everything else,
      // so `:file[Profiles/…]{project=buAPI}` lost its project on the way in and the chip fell back
      // to the ROOM's project — a reference into a sibling repo silently opened the same path in the
      // repo you were standing in (BUApp's report, and they were right). Same parser the leaf
      // directives use, so `{…}` means one thing in a bubble whichever weight it's written at.
      const attrs = parseAttrs(m[3] || "");
      const Ref = REF_BLOCKS[m[1]] || ReportLink;
      out.push(<Ref key={`${kp}${k++}`} label={m[2]} attrs={attrs} />);
    } else if (m[4] !== undefined) {
      // A MARKDOWN LINK WHOSE TARGET IS A PATH DRAWS THE FILE CHIP — the same component `:file[...]`
      // uses, so a reference means one thing however it was written. The decision is `pathHref`'s and
      // only `pathHref`'s; the collector reads the same rule, or the panel would list a row the
      // bubble never drew.
      const asPath = pathHref(m[5]);
      out.push(
        asPath ? (
          <FileLink key={`${kp}${k++}`} label={asPath} attrs={{}} />
        ) : (
          <ChatLink key={`${kp}${k++}`} href={m[5]}>
            {m[4]}
          </ChatLink>
        ),
      );
    } else {
      out.push(
        <ChatLink key={`${kp}${k++}`} href={m[6]}>
          {shortUrl(m[6])}
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
function SvChatBlock({ name, label, attrs, line, children, kind = "leaf", src = "" }) {
  const [dark] = useAppDark();
  const entry = BLOCKS[name];
  if (!entry || !entry.Component) return null;
  const { Component } = entry;
  // KIND AND SOURCE TRAVEL WITH THE BLOCK, as they do from the document renderer. A `:::run` in the
  // chat arrived without them, so RunBlock took it for a SAVED action named "" — "loading…", then a
  // "saved action" card around steps that were written right there (his catch: "it's not a saved
  // action, why is it in a saved action block?").
  return (
    // `markdown` IS THE SCOPE THE BLOCK STYLES LIVE IN — and it re-declares the theme tokens as
    // LIGHT, because a DOCUMENT is explicitly light or dark rather than following the app. That is
    // right for the TV and wrong here: adding the class without its `--dark` twin is what pinned a
    // white card into a dark chat. A chat is not a document; it follows the app, like the panel
    // around it does.
    <div className={`chat-md__block markdown${dark ? " markdown--dark" : ""}`}>
      <Component name={name} kind={kind} src={src} label={label} attrs={attrs} line={line} node={null}>
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
        <SvChatBlock key={`d${k++}`} name={name} label={dlabel || ""} attrs={attrs} line={i + 1} kind={fence === ":::" ? "container" : "leaf"} src={body || ""}>
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
const ResizeBorder = ({ start, onReset, zones = RESIZE_ZONES }) =>
  zones.map((z) => (
    <div
      key={z.k}
      className={`${CLASSNAME}__rz ${CLASSNAME}__rz--${z.k}`}
      title="Drag to resize · double-click to toggle default ⇄ large"
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
// A LIST ROW NEEDS THE DAY — his catch on the TV's report list: bare times read fine in a chat
// (everything is today) and mean nothing on a list spanning weeks. Today keeps the bare time;
// anything older leads with its date, the board's own style.
const rowWhen = (ts) => {
  if (!ts) return "";
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? msgTime(ts)
    : `${d.toLocaleDateString([], { month: "short", day: "numeric" })}, ${msgTime(ts)}`;
};

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

// RFC-062 — THE RECORDER IS VISIBLE FROM THE DOCKED ROW. Floating, the mic peek hangs beside the
// bubble; docked in the card that box lands outside the panel and is clipped — so a recording
// looked stopped the moment he docked the agent. The row itself wears the state: a red dot and
// the elapsed time, static on purpose (a cue that lives on screen for minutes must not animate).
function RecClock({ since, className }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const sec = Math.max(0, Math.floor((Date.now() - since) / 1000));
  const mm = String(Math.floor(sec / 60)).padStart(2, "0");
  const ss = String(sec % 60).padStart(2, "0");
  return <span className={className} title="The recorder is running">⏺ {mm}:{ss}</span>;
}

function StatusLine({ status, visitor, tok }) {
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
      {/* The live token count, after the dots — same place it rides on the panel's cooking line. */}
      {tok && <span className="agent-chat__cooking-tok">{tok}</span>}
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

// THE NUMBER COUNTS UP. A token figure that jumps 1,200 → 2,749 reads as a glitch; one that runs
// through the numbers reads as work happening (his ask: "animate it growing, number by number —
// the distance between the changes decides how fast it changes"). Each new target starts a run
// from wherever the display is; the run's length grows with the gap, so a small step ticks and a
// big one sprints, and both land exactly on the target.
function useCountUp(target) {
  const [shown, setShown] = useState(target);
  const ref = useRef({ from: target, to: target, t0: 0, dur: 0, raf: 0 });
  useEffect(() => {
    const r = ref.current;
    if (target === r.to) return undefined;
    cancelAnimationFrame(r.raf);
    r.from = shown;
    r.to = target;
    r.t0 = performance.now();
    const gap = Math.abs(target - shown);
    // 200ms for a handful, up to ~1.4s for thousands — never so slow it lags the next update.
    r.dur = Math.min(1400, 200 + Math.sqrt(gap) * 18);
    const step = (now) => {
      const k = Math.min(1, (now - r.t0) / r.dur);
      const eased = 1 - (1 - k) * (1 - k);
      setShown(Math.round(r.from + (r.to - r.from) * eased));
      if (k < 1) r.raf = requestAnimationFrame(step);
    };
    r.raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(r.raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  return shown;
}

// THE AGENT'S OWN WORKLIST — autobot's `mcp__worklist__set`, arriving as `todo.updated` on the
// session stream and folded into `state.todo` (feedRows). His ask, and the reason it is here rather
// than in a document: *"work that follows you and you can see the progress"* — and, sharper, that it
// helped ME as much as him. A list written in prose is one I can quietly stop honouring; a list on
// screen is one he can hold me to.
//
// IT IS THE HARNESS'S STATE, NOT OURS. We render whatever the session says, in the session's own
// order — no sorting, no re-grouping. The model's ordering is its plan.
//
// CLOSED IT IS ONE LINE: what it is doing now, and how far in. Open, the whole plan. A worklist that
// costs the conversation five lines forever is a worklist he will collapse once and never see again.
// A JOB'S RUN IS NOT A SKILL'S LIST (his ask, 2026-10-08: the job *"was supposed to look distinct
// from just a skill run, so I could see that it was work they executed, and it's waiting for me
// with a report"*). It used to render as the same `WorkList` with `job:month-close` in the source
// chip — a label on somebody else's component.
//
// THE CARD READS THE RUN RECORD, NOT THE CHAT. The event stream says what the agent did; the record
// says what happened to the job — its status, the account it filed, the rating. A card built from
// events alone would be the agent's testimony about its own work, and a job exists precisely so its
// result is checkable without that. `window.systemview.jobs` has been exposed since RFC-005 §10 and
// nothing in this app had ever called it.
//
// AND FINISHED WORK WAITS. A completed skill plan says "plan complete" and he clears it. A completed
// JOB has handed something over, so the card's last state is the report sitting there with the
// rating beside it — the rate verb's own comment has always said *"capturable where the report is
// READ."* This is that place.
function JobRun({ items, source, projectCode, runId, onClear, onLanes, laneChildren, laneCount = 0, standingLanes = [] }) {
  const jobId = String(source || "").slice(4);
  const [open, setOpen] = useState(false);
  const [rec, setRec] = useState(null);
  const [rating, setRating] = useState(0);
  const done = (items || []).filter((t) => t.state === "done").length;
  const total = (items || []).length;
  const complete = total > 0 && done === total;

  // Re-read on every change to the list, and once more when it completes — the report is filed in
  // the same breath as the last item, so a single read at mount would always miss it.
  useEffect(() => {
    if (!hasHostJobs()) return;
    let alive = true;
    const pull = async () => {
      const runs = await jobRuns(jobId);
      if (!alive) return;
      const rows = Array.isArray(runs) ? runs : [];
      // THIS ROW'S RUN, NEVER THE NEWEST. `rows[0]` put the latest record on EVERY card of the
      // job — his catch, 2026-10-14: two proactive-work cards, different worklists, yet the same
      // report and the same 16:28 stamp, because both were wearing the newest run's record. The
      // row's key IS the run id on both containers (the strip's disk rows slice it off the owner,
      // the live fold keys on `ev.run`), and the job record shares that id — so the card asks for
      // its own. No fallback to rows[0] when the id misses: the newest record as a stand-in is
      // exactly the lie this fixes, and "cannot read" is already this card's honest word for it.
      const mine = runId ? rows.find((r) => r.id === runId) || null : rows[0] || null;
      setRec(mine);
      setRating(Number((mine || {}).rating || 0));
      // THE LANES THIS RUN CUT, reported upward — the record is the job's (his design: the job
      // refers to the lane, never the reverse), and the STRIP is where the organising happens, so
      // the parent needs the claim to pull those rows under this card.
      if (onLanes) onLanes(runId, ((mine && mine.lanes) || []).map((l) => l.branch));
    };
    pull();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, runId, done, total, complete]);
  // A cleared card releases its claim — its lanes return to the flat strip rather than vanishing
  // with the card that was holding them.
  useEffect(() => () => { if (onLanes) onLanes(runId, null); }, [runId, onLanes]);

  const report = rec && rec.report && rec.report.path ? rec.report : null;
  // THE RECORD'S OWN LANES, AND WHICH ARE ALREADY IN — his walk, 2026-10-16: a card that only
  // nests lanes still standing in the strip shows history as laneless, and "finished" says nothing
  // about whether he already committed the work and moved on. A recorded lane whose strip row is
  // GONE was cleared through the one door that refuses anything not verifiably in the tree — so
  // row-gone IS the honest signal for landed, with no new derivation invented here.
  const recLanes = (rec && Array.isArray(rec.lanes) ? rec.lanes : []).filter((l) => l && l.branch);
  const landedLanes = recLanes.filter((l) => !standingLanes.includes(l.branch));
  const allLanded = complete && recLanes.length > 0 && landedLanes.length === recLanes.length;
  const state = complete ? (allLanded ? "finished · landed" : "finished") : (rec && rec.status) || "running";
  const rate = async (n) => {
    setRating(n);
    await rateJobRun(jobId, (rec && rec.id) || "", n);
  };

  if (!total) return null;
  return (
    <div className={`${CLASSNAME}__jobrun${complete ? ` ${CLASSNAME}__jobrun--done` : ""}`}>
      {/* THE WHOLE BAR IS THE DOOR — his catch, 2026-10-12: *"oh, 'cause I gotta click directly on
          the title."* Exactly: the only targets were the name and the chevron, so a press anywhere
          else on a row that LOOKS like one button did nothing. Same rule the lane row already
          follows ("the whole row is the door"). The × stops propagation so clearing never opens
          the thing it is removing. */}
      {/* THE TOP BLOCK: head row + title line on the left, the × CENTERED against both — his
          correction, 2026-10-17: "it doesn't need to be in either row." */}
      <div className={`${CLASSNAME}__jobrun-top`}>
      <div
        className={`${CLASSNAME}__jobrun-topmain`}
        role="button"
        tabIndex={0}
        title={open ? "collapse this run" : "expand this run — why it fired, its report, its steps"}
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(!open); } }}
      >
      {/* the door is the WHOLE block — head row AND the title line (his catch: "it's only working
          on the first row") */}
      <div className={`${CLASSNAME}__jobrun-head`}>
        <span className={`${CLASSNAME}__jobrun-badge`}>⚙</span>
        <span className={`${CLASSNAME}__jobrun-name`}>{(rec && rec.job) || jobId}</span>
        <span className={`${CLASSNAME}__jobrun-state${allLanded ? ` ${CLASSNAME}__jobrun-state--landed` : ""}`}>{state}</span>
        <span className={`${CLASSNAME}__worklist-count`}>{done}/{total}</span>
        <span className={`${CLASSNAME}__worklist-bar${complete ? ` ${CLASSNAME}__worklist-bar--done` : ""}`}>
          <span className={`${CLASSNAME}__worklist-fill`} style={{ width: `${Math.round((done / total) * 100)}%` }} />
        </span>
        {/* CLOSED, THE BAR STILL CARRIES THE ONE THING THAT NEEDS HIM. Collapsing must not hide a
            handover — a report filed and never read is the failure this card exists against — so
            the waiting mark rides the bar itself and the chip is what expanding reveals. */}
        {!open && report && (
          <span className={`${CLASSNAME}__jobrun-waiting`} title={`a report is waiting: ${report.label || report.path}`}>
            report waiting
          </span>
        )}
        {!open && complete && !report && (
          <span className={`${CLASSNAME}__jobrun-none`} title={rec ? "this run filed no report" : "cannot read the run record from here"}>
            {rec ? "no report" : "cannot read"}
          </span>
        )}
        {!open && (recLanes.length > 0 || laneCount > 0) && (
          <span className={`${CLASSNAME}__jobrun-lanecount`} title={`this run cut ${recLanes.length || laneCount} lane${(recLanes.length || laneCount) === 1 ? "" : "s"} — expand to see them`}>
            {recLanes.length || laneCount} lane{(recLanes.length || laneCount) === 1 ? "" : "s"}
          </span>
        )}
        {/* WHEN IT RAN. A finished run with no time on it is a row you cannot place in the day —
            and these sit in a strip beside other runs. Finished time once it is finished, started
            time while it is still going, because that is the one that is still moving. */}
        {rec && (rec.finishedAt || rec.startedAt) && (
          <span
            className={`${CLASSNAME}__jobrun-when`}
            title={`${rec.finishedAt ? "finished" : "started"} ${moment(rec.finishedAt || rec.startedAt).format("ddd D MMM, h:mm:ss a")}`}
          >
            {moment(rec.finishedAt || rec.startedAt).format("D MMM h:mm a")}
          </span>
        )}
        <span className={`${CLASSNAME}__jobrun-chev`}>{open ? "▾" : "▸"}</span>
      </div>
      {/* WHAT THE RUN DID, as its own quiet line — his correction, 2026-10-17: the work-title in
          the head row "displaced everything", so the head keeps its original shape and the record's
          report label rides UNDER it, subtle, truncating. */}
      {report && report.label ? <div className={`${CLASSNAME}__jobrun-title`} title={report.label}>{report.label}</div> : null}
      </div>
      {complete && onClear && (
        <button
          type="button"
          className={`${CLASSNAME}__worklist-clear ${CLASSNAME}__jobrun-clear`}
          title="Clear this run from your view"
          onClick={(e) => { e.stopPropagation(); onClear(); }}
        >
          ×
        </button>
      )}
      </div>

      {/* A JOB RUN IS A BAR UNTIL YOU OPEN IT — his call, 2026-10-12, on the first one that ever
          ran: *"the job needs to be able to show on the chat as just a bar that can be expanded.
          So what I saw was to me expanded."* He was right and `open` was only ever gating the item
          list, so a "closed" card was still three rows deep: the head, the `why` sentence, and the
          report row with its five stars. Everything below this line is now behind the chevron; the
          bar keeps the progress, the state, and a mark when something is waiting on him. */}
      {open && rec && rec.why && <div className={`${CLASSNAME}__jobrun-why`}>{rec.why}</div>}
      {/* WHY IT WAS WORKED ON — his walk, 2026-10-16: the evaluation verdict exists on the board
          and in the report, but the row never said it. When the record carries one, the card does. */}
      {open && rec && rec.verdict && <div className={`${CLASSNAME}__jobrun-verdict`}>⚖ {rec.verdict}</div>}

      {/* THE HANDOVER, AS A REAL CHIP — the report already lives in the reports panel, so this is a
          pointer to it and not a second copy (RFC-066 §5, settled by deleting the alternative). */}
      {open && report && (
        <div className={`${CLASSNAME}__jobrun-report`}>
          <span className={`${CLASSNAME}__jobrun-waiting`}>waiting for you</span>
          <FileLink label={report.path} attrs={{ project: projectCode }} />
          <span className={`${CLASSNAME}__jobrun-rate`}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                className={`${CLASSNAME}__jobrun-star${n <= rating ? ` ${CLASSNAME}__jobrun-star--on` : ""}`}
                title={`rate this run ${n}/5`}
                onClick={() => rate(n)}
              >
                ★
              </button>
            ))}
          </span>
        </div>
      )}
      {/* FINISHED AND NOTHING FILED IS A FACT, not a blank. A job whose handover never arrived is
          the case the account exists for, so the card says so rather than looking unfinished.
          BUT ONLY IF THE RECORD WAS READABLE: without a `jobs:read` grant the shell hands this
          window no way to look, and "filed no report" would be a claim about a file nobody opened.
          Not being able to see is its own sentence. */}
      {open && complete && !report && (
        <div className={`${CLASSNAME}__jobrun-report`}>
          <span className={`${CLASSNAME}__jobrun-none`}>
            {rec ? "finished, and filed no report" : "finished — cannot read the run record from here"}
          </span>
        </div>
      )}

      {/* THE LANES THIS RUN CUT, UNDER THE CARD THAT CUT THEM — his design, 2026-10-14: *"the
          lanes can be organized under the jobs… the whole point is it's organized properly in the
          strip."* These are the SAME rows the flat strip would draw (same component, same panel,
          same delete), rendered by the parent and handed in — the record names the branches, the
          strip does the join, and nothing is stored twice. */}
      {open && laneChildren}
      {/* THE LANES THAT ALREADY LEFT — the record keeps what the live strip forgets. A standing
          lane renders as its real row above (laneChildren); a recorded lane with no row left was
          brought in and cleared, and history should still say it existed: branch, commit, landed. */}
      {open && landedLanes.length > 0 && (
        <div className={`${CLASSNAME}__jobrun-lanes`}>
          {landedLanes.map((l) => (
            <div key={l.branch} className={`${CLASSNAME}__jobrun-reclane`} title={`${l.branch}${l.commit ? ` @ ${l.commit}` : ""} — its row was cleared through the door that only clears work verifiably in the tree`}>
              <span className={`${CLASSNAME}__jobrun-reclane-branch`}>⌁ {l.branch}</span>
              {l.repo && (
                <span className={`${CLASSNAME}__lane-repo`} title={`cut in ${l.repo}`}>{String(l.repo).split("/").pop()}</span>
              )}
              {l.commit ? <code className={`${CLASSNAME}__jobrun-reclane-commit`}>{String(l.commit).slice(0, 7)}</code> : null}
              <span className={`${CLASSNAME}__jobrun-landed`}>landed</span>
            </div>
          ))}
        </div>
      )}

      {open && (
        <ul className={`${CLASSNAME}__worklist-items`}>
          {items.map((t) => (
            <li key={t.id} className={`${CLASSNAME}__worklist-item ${CLASSNAME}__worklist-item--${t.state}`}>
              <span className={`${CLASSNAME}__worklist-mark`}>{{ done: "✓", active: "▸", pending: "·" }[t.state] || "·"}</span>
              <span className={`${CLASSNAME}__worklist-text`}>{t.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function WorkList({ items, onClear, source = "" }) {
  const [open, setOpen] = useState(false);
  if (!items || !items.length) return null;
  const done = items.filter((t) => t.state === "done").length;
  // FINISHED IS HIS TO CLEAR — his call, and it removes the reliance on agent manners: a completed
  // plan stays on screen for him to look over, and the × retires it from HIS view. The agent's next
  // write brings the clipboard back with the new plan; nothing is deleted anywhere but here.
  const complete = done === items.length;
  const active = items.find((t) => t.state === "active");
  const mark = { done: "✓", active: "▸", pending: "·" };
  return (
    <div className={`${CLASSNAME}__worklist`}>
      <div className={`${CLASSNAME}__worklist-headrow`}>
      <button
        type="button"
        className={`${CLASSNAME}__worklist-head`}
        onClick={() => setOpen(!open)}
        title={open ? "Hide the rest of the plan" : "Show the whole plan"}
      >
        {/* The clipboard LEADS the line — his second pass: no check beside it (the one glyph that
            refused his green: ✓ next to an emoji renders as the EMOJI variant and ignores color),
            just the clipboard, smaller, opening the line it names. */}
        <span className={`${CLASSNAME}__worklist-badge`}>📋</span>
        <span className={`${CLASSNAME}__worklist-count`}>
          {done}/{items.length}
        </span>
        {/* THE SAME BAR THE LANE ROW WEARS (his ask, 2026-10-03). A fraction is read; a bar is SEEN,
            and this header is glanced at far more often than it is opened. Nothing else about the
            row changes — it still opens, still shows the active item, still clears when complete. */}
        <span
          className={`${CLASSNAME}__worklist-bar${complete ? ` ${CLASSNAME}__worklist-bar--done` : ""}`}
          title={`${done} of ${items.length} done`}
        >
          <span
            className={`${CLASSNAME}__worklist-fill`}
            style={{ width: `${items.length ? Math.round((done / items.length) * 100) : 0}%` }}
          />
        </span>
        {/* the run's source — a skill's list is visibly the skill's, not the agent's own plan */}
        {source ? <span className={`${CLASSNAME}__worklist-source`}>{source}</span> : null}
        {/* The ACTIVE item is the line — not "3 tasks", which says nothing about what is happening.
            With nothing active (finished, or not started yet) it says so plainly. */}
        <span className={`${CLASSNAME}__worklist-now`}>
          {active ? active.text : done === items.length ? "plan complete" : "planning"}
        </span>
        <span className={`${CLASSNAME}__worklist-chev`}>{open ? "▾" : "▸"}</span>
      </button>
      {complete && onClear && (
        <button
          type="button"
          className={`${CLASSNAME}__worklist-clear`}
          title="Clear the finished plan"
          onClick={onClear}
        >
          ×
        </button>
      )}
      </div>
      {open && (
        <ul className={`${CLASSNAME}__worklist-items`}>
          {items.map((t) => (
            <li key={t.id} className={`${CLASSNAME}__worklist-item ${CLASSNAME}__worklist-item--${t.state}`}>
              {/* TWO SPANS, TWO STYLES — his correction, twice, and he is right that the honest fix
                  is structural: Chrome draws a row's line-through across inline-block children
                  regardless of what they declare (the spec says atomic inlines escape; the browser
                  disagrees). So the strike lives on the TEXT'S OWN SPAN and the check never shares
                  a decoration with it — there is nothing to escape from. */}
              <span className={`${CLASSNAME}__worklist-mark`}>{mark[t.state] || "·"}</span>
              <span className={`${CLASSNAME}__worklist-text`}>{t.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// THE WHITEBOARD — the worklist's sibling (his design, 2026-09-16): freeform markdown for the
// CONVERSATION'S working state — drafts under discussion, values being worked out — the things
// that otherwise float up the chat and have to be re-said. The list is the state of the work;
// the board is the state of the conversation.
//
// OPEN BY DEFAULT — visibility is the entire point; a whiteboard you have to open is the scroll
// problem wearing a toggle. Basic markdown only (renderChatMessage, the chat's own light pass):
// the moment code walls want in, the content belongs on the TV, not here.
//
// THE WIPE IS REAL AND MUTUAL. His × calls the host, the host clears the stored board and emits
// the empty event — every watcher clears together. Not a view-local hide: a shared surface either
// side may erase, and the other finds out the way anyone does — by looking at it.
// THE BAND'S HEADER — one definition, worn in BOTH states, pinned RIGHT in both (his calls: "it
// evolved to what it is — it's a header"; "keep it on the right side"). It counts the things that
// matter — jobs, lanes, reports — never the whiteboard; the approval flag rides when one waits.
// THE BAND HEAD IS A ROW OF DOORS, NOT A SENTENCE. His ask, 2026-10-19: *"when you click the
// headers, which say one job, three lanes, it opens up into that particular tab."* So each count is
// its own button that selects that tab (and opens the band if it was down), the chevron keeps the
// open/close it always had, and the ☰/▥ pair from the navigator lives here too — same icons, same
// meaning, because a second vocabulary for one idea is how a surface stops being learnable.
//
// "JOBS" COUNTS JOBS — his catch, 2026-10-16: the header said "18 jobs" over 13 job cards, because
// the count took every standing worklist. Skill and session lists get their own word when any
// stand; usually none do, and the header simply stops lying.
function WorkbandHead({ open, jobs, lists = 0, lanes, reports, waiting, onToggle, onPick }) {
  const seg = [
    ["jobs", jobs, bandLabel("jobs", jobs)],
    ["lists", lists, bandLabel("lists", lists)],
    ["lanes", lanes, bandLabel("lanes", lanes)],
    // Reports count was the one segment that was not a door — it read the same and did nothing,
    // which is worse than not being there. Now it opens its own tab like the rest.
    ["reports", reports, bandLabel("reports", reports)],
  ].filter(([, n]) => n > 0);
  return (
    // THE HEAD IS WHAT IT WAS, with doors in it. His correction: *"you weren't supposed to change
    // the style of the headers. You're just supposed to make them clickable."* It reads exactly as
    // before — right-aligned muted counts joined by · with the chevron at the end — and the only
    // structural change is that it is no longer a single <button>, because a button cannot contain
    // the buttons the counts had to become. Which tab is showing is said by the tab bar, not here.
    <div className="agent-chat__workband-head" onClick={onToggle} role="presentation">
      {waiting ? <span className="agent-chat__reports-flag">⚑ {waiting} approval waiting</span> : null}
      <span className="agent-chat__workband-head-text">
        {seg.map(([kind, , label], i) => (
          <React.Fragment key={kind}>
            {i ? <span className="agent-chat__workband-sep"> · </span> : null}
            <button
              type="button"
              className="agent-chat__workband-seg"
              title={open ? "Put the work band down" : `Open the ${kind}`}
              // A COUNT IS A WAY IN, NOT A SWITCH. His correction, 2026-10-19: *"clicking opens it
              // and closes it — once it's open it just closes it. You already got the tabs once
              // it's open."* Exactly: while the band is open the tab row is the switch, so the head
              // has one job left and every press in it means the same thing.
              onClick={(e) => {
                e.stopPropagation();
                if (open) onToggle();
                else if (onPick) onPick(kind);
              }}
            >
              {label}
            </button>
          </React.Fragment>
        ))}
      </span>
      <span className={`agent-chat__swap-chev${open ? "" : " agent-chat__swap-chev--up"}`}>›</span>
    </div>
  );
}

function Whiteboard({ text, writeTs = 0, onWipe }) {
  // CLOSED ON ARRIVAL, OPEN ON LIVE WRITE — his rule, fixed properly the second time: comparing
  // text to its previous value opened on every refresh, because the history batch arrives AFTER
  // mount and reads as a change. The write's own clock settles it: a stamp older than this view
  // is history, a newer one is the agent writing while you watch.
  const [open, setOpen] = useState(false);
  const mountedAt = useRef(Date.now());
  useEffect(() => {
    if (text && writeTs > mountedAt.current) setOpen(true);
  }, [text, writeTs]);
  // Wiping is two-step, the same as every other destructive thing in this app — the armed ×
  // becomes "wipe? yes/no" in place. window.confirm was wrong here and is banned in this codebase
  // (InlineLogs says so in as many words); found AFTER shipping it, his catch.
  const [armed, setArmed] = useState(false);
  if (!text) return null;
  return (
    <div className={`${CLASSNAME}__whiteboard`}>
      <div className={`${CLASSNAME}__whiteboard-headrow`}>
        <button
          type="button"
          className={`${CLASSNAME}__whiteboard-head`}
          onClick={() => setOpen(!open)}
          title={open ? "Fold the whiteboard" : "Show the whiteboard"}
        >
          <span className={`${CLASSNAME}__whiteboard-badge`}>▦</span>
          <span className={`${CLASSNAME}__whiteboard-label`}>whiteboard</span>
          <span className={`${CLASSNAME}__whiteboard-chev`}>{open ? "▾" : "▸"}</span>
        </button>
        {onWipe && !armed && (
          <button
            type="button"
            className={`${CLASSNAME}__whiteboard-wipe`}
            title="Wipe the whiteboard"
            onClick={() => setArmed(true)}
          >
            ×
          </button>
        )}
        {onWipe && armed && (
          <span className={`${CLASSNAME}__whiteboard-confirm`}>
            wipe?
            <button type="button" className={`${CLASSNAME}__whiteboard-confirm-yes`} onClick={() => { onWipe(); setArmed(false); }}>yes</button>
            <button type="button" className={`${CLASSNAME}__whiteboard-confirm-no`} onClick={() => setArmed(false)}>no</button>
          </span>
        )}
      </div>
      {open && <div className={`${CLASSNAME}__whiteboard-body`}>{renderChatMessage(text)}</div>}
    </div>
  );
}

// A LANE ROW — RFC-059: one row per delegated subagent lane, in the same strip as the worklist
// and the whiteboard. A lane is a run whose source is `lane:<branch>`: the row shows a REAL
// fraction from its run list (never a spinner), and a finished lane grows its review — press the
// row and the ::branch block renders right here, live diff and landing included.
// THE LANE PANEL (RFC-059) — the window into a lane: its LOG (the real commands and results it
// ran, folded by the same Feed the workbench uses), its branch review, and its ARTIFACTS — the
// janitor's row: worktree still on disk, branch merged or not, run closed or died. What a lane
// did, what it proved, what it left behind — one panel, closed with ×.
function LanePanel({ source, items, laneEvents, brief = "", projectCode, onClose }) {
  // THE BRIEF AT THE TOP (his ask): the prompt that scoped this lane, shown where the lane is
  // monitored — the owner's context compressed into instructions is exactly what a reader needs
  // to judge the log below it. Folded, because it can be long and the log is the live half.
  const [briefOpen, setBriefOpen] = useState(false);
  const branch = source.slice(5);
  const [arts, setArts] = useState(null);
  // THE LANE'S REPO, WHICH IS NOT ALWAYS THIS CHAT'S. The panel is drawn in the room of the session
  // that spawned the lane; the lane may have worked in a different repository — and then the
  // artifacts read empty and the ::branch block below diffs a branch that is not there, which is
  // what `main...lane/corpus-kind: unknown revision` actually means. The run record cannot say
  // (`source: "lane:<branch>"` is a branch name and nothing else), so the hub is asked which project
  // holds the branch. Until it answers, this chat's project is the assumption — right for the
  // common case, and the same behaviour as before for everything else.
  const [repo, setRepo] = useState(projectCode);
  useEffect(() => {
    let dead = false;
    setRepo(projectCode);
    (async () => {
      try {
        const r = await hostFiles(projectCode).branchOwner({ branch });
        if (!dead && r && r.ok && r.projectCode) setRepo(r.projectCode);
      } catch {
        /* older hub, no such verb — the assumption stands */
      }
    })();
    return () => { dead = true; };
  }, [projectCode, branch]);
  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const p = hostFiles(repo);
        const [wt, bs] = await Promise.all([
          p.worktrees ? p.worktrees().catch(() => null) : null,
          p.branchState ? p.branchState({ branch }).catch(() => null) : null,
        ]);
        if (!dead) setArts({
          worktree: wt && (wt.worktrees || []).find((w) => !w.main && w.branch === branch),
          branch: bs,
        });
      } catch { if (!dead) setArts({}); }
    })();
    return () => { dead = true; };
  }, [repo, branch]);
  const done = items.filter((t) => t.state === "done").length;
  const finished = items.length > 0 && done === items.length;
  const died = !finished && items.some((t) => t.state === "active");
  // The panel already HOLDS the log, so it needs nothing passed to answer the same question.
  const delegated = !!laneEvents;
  return (
    <div className={`${CLASSNAME}__lanepanel`}>
      <div className={`${CLASSNAME}__lanepanel-head`}>
        {/* 🤖 A SUBAGENT IS IN HERE · 🌿 THIS AGENT'S OWN WORK.
            Read from whether the lane has a routed event log — a subagent's messages carry
            `parent_tool_use_id` and get stamped with the lane they belong to.
            RESTORED 2026-10-12 after I removed it on my own initiative, which was wrong. He asked
            what the leaf MEANT; nobody said anything was broken. What we built was that a lane no
            longer HAS to be a subagent's — subagents in lanes are untouched and are most of them,
            so the robot is the useful half and deleting it threw away the thing he reads the strip
            for: *"my delegate lanes, robots in there doing work, I can see what they're doing."*
            KNOWN AND NOT HIDDEN: the log is session memory, so after a shell restart — or once a
            finished subagent's events age past the log cap — a delegated lane reads 🌿. Making it
            survive needs delegation stamped on the RUN RECORD at registration, which is a
            host-side change and is not done. Until then the title says which question this
            answered, so a leaf is never read as a claim about history. */}
        <span
          className={`${CLASSNAME}__lane-icon`}
          title={delegated
            ? "a subagent is working in this branch — its log is in the panel"
            : "no live log for this lane: either this agent's own work, or a subagent whose session has ended"}
        >
          {delegated ? "\u{1F916}" : "\u{1F33F}"}
        </span>
        <span className={`${CLASSNAME}__lanepanel-name`}>{branch}</span>
        <span className={`${CLASSNAME}__lanepanel-run`}>
          {finished ? `run closed · ${done}/${items.length}` : died ? `died at: ${(items.find((t) => t.state === "active") || {}).text}` : `${done}/${items.length}`}
        </span>
        <button type="button" className={`${CLASSNAME}__lanepanel-x`} onClick={onClose}>×</button>
      </div>
      {brief && (
        <div className={`${CLASSNAME}__lanepanel-brief`}>
          <button type="button" className={`${CLASSNAME}__lanepanel-brieftoggle`} onClick={() => setBriefOpen((v) => !v)}>
            {briefOpen ? "▾" : "▸"} the brief — what this lane was told
          </button>
          {briefOpen && <pre className={`${CLASSNAME}__lanepanel-brieftext`}>{brief}</pre>}
        </div>
      )}
      {arts && (
        <div className={`${CLASSNAME}__lanepanel-arts`}>
          <span className={arts.worktree ? `${CLASSNAME}__lanepanel-art--left` : `${CLASSNAME}__lanepanel-art`}>
            {arts.worktree ? `worktree left behind: ${arts.worktree.path}` : "no worktree left behind"}
          </span>
          {arts.branch && arts.branch.exists && (
            <span className={arts.branch.merged || (arts.branch.applied && arts.branch.applied.inTree) ? `${CLASSNAME}__lanepanel-art` : `${CLASSNAME}__lanepanel-art--left`}>
              {arts.branch.merged
                ? `branch merged into ${arts.branch.base} — deletable`
                : arts.branch.applied && arts.branch.applied.verdict === "unknown"
                ? `can't tell — the files this lane touched have moved on since it was cut (${arts.branch.applied.matching}/${arts.branch.applied.total} match)`
                : arts.branch.applied && arts.branch.applied.inTree
                ? arts.branch.applied.committed
                  ? `work brought in and committed — branch deletable`
                  : `work in the tree, not yet committed — a commit is owed`
                : arts.branch.applied && arts.branch.applied.matching > 0
                ? `branch unmerged — ${arts.branch.applied.matching}/${arts.branch.applied.total} of its files match the tree`
                : `branch unmerged vs ${arts.branch.base}`}
            </span>
          )}
          {arts.branch && arts.branch.exists === false && <span className={`${CLASSNAME}__lanepanel-art`}>no branch by this name</span>}
        </div>
      )}
      <div className={`${CLASSNAME}__lanepanel-review`}>
        <BranchBlock key={repo} label={branch} attrs={{ project: repo }} />
      </div>
      <div className={`${CLASSNAME}__lanepanel-log`}>
        <div className={`${CLASSNAME}__lanepanel-logtitle`}>the lane's log — what it actually did</div>
        {laneEvents && laneEvents.length ? (
          <Feed rows={foldEvents(laneEvents)} />
        ) : (
          <div className={`${CLASSNAME}__lanepanel-empty`}>no log held — the lane ran before this view attached, or its events aged out</div>
        )}
      </div>
    </div>
  );
}

function LaneRow({ source, items, projectCode, repo, delegated, panelOpen, onOpenPanel, onDelete }) {
  const branch = source.slice(5); // "lane:" — the suffix IS the branch, by convention
  const done = items.filter((t) => t.state === "done").length;
  const finished = items.length > 0 && done === items.length;
  const active = items.find((t) => t.state === "active");
  // THE DELETE IS HIS, TWO-STEP (his design): pressing 🗑 first READS what the delete would
  // destroy — branch merged or not, worktree still on disk — and the confirm says it to his
  // face. An unmerged branch is real work; "delete anyway?" is the honesty, same as the switch
  // refusing over dirty files. Yes removes worktree, branch and run record; the row dying is
  // the verification.
  const [confirm, setConfirm] = useState(null); // null | "reading" | {merged, exists, worktree}
  const [delErr, setDelErr] = useState("");
  const [busy, setBusy] = useState(false);
  // THE ROW'S REPO IS NOT THIS CHAT'S REPO, NECESSARILY. A lane row is drawn in the chat of the
  // session that spawned it; the lane itself may have worked in another repo — mine ran in autobot
  // while their rows sat here, and every git verb went to systemview, where `main...lane/corpus-kind`
  // is an unknown revision because the branch is simply not in that repository. The run record
  // cannot help: `source: "lane:<branch>"` is a branch name and nothing else. So ask the hub which
  // project actually has this branch, and act there. Asked of disk, not of the lane — it fixes rows
  // that are already on disk and does not depend on a subagent having remembered to say.
  const repoOf = async () => {
    try {
      const r = await hostFiles(projectCode).branchOwner({ branch });
      if (r && r.ok && r.projectCode) return hostFiles(r.projectCode);
    } catch {
      /* an older hub has no such verb — fall back to this chat's project, which is right for
         same-repo lanes and no worse than before for the rest */
    }
    return hostFiles(projectCode);
  };
  // THE ROW CARRIES WHAT SOMEBODY SAID, AND NOTHING IT WORKED OUT ITSELF.
  //
  // RETRACTED 2026-10-12, by him, after a lane cut thirty seconds earlier and holding zero commits
  // drew `files say: in · committed`: *"It still says committed… Committed to me means that it was
  // brought in and committed. I never had a problem with agents leaving a note. I never really
  // needed an automatic system… I don't need that extra committed. I don't need no note from the
  // system. I need a note from the agents."*
  //
  // He is right, and the derivation had already been wrong in both directions — `in · committed`
  // for a branch with nothing on it, `can't tell 4/11` for work that was provably landed. A word
  // like "committed" costs nothing to print and means something exact to him, so a surface that
  // prints it on a guess is worse than one that says nothing. Two things remain and both have an
  // author: the STATEMENT an agent set, and the RECEIPT of an act it recorded.
  //
  // DERIVATION IS NOT GONE, IT MOVED TO WHERE IT PROTECTS SOMETHING: the delete confirm still
  // reads git at the moment of the press (laneConfirm), because "real work dies with it" is the
  // one place a guess is better than silence. The panel's leftovers row keeps it too, labelled.
  const [chip, setChip] = useState(null);
  const [receipt, setReceipt] = useState(null);
  useEffect(() => {
    let dead = false;
    let timer = null;
    // KEEPS LISTENING UNTIL IT SETTLES. A bring-in happens while the row is already on screen —
    // in the chat, by the agent — and a row that only reads on mount would need a refresh to
    // admit it, which this window never asks for. It keeps reading while the answer is still
    // "uncommitted", because that state ends with a commit the row should also notice.
    const read = async () => {
      try {
        const p = await repoOf();
        const bs = await p.branchState({ branch });
        if (dead) return;
        // THE DECISION IS NOT MADE HERE. laneVerdict() is the one place a receipt may meet a
        // verdict, and the only place that ordering is tested — a receipt answers `unknown` and
        // never outranks `out`, because `out` is proof and a receipt is a record.
        const v = laneVerdict(bs);
        // NEITHER OF THESE IS ABOUT THE LANE BEING FINISHED. This read used to sit behind
        // `if (!finished) return`, which is why a receipt on a lane at 0/4 was invisible
        // (2026-10-10: *"the only thing I'm waiting to see is a receipt on that empty lane"*).
        // Somebody said something, or recorded an act; the bar has nothing to do with either.
        setChip(v.state === "said" ? laneChip(v) : null);
        setReceipt(laneReceipt(v));
        // A STATEMENT AND A RECEIPT ARRIVE WHILE THE ROW IS ON SCREEN — an agent sets them mid-turn
        // and this window never asks for a refresh — so keep reading until one of them exists.
        // Nothing to wait for once something has an author.
        if (!v.receipt && v.state !== "said") timer = setTimeout(read, 20000);
      } catch { if (!dead) timer = setTimeout(read, 30000); /* the delete confirm still reads fresh */ }
    };
    read();
    return () => { dead = true; if (timer) clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished, branch, panelOpen]);
  const armDelete = async (e) => {
    e.stopPropagation();
    if (confirm) { setConfirm(null); return; }
    setConfirm("reading");
    setDelErr("");
    try {
      const p = await repoOf();
      const [wt, bs] = await Promise.all([
        p.worktrees().catch(() => null),
        p.branchState({ branch }).catch(() => null),
      ]);
      setConfirm({
        merged: !!(bs && bs.merged),
        exists: !!(bs && bs.exists),
        applied: (bs && bs.applied) || null,
        worktree: wt && (wt.worktrees || []).find((w) => !w.main && w.branch === branch),
      });
    } catch {
      setConfirm({ merged: false, exists: false, worktree: null });
    }
  };
  const doDelete = async (e) => {
    e.stopPropagation();
    if (!confirm || confirm === "reading") return;
    setBusy(true);
    try {
      const p = await repoOf();
      if (confirm.worktree) {
        const r = await p.removeWorktree({ path: confirm.worktree.path, force: true });
        if (r && r.ok === false) throw new Error(r.error || "could not remove the worktree");
      }
      if (confirm.exists) {
        // -d when merged; the forced -D only rides a confirm that said "not merged" out loud
        const r = await p.deleteBranch({ name: branch, force: !confirm.merged });
        if (r && r.ok === false) throw new Error(r.error || "could not delete the branch");
      }
      await onDelete();
      return; // the row is gone — nothing left to un-busy
    } catch (err) {
      setDelErr((err && err.message) || "delete failed");
    }
    setBusy(false);
  };
  return (
    <div className={`${CLASSNAME}__lane${finished ? ` ${CLASSNAME}__lane--done` : ""}`}>
      {/* THE WHOLE ROW IS THE DOOR. The name alone was the button and nothing said so — a lane
          mid-flight looked like a read-only bar until it finished. His call: rows "should just be
          clickable to open this panel in general." The ⎇ review chip that used to expand a branch
          block inline is gone — his call too: the panel already holds the review, the bar already
          says done, and one row does not need two doors. */}
      <div
        className={`${CLASSNAME}__lane-row${panelOpen ? ` ${CLASSNAME}__lane-row--open` : ""}`}
        role="button"
        tabIndex={0}
        title="open the lane's panel — its log, review, and leftovers"
        onClick={onOpenPanel}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenPanel(); } }}
      >
        {/* 🤖 A SUBAGENT IS IN HERE · 🌿 THIS AGENT'S OWN WORK.
            Read from whether the lane has a routed event log — a subagent's messages carry
            `parent_tool_use_id` and get stamped with the lane they belong to.
            RESTORED 2026-10-12 after I removed it on my own initiative, which was wrong. He asked
            what the leaf MEANT; nobody said anything was broken. What we built was that a lane no
            longer HAS to be a subagent's — subagents in lanes are untouched and are most of them,
            so the robot is the useful half and deleting it threw away the thing he reads the strip
            for: *"my delegate lanes, robots in there doing work, I can see what they're doing."*
            KNOWN AND NOT HIDDEN: the log is session memory, so after a shell restart — or once a
            finished subagent's events age past the log cap — a delegated lane reads 🌿. Making it
            survive needs delegation stamped on the RUN RECORD at registration, which is a
            host-side change and is not done. Until then the title says which question this
            answered, so a leaf is never read as a claim about history. */}
        <span
          className={`${CLASSNAME}__lane-icon`}
          title={delegated
            ? "a subagent is working in this branch — its log is in the panel"
            : "no live log for this lane: either this agent's own work, or a subagent whose session has ended"}
        >
          {delegated ? "\u{1F916}" : "\u{1F33F}"}
        </span>
        <span className={`${CLASSNAME}__lane-name`}>{branch}</span>
        {/* WHICH REPO holds the branch — his catch: autobot and systemview lanes read identically,
            so the strip could not answer "is this repo clean". Shown only when it is NOT this
            chat's own project; stamped on the run record at registration, so it survives restarts. */}
        {repo && repo !== projectCode && (
          <span className={`${CLASSNAME}__lane-repo`} title={`this lane's branch lives in ${repo}`}>{repo}</span>
        )}
        <span className={`${CLASSNAME}__lane-bar`}>
          <span className={`${CLASSNAME}__lane-fill`} style={{ width: `${items.length ? Math.round((done / items.length) * 100) : 0}%` }} />
        </span>
        <span className={`${CLASSNAME}__lane-count`}>{done}/{items.length}</span>
        {chip && (
          <span className={`${CLASSNAME}__lane-in ${CLASSNAME}__lane-in--${chip.tone}`} title={chip.title}>
            {chip.text}
          </span>
        )}
        {/* BESIDE the statement, never under it — a receipt is the unretractable half. See
            laneReceipt(): it returns null when the chip already IS the receipt. */}
        {receipt && (
          <span className={`${CLASSNAME}__lane-in ${CLASSNAME}__lane-in--${receipt.tone}`} title={receipt.title}>
            {receipt.text}
          </span>
        )}
        {!finished && <span className={`${CLASSNAME}__lane-doing`}>{active ? active.text : "starting"}</span>}
        <button type="button" className={`${CLASSNAME}__lane-del`} title="clean up this lane — worktree, branch, record" onClick={armDelete}>🗑</button>
        <span className={`${CLASSNAME}__lane-chev`}>{panelOpen ? "▾" : "▸"}</span>
      </div>
      {confirm && (
        <div className={`${CLASSNAME}__lane-confirm`} onClick={(e) => e.stopPropagation()}>
          {confirm === "reading" ? (
            <span>reading what this would destroy…</span>
          ) : (
            <>
              {/* THE TEXT COMES FROM laneConfirm(), not from this markup. The confirm and the
                  row's chip answering differently about the same lane is how a surface contradicts
                  itself; one decision, one place, one test. */}
              {(() => {
                const c = laneConfirm({ exists: confirm.exists, merged: confirm.merged, applied: confirm.applied || {} }, { worktree: !!confirm.worktree });
                return <span className={c.warn ? `${CLASSNAME}__lane-confirm-warn` : ""}>{c.text}</span>;
              })()}
              <button type="button" disabled={busy} onClick={doDelete}>yes, delete</button>
              <button type="button" disabled={busy} onClick={(e) => { e.stopPropagation(); setConfirm(null); }}>no</button>
            </>
          )}
          {delErr && <span className={`${CLASSNAME}__lane-confirm-warn`}>{delErr}</span>}
        </div>
      )}
    </div>
  );
}

function CookLine({ doing, state, liveChars = 0 }) {
  const text = useCookWord(doing, state);
  const counted = useCountUp(Math.round(liveChars / 4));
  // TOKENS, WITH THE TURN THEY BELONG TO. The count of what is being generated rides the cooking
  // line, not the usage bar — his call: a per-turn number "should show with the cooking message."
  // Characters over four, marked ≈, only while the answer is actually streaming.
  const tok = state === "working" && liveChars > 40 ? `${counted.toLocaleString()} tok` : "";
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
      {/* The count climbs AFTER the dots — his: "it should be on the other side of that dancing
          ellipsis, and it would be going up and up as you worked." */}
      {tok && <span className={`${CLASSNAME}__cooking-tok`}>{tok}</span>}
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

// AGENTS COME FROM THE BROWSER — his correction. `connectedServices` is the legacy webpage model
// (you "joined" by connecting to a SystemLynx service through the plugin). In the harness, agents
// are DEFINED at the browser level; `window.systemview.agent.defs()` is the source of truth. Keying
// bot presence off this means the bots exist on every page by construction and survive a refresh —
// there is no connection step to miss, which is exactly why they vanished on the Context page.
function useHarnessAgentProjects() {
  const [pcs, setPcs] = useState([]);
  useEffect(() => {
    let dead = false;
    const load = async () => {
      const a = typeof window !== "undefined" && window.systemview && window.systemview.agent;
      if (!a || typeof a.defs !== "function") return;
      try {
        const defs = await a.defs();
        if (!dead) setPcs([...new Set((defs || []).map((d) => d.projectCode).filter(Boolean))]);
      } catch {}
    };
    load();
    const on = () => load();
    window.addEventListener("sv:botHub", on);
    return () => {
      dead = true;
      window.removeEventListener("sv:botHub", on);
    };
  }, []);
  return pcs;
}

export default function AgentChats() {
  const { connectedServices } = useContext(ServiceContext);
  const [, force] = useState(0);
  useEffect(() => {
    const on = () => force((n) => n + 1);
    window.addEventListener("sv:botHub", on);
    return () => window.removeEventListener("sv:botHub", on);
  }, []);
  const harnessPcs = useHarnessAgentProjects();
  const projects = useMemo(
    () => [...new Set([...(connectedServices || []).map((s) => s.projectCode), ...harnessPcs])],
    [connectedServices, harnessPcs],
  );
  return projects
    .filter((pc) => !isParked(pc))
    .map((pc, i) => <BotBubble key={pc} projectCode={pc} index={i} />);
}

// RFC-052 — THE DOCK'S SPOTS, one per agent, in his order. Rendered by the page inside the rail;
// each docked bot portals into its own spot, an undocked one leaves its spot visibly empty.
export function DockSpots() {
  const { connectedServices } = useContext(ServiceContext);
  const order = useDockOrder();
  const harnessPcs = useHarnessAgentProjects();
  const projects = useMemo(
    () => [...new Set([...(connectedServices || []).map((s) => s.projectCode), ...harnessPcs])].filter((pc) => !isParked(pc)),
    [connectedServices, harnessPcs],
  );
  const ordered = orderProjects(order, projects);
  return ordered.map((pc) => <div key={pc} id={spotId(pc)} data-spot={pc} className="nav-panel__spot" title={pc} />);
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
  // HARNESS AGENTS COUNT TOO — connectedServices alone is the webpage-era model, and with nothing
  // joined the hub returned null: the 🤖 vanished from the header on any page without a service
  // join. Same merge the dock and the chats already do.
  const harnessPcs = useHarnessAgentProjects();
  const projects = [...new Set([...(connectedServices || []).map((s) => s.projectCode), ...harnessPcs])];
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
  // OPEN SURVIVES THE SWAP. The self-updating tab reloads itself when a build lands, and the
  // panel's open state lived only in memory — so every build closed his chat mid-conversation and
  // he had to find the 💬 again (three times in one evening, once per build). A swap is meant to
  // be invisible; a panel that shuts is the opposite. Remembered per project, like `attached`.
  //
  // DOCKED, THE NAVIGATOR'S OWN STATE IS THE DEFAULT (his rule, 2026-10-03) — because docked is two
  // different places, not one.
  //
  // Collapsed, the bots are in the RAIL: the minimised view, a line of glances. A chat open there is
  // the stack he had to shut one by one, and it arrived by itself — one sticky flag per project meant
  // a reload, a new tab, or collapsing the navigator restored every docked chat OPEN at once.
  //
  // With the navigator OPEN each bot sits in its own project card's section, which is somewhere he is
  // actually working. There the chat belongs open, and that is the default.
  //
  // Either way a docked open is NOT remembered: the sticky flag keeps meaning "the panel he was
  // typing in", which is the thing worth restoring across a rebuild. Undocked is untouched.
  const navIsOpen = () => {
    try { return localStorage.getItem("sv.navOpen") !== "false"; } catch { return true; }
  };
  const [open, setOpen] = useState(() => {
    if (isNavDocked(projectCode)) return navIsOpen();
    try { return localStorage.getItem(`sv.chat.open.${projectCode}`) === "1"; } catch { return false; }
  });
  useEffect(() => {
    if (isNavDocked(projectCode)) return;
    try { localStorage.setItem(`sv.chat.open.${projectCode}`, open ? "1" : "0"); } catch {}
  }, [open, projectCode]);
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
  // THE UNIT YOU CLICK COMES TO THE FRONT, DOCKED OR NOT (his rule). A docked bot lives inside the
  // rail, and the rail is its own stacking context — so its own z only orders it among the other
  // docked bots, and a floating bot's panel always covered it. Clicking a docked bot lifts the RAIL
  // to the top of the same counter; clicking a floating bot takes the next number and comes back
  // over the rail. One order, every agent in it.
  const bringToFront = () => {
    const nz = ++topZ;
    setZ(nz);
    if (inRailRef.current) window.dispatchEvent(new CustomEvent("sv:railFront", { detail: { z: nz } }));
  };
  // Double-click the bot → take the lowest free slot and go there. Only THIS bot moves.
  // RFC-038 — DOCKING MEANS GOING HOME NOW, not parking at the edge of the window. Double-clicking
  // the face sends the agent back into its own codebase card; the arrow on the docked row (or
  // dragging it out) brings it back to floating. The header lane keeps configuration and loses
  // docking, which is his call: two docks was one too many.
  const dockHere = () => {
    if (!dockOrder().includes(projectCode)) placeInDock(projectCode, null); // a spot at the end
    setNavDocked(projectCode, true);
  };
  // COME OUT WHERE YOU WENT IN (his ask). Undocking used to drop the bot back at whatever corner
  // it was floating in before, which is usually nowhere near the codebase you were just reading —
  // so pulling it out looked like it had vanished. It lands beside its own slot (card or rail)
  // instead, and that position is remembered like any other.
  const pullOut = () => {
    try {
      const el = document.getElementById(slotId(projectCode)) || document.getElementById(railId);
      const r = el && el.getBoundingClientRect();
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
  };
  const navDocked = useNavDock(projectCode);
  // AND IT FOLLOWS THE NAVIGATOR LIVE, not only on a mount. Docking is a portal move — the bot keeps
  // every bit of its state deliberately — so collapsing the navigator with chats open would leave
  // that same stack in the rail by another route, and expanding it again would leave them all shut.
  // The nav announces both (`sv:navOpen`, `sv:navView`), so this reads the signal rather than polling.
  const [navOpenNow, setNavOpenNow] = useState(navIsOpen);
  useEffect(() => {
    const read = () => setNavOpenNow(navIsOpen());
    window.addEventListener("sv:navOpen", read);
    window.addEventListener("sv:navView", read);
    return () => {
      window.removeEventListener("sv:navOpen", read);
      window.removeEventListener("sv:navView", read);
    };
  }, []);
  useEffect(() => {
    if (navDocked) setOpen(navOpenNow);
  }, [navDocked, navOpenNow]);
  // The slot is a DOM node owned by the nav, which mounts and unmounts on its own (the panel opens,
  // a filter hides the card, the page changes). So it is looked for on a slow tick rather than once
  // — and dropped the moment it leaves the document, which is what puts the bot back on the screen
  // instead of leaving it rendered into a detached node.
  // RFC-062 — NO MIRRORED STATE. A docked bot already finds its home by LOOKING — the card's
  // slot, or the rail spot when the nav is collapsed. Tabs view adds exactly one fact, read in
  // the same look: is the nav open in tabs view right now? If so, a docked bot with no slot on
  // screen is IN ITS TAB and renders nothing. An event-fed copy of "which tab is active" was the
  // first version of this, and it went stale the moment anything changed without an event —
  // collapsing the nav emptied the rail because every bot was acting on the copy.
  const [navTabsOpen, setNavTabsOpen] = useState(false);
  const [slotEl, setSlotEl] = useState(null);
  // EVERYTHING THAT POPS, POPS AS A DOCUMENT (his ruling, 2026-10-14: *"anything that might pop
  // up… I don't even want the chat here"*). Docked, the column renders the agent's ROW and nothing
  // else — the chat panel, the collector and the commands/usage panel PORTAL into a centre tab
  // slot that Documentation renders for them, exactly the way the whole bot portals into the nav.
  // One component, two containers again: no extraction, no second implementation, the full panel
  // with its mic and its state, standing in the centre as a tab.
  const dockTabKind = (() => {
    if (!navDocked) return null;
    const t = new URLSearchParams(location.search).get("tab");
    // THE CHAT IS NOT ON THIS LIST. His correction, 2026-10-14, loud: the conversation lives with
    // him in the column — it is the surfaces that pop up BESIDE it that become documents.
    return t === "links" || t === "cmds" ? t : null;
  })();
  const [dockTabSlot, setDockTabSlot] = useState(null);
  useEffect(() => {
    if (!dockTabKind) return setDockTabSlot(null) || undefined;
    let dead = false;
    let raf = 0;
    const look = () => {
      if (dead) return;
      const el = document.getElementById(`sv-dock-slot-${projectCode}-${dockTabKind}`);
      if (el) setDockTabSlot(el);
      else raf = requestAnimationFrame(look); // the tab mounts in the same commit — catch it next frame
    };
    look();
    return () => {
      dead = true;
      if (raf) cancelAnimationFrame(raf);
      setDockTabSlot(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dockTabKind, projectCode]);
  const inDockTab = (kind) => dockTabKind === kind && !!dockTabSlot;
  useEffect(() => {
    if (!navDocked) return setSlotEl(null) || undefined;
    const look = () => {
      // The card's slot first; the RAIL when the navigator is collapsed (RFC-052) — docked never
      // means gone.
      // A card slot inside a HIDDEN navigator does not count — the collapsed nav keeps its body
      // mounted at display:none, and a bot portaled into that is the "docked agents vanish" bug.
      const card = document.getElementById(slotId(projectCode));
      const el = (card && card.offsetParent !== null ? card : null) || document.getElementById(spotId(projectCode));
      setSlotEl((cur) => (cur === el ? cur : el || null));
      try {
        setNavTabsOpen(localStorage.getItem("sv.navOpen") !== "false" && (localStorage.getItem("sv.navView") || "tabs") === "tabs");
      } catch {}
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
  const [recSince, setRecSince] = useState(0);
  useEffect(() => {
    setRecSince(listening ? Date.now() : 0);
  }, [listening]);
  // The minimised READING surface keeps itself at the bottom, but only when something new lands —
  // yanking it down on every poll would fight you every time you scrolled up to re-read.
  const peekCountRef = useRef(0);
  // The live wire: INTERIM transcripts stream into a visible line while you talk (his catch —
  // "no indication, the words just pop up"); finals commit into the input.
  // THE LIVE TRANSCRIPT IS NOT PANEL STATE. See interimStore.js: this used to be `useState`, so
  // every few syllables re-rendered the entire chat panel while he was mid-sentence — the strain he
  // could feel in the recorder. The store's subscribers are the two leaves that draw the words.
  const interimStore = useRef(createInterimStore()).current;
  const setInterim = interimStore.set;
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
  // …AND IT SURVIVES A REFRESH. This lived in React state only, so dismissing a chip cleared it
  // until the page reloaded and the strip rebuilt itself from the chat — which is derived from the
  // transcript, and the transcript does not forget. So the ✕ looked broken: press it, come back,
  // they are all there again. His rule: seeing it IS dismissing it — clicking through to the
  // message counts, and so does the ✕. Stamped per project, and a NEWER turn from the same agent
  // still brings them back, because that is a new thing to have seen.
  const spokeSeenKey = `sv.chat.spokeSeen.${projectCode}`;
  const [spokeCleared, setSpokeCleared] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(spokeSeenKey) || "{}") || {};
    } catch {
      return {};
    }
  });
  const clearSpoke = (who) =>
    setSpokeCleared((cur) => {
      const next = { ...cur, [who]: Date.now() };
      try {
        localStorage.setItem(spokeSeenKey, JSON.stringify(next));
      } catch {}
      return next;
    });
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
  // Send took the visible words and hung up — anything the recorder delivers AFTER that is a
  // duplicate, not a message. Cleared every time a recording STARTS; never set by the stop button,
  // whose tail commit is legitimate.
  const suppressCommitsRef = useRef(false);
  const commitSpoken = (text) => {
    if (suppressCommitsRef.current) return;
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
    if (!listening) suppressCommitsRef.current = false; // a fresh recording commits normally
    if (listening) {
      if (viaHostMic) return finishHostMic();
      try { if (recRef.current) recRef.current.stop(); } catch {}
      return;
    }
    if (viaHostMic) {
      try {
        suppressCommitsRef.current = false;
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
      suppressCommitsRef.current = false;
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

  // A CEILING ON RECORDING, his ask alongside the border and for the same reason: he forgets it is
  // running. The border tells him whenever he looks; this one acts when he doesn't.
  //
  // IT STOPS THE WAY THE BUTTON STOPS — nothing is discarded. Every finalised phrase is already in
  // the input box, so a cap that fires leaves him with his words and a stopped mic, never a lost
  // sentence. (Throwing the transcript away on a timeout would make the cap worse than the problem.)
  const MAX_RECORDING_MS = 2.5 * 60 * 1000; // HIS NUMBER, revised: two and a half minutes
  useEffect(() => {
    if (!listening) return undefined;
    const t = setTimeout(() => {
      if (viaHostMic) finishHostMic();
      else {
        try {
          if (recRef.current) recRef.current.stop();
        } catch {}
      }
    }, MAX_RECORDING_MS);
    // The timer is keyed to the RECORDING, not to a render: it starts when the mic opens and is
    // cleared the moment it closes, however it closes.
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listening, viaHostMic]);

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
  // WHAT THE PANEL IS POINTED AT. A `:ns[…]` chip clicked off the Code page has nowhere else to
  // land — there is no navigator on Stats or Agents, and a namespace is not a document, so no doc
  // panel can hold one. This panel already renders the same `CodebaseNav` the navigator does; it
  // was simply never told about reveals, so the tree it draws could not be pointed at anything.
  const [cbReveal, setCbReveal] = useState(null);
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
  // RFC-062 — PULLED OUT BY ITS TAB (his ask: undock from the strip without entering the tab).
  // The strip only knows project codes; the bot owns its position, so the strip dispatches and
  // the bot places itself under the pointer and undocks.
  useEffect(() => {
    const onPull = (e) => {
      const d = e.detail || {};
      if (d.projectCode !== projectCode) return;
      const p2 = {
        x: Math.max(DOCK_EDGE, Math.min(Number(d.x) || 80, window.innerWidth - 96 - DOCK_EDGE)),
        y: Math.max(DOCK_EDGE, Math.min(Number(d.y) || 80, window.innerHeight - 72 - DOCK_EDGE)),
      };
      setPos(p2);
      try { localStorage.setItem(`sv.chatPos.${projectCode}`, JSON.stringify(p2)); } catch {}
      setNavDocked(projectCode, false);
      // THE HAND STAYS ON IT (his catch: it "just pops out — it's not like you were dragged").
      // The pointer that pulled the tab is still down, so the bot keeps following it until
      // release — the same carry every other drag gives you, just started from the strip.
      if (d.grab) {
        const move = (ev) => {
          setPos({
            x: Math.max(DOCK_EDGE, Math.min(ev.clientX - 23, window.innerWidth - 96 - DOCK_EDGE)),
            y: Math.max(DOCK_EDGE, Math.min(ev.clientY - 23, window.innerHeight - 72 - DOCK_EDGE)),
          });
        };
        const drop = () => {
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", drop);
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", drop);
      }
    };
    window.addEventListener("sv:pullOut", onPull);
    return () => window.removeEventListener("sv:pullOut", onPull);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectCode]);
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
        if (args.agents) {
          // The Agents page (RFC-055) — roster and profiles, scoped to the project.
          go({ pathname: `/agents/${projectCode}`, search: "" });
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
          // RFC-069 — the hub resolved this file before the command reached us. A machine file has
          // no project and needs no service; a file the resolver placed in ANOTHER project carries
          // that project, so the pane asks the right root instead of this room's.
          if (args.machine) {
            p.set("fmachine", "1");
            p.delete("fproj");
            p.delete("fsvc");
          } else {
            p.delete("fmachine");
            p.set("fproj", args.fileProject || projectCode);
          }
          // A FILE NEEDS A SERVICE TO COME FROM. The pane fetches through a connected service, and
          // with none it finds no host and CLOSES ITSELF — restoring the tab you came from, which
          // is why every attempt landed back on the Stage with nothing open. The earlier partial
          // success only worked because a different writer happened to supply `fsvc`.
          //
          // Prefer the service the human is standing in; otherwise this project's first one.
          const svc = args.machine
            ? null
            : (connectedServices || []).find(
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
            ["file", "fproj", "fsvc", "flang", "flines", "fside", "fmachine"].forEach((k) => params.delete(k));
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
        //
        // DOCKED, THE TV IS A DOCUMENT TAB. His ruling, 2026-10-14: *"I don't want the reports to
        // show up on the side panel… I want it to pop up like a document."* In the side panel the
        // column panels shove the chat down, so a show routes to the centre's report tab — the
        // same URL the nav verb writes — instead of standing beside the conversation. A CLEAR is
        // floating-only on purpose: docked, the document is a tab HE holds open now, and a verb
        // that yanks a tab out from under his reading is the screen-grab this page just spent a
        // day removing.
        if (!args.clear && inNav && args.path) {
          const params = new URLSearchParams(window.location.search);
          ["file", "fproj", "fsvc", "flang", "flines", "fside", "fnav", "ftab", "help", "fmachine"].forEach((k) => params.delete(k));
          params.set("tab", "reports");
          params.set("rdoc", args.path);
          go({ pathname: `/specs/${projectCode}`, search: `?${params.toString()}` });
          return;
        }
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
  useEffect(() => {
    if (!open) return undefined;
    const f1 = requestAnimationFrame(() => requestAnimationFrame(scrollToEnd));
    return () => cancelAnimationFrame(f1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotEl, open]);
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
      // A `:::cmd` PRESSED IN THE CHAT REPORTS BACK — always, no attribute (his call: a block in a
      // reply is the agent asking, so the press is the answer, same as a commit's). ONE LINE, both
      // ways — never the output: the full transcript is already on disk in the host's session log
      // (~/.autobot/terminals/) and the agent reads it there (his call: "if the log is on disk and
      // you already know, don't inject it"). Spoken AS "cmd", not as him — the run is a non-human
      // speaker and the row should say so. Documents don't implement this; presses there ping nobody.
      tellRun: (outcome) => {
        if (!attached) return;
        work.send(formatReceipt(outcome), "cmd");
      },
      setAttr: (line, key, value) => {
        if (!attached) return;
        // NAME WHAT WAS ANSWERED. `answered "157"` arrived on its own and meant nothing to either of
        // us — a value with no question attached is a receipt for a purchase you can't identify. The
        // block only hands back (line, key, value), so the question is found by looking for the
        // directive that owns this value among the rows on screen.
        // WHICH KIND OF BLOCK WROTE THIS. The search used to look for question|approval|input and
        // nothing else, so a COMMIT stamping its own `sha` and `ts` was matched against the nearest
        // QUESTION and reported as one — "cleared the sha — How do these read now?", and a commit
        // timestamp arriving as `answered "1787615445105"`. Two different blocks, one message, and
        // the receipt named the wrong one. The key says who owns the write: sha/ts/height belong to
        // a commit, an answer belongs to a question. Match on that, not on whatever is nearby.
        const OWNER = { sha: "commit", ts: "commit", height: "commit" };
        const kind = OWNER[key] || "question|approval|input";
        const re = new RegExp(`^\\s*(:{2,3})(${kind})\\b`);
        let about = "";
        try {
          const rows = (workRef.current && workRef.current.rows) || [];
          // WHICH BLOCK, NOT WHICH KIND. `line` is the directive's own source line inside this
          // row's document — the block hands it over on every write, and this search used to throw
          // it away and take the FIRST matching directive on screen. So three commit offers in one
          // conversation all reported as the first one: right sha, wrong message, and once the
          // wrong repo. A commit can't be matched by its value either — the value is a sha the
          // offer never contained — so the line number is the only thing that says which block was
          // pressed. Newest row first, because a tie is always the offer made most recently.
          for (const r of [...rows].reverse()) {
            const lines = String(r.text || "").split("\n");
            const at = Number(line) > 0 ? lines[Number(line) - 1] : null;
            const hit =
              at && re.test(at)
                ? at
                : kind === "commit"
                ? null // never fall back to "some other commit block" — say nothing instead
                : lines.find((l) => re.test(l) && (!value || l.includes(String(value))));
            if (hit) {
              const label = hit.match(/\[([^\]]+)\]/);
              const msg = hit.match(/\bmessage=("?)([^"}]+)\1/);
              const id = hit.match(/\bid=("?)([^"\s}]+)\1/);
              about = label ? label[1] : msg ? msg[2] : id ? id[2] : "";
              if (about) break;
            }
          }
        } catch {}
        // …and say what actually happened. "answered" is a question's word; a commit that stamps a
        // sha committed, and one that clears it is offering itself again.
        const said =
          OWNER[key] === "commit"
            ? key === "sha"
              ? value
                ? `committed ${String(value).slice(0, 7)}`
                : "cleared the commit — offering it again"
              : null
            : value
            ? `answered "${value}"`
            : `cleared the ${key || "answer"}`;
        if (!said) return; // a `ts` or a height is bookkeeping, not something to narrate
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
        //
        // …but only a show that still EXISTS — his zombie: "it starts you off with one… 'the
        // document could not be read'. If it's empty, it's empty." This restore ignored `hidden`
        // (a deleted show came back on every reload) and never asked whether a report-backed
        // show's FILE was still there. Same truth as the picker now: files first, hidden skipped,
        // and if nothing real remains the TV restores NOTHING.
        // HIS PICK WINS. A report chosen from the TV's list leaves no show record — restoring
        // records over the pick sent him back to an old show on every reload. If the picked file
        // still exists, it IS the TV.
        let picked = null;
        try { picked = JSON.parse(localStorage.getItem(`sv.tvPicked.${projectCode}`)); } catch {}
        if (picked && picked.path) {
          try {
            const res = await hostFiles(projectCode).readFile({ path: picked.path });
            if (!dead) setTv({ id: `report:${picked.path}`, path: picked.path, text: res.content || "", label: picked.name, ts: Date.now(), pickedAt: Date.now() });
            picked = { held: true };
          } catch {
            try { localStorage.removeItem(`sv.tvPicked.${projectCode}`); } catch {} // dead pick dies
            picked = null;
          }
        } else picked = null;
        const candidates = picked
          ? []
          : [...(history || [])]
              .reverse()
              .filter((m) => m.kind === "command" && m.cmd === "show" && m.args && m.args.text && !m.hidden);
        let lastShow = null;
        for (const m of candidates) {
          const a = m.args || {};
          const sets = await reportIndexSets(projectCode).catch(() => null);
          // A "text-only" show can still POINT at reports — the zombie's last hiding place: its
          // text embeds `.systemview/report.…md` paths, and if any of those is dead the show
          // renders as "this file can't be read". Every referenced report must exist.
          const referenced = String(a.text || "").match(/\.systemview\/report\.[^\s"')\]]+\.md/g) || [];
          if (sets && referenced.some((pth) => !sets.paths.has(pth))) continue;
          if (!a.report && !a.path) { lastShow = m; break; }
          if (!sets) { lastShow = m; break; } // unreadable index must not read as deleted
          const path = a.path || (a.report && reportPathFor(a.report));
          if ((path && sets.paths.has(path)) || (a.report && sets.names.has(a.report))) { lastShow = m; break; }
        }
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
      // TELL THE HUB THIS ROOM IS A CONVERSATION. While attached, `say <thisRoom>` is the wrong
      // door (you are IN the chat) and the hub refuses it — but attachment lives here, so here is
      // what has to say so. A heartbeat, not a register/unregister pair: it rides this existing
      // tick and expires hub-side in 30s, so a closed tab never leaves a stale wall up.
      if (attachedRef.current) { try { SystemView.chatAttached(projectCode, { on: true }); } catch {} }
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
      // evening: attached, the room is out of the panel, and a `systemview say` [RETIRED-2026-08-26, now tell] from this project's
      // own agent had nowhere on earth to render. He kept going back to look for a commit block that
      // was genuinely in the room and genuinely rendering — on a surface he was no longer looking at.
      // It is SHOWN, not sent: the session already IS this agent, so feeding it back to the model
      // would have it answering itself.
      else if (attachedRef.current && record.from === "agent" && !record.kind && !record.as) {
        try { workRef.current.showSaid(String(record.text || ""), projectCode); } catch {}
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
      // RFC-052 — DRAGGED OUT OF THE RAIL — and out of the CODEBASE CARD's slot the same way: the
      // moment a real drag starts, a docked agent undocks and floats under the pointer. The button
      // (double-click) stays; the drag was always supposed to work too.
      if (inRailRef.current || inNavRef.current) setNavDocked(projectCode, false);
      // …and over the dock, the preview: shrink, and ring the spot it would take.
      // The agent-panel CARD is a dock target too (his ask: "I can drag it out of the card, I
      // should drag it into the card") — its own card only.
      const hit = dockTargetOf(ev.clientX, ev.clientY);
      const cardHit = panelCardAt(ev.clientX, ev.clientY);
      setOverDock(!!hit || !!cardHit || !!openNavAt(ev.clientX, ev.clientY));
      markDockTarget(hit);
      markPanelCard(cardHit);
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
    const up = (ev) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      const d = dragRef.current;
      dragRef.current = null;
      setDragging(false);
      setOverDock(false);
      markDockTarget(null);
      markPanelCard(null);
      // DROPPED ON THE OPEN NAVIGATOR: that is docking too (his ask — "drag an agent back into
      // the code section and drop them back in"). The panel is the agent's home wherever the view
      // stands: list view, its card; tabs view, its tab — landing there docks it, and if its tab
      // isn't the active one it goes INTO the tab, which is what docked means there.
      if (d && d.moved && ev && openNavAt(ev.clientX, ev.clientY)) {
        suppressClickRef.current = true;
        setTimeout(() => { suppressClickRef.current = false; }, 0);
        setNavDocked(projectCode, true);
        return;
      }
      // DROPPED ON ITS OWN CARD in the agent panel: that is docking, same as the rail.
      if (d && d.moved && ev && panelCardAt(ev.clientX, ev.clientY)) {
        suppressClickRef.current = true;
        setTimeout(() => { suppressClickRef.current = false; }, 0);
        setNavDocked(projectCode, true);
        return;
      }
      // RFC-052 — DROPPED ONTO THE RAIL: that is docking. Only when the rail is there (navigator
      // collapsed) and the pointer let go over the rail's OWN area — below the nav tab. Above it
      // stays free (his rule: "from the nav tab up, it should be free" — the top corners are still
      // places to put an agent).
      const railEl = document.getElementById(railId);
      const railBox = railEl && railEl.getBoundingClientRect();
      if (d && d.moved && ev && railBox && ev.clientX <= railBox.right + 12 && ev.clientY >= railBox.top && ev.clientY <= railBox.bottom) {
        suppressClickRef.current = true;
        setTimeout(() => { suppressClickRef.current = false; }, 0);
        // WHERE YOU DROPPED IT (his ask): the spot under the pointer is the spot it takes, and
        // that spot's owner SWITCHES into the spot you left — your own, wherever it sits. Two
        // spots trade; nothing else moves. (Shifting the column was built first and read as a
        // blink without an animation to carry it — his call: "switching would be more intuitive.")
        const spots = [...railEl.querySelectorAll("[data-spot]")];
        const full = spots.map((el) => el.dataset.spot);
        let target = -1;
        for (let i = 0; i < spots.length; i += 1) {
          const b = spots[i].getBoundingClientRect();
          if (ev.clientY <= b.bottom) { target = i; break; }
        }
        if (target < 0) target = full.length - 1;
        const mine = full.indexOf(projectCode);
        if (mine >= 0 && target !== mine) {
          full[mine] = full[target];
          full[target] = projectCode;
        }
        setDockOrder(full);
        setNavDocked(projectCode, true);
        return;
      }
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

  // THE COMMANDS PANEL — his ask: a place to see the slash commands, run one, and have the result
  // render FRESH beside the chat (the way the editor extension does it) instead of landing as a
  // printout in the transcript. `cmdRun` remembers what was sent and when, so the panel shows the
  // receipt that arrives AFTER the press and never a stale one from an hour ago.
  const [cmdsOpen, setCmdsOpen] = useState(false);
  // THE COMMANDS PANEL'S CORNER PULLS THE CHAT. It is as tall as the chat, so its edges are the
  // chat's edges: pull one and the chat resizes, and the panel with it — the same gesture you make
  // on the chat's own corner, from the other side (his: "if it's going to resize with the chat,
  // then it needs to be able to be pulled as well… vice versa"). Height only — the width is the
  // panel's own and stays.
  const cmdsPull = (mw, mh) => makeResize(() => size, (v) => setSize((cur) => ({ ...cur, h: v.h })), `sv.chatSize.${projectCode}`)(0, mh);
  // Vertical only — the width is the panel's own; no side or corner handle on it.
  const CMDS_ZONES = RESIZE_ZONES.filter((z) => z.k === "n" || z.k === "s");
  const [slashSel, setSlashSel] = useState(0); // highlighted row in the `/` popup
  const [cmdRun, setCmdRun] = useState(null);
  // ONE DOOR FOR A SLASH COMMAND, wherever it came from — the panel's list, the `/` popup, or
  // typed out and sent. His correction: *"you type slash, it gives you the options, you click on
  // them — you don't have to press enter."* A pick IS the send. And every route opens the panel,
  // so the result renders fresh there instead of only as a printout in the transcript.
  // THE PLAN METERS. The hub runs the CLI's own /usage on his machine and hands the text back —
  // real numbers, no agent in the loop. Fetched when it can have MOVED: a turn ending (the only
  // event that spends), throttled to once per five minutes; on opening the panel; on picking
  // /usage (always fresh); and a thirty-minute fallback so a quiet panel never goes stale. His
  // rule on cost: *"stop offering inefficient things casually, like running some call every few
  // minutes"* — each fetch is a few seconds of CLI, so the events decide, not a clock.
  // THE LAST REPORT IS ALWAYS ON SCREEN. The CLI takes ~3s to answer; that wait belongs behind
  // the numbers, never in front of them. The last report is remembered across reloads so the bar
  // and the meters paint instantly with an honest "as of", and the fresh read replaces them.
  const [usage, setUsage] = useState(() => {
    try { return JSON.parse(localStorage.getItem("sv.usage.last")) || null; } catch { return null; }
  });
  // WHAT THE BAR SHOWS IS HIS TO CONFIGURE — checkboxes in the usage panel, remembered. His
  // correction after I trimmed the bar by fiat: "cost and tokens should be optional… add a list
  // of checkboxes that allows you to configure what shows on the bar." Session, week and Fable
  // are on by default; tokens and cost are there for the day another API makes them matter.
  const BAR_DEFAULTS = { session: true, week: true, fable: true, ctx: true, tokens: false, cost: false, fill: "auto" , resets: "date" };
// WHEN A METER RESETS, TWO FACES (his: "an option to show resets as the date, or a countdown —
// granular"). The printout says "Sep 1 at 11:59pm" in his own zone; that parses to an instant, and
// the countdown is measured from now, in days, hours and minutes — every unit that is non-zero.
const resetAt = (str) => {
  const m = /^(\w{3}) (\d{1,2}) at (\d{1,2}):(\d{2})(am|pm)$/i.exec(String(str || "").trim());
  if (!m) return null;
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const mo = months.indexOf(m[1].toLowerCase());
  if (mo < 0) return null;
  let h = Number(m[3]) % 12;
  if (m[5].toLowerCase() === "pm") h += 12;
  const now = new Date();
  let d = new Date(now.getFullYear(), mo, Number(m[2]), h, Number(m[4]));
  // A reset more than a day in the past was really next year's (a January reset read in December).
  if (d.getTime() < now.getTime() - 86400000) d = new Date(now.getFullYear() + 1, mo, Number(m[2]), h, Number(m[4]));
  return d;
};
const countdown = (str, now = Date.now()) => {
  const at = resetAt(str);
  if (!at) return null;
  let ms = at.getTime() - now;
  if (ms <= 0) return "now";
  const dd = Math.floor(ms / 86400000); ms -= dd * 86400000;
  const hh = Math.floor(ms / 3600000); ms -= hh * 3600000;
  const mm = Math.floor(ms / 60000);
  return [dd && `${dd}d`, hh && `${hh}h`, `${mm}m`].filter(Boolean).join(" ");
};

  const [barPrefs, setBarPrefs] = useState(() => {
    try { return { ...BAR_DEFAULTS, ...(JSON.parse(localStorage.getItem("sv.usagebar.show")) || {}) }; } catch { return BAR_DEFAULTS; }
  });
  // The countdown moves — one re-render a minute while that face is showing.
  const [, resetTick] = useState(0);
  useEffect(() => {
    if (barPrefs.resets !== "countdown") return undefined;
    const t = setInterval(() => resetTick((n) => n + 1), 60000);
    return () => clearInterval(t);
  }, [barPrefs.resets]);
  const resetFace = (r, name) => {
    if (barPrefs.resets === "countdown") {
      const c = countdown(r);
      if (c) return `in ${c}`;
    }
    return name === "session" ? String(r || "").replace(/^\w+ \d+ at /, "") : String(r || "").replace(" at ", " ");
  };
  const setBarPref = (k, v) => {
    const next = { ...barPrefs, [k]: v };
    setBarPrefs(next);
    try { localStorage.setItem("sv.usagebar.show", JSON.stringify(next)); } catch {}
  };
  const usageAt = useRef(0);
  const fetchUsage = async ({ fresh = false } = {}) => {
    try {
      const r = await SystemView.usageReport({ fresh });
      if (!r || !r.ok) return;
      const bars = parseUsageLines(r.text);
      if (!bars) return;
      usageAt.current = Date.now();
      const next = { bars, text: r.text, ts: r.ts || Date.now() };
      setUsage(next);
      try { localStorage.setItem("sv.usage.last", JSON.stringify(next)); } catch {}
    } catch {}
  };
  const usageTurns = work.state.turns;
  useEffect(() => {
    if (!attached) return undefined;
    if (Date.now() - usageAt.current > 5 * 60 * 1000) fetchUsage();
    const t = setInterval(() => fetchUsage(), 30 * 60 * 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attached, usageTurns]);

  const runSlash = (cmd) => {
    const c = String(cmd || "").trim();
    if (!c) return;
    setSlashSel(0);
    setInput("");
    setCmdsOpen(true);
    // DOCKED, THE COMMAND PANEL IS A TAB — the output (usage meters included) portals into the
    // centre instead of stacking the column (his "usage or skills" ruling, 2026-10-14).
    if (inNav) {
      const params = new URLSearchParams(window.location.search);
      ["file", "fproj", "fsvc", "flang", "flines", "fside", "fnav", "ftab", "help", "rdoc", "fmachine"].forEach((k) => params.delete(k));
      params.set("tab", "cmds");
      go({ pathname: `/specs/${projectCode}`, search: `?${params.toString()}` });
    }
    // /usage is answered by the hub, not the session — the CLI runs it, the panel draws it.
    if (/^\/usage\b/.test(c)) { setCmdRun({ cmd: "/usage", at: Date.now(), local: true }); fetchUsage({ fresh: true }); return; }
    setCmdRun({ cmd: c, at: Date.now() });
    work.send(c);
  };

  // ATTACHED PICTURES, waiting to go with the next message. Three doorways — paste into the box,
  // drop anywhere on the panel, or the paperclip — all landing in one list, because "how did it
  // get here" must not change what it is. `dropping` is only the highlight — named apart from the
  // panel's own `dragging`, which is the bubble being moved around the screen.
  const [shots, setShots] = useState([]);
  const [dropping, setDropping] = useState(false);
  const dragDepth = useRef(0);
  const addFiles = async (dt) => {
    const found = await readImagesFrom(dt);
    if (found.length) setShots((cur) => [...cur, ...found]);
    return found.length;
  };
  const onPasteShots = async (e) => {
    if (!hasImages(e.clipboardData)) return;
    // Only swallow the paste when it actually carried an image — a normal text paste must keep
    // behaving like a normal text paste. The clipboard is read synchronously here; the async
    // work happens after, which is why preventDefault cannot wait for it.
    e.preventDefault();
    await addFiles(e.clipboardData);
  };
  // DROP ANYWHERE ON THE PANEL, not just on the little input. Dragging a screenshot at a text box
  // is aiming; dragging it at the conversation is the actual intent. dragenter/leave are counted
  // because they fire for every child element the pointer crosses — without the depth count the
  // highlight strobes its way across the feed.
  const onDragEnter = (e) => {
    if (!hasImages(e.dataTransfer)) return;
    e.preventDefault();
    dragDepth.current += 1;
    setDropping(true);
  };
  const onDragLeave = (e) => {
    if (!dropping) return;
    e.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (!dragDepth.current) setDropping(false);
  };
  const onDropShots = async (e) => {
    if (!hasImages(e.dataTransfer)) return;
    e.preventDefault();
    dragDepth.current = 0;
    setDropping(false);
    await addFiles(e.dataTransfer);
  };

  const send = async () => {
    // SEND TAKES WHAT'S VISIBLE — his procedure, after every cleverer version failed him: "the
    // words are showing, meaning they've been captured; the simplest thing is just send whatever
    // words are there." The input holds the committed segments; the buildup line holds the rest,
    // already on screen. Their sum IS the message — no flush call (the old flush could WEDGE the
    // host recorder: light on, words frozen, stop-recording vaporizing them), no armed IOU firing
    // later or never. What you can read is what sends, the moment you press.
    const draft = (() => {
      const v = interimStore.get();
      return v && v !== "transcribing…" ? v : "";
    })();
    // NOT A PLAIN JOIN — see spokenJoin.js. A draft that resolved after its own sentence committed
    // holds words that are already in the box, and joining blind sent them twice (his report,
    // 2026-10-10). The host no longer emits those drafts; this is the check at the seam where the
    // two sources meet, and it fails toward keeping words.
    const text = joinSpoken(input, draft);
    // A SLASH COMMAND IS NOT A MESSAGE — it goes through the commands door, panel and all.
    if (attached && /^\/\S+/.test(text)) return runSlash(text);
    // PRESSING SEND WHILE THE WORDS ARE STILL LANDING. His bug, and it wasted his time all session:
    // *"if I press send while the chat is building up — I can see the transcript building up, it
    // didn't go into the input yet — then it won't do anything, it'll just stay there and I'm
    // waiting."* Host dictation commits a segment ASYNCHRONOUSLY into the box, so there is a real
    // window where he has finished speaking, can SEE the words arriving, and the input is still
    // empty. `if (!text) return` threw that press away, and the transcript then landed in a box
    // nobody was going to send. A press is an intention, not a snapshot — so when the mic is live
    // and there is nothing yet, the send is ARMED and fires the moment the words arrive.
    // NOTHING VISIBLE = NOTHING HAPPENS — his rule: an empty press must not touch the recorder,
    // arm anything, or leave a note. The recorder keeps doing its job; press again when words show.
    // A PICTURE WITH NO CAPTION IS A WHOLE MESSAGE. Requiring words here would have made the most
    // natural use of this — paste a screenshot, press send — do nothing at all.
    const pics = shots;
    if (!text && !pics.length) return;
    // Sending ends the dictation — you said what you had to say (his call). `onend` arrives a beat
    // later, so drop the flag HERE: otherwise the transcript panel hangs on screen after the
    // message is already gone, which reads as it popping up because you sent something.
    if (listening) {
      suppressCommitsRef.current = true; // late deliveries are duplicates from here
      setListening(false);
      setInterim("");
      try { if (recRef.current) { recRef.current.onresult = null; recRef.current.stop(); } } catch {}
      if (hostMicRef.current) {
        const rec = hostMicRef.current;
        hostMicRef.current = null;
        rec.cancel(); // the visible words are already IN the message — a late segment would double-land
      }
    }
    setInput("");
    setShots([]);
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
      // A FAILED DISPATCH GIVES THE WORDS BACK. The teardown above (mic stopped, input cleared,
      // overlay closed) runs before delivery is known — so a session that refuses input (busy,
      // compacting: his board note names it) was VAPORIZING the message, with one easy-to-miss
      // error line as the only trace. The words return to the input box, selected territory, his.
      if (!workRef.current.send(text, null, pics)) {
        setSendErr("the session isn't accepting input — your words are back in the box");
        setInput(text);
        setShots(pics); // the pictures come back with the words — a refused send loses nothing
        setTimeout(() => inputRef.current && autogrow(inputRef.current), 0);
        return;
      }
      setSendErr("");
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
    } catch {
      // Same rule on the room path: a send that threw did not happen — the words come back.
      setSendErr("couldn't reach the hub — your words are back in the box");
      setInput(text);
    }
  };

  // (The armed-send machinery is GONE — send takes the visible words instead of promising to
  // send invisible future ones.)

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
          // "cmd" is the machine's reserved voice (a :::cmd press reporting back), not a visitor —
          // a receipt must never grow a "jump to what cmd said" chip.
          if (r.as && r.as !== "cmd" && !subs.has(r.as) && !(spokeCleared[r.as] && (r.ts || 0) <= spokeCleared[r.as]))
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
  // EVERY PROJECT THIS APP KNOWS, minus the ones already on the list and minus this one. The roster
  // is the only place that needs it, so it is derived here rather than fetched again.
  const addable = useMemo(() => {
    const already = new Set(
      (subscribed || []).map((v) => (typeof v === "string" ? v : v && v.identity)).filter(Boolean),
    );
    return [...new Set((connectedServices || []).map((s) => s.projectCode).filter(Boolean))]
      .filter((pc) => pc !== projectCode && !already.has(pc))
      .sort();
  }, [connectedServices, subscribed, projectCode]);
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
    async (id, label, pristineText, ts, report, { auto = false } = {}) => {
      let text = pristineText;
      let path = report && report.path;
      // A POINTER SHOW LIVES IN A FILE. Read the document, and remember where it came from so that
      // answering in it writes back to the document rather than into a chat record.
      if (report && projPluginRef.current) {
        try {
          const res = await projPluginRef.current.readFile({ path: report.path });
          text = res.content;
        } catch {
          // THE MECHANISM HE DEMANDED, on the record: this is not a second list. Show RECORDS are
          // chat history — a memory — and the 📺 fallback trusted the memory without asking the
          // files, then rendered this tombstone when the file was gone. An AUTO open (📺, restore)
          // of a dead report now opens NOTHING and reports failure so the caller tries the next;
          // only an explicit CLICK on a history line still says plainly what's missing.
          if (auto) return false;
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
      return true;
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
  // FILES ARE THE TRUTH (his unification): a report-backed show whose DOCUMENT is gone is a memory,
  // not an entry — he deletes reports from the repo precisely so they stop lying around, and the TV
  // list kept them alive. The index is read when the picker opens; a null read prunes NOTHING
  // (an unreadable index must not look like a mass deletion). Text-only shows have no file and are
  // untouched by all of this.
  const [reportSets, setReportSets] = useState(null);
  // THE PICKER LISTS THE PROJECT'S REPORTS — the same list the nav fold reads, from the same
  // function. His rule, after a fresh report couldn't be pulled up here: "it's the same thing,
  // it's just where I get to see it." A report needs no show record to be on the TV's menu.
  const [allReports, setAllReports] = useState(null);
  useEffect(() => {
    // NO hasHostFiles GUARD — hostFiles reaches the HUB when the shell has no file verb, which is
    // exactly how the nav's fold works. The guard made the picker permanently "empty" in any tab
    // where the shell bridge was absent, while the nav happily listed reports beside it.
    if (!tvPick) return;
    let dead = false;
    reportIndexSets(projectCode).then((sets) => {
      if (!dead) setReportSets(sets);
    });
    listReports(projectCode).then((list) => {
      if (!dead) setAllReports(list);
    }).catch(() => { if (!dead) setAllReports([]); });
    return () => { dead = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tvPick, projectCode]);
  // A report row plays ON the TV by reading its FILE — a show record is history, not a
  // prerequisite. Text-only shows (no file behind them) stay listed from history below.
  const openReportOnTv = async (r) => {
    try {
      const res = await hostFiles(projectCode).readFile({ path: r.path });
      setTvPick(false);
      setTvArmed("");
      // `path` rides along — it is what the 📄 hand-off and freshness re-reads key on; without it
      // a report opened from the LIST had no button to the tabs (his catch on the walkthrough).
      setTv({ id: `report:${r.path}`, path: r.path, text: res.content || "", label: r.name, ts: r.ts || Date.now(), pickedAt: Date.now() });
      setTvOpen(true);
      // THE PICK IS THE TV'S STATE — his bug: he picked a new report, reloaded, and the TV went
      // back to an old show record, because a pick left no record for the restore to find. The
      // pick persists; restore honors it FIRST (if its file still exists).
      try { localStorage.setItem(`sv.tvPicked.${projectCode}`, JSON.stringify({ path: r.path, name: r.name })); } catch {}
    } catch {}
  };
  const deleteReportRow = async (r) => {
    try { await deleteReportFile(projectCode, r.path); } catch {}
    setAllReports((cur) => (cur || []).filter((x) => x.path !== r.path));
    // …and the BAND's list, which is a second poll of the same files. Without this the row he
    // just deleted sat there until the next 30s tick — a surface disagreeing with the disk about
    // something he did himself.
    setReportsMeta((m) => ({ ...m, list: m.list.filter((x) => x.path !== r.path), flags: m.flags }));
    // …and every show RECORD carrying this report goes hidden with it — leaving them was the
    // zombie's other half: the restore found an unhidden record for a file that no longer existed.
    (fullHist || messages || []).forEach((m) => {
      if (m.kind !== "command" || m.cmd !== "show" || m.hidden) return;
      const a = m.args || {};
      if (
        a.path === r.path ||
        (a.report && reportPathFor(a.report) === r.path) ||
        (a.text && a.text.includes(r.path)) ||
        // OLD FULL-TEXT RECORDS carry the whole document and no path at all — the immortal zombie:
        // file deleted, list clean, record replaying its embedded copy forever. The label is the
        // report's name and it is the only handle left.
        (m.label && r.name && m.label === r.name)
      )
        hideRecord(m.id);
    });
    try {
      const picked = JSON.parse(localStorage.getItem(`sv.tvPicked.${projectCode}`));
      if (picked && picked.path === r.path) localStorage.removeItem(`sv.tvPicked.${projectCode}`);
    } catch {}
    setTvArmed("");
    // …and the TV itself, whatever id the dead show wears — an in-session `tv` that survived its
    // own deletion was the "pops up every time I go back in" (state, not storage: reopening the TV
    // showed the held object without asking anything).
    if (tv && (tv.id === `report:${r.path}` || tv.path === r.path || (r.name && tv.label === r.name))) {
      setTv(null);
      setTvOpen(false);
    }
  };
  const showExists = React.useCallback(
    (s) => {
      const a = s.args || {};
      if (!a.report && !a.path) return true; // not document-backed — nothing to be missing
      if (!reportSets) return true;
      const path = a.path || (a.report && reportPathFor(a.report));
      return (path && reportSets.paths.has(path)) || (a.report && reportSets.names.has(a.report));
    },
    [reportSets, reportPathFor],
  );
  const liveShows = React.useMemo(() => shows.filter(showExists), [shows, showExists]);
  // THE TV'S DELETE IS THE REPORT'S DELETE — one verb, shared with the nav fold. Report-backed:
  // the file and the index entry go, then the show record hides; text-only: the record hides.
  // Deleting what's ON the TV puts the TV away.
  const [tvArmed, setTvArmed] = useState("");
  // The band's reports tab arms its own row — same two-step every deletable row in this app has,
  // kept separate from the TV picker's so arming one never lights the other.
  const [repArmed, setRepArmed] = useState("");
  const deleteShow = async (s) => {
    const a = s.args || {};
    const path = a.path || (a.report && reportPathFor(a.report));
    if (path) {
      try { await deleteReportFile(projectCode, path); } catch {}
      setReportSets((cur) => {
        if (!cur) return cur;
        const paths = new Set(cur.paths); paths.delete(path);
        const names = new Set(cur.names); if (a.report) names.delete(a.report);
        return { paths, names };
      });
    }
    hideRecord(s.id);
    setTvArmed("");
    if (tv && (tv.id === s.id || (s.label && tv.label === s.label))) {
      setTv(null);
      setTvOpen(false);
    }
  };
  // RFC-039 — take a record off the list. Optimistic locally so the row goes at once, then the hub
  // patches the record (hidden: true) and every open panel re-reads it. The links panel's own
  // two-step remove went with the report rows; the callers left are the message and show menus.
  const hideRecord = (id) => {
    setFullHist((cur) => (cur ? cur.map((m) => (m.id === id ? { ...m, hidden: true } : m)) : cur));
    setMessages((cur) => cur.map((m) => (m.id === id ? { ...m, hidden: true } : m)));
    if (SystemView && SystemView.chatHide)
      SystemView.chatHide(projectCode, { chat, id }).catch(() => {});
  };
  // THE COLLECTOR READS BOTH CONVERSATIONS. It only ever read the ROOM's records, and the room has
  // not been the conversation since the session took the panel over — so the panel listed links
  // from a chat he no longer looks at and missed every link the agent he is TALKING to had just
  // put on his screen. His words: *"the links I see have nothing to do with the recent links that
  // you just put in the chat."* The room still counts (shows are room records, and another agent
  // can still write into it), it just isn't the whole of it any more.
  //
  // Only while the panel is up: `work.rows` is re-folded on every render, and a streamed answer
  // renders many times a second.
  const collected = React.useMemo(
    () => (linksOpen || dockTabKind === "links" ? collectLinks({ records: fullHist || messages, rows: work.rows, q: linkQ }) : []),
    [linksOpen, dockTabKind, fullHist, messages, work.rows, linkQ],
  );
  // One openable thing, drawn with the SAME component the bubble would have drawn it with — a
  // `:file[…]` has to mean one thing everywhere or there are two dialects to keep in step.
  const linkChip = (e) => {
    if (e.kind === "link") return <ChatLink href={e.href}>{e.label}</ChatLink>;
    const Ref = REF_BLOCKS[e.kind] || ReportLink;
    return <Ref label={e.label} attrs={parseAttrs(e.attrs)} />;
  };

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
  // THE PROJECT'S FILE PLUGIN, which the TV's reader and the report editor still need after the
  // board moved out to organisms/Board (2026-10-14, his "pop up like a document" ruling).
  const chatFilesPlugin = useMemo(() => (hasHostFiles() ? hostFiles(projectCode) : null), [projectCode]);
  useEffect(() => {
    projPluginRef.current = chatFilesPlugin;
  }, [chatFilesPlugin]);

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
  // DOUBLE-CLICK: DEFAULT ⇄ PROPORTIONALLY LARGER, both axes, on the header and on every edge.
  //
  // FIXED PIXEL DEFAULTS, ONE PER PANEL, CHOSEN FOR WHAT THE PANEL HOLDS. Window-fraction defaults
  // were wrong: they made every panel the same square and left the codebase wide and stupid. A
  // file tree and a document read DOWN — tall and narrow. A chat is a column. A board is a stack
  // of cards. They are not the same shape and should never have shared one number.
  //
  // Each of these is one line to change if it lands wrong. The MECHANISM is not the thing to
  // change when a size feels off — that mistake is what turned one tweak into a dozen builds.
  const GROW = 1.4;
  const winW = () => window.innerWidth;
  const winH = () => window.innerHeight;
  const writeSize = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  // Clamped, so a grow can never push a panel past the window it lives in.
  const grownFrom = (d) => ({
    w: Math.min(Math.round(d.w * GROW), Math.max(320, winW() - 80)),
    h: Math.min(Math.round(d.h * GROW), Math.max(320, winH() - 80)),
  });
  // A few pixels of drift must not make the next double-click a no-op.
  const sameSize = (a, b) => a && b && Math.abs(a.w - b.w) < 12 && Math.abs(a.h - b.h) < 12;
  const resetSize = (setter, def, key, getCur) => () => {
    const big = grownFrom(def);
    const cur = (typeof getCur === "function" && getCur()) || def;
    // At the large size → home. Anywhere else, including mid-drag → large.
    const next = sameSize(cur, big) ? { ...def } : big;
    setter(next);
    writeSize(key, next);
  };
  const panelReset = resetSize(setSize, { w: 340, h: 480 }, `sv.chatSize.${projectCode}`, () => size);
  const cbResize = makeResize(() => cbSize, setCbSize, `sv.cbSize.${projectCode}`);
  // THE CODEBASE PANEL IS A DOCUMENT TOO — a file tree and a code view read down, not across, so
  // its default is taller than it is wide for the same reason the TV's is.
  // HIS HAND SIZING, read off the element: 406 × 610.
  const cbReset = resetSize(setCbSize, { w: 406, h: 610 }, `sv.cbSize.${projectCode}`, () => cbSize);
  const boardResize = makeResize(() => boardSize, setBoardSize, `sv.boardSize.${projectCode}`);
  const boardReset = resetSize(setBoardSize, { w: 380, h: 420 }, `sv.boardSize.${projectCode}`, () => boardSize);
  // The TV's double-click means "give me my natural FLEX size" (his call, matching the story
  // panes) — PER AXIS: the edge you double-click hands back its own dimension (side = width,
  // top/bottom = height, corner = both), and the TV header flexes the whole thing at once.
  // THE TV SWINGS THE SAME WAY AS EVERY OTHER PANEL — both axes, whichever edge you grab. It used
  // to be its own thing: the fit/fill flip was gated on `mh`, so grabbing a SIDE ran a different
  // branch that swapped width only, and which way the next double-click went depended on a stored
  // flag you could not see. Same gesture, three outcomes, depending on where your cursor landed.
  //
  // WHAT STAYS DIFFERENT IS ITS SMALL END, and that is a real difference rather than an accident:
  // the TV's natural size is AUTO — the box is as tall as the show, so a two-line show is a
  // two-line box. `tvSized` is what switches that off, which is why it is cleared on the way down
  // and set on the way up rather than deleted outright.
  // THE TV USES THE SAME RULE AS EVERY OTHER PANEL — grow proportionally from whatever size it is
  // now, and go back to exactly that. Its one genuine difference stays: until you have sized it by
  // hand the height flexes to the show, so a two-line show is a two-line box. The first
  // double-click is what ends that, which is why `tvSized` is set here and never cleared — you
  // asked for a size, so it keeps a size.
  // His hand sizing, read off the element: 448 × 638.
  const TV_DEFAULT = { w: 448, h: 638 };
  const tvReset = () => {
    const big = grownFrom(TV_DEFAULT);
    const r = tvElRef.current ? tvElRef.current.getBoundingClientRect() : null;
    const cur = { w: Math.round(r ? r.width : tvSize.w), h: Math.round(r ? r.height : tvSize.h) };
    const next = sameSize(cur, big) ? { ...TV_DEFAULT } : big;
    setTvSized(true); // a chosen size, so the height stops flexing to the show
    setTvSize(next);
    writeSize(`sv.tvSize.${projectCode}`, next);
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
  // RFC-052 — IN THE RAIL: the navigator is collapsed, the card is gone, and the bot is drawn small
  // in the strip that remains. Not `inNav` (no tabs, no card row): a small face whose panels open
  // beside the rail.
  const inRail = navDocked && !!slotEl && slotEl.id === spotId(projectCode);
  const inNav = navDocked && !!slotEl && !inRail;
  // RFC-062 — the SAME dock, with ROOM. In tabs view the nav shows one card spanning the panel,
  // so the docked chat's 420px cap stops making sense there: the panel keeps its own resize
  // handle and may be dragged as tall as the panel goes. Everywhere else the cap stands.
  const inTabsNav = inNav && !!(slotEl && typeof slotEl.closest === "function" && slotEl.closest(".system-nav--tabs"));
  const inRailRef = useRef(inRail);
  inRailRef.current = inRail;
  // …and its twin for the CARD dock, so a drag can pull the agent out of the codebase slot exactly
  // like it pulls one out of the rail (his call, and it was always the obvious symmetry: "you're
  // supposed to just be able to drag that agent out, just like the other dock").
  const inNavRef = useRef(inNav);
  inNavRef.current = inNav;
  // RFC-052 — OVER THE DOCK WHILE DRAGGING: the bot shrinks to dock size in your hand and the spot
  // under the pointer shows a ring, so where it lands is clear before you let go (his ask).
  const [overDock, setOverDock] = useState(false);
  const dockTargetOf = (x, y) => {
    const railEl = document.getElementById(railId);
    const box = railEl && railEl.getBoundingClientRect();
    if (!box || x > box.right + 12 || y < box.top || y > box.bottom) return null;
    const spots = [...railEl.querySelectorAll("[data-spot]")];
    let target = spots.length - 1;
    for (let i = 0; i < spots.length; i += 1) {
      if (y <= spots[i].getBoundingClientRect().bottom) { target = i; break; }
    }
    return { railEl, spots, target };
  };
  const markDockTarget = (hit) => {
    document.querySelectorAll("[data-spot].nav-panel__spot--target").forEach((el) => el.classList.remove("nav-panel__spot--target"));
    if (hit && hit.spots[hit.target]) hit.spots[hit.target].classList.add("nav-panel__spot--target");
  };
  // RFC-055 — THE AGENT-PANEL CARD IS A DOCK TARGET (his ask: dragging out works, dragging back
  // in has to work too). This bot's OWN card only — the one whose slot carries its projectCode.
  const openNavAt = (x, y) => {
    const el = document.querySelector('[data-sv="nav"]');
    if (!el || !el.className.includes("nav-panel--open")) return null;
    const b = el.getBoundingClientRect();
    return x >= b.left && x <= b.right && y >= b.top && y <= b.bottom ? el : null;
  };
  const panelCardAt = (x, y) => {
    for (const s of document.querySelectorAll(".agent-panel__slot[data-spot]")) {
      if (s.dataset.spot !== projectCode) continue;
      const card = s.closest(".agent-panel__card");
      const b = card && card.getBoundingClientRect();
      if (b && x >= b.left && x <= b.right && y >= b.top && y <= b.bottom) return card;
    }
    return null;
  };
  const markPanelCard = (card) => {
    document.querySelectorAll(".agent-panel__card--dockover").forEach((el) => el.classList.remove("agent-panel__card--dockover"));
    if (card) card.classList.add("agent-panel__card--dockover");
  };
  // Docked, the four icons are TABS over one surface — a 280px column cannot hold four boxes side
  // by side, and switching is a tab bar's whole job (his call, and better than what I proposed).
  // OPENING HAS TO SCROLL THE PANEL TO IT (his catch): several projects are stacked in that column,
  // so an agent expanding below the fold reads as nothing having happened. It lives HERE, not up by
  // the slot lookup, because it reads the four open-flags — declared further down, and reading one
  // above its declaration is a TDZ crash that takes the whole surface with it.
  const navShowing = navDocked && (open || boardOpen || linksOpen || tvOpen);
  // RFC-055 — DOCKED IN AN AGENT-PANEL CARD. Same rail mode, different home: the card lives in a
  // SCROLLING column, so everything measured off the bot (the panel row, the peek, the say bubble)
  // must re-measure as he scrolls or it stays behind while the face moves (his catch). A scroll
  // tick re-renders the bot; the fixed positions are recomputed from the fresh rect each time.
  const inPanelCard = inRail && !!(slotEl && typeof slotEl.closest === "function" && slotEl.closest(".agent-panel"));
  const [, bumpReflow] = useState(0);
  useEffect(() => {
    if (!inPanelCard) return undefined;
    const on = () => bumpReflow((n) => n + 1);
    window.addEventListener("scroll", on, true); // capture reaches the panel's inner scroll
    window.addEventListener("resize", on);
    return () => {
      window.removeEventListener("scroll", on, true);
      window.removeEventListener("resize", on);
    };
  }, [inPanelCard]);
  // …and the bubbles ESCAPE the card: the panel clips (it scrolls) and sits under the page, so a
  // peek or say positioned inside it gets cut at the panel's edge. Fixed, measured off the face,
  // over everything (his rule: "that z-index should be above all this stuff on the page").
  const bubbleFix = (dy = 0) => {
    if (!inPanelCard || !rootRef.current) return undefined;
    const b = rootRef.current.getBoundingClientRect();
    return { position: "fixed", left: b.right + 8, right: "auto", top: b.top + dy, transform: "none", zIndex: 9000 };
  };
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
  // "BRING OVER AS CHANGES" WANTS A CHANGES LIST ON SCREEN (his: "it might as well side panel").
  // The block announces it made uncommitted changes; a floating chat answers by opening the
  // codebase panel, where the git bar shows them. Docked in the nav, the nav's own git area is
  // already visible — nothing to open.
  useEffect(() => {
    // scoped to the project the block belongs to — the bare event opened every bot's panel
    const onChanges = (e) => {
      if (!inNav && e && e.detail && e.detail.projectCode === projectCode) setCbOpen(true);
    };
    window.addEventListener("sv:openChanges", onChanges);
    return () => window.removeEventListener("sv:openChanges", onChanges);
  }, [inNav, projectCode]);
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
  // A NAMESPACE REFERENCE, OFF THE CODE PAGE, OPENS THE CODEBASE HERE. His ruling: *"reports and
  // namespaces… should be using the side panel, they shouldn't be navigating me back to the code
  // tab."* On /specs the real navigator owns the reveal and this must stay out of the way. Marking
  // the detail `handled` is what tells the chip a tree answered — unanswered, it falls back to the
  // navigation it always did, so the click is never dead (the mistake reveal-only made).
  useEffect(() => {
    const onReveal = (e) => {
      const d = (e && e.detail) || {};
      if (inNav || d.kind !== "namespace") return;
      if (d.projectCode !== projectCode) return; // this panel draws one project's tree
      if (window.location.pathname.startsWith("/specs/")) return;
      d.handled = true;
      setCbOpen(true);
      setCbReveal(d);
    };
    window.addEventListener("sv:revealInNav", onReveal);
    return () => window.removeEventListener("sv:revealInNav", onReveal);
  }, [inNav, projectCode]);
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
  // AUTO-OPEN WALKS UNTIL SOMETHING REAL OPENS — files first, memory second. If every candidate
  // is dead, the TV opens onto its PICKER (the live list), never onto a corpse.
  const openFreshShow = async (cands) => {
    for (const c of cands) {
      // eslint-disable-next-line no-await-in-loop
      if (await openShow(c.id, c.label, c.args.text, c.ts, c.args.report || c.args.path ? c.args : null, { auto: true })) return true;
    }
    setTvOpen(true);
    setTvPick(true);
    return false;
  };
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
    // DOCKED, EVERY ICON IS A DOOR TO THE CENTRE. His ruling, 2026-10-14: *"everything here that
    // can pop up shouldn't pop up — it should be a document… I don't even want the chat here. And
    // that goes for everything that might pop in my way at the chat side."* Nothing stacks in the
    // column any more: each press routes to a centre tab — the board and reports as the documents
    // they are, the chat, the collector and the commands panel as PORTALS into their tab's slot
    // (see dockTabKind above). The stale params are cleared the way routeTo clears them, because a
    // leftover `file=` makes Documentation open the file tab and return before ours exists — the
    // bug that shipped the board as a tabless stack on day one.
    const params = new URLSearchParams(window.location.search);
    ["file", "fproj", "fsvc", "flang", "flines", "fside", "fnav", "ftab", "help", "rdoc", "fmachine"].forEach((k) => params.delete(k));
    const route = () => go({ pathname: `/specs/${projectCode}`, search: `?${params.toString()}` });
    if (which === "board") {
      // OFF THE CODE PAGE, OFFER FIRST (his report, 2026-10-17: these icons navigated away from
      // the Agents page even though its document display can host the board). Same offer/handled
      // contract as files; only silence navigates.
      if (!onCodePage()) {
        const d = { kind: "board", projectCode };
        window.dispatchEvent(new CustomEvent("sv:openCenterKind", { detail: d }));
        if (d.handled) return;
      }
      params.set("tab", "board");
      return route();
    }
    if (which === "tv") {
      // Freshest unseen show first, then whatever the TV was holding, then the newest show this
      // room has had: the same priority the floating TV applies, ending in a report tab.
      const fresh = showToOpen();
      const rec = fresh || [...shows].reverse().find((m) => m.args && m.args.path);
      const path = (fresh && fresh.args && fresh.args.path) || (tv && tv.path) || (rec && rec.args.path);
      // A report is a file — off the Code page it lands in whatever document display this page
      // owns, and only silence navigates.
      if (!onCodePage() && path && openReportInPanel({ projectCode, path, language: "markdown" })) return;
      params.set("tab", "reports");
      if (path) params.set("rdoc", path);
      return route();
    }
    if (which === "links") {
      setLinksOpen(true); // the collector's list is computed behind this flag
      params.set("tab", "links");
      return route();
    }
    // chat — HIS, AND IT STAYS WITH HIM IN THE COLUMN (his correction, 2026-10-14, after one
    // build where it opened as a tab: the conversation is not a document he visits, it is the
    // thing he talks through). A plain toggle, exactly as it always was.
    const next = !open;
    setOpen(next);
    openRef.current = next;
    if (next) {
      setUnread(0);
      try { localStorage.setItem(`sv.chatSeen.${projectCode}`, String(Date.now())); } catch {}
    }
  };
  // A NOTE HANDED OVER FROM THE BOARD TAB. The 💬 on a card used to reach the chat's input
  // directly (one component); with the board also living as a centre tab, the hand-over arrives as
  // an event — same text, same marker, and the chat opens so he can see where it landed.
  useEffect(() => {
    const onHand = (e) => {
      const d = (e && e.detail) || {};
      if (!d.text || (d.projectCode && d.projectCode !== projectCode)) return;
      setInput((cur) => (cur ? `${cur}\n${d.text}` : d.text));
      setOpen(true);
      openRef.current = true;
    };
    window.addEventListener("sv:boardHand", onHand);
    return () => window.removeEventListener("sv:boardHand", onHand);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectCode]);
  // ONE PICKER, TWO SEATS — the full TV's dropdown and the EMPTY TV's body are the same list.
  const tvPickerEl = tvPick ? (
    <div className={`${CLASSNAME}__tv-picker`} onClick={(e) => e.stopPropagation()}>
                    {/* THE PROJECT'S REPORTS — the nav's exact list. Every report is playable here the
                        moment it exists; no show record required. */}
                    {(allReports || []).map((r) => (
                      <div key={r.path} className={`${CLASSNAME}__tv-pick-row${tvArmed === r.path ? " is-armed" : ""}`}>
                        <button
                          type="button"
                          className={`${CLASSNAME}__tv-pick-item${tv && tv.id === `report:${r.path}` ? " is-on" : ""}`}
                          title={r.path}
                          onClick={() => openReportOnTv(r)}
                        >
                          <span className={`${CLASSNAME}__tv-pick-name`}>{r.name}</span>
                          {r.ts ? <span className={`${CLASSNAME}__tv-pick-time`}>{rowWhen(r.ts)}</span> : null}
                        </button>
                        <button
                          type="button"
                          className={`${CLASSNAME}__tv-pick-del`}
                          title={tvArmed === r.path ? "Click again — deletes the report (kept in git history)" : "Delete this report"}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (tvArmed === r.path) deleteReportRow(r);
                            else setTvArmed(r.path);
                          }}
                        >
                          {tvArmed === r.path ? "sure?" : "×"}
                        </button>
                      </div>
                    ))}
                    {allReports === null ? (
                      <div className={`${CLASSNAME}__tv-pick-empty`}>reading the reports…</div>
                    ) : allReports.length === 0 && liveShows.filter((s) => !(s.args && (s.args.report || s.args.path))).length === 0 ? (
                      <div className={`${CLASSNAME}__tv-pick-empty`}>no reports or shows in this room yet</div>
                    ) : (
                      liveShows.filter((s) => !(s.args && (s.args.report || s.args.path))).map((s) => (
                        <div key={s.id} className={`${CLASSNAME}__tv-pick-row${tvArmed === s.id ? " is-armed" : ""}`}>
                          <button
                            type="button"
                            className={`${CLASSNAME}__tv-pick-item${tv && tv.id === s.id ? " is-on" : ""}`}
                            onClick={() => {
                              setTvArmed("");
                              setTvPick(false);
                              openShow(s.id, s.label, s.args.text, s.ts, s.args.report ? s.args : null);
                            }}
                          >
                            <span className={`${CLASSNAME}__tv-pick-name`}>{s.label || "show"}</span>
                            <span className={`${CLASSNAME}__tv-pick-time`}>{rowWhen(s.ts)}</span>
                          </button>
                          {/* The row's quick delete — the SAME two-step every deletable row in this app
                              has, and the SAME delete the nav's reports fold runs: file + index + this
                              list, one press pair. */}
                          <button
                            type="button"
                            className={`${CLASSNAME}__tv-pick-del`}
                            title={tvArmed === s.id ? "Click again — deletes the report file too (kept in git history)" : "Delete this report"}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (tvArmed === s.id) deleteShow(s);
                              else setTvArmed(s.id);
                            }}
                          >
                            {tvArmed === s.id ? "sure?" : "×"}
                          </button>
                        </div>
                      ))
                    )}
                  </div>
  ) : null;
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
  // THE COUNT SHOWS MINIMISED TOO — the peek is where he watches a turn build. Same rule as the
  // panel's cooking line: chars over four, marked ≈, only while the session is actually working.
  const peekCounted = useCountUp(Math.round(work.state.liveChars / 4));
  const peekTok = work.state.state === "working" && work.state.liveChars > 40 ? `${peekCounted.toLocaleString()} tok` : "";
  // CLEARED IS A VIEW STATE, HIS — per LIST now: the fingerprint of each list he dismissed,
  // keyed by session/run. Same list → stays hidden; that list's next WRITE is a different
  // fingerprint and it returns on its own. Completion clears NOTHING — a finished run sits on
  // screen until he presses its ×, which is the only way multiple lists can be seen together.
  // AND IT HAS TO PERSIST NOW (2026-10-14). It was `useState({})`, which was survivable while a
  // job row lived only in this session's events — a restart took the row and the dismissal
  // together. Rows are read off run FILES now, so an in-memory dismissal means every card he
  // cleared comes back on the next restart and he clears it forever. Exactly the bug `deletedLanes`
  // below was added for, one row-kind later.
  const clearedListsKey = `sv.chat.clearedLists.${projectCode}`;
  const readClearedLists = (k) => {
    try {
      const v = JSON.parse(window.localStorage.getItem(k) || "{}");
      return v && typeof v === "object" && !Array.isArray(v) ? v : {};
    } catch {
      return {};
    }
  };
  const [clearedLists, setClearedListsRaw] = useState(() => readClearedLists(clearedListsKey));
  const setClearedLists = (next) =>
    setClearedListsRaw((prev) => {
      const v = typeof next === "function" ? next(prev) : next;
      try { window.localStorage.setItem(clearedListsKey, JSON.stringify(v)); } catch {}
      return v;
    });
  useEffect(() => {
    setClearedListsRaw(readClearedLists(clearedListsKey));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearedListsKey]);
  // JUST THE CONVERSATION. His ask, 2026-10-14: *"I need the ability to hide all the runs and the
  // whiteboard and everything, just like everything, that's not the chat."* The panel accumulates
  // furniture that has nothing to do with talking — a run row per lane, a card per job and skill, a
  // whiteboard — and on a long day that is most of its height while he is trying to have a
  // conversation.
  //
  // IT IS A VIEW, NOT A DISMISSAL, and that is the whole distinction from `clearedLists`. Clearing
  // a card says *this is finished with* and is per-card and permanent. This says *not right now*,
  // takes everything at once, and is meant to be pressed back — so it is one flag rather than a
  // sweep over ids, and nothing it hides is forgotten or deleted.
  //
  // PERSISTED PER PROJECT, like the dismissals: a view preference that resets on refresh is one he
  // has to set again every time, which is the same complaint one layer up.
  // THE WORK BAND RESIZES, NOT TOGGLES (his design, ordered for right after 8d1ee73): drag the
  // seam above it; dragged to nothing it collapses to a LABEL — "like it's closed", the mailbox
  // face — and the label pulls back out. The ONE engine (organisms/WallPanel), vertical side;
  // height is a % of the chat column, persisted per project like the old toggle was. hideWork
  // stays as a derived alias so the ⊟/⊞ control and every condition read exactly as before.
  const stripRef = useRef(null);
  // THE BAND DOES NOT TOUCH THE COLUMN'S BOTTOM — the composer sits below it, so measuring the
  // pointer against the column's bottom carried a composer-sized offset ("your mouse is way
  // down", his catch). The engine gets a composed rect: the band's OWN bottom (fixed in space
  // while dragging) as the anchor, the column's height as the scale — the seam tracks 1:1.
  const stripRow = {
    get current() {
      const el = stripRef.current;
      const col = el && el.parentElement;
      if (!col) return null;
      return {
        getBoundingClientRect: () => {
          const c = col.getBoundingClientRect();
          const b = el.getBoundingClientRect();
          return { top: c.top, left: c.left, right: c.right, width: c.width, height: c.height, bottom: b.bottom };
        },
      };
    },
  };
  const { open: stripOpen, setOpen: setStripOpen, w: stripH, setW: setStripH, startDrag: stripDrag, startPull: stripPull } =
    useWallPanel({ name: `chatStrip-${projectCode}`, side: "bottom", rowRef: stripRow, defaultW: 24, min: 8, max: 60, collapseAt: 4 });
  const hideWork = !stripOpen;
  const setHideWork = (v) => setStripOpen(!v);
  // OPEN TO FIT — his catch, 2026-10-17: a room with one report and no jobs opened to the default
  // height and showed a band of empty space. After an open, measure what the band actually holds —
  // the strip's rows (the strip itself stretches, so its CHILDREN carry the natural height), and
  // the non-stretching siblings (head, whiteboard, mailbox) — and shrink the height to fit when the
  // default overshoots. Never grows past the default and never under the engine's own floor, and a
  // height HE dragged is left alone (this runs only on the open transition).
  const stripWasOpen = useRef(stripOpen);
  useEffect(() => {
    const was = stripWasOpen.current;
    stripWasOpen.current = stripOpen;
    if (!stripOpen || was) return; // only the closed → open edge
    requestAnimationFrame(() => {
      try {
        const el = stripRef.current;
        const col = el && el.parentElement;
        if (!el || !col) return;
        let need = 14; // seam + paddings
        for (const child of el.children) {
          if (child.className && String(child.className).includes("__strip")) {
            for (const row of child.children) need += row.offsetHeight;
          } else {
            need += child.offsetHeight;
          }
        }
        const colH = col.getBoundingClientRect().height || 0;
        if (!colH) return;
        const needPct = Math.min(24, Math.max(8, Math.ceil((need / colH) * 100)));
        if (needPct < stripH) setStripH(needPct);
      } catch {}
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stripOpen]);

  // REPORTS IN THE BAND (his design, 2026-10-16): the one list (listReports — same list the nav
  // fold and the TV picker read), plus the APPROVAL SCAN — a report carrying a :::approval with no
  // verdict= is a flag up in the mailbox. Scanned over the newest 20 on a slow poll; the files are
  // the truth, there is no second store to drift.
  const [reportsMeta, setReportsMeta] = useState({ list: [], waiting: 0, flags: {} });
  // THE GATE — his challenge, 2026-10-16: *"isn't polling inefficient? …you have to justify it."*
  // The justified shape: one cheap listing per tick fingerprints every report file AND the index by
  // (path, mtime). Unchanged fingerprint → the tick ends at that single call; nothing is re-read
  // and the state already on screen stays. Changed → the real pull runs (the list, the 20 approval
  // reads). A verdict press bumps its file's mtime and a filing/delete changes the path set, so
  // both arrive within a tick — the gate skips only the ticks where nothing happened, which is
  // most of them.
  const reportsPrint = useRef("");
  useEffect(() => {
    let dead = false;
    const pull = async () => {
      const files = hostFiles(projectCode);
      try {
        const res = await files.listFiles({ dir: ".systemview" }); // dir-scoped walk — glob was never a real option on this door
        const print = ((res && (res.files || res)) || [])
          .map((f) => ({ path: (f && f.path) || f, ts: (f && (f.mtime || f.ts)) || 0 }))
          .filter((f) => f.path && (/\.systemview\/report\..+\.md$/i.test(f.path) || /reports\.index\.json$/.test(f.path)))
          .map((f) => `${f.path}@${f.ts}`)
          .sort()
          .join("|");
        if (print === reportsPrint.current) return; // a quiet tick costs exactly this one listing
        reportsPrint.current = print;
      } catch {
        reportsPrint.current = ""; // an unreadable listing never gates — fall through to the pull
      }
      try {
        const list = await listReports(projectCode);
        const flags = {};
        await Promise.all(
          list.slice(0, 20).map(async (r) => {
            try {
              const res = await files.readFile({ path: r.path });
              const blocks = [...String(res.content || "").matchAll(/:::approval\{([^}]*)\}/g)];
              if (blocks.some((b) => !/verdict=/.test(b[1]))) flags[r.path] = true;
            } catch {}
          })
        );
        if (!dead) setReportsMeta({ list, waiting: Object.keys(flags).length, flags });
      } catch {
        if (!dead) setReportsMeta({ list: [], waiting: 0, flags: {} });
      }
    };
    pull();
    const t = setInterval(pull, 30000);
    return () => { dead = true; clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectCode]);
  // RFC-071 — DOCUMENTS WITH UNSENT UPDATES. The hub walks the folder (api/documentMembers.js),
  // because "which documents have members" is a question about a project, not about the file that
  // happens to be open. Only documents where somebody is BEHIND become rows: a document whose
  // members are all current is not work waiting on him, and a row that can only say "nothing to do"
  // is the furniture the band already refuses everywhere else.
  const [docsMeta, setDocsMeta] = useState({ list: [] });
  useEffect(() => {
    let dead = false;
    const pull = async () => {
      try {
        const svc = SystemViewService && SystemViewService.Agent;
        if (!svc || !svc.documents) return;
        const r = await svc.documents({ projectCode });
        const list = ((r && r.documents) || []).filter((d) => (d.behind || []).length);
        if (!dead) setDocsMeta({ list });
      } catch {
        if (!dead) setDocsMeta({ list: [] });
      }
    };
    pull();
    const t = setInterval(pull, 30000);
    return () => { dead = true; clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectCode, SystemViewService]);

  const openBandReport = (path) => {
    if (!onCodePage() && openReportInPanel({ projectCode, path })) return;
    const q = new URLSearchParams(window.location.search);
    q.set("tab", "reports");
    q.set("rdoc", path);
    history.push({ pathname: `/specs/${projectCode}`, search: `?${q.toString()}` });
  };
  // A DELETED LANE IS DELETED, AND IT HAS TO SURVIVE A REFRESH — which `clearedLists` could not,
  // being useState({}). His cleanup removed the worktree, the branch and the run file, and then a
  // reload replayed the session's own events and drew the row again from the transcript, which is
  // permanent history nobody can delete. He deleted the same dead lane four times (2026-09-19).
  // Two differences from the fingerprint above, both deliberate: this persists, and it keys on the
  // LANE alone — a lane that writes its list again after he killed it must not return under a new
  // fingerprint. Per project, because a lane belongs to one repo.
  const deletedLanesKey = `sv.chat.deletedLanes.${projectCode}`;
  const readDeletedLanes = (k) => {
    try {
      return new Set(JSON.parse(window.localStorage.getItem(k) || "[]"));
    } catch {
      return new Set();
    }
  };
  const [deletedLanes, setDeletedLanes] = useState(() => readDeletedLanes(deletedLanesKey));
  useEffect(() => {
    setDeletedLanes(readDeletedLanes(deletedLanesKey));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deletedLanesKey]);
  // which lane's panel is open — one at a time; the panel is the deep look, the rows are the glance
  const [lanePanel, setLanePanel] = useState(null);
  // THE BAND IS TABS, FULL STOP (his call once he saw the toggle: *"just make it tabs"*). `bandTab`
  // is only a PREFERENCE: which tab actually shows is decided in bandTabs.js from what has rows, so
  // the band never shows an empty pane while work sits on another tab.
  const [bandTab, setBandTab] = useState(() => readBandTab());
  const pickBandTab = (k) => {
    setBandTab(k);
    writeBand(TAB_KEY, k);
    // pressing a count in the head is also how you OPEN the band — his flow: the head says
    // "3 lanes", you press it, you are looking at the lanes
    setStripOpen(true);
  };
  // THE LANE'S RAW LOG, joined once for both render sites. The split stamps a subagent's events
  // with the spawning Agent call's id, while a row is keyed by its RUN id — so the join is on the
  // sourced `set` call, which is the only thing both halves carry. A lane an agent registered for
  // its OWN work has no subagent and therefore no events, which is not an error: the panel's log
  // is empty and its header still reads the run.
  const laneLogFor = (source) => {
    for (const [, lane] of work.lanes || [])
      if (lane.source === source) return { events: lane.events, brief: lane.brief || "" };
    return { events: null, brief: "" };
  };
  // JOB AND SKILL ROWS, FROM THE SAME RUN FILES THE LANES COME FROM. His report, 2026-10-14: *"the
  // job rows disappeared, I didn't delete them."* They had — this read only `todoLists`, which is
  // folded from the session's in-memory events, so a shell restart erased every job card while the
  // lane rows beside them stood. The records were on disk the whole time, which made the strip say
  // a job never ran while the disk said it did.
  //
  // Same merge as `lanesShown`, and the live entry wins for the same reason: while the session is
  // running its events are fresher than the file. The host bounds what comes back and the row
  // count is not this surface's decision — but it no longer bounds it BY AGE. `stripRuns` carried a
  // 24-hour window on closed job and skill runs until 2026-10-14, which quietly reversed the strip's
  // own ruling one scroll below (*"a row that vanishes because its run finished is a row he cannot
  // find again"*); it was hiding fifteen closed runs here when it came out. What bounds it now is
  // `pruneRuns` deleting the record at fourteen days, and `clearedLists` remembering the ✕ he
  // pressed.
  const listsShown = (() => {
    const rows = new Map();
    for (const r of work.standingRuns || []) {
      const src = String(r.source || "");
      if (src.startsWith("lane:") || !(r.items && r.items.length)) continue;
      rows.set(String(r.owner || "").slice(4), { key: String(r.owner || "").slice(4), source: src, items: r.items });
    }
    for (const l of work.state.todoLists || [])
      if (l.items.length && !l.source.startsWith("lane:")) rows.set(l.key, { key: l.key, source: l.source, items: l.items });
    return [...rows.values()].filter((l) => JSON.stringify(l.items) !== clearedLists[l.key]);
  })();
  // STANDING LANES (RFC-059 slice 2): a lane row is born from a spawn and DIES AT CLEANUP —
  // nothing in between kills it. Rows come from the host's run files, so they outlive refreshes;
  // this session's live lane events overlay them (freshest items win) but never own the row's
  // existence. clearedLists still applies — after his confirmed delete the run file is gone, and
  // the fingerprint is what keeps the session's own event echo from resurrecting the row.
  // WHICH LANES THE JOB CARDS CLAIM — { runId: [branch, ...] }, reported by each JobRun as its
  // record arrives and released when the card leaves. The job's record names the branches (his
  // design: the job refers to the lane); the strip joins here at render, so the relation is stored
  // exactly once. Guarded against no-op writes or every report would re-render the strip forever.
  const [jobLaneClaims, setJobLaneClaims] = useState({});
  const claimLanes = useCallback((runId, branches) => {
    setJobLaneClaims((cur) => {
      if (branches == null) {
        if (!(runId in cur)) return cur;
        const next = { ...cur };
        delete next[runId];
        return next;
      }
      if (JSON.stringify(cur[runId] || []) === JSON.stringify(branches)) return cur;
      return { ...cur, [runId]: branches };
    });
  }, []);
  const lanesShown = (() => {
    const rows = new Map();
    for (const r of work.standingRuns || []) {
      // FILTER FOR LANES, which this loop never had to do and now must. It read `standingLanes`,
      // a list that only ever held `lane:` runs, so widening that list to carry job and skill runs
      // (2026-10-14) silently handed all of them to the LANE renderer: fourteen rows wearing the
      // leaf and a trash can, with labels chopped by the `slice(5)` that strips "lane:" — his
      // paste read `roactive-work` and `:job-authoring`. One rename, two symptoms, and the row he
      // was most likely to press was a delete.
      if (!String(r.source || "").startsWith("lane:")) continue;
      const id = String(r.owner || "").slice(4); // "run:<id>"
      // THE REPO RIDES THE ROW, and it can only come from the FILE: the record is stamped at
      // registration, while the live `todo.updated` event carries items and nothing else. Dropping
      // it here is what made the chip never appear however correct both halves were (his catch:
      // *"the lanes as they are displayed below the chat do not"*) — the field existed on disk, on
      // the row's props, and in the CSS, with nothing joining them.
      if (r.items && r.items.length) rows.set(id, { key: id, source: r.source, items: r.items, repo: r.repo || "" });
    }
    for (const l of work.state.todoLists || []) {
      // the live overlay wins on ITEMS and must not erase what only the file knows — a lane
      // registered in this very session is exactly the case where the event is fresher and emptier
      if (l.items.length && l.source.startsWith("lane:"))
        rows.set(l.key, { key: l.key, source: l.source, items: l.items, repo: (rows.get(l.key) || {}).repo || "" });
    }
    return [...rows.values()].filter(
      (l) => !deletedLanes.has(l.key) && JSON.stringify(l.items) !== clearedLists[l.key]
    );
  })();
  // WHICH TABS THE BAND HAS, and which one is showing — decided from what has rows (see
  // bandTabs.js), so the head's highlight and the pane below can never disagree.
  const bandJobs = listsShown.filter((l) => l.source.startsWith("job:"));
  const bandLists = listsShown.filter((l) => !l.source.startsWith("job:"));
  const bandShown = bandTabs(
    {
      jobs: bandJobs.length,
      lists: bandLists.length,
      lanes: lanesShown.length,
      reports: reportsMeta.list.length,
      documents: docsMeta.list.length,
    },
    bandTab,
  );
  const todoShown = listsShown.length ? listsShown[listsShown.length - 1].items : null;
  // THE PLAN'S HEADER RIDES THE MINIMISED VIEW ONLY — his correction after I put it on the open
  // panel's cooking line too: *"the worklist is already showing inside the chat."* Open, the list
  // itself sits right under the cooking line, and a summary of a thing beside the thing is noise.
  // Minimised there IS no list — that is what the brief is for.
  const peekTodo = (() => {
    const t = todoShown;
    if (!t || !t.length) return "";
    const done = t.filter((x) => x.state === "done").length;
    const act = t.find((x) => x.state === "active");
    return `${done}/${t.length}${act ? ` ${act.text.length > 44 ? `${act.text.slice(0, 42)}…` : act.text}` : ""}`;
  })();
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
        // THE LAST THING SAID, UP TO THREE LINES — his ask: "it can show more than one line."
        const firstLines = (t, n = 3) =>
          String(t || "")
            .split("\n")
            .map((x) => x.trim())
            .filter((x) => x)
            .slice(0, n)
            .join("\n");
        // STALE IS NOT CURRENT. The brief showed the last sentence of the PREVIOUS turn as if it
        // were this one — he sends a message, the agent starts, and the display keeps quoting an
        // answer to something else with nothing saying so. His words: "it will say something
        // that's stale — your last thing." A sentence from before his latest message is dropped
        // while a new turn is cooking; the cooking line stands in for it until this turn speaks.
        let turnStart = 0;
        for (let i = work.rows.length - 1; i >= 0; i -= 1) {
          if (work.rows[i].kind === "mine" && !work.rows[i].replay) { turnStart = work.rows[i].ts || 0; break; }
        }
        const lastSaid = saidRows.length ? saidRows[saidRows.length - 1] : null;
        const sayStale = !!(lastSaid && sessionCooking && (lastSaid.ts || 0) < turnStart);
        const say = lastSaid && !sayStale ? firstLines(lastSaid.text) : "";
        const cmdStale = !!(cmd && sessionCooking && cmd.state !== "running" && (cmd.ts || 0) < turnStart);
        return {
          say,
          cmd: cmd && !cmdStale ? cmd.summary || cmd.tool : "",
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
  // THE ROW IS A FLEX ROW NOW (his ask: "can they all be in an invisible horizontal scroll?").
  // `after()` used to place every panel by hand — an absolute `left` summed from the widths of
  // whatever was open ahead of it — which is a flex row done with arithmetic, and one that hung
  // off the screen edge. The anchor lays them out (CSS `order` keeps his sequence: chat, links,
  // TV, board, commands, codebase), caps itself at the viewport, and scrolls sideways with the
  // bar hidden. Kept as a no-op so the call sites read the same; the offsets are the row's now.
  const after = () => ({});
  // How wide the row may be before it scrolls: from the bot to the screen edge on the side it
  // opens toward. Measured off the bot itself; a bot that has not been placed yet gets the width.
  // THE ROW IS THE FULL SCREEN, WHEREVER THE BOT IS (his rule: "the agent is not the edge — it
  // should disappear in the corners regardless"). Floating, the row is pinned to the viewport,
  // corner to corner, at the bot's height; the first panel starts at the bot's x (padding), and
  // everything scrolls edge to edge. Past the middle the row runs leftward from the bot instead.
  // ONE RULE, FLOATING OR DOCKED (his catch: the dock's row was on its own rule and did not
  // scroll). Docked, the row starts beside the strip, a little lower so the name's icon row has
  // room; otherwise identical.
  // NO LAG (his catch: the bot "bouncing" above its panel while dragged). A row pinned by a
  // MEASURED rectangle is always one frame behind the bot; anchored inside the bot with the bot's
  // own `pos` — the same number, the same render — they move as one. The row is still a full
  // screen wide: it starts at the screen's left edge (`-pos.x` from the bot) and its padding puts
  // the first panel at the bot.
  const rowStyle = (() => {
    if (inNav) return undefined;
    const r = rootRef.current && rootRef.current.getBoundingClientRect();
    if (inRail) {
      if (!r) return undefined;
      return { position: "fixed", left: 0, right: 0, top: r.top + 44 - 30, margin: 0, paddingLeft: Math.max(0, r.right + 14), paddingRight: 0 };
    }
    const x = pos ? pos.x : r ? r.left : 0;
    const w = r ? r.width : 60;
    return {
      position: "absolute",
      top: "calc(100% + 10px)",
      left: -x,
      right: "auto",
      width: "100vw",
      // The box has 30px of padding above for the panels' shadow; pull it back so the panels sit
      // 10px under the bot, not 40 (his catch: "so much further down").
      margin: "-30px 0 0 0",
      paddingLeft: flip ? 0 : Math.max(0, x),
      paddingRight: flip ? Math.max(0, window.innerWidth - x - w) : 0,
    };
  })();
  const linksAhead = linksOpen ? LINKS_W + 10 : 0;
  const boardAhead = linksAhead + (tvOpen && tv ? tvSize.w + 10 : 0);
  const cbAhead = boardAhead + (boardOpen ? boardSize.w + 10 : 0);
  // The project's own services, which is all a single card needs.
  const myServices = (connectedServices || []).filter((s) => s.projectCode === projectCode);
  const body = (
    <div
      ref={rootRef}
      className={`${CLASSNAME} ${topHalf ? `${CLASSNAME}--top` : ""} ${leftHalf ? `${CLASSNAME}--left` : ""} ${flip && !inRail ? `${CLASSNAME}--flipx` : ""} ${docked ? `${CLASSNAME}--docked` : ""}${saying ? ` ${CLASSNAME}--errand` : ""}${iconsLeft ? ` ${CLASSNAME}--iconsleft` : ""}${inNav ? ` ${CLASSNAME}--innav` : ""}${inRail ? ` ${CLASSNAME}--rail` : ""}${inRail && (open || tvOpen || linksOpen || boardOpen || cbOpen || cmdsOpen) ? ` ${CLASSNAME}--rail-open` : ""}${overDock ? ` ${CLASSNAME}--overdock` : ""}`}
      style={inNav ? undefined : inRail ? { zIndex: z } : style}
      // Touch any part of a bot — its bubble, panel, or TV — and it comes to the FRONT (his
      // ask: "if I click on it, I'm trying to be in that chat").
      onPointerDownCapture={bringToFront}
    >
      {/* The anchor also stands up for the COLLECTOR alone — the links table opens from the closed
          bot now, so it can't live behind the panel being open. */}
      {(open || linksOpen || boardOpen || cbOpen || cmdsOpen || (tvOpen && tv)) && (
        <div className={`${CLASSNAME}__panel-anchor`} style={rowStyle}>
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
              title="Drag to move · double-click to toggle size"
              onPointerDown={onBotPointerDown}
              // THE HEADER IS THE OBVIOUS TARGET. The size toggle lived only on the 6px resize
              // borders, so double-clicking the bar you actually grab did nothing at all — the
              // feature was there and unreachable.
              onDoubleClick={cbReset}
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
                reveal={cbReveal}
                // THIS PANEL IS DRAWN BY THE AGENT, so the agent must not dock into it. The card
                // renders a slot for a docked agent and the agent portals itself in — fine in the
                // side nav, circular here, and the rest of the card does not survive the move. It
                // is why the two projects with a live agent were the two missing the git bar.
                allowDock={false}
              />
            </div>
          </div>
        )}
        {/* THE LANE PANEL, FLOATING: a side panel beside the chat, like every other deep look —
            in the nav it expands inline in the strip instead (that render is up in the strip). */}
        {attached && lanePanel && !inNav && (() => {
          const l = lanesShown.find((x) => x.key === lanePanel);
          if (!l) return null;
          const { events: laneEvents, brief: laneBrief } = laneLogFor(l.source);
          return (
            <div className={`${CLASSNAME}__tv ${CLASSNAME}__lanepanel-side`} style={{ width: 460, height: Math.max(380, size.h) }}>
              <LanePanel
                source={l.source}
                items={l.items}
                laneEvents={laneEvents}
                brief={laneBrief}
                projectCode={projectCode}
                onClose={() => setLanePanel(null)}
              />
            </div>
          );
        })()}
        {/* THE BOARD. Plain and his: type, it saves itself, it is still there tomorrow. Markdown,
            so anything he pastes or writes can be a real block later — but nothing here renders it,
            because a notepad that reformats what you typed while you type is not a notepad. */}
        {((cmdsOpen && !inNav) || inDockTab("cmds")) && attached && (() => {
          const SLASH = SLASH_COMMANDS;
          // The receipt that arrived for THIS press — newest command row stamped after the send.
          const fresh = cmdRun
            ? [...work.rows].reverse().find((r) => r.kind === "cmdret" && (r.ts || 0) >= cmdRun.at - 1000)
            : null;
          const run = (cmd) => {
            setCmdRun({ cmd, at: Date.now() });
            work.send(cmd);
          };
          const tab = inDockTab("cmds");
          const el = (
            <div
              className={`${CLASSNAME}__board ${CLASSNAME}__cmds`}
              // AS TALL AS THE CHAT, ITS OWN WIDTH — height follows the chat (his ask: "match the
              // LENGTH of the input"); the width is the panel's own. Pulled, it carries its offset.
              style={tab ? { width: "100%", height: "100%" } : inNav ? { width: "auto", height: Math.max(380, size.h) } : { width: 360, height: size.h, ...after(boardAhead) }}
            >
              <ResizeBorder start={cmdsPull} onReset={panelReset} zones={CMDS_ZONES} />
              <div
                className={`${CLASSNAME}__board-head ${CLASSNAME}__tv-head--grab`}
                title="Drag to move"
                onPointerDown={onBotPointerDown}
              >
                <span className={`${CLASSNAME}__tv-badge`}>/</span>
                <span className={`${CLASSNAME}__board-title`}>commands</span>
                <button type="button" className={`${CLASSNAME}__board-x`} title="Put it away" onClick={() => setCmdsOpen(false)}>
                  ✕
                </button>
              </div>
              <div className={`${CLASSNAME}__cmds-list`}>
                {SLASH.map((c) => (
                  <button
                    key={c.cmd}
                    type="button"
                    className={`${CLASSNAME}__cmds-item${cmdRun && cmdRun.cmd === c.cmd ? ` ${CLASSNAME}__cmds-item--on` : ""}`}
                    title={c.what}
                    onClick={() => run(c.cmd)}
                  >
                    <code>{c.cmd}</code>
                    <span>{c.what}</span>
                  </button>
                ))}
              </div>
              <div className={`${CLASSNAME}__cmds-out`}>
                {!cmdRun ? (
                  <div className={`${CLASSNAME}__cmds-empty`}>pick one — it runs now and shows here</div>
                ) : cmdRun.local && !usage ? (
                  <div className={`${CLASSNAME}__cmds-empty`}><span className={`${CLASSNAME}__interim-dot`} /> asking the CLI…</div>
                ) : cmdRun.local && usage ? (
                  // USAGE, DRAWN AS METERS — his ask from the start: *"a nice display for commands
                  // like that… it should be showing nice bars."* Each limit is its own meter with
                  // the reset time under it, in the context ruler's colour language (calm, amber
                  // past 75, red past 90). The "what's contributing" lines follow as plain text.
                  <div className={`${CLASSNAME}__usage`}>
                    <div className={`${CLASSNAME}__usage-asof`}>as of {new Date(usage.ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</div>
                    {/* STAT TILES WITH METERS. The fill carries severity — accent, then warning past
                        75, critical past 90 — and severity never rides color alone: past the
                        thresholds the tile says so in words beside the number. The unfilled track
                        is a lighter step of the same ramp so the whole bar reads as one state.
                        Values are proportional figures (a display-size number in tabular digits
                        looks loose); the reset time sits under each bar in secondary ink. */}
                    {/* THE BAR'S SETTINGS — toggles in the app's own chip style rather than the
                        browser's checkboxes (his: "the default checkbox is a little clunky"), and a
                        second row picking which meter the bar's fill follows. */}
                    <div className={`${CLASSNAME}__usage-prefs`}>
                      <span className={`${CLASSNAME}__usage-prefs-label`}>on the bar</span>
                      {[["session", "session"], ["week", "week"], ["fable", "Fable"], ["ctx", "context"], ["tokens", "tokens"], ["cost", "cost"]].map(([k, name]) => (
                        <button
                          key={k}
                          type="button"
                          className={`${CLASSNAME}__usage-pref${barPrefs[k] ? ` ${CLASSNAME}__usage-pref--on` : ""}`}
                          onClick={() => setBarPref(k, !barPrefs[k])}
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                    <div className={`${CLASSNAME}__usage-prefs`}>
                      <span className={`${CLASSNAME}__usage-prefs-label`}>fill follows</span>
                      {[["auto", "highest"], ["session", "session"], ["week", "week"], ["fable", "Fable"]].map(([k, name]) => (
                        <button
                          key={k}
                          type="button"
                          className={`${CLASSNAME}__usage-pref${barPrefs.fill === k ? ` ${CLASSNAME}__usage-pref--on` : ""}`}
                          onClick={() => setBarPref("fill", k)}
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                    <div className={`${CLASSNAME}__usage-prefs`}>
                      <span className={`${CLASSNAME}__usage-prefs-label`}>resets as</span>
                      {[["date", "date"], ["countdown", "countdown"]].map(([k, name]) => (
                        <button
                          key={k}
                          type="button"
                          className={`${CLASSNAME}__usage-pref${barPrefs.resets === k ? ` ${CLASSNAME}__usage-pref--on` : ""}`}
                          onClick={() => setBarPref("resets", k)}
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                    {usage.bars.map((bar) => {
                      const tone = bar.pct >= 90 ? "due" : bar.pct >= 75 ? "warn" : "";
                      const word = tone === "due" ? "at the limit" : tone === "warn" ? "high" : "";
                      return (
                        <div key={bar.label} className={`${CLASSNAME}__usage-row${tone ? ` ${CLASSNAME}__usage-row--${tone}` : ""}`}>
                          <div className={`${CLASSNAME}__usage-head`}>
                            <span className={`${CLASSNAME}__usage-label`}>{bar.label.replace(/^week · /, "week — ")}</span>
                            <span className={`${CLASSNAME}__usage-value`}>
                              {word && <span className={`${CLASSNAME}__usage-word`}>{tone === "due" ? "⚠" : "▲"} {word}</span>}
                              <span className={`${CLASSNAME}__usage-pct`}>{bar.pct}<span className={`${CLASSNAME}__usage-unit`}>%</span></span>
                            </span>
                          </div>
                          <div className={`${CLASSNAME}__usage-meter`} role="meter" aria-valuenow={bar.pct} aria-valuemin={0} aria-valuemax={100} aria-label={bar.label}>
                            <div className={`${CLASSNAME}__usage-fill`} style={{ width: `${Math.max(bar.pct, 1.5)}%` }} />
                          </div>
                          {bar.resets && <div className={`${CLASSNAME}__usage-resets`} title={`resets ${bar.resets}`}>resets {resetFace(bar.resets, /^session/i.test(bar.label) ? "session" : "week")}</div>}
                        </div>
                      );
                    })}
                    <div className={`${CLASSNAME}__usage-notes`}>
                      {String(usage.text).split("\n").filter((l) => l.trim() && !/^\s*Current /.test(l) && !/^You are currently/.test(l)).map((l, i) => (
                        <div key={i} className={/^\S/.test(l) ? `${CLASSNAME}__usage-note-head` : `${CLASSNAME}__usage-note`}>{l.trim()}</div>
                      ))}
                    </div>
                  </div>
                ) : fresh ? (
                  <Feed rows={[fresh]} />
                ) : (
                  <div className={`${CLASSNAME}__cmds-empty`}>
                    <span className={`${CLASSNAME}__interim-dot`} /> running {cmdRun.cmd}…
                  </div>
                )}
              </div>
            </div>
          );
          return tab ? createPortal(el, dockTabSlot) : el;
        })()}
        {boardOpen && !inNav && (
          <div
            className={`${CLASSNAME}__board`}
            style={{ width: boardSize.w, height: boardSize.h, ...after(boardAhead) }}
          >
            <ResizeBorder start={boardResize} onReset={boardReset} />
            {/* THE HEADER IS STILL THE HANDLE — dragging it moves the bot and everything hanging
                off it, so the board travels with the rest instead of being the one panel you
                cannot move. The content itself lives in organisms/Board now; docked, there is no
                panel at all — navPick routes 📋 to the centre's board tab. */}
            <Board
              projectCode={projectCode}
              headerDrag={{ onPointerDown: onBotPointerDown, onDoubleClick: boardReset }}
              onClose={() => setBoardOpen(false)}
              onHandToChat={(handed) => {
                setInput((cur) => (cur ? `${cur}\n${handed}` : handed));
                setOpen(true);
                openRef.current = true;
              }}
            />
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
        {tvOpen && !tv && !inNav && (
          <div
            className={`${CLASSNAME}__tv ${CLASSNAME}__tv--empty`}
            style={{ width: tvSize.w, height: 120 }}
          >
            <div className={`${CLASSNAME}__tv-empty-line`}>nothing on the TV yet — pick a report</div>
            {/* THE LIST, NOT A CLI LESSON — his call ("so we don't have to go through this
                ceremony"): an empty TV in a room with reports on the nav was teaching him a show
                command instead of offering the reports. Same picker, same rows, same delete. */}
            {tvPickerEl}
            <button
              type="button"
              className={`${CLASSNAME}__tv-empty-close`}
              onClick={() => setTvOpen(false)}
            >
              close
            </button>
          </div>
        )}
        {tvOpen && tv && !inNav && (
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
              title="Drag to move · double-click to toggle size and reset position"
              onPointerDown={tvDrag.onPointerDown}
              onDoubleClick={() => {
                tvReset();
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
                    // NOT ON THE CODE PAGE? The side panel is the landing (his rule: the panel
                    // shows up on every page -- reading one doc never costs the page you're on).
                    // The event opens the panel even when it's closed; `handled` says a panel
                    // answered, and only silence falls through to the navigate below.
                    if (!window.location.pathname.startsWith("/specs/")) {
                      const detail = { projectCode, path: tvDocPath, language: "markdown" };
                      window.dispatchEvent(new CustomEvent("sv:openFileInNav", { detail }));
                      if (detail.handled) {
                        setTvOpen(false);
                        if (endErrandRef.current) endErrandRef.current(true);
                        return;
                      }
                    }
                    const p = new URLSearchParams(window.location.search);
                    p.set("tab", "reports");
                    p.set("rdoc", tvDocPath);
                    p.delete("help");
                    // A REPORT BELONGS TO A PROJECT, and so do the file params sitting in the URL.
                    // Landing on this project's page while `file`/`fproj`/`fsvc` still point at
                    // another one leaves the nav showing a foreign file beside the report — which is
                    // what "my reports are not being transferred properly" looks like from outside.
                    if (p.get("fproj") && p.get("fproj") !== projectCode)
                      ["file", "fproj", "fsvc", "flang", "flines", "fside", "fmachine"].forEach((k) => p.delete(k));
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
            {tvPickerEl}
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
        {/* THE COLLECTOR (his ask: "I want that link again") — ONE list, newest first, of every
            openable thing dropped in this conversation: reference chips, plain links, pushed
            reports. His rule for it: *"if you send me something, I don't have to go back up the
            chat to find it. On the top is the latest link or anything you dropped."* A lens over
            the session and the room — no new storage. Slides beside the TV when both are open. */}
        {(() => {
          // THE COLLECTOR IS A DOCUMENT WHEN DOCKED — same portal, same ruling as the chat.
          const tab = inDockTab("links");
          if (!(tab || (linksOpen && !inNav))) return null;
          const el = (
          <div
            data-sv="links"
            className={`${CLASSNAME}__tv ${CLASSNAME}__links`}
            style={inDockTab("links") ? { width: "100%", height: "100%" } : {
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
              <span className={`${CLASSNAME}__tv-title`}>links</span>
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
                  {linkQ ? "nothing matches" : "nothing has been dropped in this conversation yet"}
                </div>
              ) : (
                // EVERY ROW IS ONE OPENABLE THING. Report rows are gone — the TV's own header
                // lists every report and picking one there is fewer steps than hunting it here.
                // And the chips are wrapped in the SAME scope the chat bubbles get: FileLink reads
                // `useMarkdownScope()` for its project, so rendered outside a provider every chip
                // in this panel resolved to no project and clicking one did nothing at all.
                <MarkdownScopeProvider value={{ projectCode }}>
                  {collected.map((e) => (
                    <div key={e.id} className={`${CLASSNAME}__links-item`}>
                      <span className={`${CLASSNAME}__links-chips`}>{linkChip(e)}</span>
                      <span className={`${CLASSNAME}__links-time`}>{rowWhen(e.ts)}</span>
                    </div>
                  ))}
                </MarkdownScopeProvider>
              )}
            </div>
          </div>
          );
          return tab ? createPortal(el, dockTabSlot) : el;
        })()}
        {(() => {
          if (!open) return null;
          const el = (
        <div
          data-sv="chat"
          // RECORDING IS A STATE OF THE WHOLE BOX, not of the button. His reason IS the
          // requirement: he forgets to stop the recorder, so this has to still be telling him five
          // minutes later, when he has stopped thinking about it and is looking at something else.
          // Ambient, never a flash — and static, because a cue that lives on screen for minutes is
          // the last thing that should animate (that lesson cost this page a day).
          className={`${CLASSNAME}__panel${listening ? ` ${CLASSNAME}__panel--recording` : ""}${
            dropping ? ` ${CLASSNAME}__panel--dropping` : ""
          }`}
          onDragEnter={onDragEnter}
          onDragOver={(e) => hasImages(e.dataTransfer) && e.preventDefault()}
          onDragLeave={onDragLeave}
          onDrop={onDropShots}
          // A free-parked bubble may not have the panel's height of room on its open side — cap
          // to the space that actually exists so it never runs off the top or bottom.
          // Docked, the COLUMN decides the width — a stored 340 would hang out over the nav's edge.
          style={
            inNav
              ? { width: "auto", height: inTabsNav ? size.h : Math.min(size.h, 420) }
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
                    /* THE SAME MENU THE MODEL PICKER USES — not a native <select>, which opens the
                       OS widget and looks like a form on a surface that has none. A text box was
                       worse still: it asked you to spell a project code the app already knows, and
                       a typo reported success while subscribing nobody. Pick a name, it subscribes. */
                    <>
                      <div className={`${CLASSNAME}__ctx-overlay`} onClick={() => setAddingVisitor(false)} />
                      <div className={`${CLASSNAME}__model-menu ${CLASSNAME}__visitor-menu`}>
                        {addable.length === 0 && (
                          <span className={`${CLASSNAME}__model-item ${CLASSNAME}__model-item--none`}>
                            everyone is already here
                          </span>
                        )}
                        {addable.map((pc) => (
                          <button
                            key={pc}
                            type="button"
                            className={`${CLASSNAME}__model-item`}
                            style={visStyle(pc)}
                            title={`Send ${pc} this conversation`}
                            onClick={async () => {
                              setAddingVisitor(false);
                              try {
                                const res = await SystemView.chatAddVisitor(projectCode, { identity: pc });
                                if (res && res.added)
                                  setSubscribed((cur) =>
                                    cur.some((x) => x.identity === pc)
                                      ? cur
                                      : [{ identity: pc, by: "human", ts: Date.now() }, ...cur],
                                  );
                              } catch {}
                            }}
                          >
                            {pc}
                          </button>
                        ))}
                      </div>
                    </>
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
                        {/* SCOPED, so the blocks inside have a project to read from — every
                            ::file / ::diff / ::image resolves its folder from `scope.projectCode`,
                            and three of the four chat-markdown surfaces had no provider above them.
                            (autobot found that; the duplicate nesting here was my own script
                            matching its own output, which is its own small lesson about edits that
                            rewrite what they just wrote.) */}
                        <MarkdownScopeProvider value={{ projectCode }}>
                          {renderChatMessage(String(m.text || ""))}
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
          {/* WHAT THE AGENT READS BACK — AT THE FOOT OF THE CONVERSATION, HOVERING OVER IT.
              It belongs to the CONVERSATION rather than to a reply (*"now I want it on
              everything… we're not having a conversation, I just probably want callout"*), so
              there is one of these instead of one per message.
              IT IS NOT A ROW. Placed here as an ordinary block it stretched the full width of the
              chat and became a band in the stack — his: *"it was a row… it should just be a pill."*
              So this wrapper has NO HEIGHT and the pill inside it is lifted out, overlaying the
              bottom of the conversation. Nothing below it moves, and it adds nothing to the
              column. (It belongs in the chat, not in the bottom drawer area — that was the other
              thing I got wrong.) */}
          <div className={`${CLASSNAME}__voicebar`}>
            <VoiceMode className={`${CLASSNAME}__voice`} scope={projectCode} />
          </div>
          {attached && (work.state.state === "working" || work.state.state === "waiting") && (
            <CookLine doing={work.state.doing} state={work.state.state} liveChars={work.state.liveChars} />
          )}
          {/* THE PLAN OUTLIVES THE TURN THAT WROTE IT. Deliberately not gated on `working`: the
              moment a turn ends is exactly when "what's left" matters, and a list that vanishes
              when the agent stops is a list he can only read while he cannot act on it. */}
          {/* THE RUN STRIP IS BOUNDED, AND NOTHING LEAVES IT. His report, 2026-10-13: *"when a job
              is showing, for some reason, it covers up everything under it, including the chat."*
              Every sourced run of a session draws a row here — twenty of them that day — and the
              rows were bare siblings of the feed and the input, so there was no element to hang a
              bound on and the stack grew until the conversation had no room left.
              `__worklist-items` had already solved this ONE LEVEL DOWN (*"a long plan scrolls
              itself rather than pushing the conversation off screen"*); the STACK of cards never
              got the same treatment.
              NOT by dropping closed runs out, which was the other half of the ask: a row that
              vanishes because its run finished is a row he cannot find again, and watching them is
              what the strip is FOR. It scrolls instead — every row still there, the height fixed.
              Both cards already collapse to one header line when closed (`open: false` is their
              initial state), so the common case is short and the bound only bites on a long day. */}
          {/* JUST THE CONVERSATION — ON THE SECTION IT HIDES, NOT IN THE HEADER. His correction,
              2026-10-14: *"right above, on the right of that section, not at the top."* A control
              in the title bar is a window control and reads as one; this one acts on the band of
              runs and whiteboard directly beneath it, so it belongs against that band's top right
              where the thing it affects is the next thing your eye lands on.
              IT MUST OUTLIVE WHAT IT HIDES — it is the only way back, so the row renders while
              there is something to hide OR while something is hidden, never gated on the section
              it controls. And the count rides the title while it is on: a surface that silently
              omits is a surface that lies, so "no runs" and "runs, hidden by me" must never look
              the same. */}
          {attached && !hideWork && (lanesShown.length > 0 || listsShown.length > 0 || reportsMeta.list.length > 0 || !!work.state.whiteboard) && (
            <div className={`${CLASSNAME}__workband`} ref={stripRef} style={{ flex: `0 1 ${stripH}%` }}>
              <div
                className="panel-divider panel-divider--h"
                title="Drag to resize · drag to the bottom to close · double-click resets"
                onMouseDown={stripDrag}
                onDoubleClick={() => setStripH(24)}
              />
              <WorkbandHead
                open
                jobs={listsShown.filter((l) => l.source.startsWith("job:")).length}
                lists={listsShown.filter((l) => !l.source.startsWith("job:")).length}
                lanes={lanesShown.length}
                reports={reportsMeta.list.length}
                waiting={reportsMeta.waiting}
                onPick={pickBandTab}
                onToggle={() => setStripOpen(false)}
              />
              {/* THE TAB BAR — one tab per kind that HAS rows, drawn only in tabs view. The head's
                  counts are the other door into exactly these; both set the same state, so they
                  cannot disagree about what is showing. */}
              {/* THE TAB ROW — one tab per TYPE of work that has rows. No toggle and no stacked
                  view: the band is tabs (his call). A single type still gets its tab, because the
                  tab is the type's name, not a choice between kinds. */}
              {bandShown.tabs.length > 0 && (
                <div className={`${CLASSNAME}__bandtabs`}>
                  {bandShown.tabs.map((tb) => (
                    <button
                      key={tb.key}
                      type="button"
                      className={`${CLASSNAME}__bandtab${bandShown.active === tb.key ? ` ${CLASSNAME}__bandtab--on` : ""}`}
                      onClick={() => pickBandTab(tb.key)}
                    >
                      {bandLabel(tb.key, tb.n)}
                    </button>
                  ))}
                </div>
              )}
              {(lanesShown.length > 0 || listsShown.length > 0 || reportsMeta.list.length > 0) && (
              <div className={`${CLASSNAME}__strip`}>
          {/* THE REPORTS TAB — the mailbox's rows, in the strip with every other kind of work.
              Same rows, same press (opens the report the way a :report chip does), same flag on an
              approval that waits; what is gone is the fold, because the tab IS the fold now. */}
          {attached && bandShown.active === "reports" && (
            <>
              {reportsMeta.list.slice(0, 30).map((r) => (
                <div
                  key={r.path}
                  className={`${CLASSNAME}__reports-row${repArmed === r.path ? " is-armed" : ""}`}
                >
                  {/* THE WHOLE ROW IS THE DOOR, FULL WIDTH. As a shrink-to-fit button the hit area
                      and the hover both stopped at the end of the text — his catch: *"the line
                      doesn't go flex all the way to the end, you gotta be over the fucking
                      text."* */}
                  <button
                    type="button"
                    className={`${CLASSNAME}__reports-open`}
                    title={r.path}
                    onClick={() => openBandReport(r.path)}
                  >
                    {reportsMeta.flags[r.path] ? <span className={`${CLASSNAME}__reports-flag`}>⚑</span> : null}
                    <span className={`${CLASSNAME}__reports-name`}>{r.name}</span>
                    {/* WHO FILED IT — the file name carries the agent and the list never said so,
                        which matters the moment two agents file into one room. */}
                    {(() => {
                      const who = String(r.path || "").match(/report\.([^.]+)\./);
                      return who ? <span className={`${CLASSNAME}__reports-who`}>{who[1]}</span> : null;
                    })()}
                    {r.ts ? <span className={`${CLASSNAME}__reports-when`}>{moment(r.ts).format("D MMM h:mm a")}</span> : null}
                  </button>
                  {/* AND A REPORT CAN BE DELETED FROM HERE. The band had no delete at all, so the
                      only way to clear a read report was the nav fold or the TV picker — this
                      presses the SAME verb (file + index entry + any show record carrying it). */}
                  <button
                    type="button"
                    className={`${CLASSNAME}__reports-del`}
                    title={repArmed === r.path ? "Click again — deletes the report file too (kept in git history)" : "Delete this report"}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (repArmed === r.path) {
                        setRepArmed("");
                        deleteReportRow(r);
                      } else setRepArmed(r.path);
                    }}
                  >
                    {repArmed === r.path ? "sure?" : "×"}
                  </button>
                </div>
              ))}
              {reportsMeta.list.length > 30 && (
                <div className={`${CLASSNAME}__reports-more`}>
                  +{reportsMeta.list.length - 30} older — the Stage tab lists them all
                </div>
              )}
            </>
          )}
          {/* ONE RENDERER FOR A LANE ROW, flat or nested — the row, its in-place panel, its
              delete. Defined here (not a component) so it closes over every handler the flat strip
              already wired. */}
          {(() => {
            const renderLaneRow = (l) => (
              <React.Fragment key={l.key}>
              <LaneRow
                source={l.source}
                items={l.items}
                projectCode={projectCode}
                repo={l.repo || ""}
                delegated={!!laneLogFor(l.source).events}
                panelOpen={lanePanel === l.key}
                onOpenPanel={() => setLanePanel((cur) => (cur === l.key ? null : l.key))}
                onDelete={async () => {
                  await work.deleteLaneRun(l.key);
                  // the session's own event echo of this run must not resurrect the row — and the
                  // transcript replays on every refresh, so this has to outlive the page.
                  setDeletedLanes((prev) => {
                    const next = new Set(prev);
                    next.add(l.key);
                    try {
                      window.localStorage.setItem(deletedLanesKey, JSON.stringify([...next]));
                    } catch {
                      /* private mode — the row stays gone for this page life, as before */
                    }
                    return next;
                  });
                  setLanePanel((cur) => (cur === l.key ? null : cur));
                }}
              />
              {/* IN THE NAV the panel expands in place, directly beneath its row. FLOATING, it
                  goes out to the chat's side with the other panels (his call); that render is in
                  the panel-anchor row further down. */}
              {inNav && lanePanel === l.key && (() => {
                const { events: laneEvents, brief: laneBrief } = laneLogFor(l.source);
                return (
                  <LanePanel
                    source={l.source}
                    items={l.items}
                    laneEvents={laneEvents}
                    brief={laneBrief}
                    projectCode={projectCode}
                    onClose={() => setLanePanel(null)}
                  />
                );
              })()}
              </React.Fragment>
            );
            const claimed = new Set(Object.values(jobLaneClaims).flat());
            const laneOf = (l) => String(l.source || "").slice(5);
            return (
              <>
                {/* IN TABS VIEW a kind shows alone; in LIST view everything stacks, which is
                    exactly what the band always did — the toggle picks between them and nothing
                    else changes. A job card still nests the lanes it cut on the jobs tab: that
                    relation is the job's, not the lane tab's. */}
                {attached && bandShown.active === "lanes" &&
                  lanesShown.filter((l) => !claimed.has(laneOf(l))).map(renderLaneRow)}
                {attached &&
                  listsShown
                    .filter((l) => bandShown.active === (l.source.startsWith("job:") ? "jobs" : "lists"))
                    .map((l) =>
                    l.source.startsWith("job:") ? (
                      <JobRun
                        key={l.key}
                        runId={l.key === "session" ? null : l.key}
                        items={l.items}
                        source={l.source}
                        projectCode={projectCode}
                        onLanes={claimLanes}
                        standingLanes={lanesShown.map(laneOf)}
                        laneCount={(jobLaneClaims[l.key] || []).length && lanesShown.filter((x) => (jobLaneClaims[l.key] || []).includes(laneOf(x))).length}
                        laneChildren={
                          <div className={`${CLASSNAME}__jobrun-lanes`}>
                            {lanesShown.filter((x) => (jobLaneClaims[l.key] || []).includes(laneOf(x))).map(renderLaneRow)}
                          </div>
                        }
                        onClear={() => setClearedLists((c) => ({ ...c, [l.key]: JSON.stringify(l.items) }))}
                      />
                    ) : (
                      <WorkList
                        key={l.key}
                        items={l.items}
                        source={l.source}
                        onClear={() => setClearedLists((c) => ({ ...c, [l.key]: JSON.stringify(l.items) }))}
                      />
                    ),
                  )}
              </>
            );
          })()}
            </div>
              )}
              {/* The whiteboard sits UNDER the list — tried on top, he wants to feel this order
                  again. Same area, different job: the list tracks the work, the board holds the
                  conversation. The wipe is the host's, so an erase clears it for both of us. */}
              <Whiteboard text={work.state.whiteboard} writeTs={work.state.whiteboardTs} onWipe={() => work.wipeWhiteboard()} />
            </div>
          )}
          {/* Closed, the band IS a label (his words) — the count rides it so "hidden" never looks
              like "nothing", and the label is the grab bar: pull up and it is already resizing. */}
          {/* THE WHOLE LABEL IS THE GRAB BAR — a 5px edge sliver was the only pull surface and it
              sat inside the chat guard's shadow; now any press on the row starts the pull, and a
              press that never moves is the click that opens. */}
          {attached && hideWork && (lanesShown.length > 0 || listsShown.length > 0 || reportsMeta.list.length > 0 || !!work.state.whiteboard) && (
            <div className={`${CLASSNAME}__workband-label`} ref={stripRef} onMouseDown={stripPull}>
              <WorkbandHead
                open={false}
                jobs={listsShown.filter((l) => l.source.startsWith("job:")).length}
                lists={listsShown.filter((l) => !l.source.startsWith("job:")).length}
                lanes={lanesShown.length}
                reports={reportsMeta.list.length}
                waiting={reportsMeta.waiting}
                onPick={pickBandTab}
                onToggle={() => setStripOpen(true)}
              />
            </div>
          )}
          {/* While the mic listens: the words appear HERE as you speak (interim), then commit
              into the input as they finalize. The line itself is the recording indicator. */}
          {listening && (
            <div className={`${CLASSNAME}__interim`}>
              <span className={`${CLASSNAME}__interim-dot`} />
              <InterimLine store={interimStore} />
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
                      // Travelling to it is seeing it — the chip has done its whole job.
                      clearSpoke(m.as);
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
                    onClick={() => clearSpoke(m.as)}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          {/* THE USAGE LINE — his ask: "a slick bar just like the compaction bar at the top that can
              show constantly, a thin line right above the input." The fill is the HIGHEST of the
              plan meters (that is the one that bites), in the ruler's colours; hover names all
              three; click opens the full report. The right end is the live ticker: tokens as the
              answer streams (chars/4 until the receipt lands), context, and this session's cost. */}
          {attached && (usage || work.state.ctx > 0) && (() => {
            // WHICH METER THE FILL TRACKS is his pick — session, week, Fable, or (default) whichever
            // is highest, because that is the one about to bite.
            const highest = usage ? usage.bars.reduce((a, b) => (b.pct > a.pct ? b : a), usage.bars[0]) : null;
            const pickRe = { session: /^session/i, week: /all models/i, fable: /fable/i }[barPrefs.fill];
            const top = (pickRe && usage && usage.bars.find((b) => pickRe.test(b.label))) || highest;
            const pct = top ? top.pct : 0;
            const tone = pct >= 90 ? "due" : pct >= 75 ? "warn" : "";
            // Only what is about the WHOLE picture lives here: the plan meter and the context.
            // A per-turn token count belongs with the turn — it rides the cooking line — and
            // cost is an API-equivalent figure that means nothing on a subscription (his call:
            // "it's not like I'm paying that much, what's the point").
            const ctxPct = work.state.ctxWindow ? Math.round((work.state.ctx / work.state.ctxWindow) * 100) : null;
            return (
              <button
                type="button"
                className={`${CLASSNAME}__usageline${tone ? ` ${CLASSNAME}__usageline--${tone}` : ""}`}
                title={usage ? usage.bars.map((b) => `${b.label}: ${b.pct}%${b.resets ? ` — resets ${b.resets}` : ""}`).join("\n") : "usage not read yet"}
                // A TOGGLE (his ask: "click it open, click it close"). Open: fetch and show; open
                // already: put the panel away.
                onClick={() => (cmdsOpen ? setCmdsOpen(false) : runSlash("/usage"))}
              >
                <span className={`${CLASSNAME}__usageline-track`}>
                  {/* THE BAR SHADES AS IT CLIMBS — its own thing, not the meters' amber/red steps
                      (his: "it has a separate color already… I want it to do its own thing").
                      It stays its blue through 60% (his: "shouldn't it still be blue at 39%?"),
                      then warms — violet, magenta, red at full — never crossing green or yellow. */}
                  <span className={`${CLASSNAME}__usageline-fill`} style={{ width: `${pct}%`, background: `hsl(${Math.round(232 + (128 * Math.max(0, Math.min(100, pct) - 60)) / 40)} 58% 60%)` }} />
                </span>
                <span className={`${CLASSNAME}__usageline-text`}>
                  {(() => {
                    if (!usage) return "usage";
                    const find = (re) => usage.bars.find((b) => re.test(b.label));
                    const session = find(/^session/i), week = find(/all models/i), fable = find(/fable/i);
                    // A SESSION RESETS IN HOURS, so its time is enough; week and Fable reset days
                    // out, and a bare "11:59pm" says nothing without the day (his catch). The date
                    // stays for those; only the filler word goes.
                    const short = resetFace;
                    // THE BAR AND THE TEXT BESIDE IT ARE ONE THING. Whatever meter the fill
                    // tracks is named FIRST, right against the bar — his: "the bar belongs to the
                    // text next to it." The rest follow in a fixed order. THE RESET RIDES WITH THE
                    // FILL, not with "session": the bar shows the meter that matters most (highest,
                    // by default), so its reset is the one he wants to see — his: "whenever
                    // something's the highest I would also be able to see when it resets."
                    // EACH METER COLOURS ITSELF, and the one tied to the bar is ONE UNIT with its
                    // reset (his rule). The whole line used to turn red when the top meter was due —
                    // so a session at 92% painted "week 22%" red too, which says something untrue
                    // about the week. Every string carries its own tone, computed from its own
                    // percentage; the fill keeps its own continuous shading, unrelated to these.
                    const toneOf = (n) => (n >= 90 ? "due" : n >= 75 ? "warn" : "");
                    const unit = (key, text, n) => (
                      <span
                        key={key}
                        className={`${CLASSNAME}__usageline-unit${toneOf(n) ? ` ${CLASSNAME}__usageline-unit--${toneOf(n)}` : ""}`}
                      >
                        {text}
                      </span>
                    );
                    const meter = (b, name) =>
                      unit(
                        name,
                        `${name} ${b.pct}%${b.pct >= 75 ? " high" : ""}${b === top && b.resets ? ` – resets ${short(b.resets, name)}` : ""}`,
                        b.pct,
                      );
                    const listed = [
                      barPrefs.session && session && ["session", session],
                      barPrefs.week && week && ["week", week],
                      barPrefs.fable && fable && ["fable", fable],
                    ].filter(Boolean);
                    const first = top ? listed.find(([, b]) => b === top) : null;
                    const parts = [];
                    if (first) parts.push(meter(first[1], first[0]));
                    else if (top) parts.push(meter(top, /fable/i.test(top.label) ? "fable" : /all models/i.test(top.label) ? "week" : "session"));
                    listed.filter((x) => x !== first).forEach(([name, b]) => parts.push(meter(b, name)));
                    if (barPrefs.ctx && ctxPct !== null) parts.push(unit("ctx", `ctx ${ctxPct}%`, ctxPct));
                    if (barPrefs.tokens) {
                      const live = work.state.state === "working" && work.state.liveChars ? Math.round(work.state.liveChars / 4) : work.state.turnOut || 0;
                      if (live) parts.push(unit("tok", `${work.state.state === "working" ? "≈" : ""}${live.toLocaleString()} tok`, 0));
                    }
                    if (barPrefs.cost && work.state.cost) parts.push(unit("cost", `$${work.state.cost.toFixed(2)}`, 0));
                    if (!parts.length) return "usage";
                    // The separator belongs BETWEEN units and to neither of them, so it never
                    // inherits a colour from the meter beside it.
                    return parts.flatMap((el, i) =>
                      i === 0 ? [el] : [<span key={`sep${i}`} className={`${CLASSNAME}__usageline-sep`}> · </span>, el],
                    );
                  })()}
                </span>
              </button>
            );
          })()}
          {/* WHAT IS GOING WITH THE NEXT MESSAGE. Above the box, because it belongs to the message
              you are still writing — and removable, because attaching the wrong screenshot should
              cost one click, not a send. */}
          {shots.length > 0 && (
            <div className={`${CLASSNAME}__shots`}>
              {shots.map((im) => (
                <div className={`${CLASSNAME}__shot`} key={im.id}>
                  <img src={im.thumb} alt={im.name} title={im.name} />
                  <button
                    type="button"
                    className={`${CLASSNAME}__shot-x`}
                    title="Remove"
                    onClick={() => setShots((cur) => cur.filter((x) => x.id !== im.id))}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          {dropping && <div className={`${CLASSNAME}__drophint`}>drop the image to attach it</div>}
          <div className={`${CLASSNAME}__inputrow`}>
            {/* A textarea that WRAPS and GROWS (to ~6 lines, then scrolls). Enter sends,
                Shift+Enter breaks a line — chat conventions. */}
            {/* TYPING `/` OPENS THE LIST. A message that starts with a slash and has no space yet is
                a command being typed — the popup shows what matches, filters as you type, and a
                pick fills the input (so arguments can follow); Enter then sends it. It suggests,
                never gates: an unlisted command still goes to the host as typed. */}
            {(() => {
              const typing = attached && /^\/[^\s]*$/.test(input);
              const matches = typing ? SLASH_COMMANDS.filter((c) => c.cmd.startsWith(input.toLowerCase())) : [];
              if (!matches.length) return null;
              const sel = Math.min(slashSel, matches.length - 1);
              return (
                <div className={`${CLASSNAME}__model-menu ${CLASSNAME}__slash-menu`}>
                  {matches.map((c, i) => (
                    <button
                      key={c.cmd}
                      type="button"
                      className={`${CLASSNAME}__model-item${i === sel ? ` ${CLASSNAME}__model-item--current` : ""}`}
                      onMouseEnter={() => setSlashSel(i)}
                      onMouseDown={(e) => e.preventDefault()} // keep the caret in the box
                      onClick={() => runSlash(c.cmd)}
                    >
                      <span className={`${CLASSNAME}__model-item-name`}>{c.cmd}</span>
                      <span className={`${CLASSNAME}__model-item-id`}>{c.what}</span>
                    </button>
                  ))}
                </div>
              );
            })()}
            {/* THE THIRD DOORWAY. Paste and drop are how you will actually do it; the clip is for
                the picture already sitting in a folder. */}
            <label className={`${CLASSNAME}__clip`} title="Attach an image">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={async (e) => {
                  const files = [...(e.target.files || [])];
                  e.target.value = "";
                  const read = [];
                  for (const f of files) {
                    try {
                      const im = await readImageFile(f);
                      if (im) read.push(im);
                    } catch {}
                  }
                  if (read.length) setShots((cur) => [...cur, ...read]);
                }}
              />
              📎
            </label>
            <textarea
              ref={inputRef}
              className={`${CLASSNAME}__input`}
              rows={1}
              value={input}
              onPaste={onPasteShots}
              placeholder={p.live ? "the agent is in — talk" : "message (delivered at the agent's next turn)"}
              onChange={(e) => {
                setInput(e.target.value);
                setSlashSel(0);
                autogrow(e.target);
              }}
              onKeyDown={(e) => {
                // The popup owns the arrow keys, Tab, Escape, and Enter while it is showing.
                const typing = attached && /^\/[^\s]*$/.test(input);
                const matches = typing ? SLASH_COMMANDS.filter((c) => c.cmd.startsWith(input.toLowerCase())) : [];
                if (matches.length) {
                  const sel = Math.min(slashSel, matches.length - 1);
                  if (e.key === "ArrowDown") { e.preventDefault(); return setSlashSel((sel + 1) % matches.length); }
                  if (e.key === "ArrowUp") { e.preventDefault(); return setSlashSel((sel - 1 + matches.length) % matches.length); }
                  if (e.key === "Escape") { e.preventDefault(); return setInput(input + " "); }
                  if (e.key === "Tab") {
                    e.preventDefault();
                    setSlashSel(0);
                    return setInput(`${matches[sel].cmd} `); // fill, for arguments
                  }
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    return runSlash(matches[sel].cmd); // a pick is the send
                  }
                }
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
              disabled={!input.trim() && !listening && !shots.length}
              title="Send"
            >
              <img src={SEND_ICON} alt="send" />
            </button>
          </div>
        </div>
          );
          return el;
        })()}
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
          style={bubbleFix(4) || (peekShift ? { marginLeft: peekShift } : undefined)}
        >
          {/* PINNED TO WHAT YOU'RE SAYING NOW. Once the transcript passes the box height the newest
              words fall below the fold, and nobody scrolls a box while they're mid-sentence — the
              whole point is watching your own message. It rides the bottom as you talk. */}
          <MicText store={interimStore} input={input} className={`${CLASSNAME}__mic-text`} />
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
          style={bubbleFix(4) || (peekShift ? { marginLeft: peekShift } : undefined)}
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
                {/* THE PREVIEW RENDERS ITS MARKDOWN (his ask): the last thing said often carries
                    bold, code, a list — as raw asterisks it read wrong. Same renderer as the
                    bubble, same three-line clamp and size as before; blocks are dropped here, a
                    preview is not the place for a file card. */}
                {brief.say && (
                  <div className={`${CLASSNAME}__brief-say`}>
                    <MarkdownScopeProvider value={{ projectCode }}>{renderChatMessage(brief.say)}</MarkdownScopeProvider>
                  </div>
                )}
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
                    title={brief.running ? "running right now" : brief.kind === "sv" ? "a SystemView action" : "finished"}
                  >
                    <span className={`${CLASSNAME}__brief-text`}>{brief.cmd}</span>
                    <span className={`${CLASSNAME}__dots`}>
                      <i />
                      <i />
                      <i />
                    </span>
                    {peekTok && <span className={`${CLASSNAME}__cooking-tok`}>{peekTok}</span>}
                  </div>
                )}
                {/* Only when there is nothing real yet — a turn that has started and produced
                    neither a sentence nor a command still has to prove it is alive. */}
                {!brief.cmd && sessionCooking && <StatusLine status={peekCookWord} tok={peekTok} />}
                {peekTodo && (
                  <div className={`${CLASSNAME}__cooking-todo`}>
                    <span className={`${CLASSNAME}__worklist-badge`}>📋</span> {peekTodo}
                  </div>
                )}
              </div>
            ) : sessionCooking ? (
              // THE PEEK'S OWN COMPONENT, unchanged — only where the sentence comes from changed.
              <>
                <StatusLine status={peekCookWord} tok={peekTok} />
                {peekTodo && (
                  <div className={`${CLASSNAME}__cooking-todo`}>
                    <span className={`${CLASSNAME}__worklist-badge`}>📋</span> {peekTodo}
                  </div>
                )}
              </>
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
                          chat. Plain text made the display a downgrade of the message it showed.
                          SCOPED, like the other three: without a project above it every ::file and
                          ::diff here falls through to the URL, and on /specs with nothing selected
                          that is no project at all — so the block draws its empty-handed state and
                          reads as "interactive markdown is broken". It was unaddressed, not broken.
                          This was the FOURTH surface; the comment on the other three said three of
                          four were fixed and this is the one that was left. */}
                      <MarkdownScopeProvider value={{ projectCode }}>
                        {renderChatMessage(String(m.text || ""))}
                      </MarkdownScopeProvider>
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
        <div className={`${CLASSNAME}__say ${leftHalf ? `${CLASSNAME}__say--right` : ""}`} style={bubbleFix(-4)}>
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
          // …and the bubble, so a MINIMISED bot carries it as well. It rides the ring rather than
          // replacing it: whatever the agent's state is, recording is additional information about
          // HIM, and losing the agent's status to show it would be a bad trade.
          className={`${CLASSNAME}__fab ${CLASSNAME}__fab--${ring}${listening ? ` ${CLASSNAME}__fab--recording` : ""}`}
          title={`${projectCode} — ${modeText}${unread ? ` — ${unread} waiting` : ""} — drag to move, release near an edge to dock`}
          // DOCKING BELONGS TO THE FACE, not to the whole bot. It used to sit on the container, so
          // a double-click that landed on the name tag or on one of the icons beside it docked the
          // agent as if you'd hit the icon itself.
          // DOUBLE-CLICK GOES BOTH WAYS (his rule): floating, it docks; docked, it comes out.
          onDoubleClick={inNav || inRail ? pullOut : dockHere}
          onClick={() => {
            if (suppressClickRef.current) return; // a drag is not a click
            // THE BOT IS THE MASTER SWITCH. Anything open — chat, TV, collector — and one click on
            // the bot puts all of it away. Closing three panels with three clicks isn't closing,
            // it's tidying. The icons beside the name tag are how you toggle one on its own.
            // …and the commands panel is one of those panels. It was added without joining this
            // list, so it outlived the click that put everything else away — his: "why is this
            // sticky? how disorganized are things that are supposed to be unified." One switch,
            // every panel, or it is not a switch.
            if (open || tvOpen || linksOpen || boardOpen || cbOpen || cmdsOpen) {
              openRef.current = false;
              setOpen(false);
              setTvOpen(false);
              setLinksOpen(false);
              setBoardOpen(false);
              setCbOpen(false);
              setCmdsOpen(false);
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
            if (fresh) openFreshShow(shows.slice(shows.indexOf(fresh)));
            else {
              setTvOpen(true);
              if (!tv) setTvPick(true);
            }
          }}
        >
          📺
        </button>
        <button
          type="button"
          className={`${CLASSNAME}__minilink${linksOpen ? ` ${CLASSNAME}__minilink--on` : ""}`}
          title="Everything dropped in this conversation — newest first"
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
        {inNav && listening && recSince > 0 && (
          <RecClock since={recSince} className={`${CLASSNAME}__rec-clock`} />
        )}
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
          className={`${CLASSNAME}__minicode${cbOpen ? ` ${CLASSNAME}__minicode--on` : ""}`}
          title="The codebase — open it, click again to put it away"
          onPointerDown={(e) => e.stopPropagation()} // the bot drags; this button does not
          onClick={(e) => {
            e.stopPropagation();
            // THE NAVIGATOR MAY NOT BE THERE. Collapsed into its corner, focusing it is a no-op you
            // can't see — so a floating bot shows the codebase itself instead, and only hands the
            // job to the nav when the nav is actually on screen.
            // THE RULE (his): if this agent's codebase is SHOWING — list view, or its own tab
            // active — the nav takes the event. If it is not showing, the bot shows its own
            // hovering codebase instead of yanking the tab: he can sit on one agent's tab and
            // still read the other codebases from their floating bots.
            let navShut = false, viewMode = "tabs", tabPc = "";
            try {
              navShut = localStorage.getItem("sv.navOpen") === "false";
              viewMode = localStorage.getItem("sv.navView") || "tabs";
              tabPc = localStorage.getItem("sv.navTabPc") || "";
            } catch {}
            const cardShowing = !navShut && (viewMode === "list" || tabPc === projectCode);
            if (!cardShowing && !inNav) {
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
        {(inNav || inRail) && (
          <button
            type="button"
            className={`${CLASSNAME}__pullout`}
            title="Pull the agent out of the codebase"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              pullOut();
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
  // RFC-062 — docked, tabs view open, no slot on screen: the bot is IN ITS TAB — not floating,
  // not portaled, not drawn. Every other case is exactly what it always was: slot → card,
  // rail spot → rail, undocked → floats.
  if (navTabsOpen && navDocked && !slotEl) return null;
  return inNav || inRail ? createPortal(body, slotEl) : body;
}
