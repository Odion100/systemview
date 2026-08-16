import React, { useState, useEffect, useRef, useContext, useMemo } from "react";
import { useHistory, useLocation, useParams } from "react-router-dom";
import ServiceContext from "../../ServiceContext";
import ReportLink from "../../atoms/Markdown/blocks/ReportLink";
import NsLink from "../../atoms/Markdown/blocks/NsLink";
import FileLink from "../../atoms/Markdown/blocks/FileLink";
import UiLink from "../../atoms/Markdown/blocks/UiLink";
import Markdown from "../../atoms/Markdown/Markdown";
import { spotlight, clearSpotlight, animationMode, setAnimationMode, MODES } from "../../spotlight";
import { resolveTarget, docRectOf, revealDocLines } from "../../spotlightTargets";
import { useAppDark } from "../../atoms/appTheme";
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
const REF_BLOCKS = { report: ReportLink, ns: NsLink, file: FileLink, ui: UiLink };
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
function renderChatMessage(text) {
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
const dockSlots = (() => {
  try {
    const o = JSON.parse(localStorage.getItem("sv.dockSlots"));
    return o && typeof o === "object" ? o : {};
  } catch {
    return {};
  }
})();
const saveDockSlots = () => {
  try { localStorage.setItem("sv.dockSlots", JSON.stringify(dockSlots)); } catch {}
};
// Only bots actually ON SCREEN count — a parked or removed project keeps its remembered slot but
// never holds one against anyone.
const mountedBots = new Set();
const dockedBots = () =>
  Object.keys(dockSlots)
    .filter((pc) => mountedBots.has(pc))
    .sort((a, b) => dockSlots[a] - dockSlots[b]);
// The lowest slot nobody is standing in — left to right, from what's free.
const freeSlot = (from = 0) => {
  const taken = new Set(dockedBots().map((pc) => dockSlots[pc]));
  for (let i = from; i < dockSlotCount(); i += 1) if (!taken.has(i)) return i;
  for (let i = 0; i < dockSlotCount(); i += 1) if (!taken.has(i)) return i;
  return from;
};
// The floor keeps bubbles, labels, AND hanging peeks clear of each other (his rule: "even if
// they're cooking... they don't end up going over each other") — sized for the 150px docked
// peek pill; the right margin keeps the line off the header's buttons.
const DOCK_MIN_SPACING = 160;
// Just enough to clear the header's right-hand buttons — it used to reserve 260, which is why the
// line stopped well short of the end and the bots never looked evenly spread across it.
const DOCK_RIGHT_MARGIN = 120;
// THEY PACK, THEY DO NOT SPREAD (his call). Sharing the full width out between however many
// bots are docked meant two bots sat at opposite ends of the screen — double-clicking one sent it
// "all the way across the room". They file in from the left at a fixed pitch instead, and the
// slot is just how many are already on the line. The pitch only tightens if the line runs out of
// room, so a full line still fits rather than walking off the edge.
const DOCK_EDGE = 6; // he asked for five to seven
// WHERE THE LINE STARTS. Not the corner: the docked peek pill is 150px centred under a 46px bot,
// so in the corner half of it hung off the left edge and the rest sat under the bubble. The line
// begins far enough in that the first bot's pill has room. This is only the SLOTS — the drag clamp
// still lets you put a bot at DOCK_EDGE by hand, so the two paddings stay the same as before.
const DOCK_START = 64;
// THE SLOTS ARE FIXED, WORKED OUT UP FRONT. There are N bots on screen, so the line has N places:
// the usable width divided by N, from the corner. Slot 2 is slot 2 whether or not anyone is
// standing in slot 1 — the first bot does NOT sit in the middle and then shuffle when a second
// arrives. Nothing here depends on how many are currently docked.
function dockSlotCount() {
  return Math.max(1, mountedBots.size);
}
function dockPitch() {
  // They span the WHOLE line: first in the corner, last at the far end, the rest equally spaced
  // between them — so the gap is the length divided by (N - 1), not by N, which left a quarter of
  // the line empty on the right.
  const n = dockSlotCount();
  const room = Math.max(window.innerWidth - DOCK_RIGHT_MARGIN - DOCK_START, DOCK_MIN_SPACING);
  return n > 1 ? Math.max(room / (n - 1), DOCK_MIN_SPACING) : 0;
}
function dockSlotPos(slot) {
  return { x: DOCK_START + slot * dockPitch(), y: DOCK_EDGE };
}
// Where the line sits, for the guide drawn while dragging.
function dockLineY() {
  return DOCK_EDGE + 23;
}
// The hub's one-hit button: every on-screen bot files into the line at once. This is the ONLY
// thing that moves bots you did not touch, and it moves them because you asked it to.
const dockAllBots = () => window.dispatchEvent(new Event("sv:dockAll"));
// Every visitor project gets ITS OWN color (his call: "everyone who's a visitor has the same
// color, so them cooking both is not as helpful") — a stable hash of the project code to a hue,
// steered off the home-agent green so a visitor never reads as the house. Same name = same color
// everywhere: bubbles, name tags, cooking lines, roster chips, system pills.
const visColor = (pc) => {
  let h = 0;
  for (const c of String(pc || "")) h = (h * 31 + c.charCodeAt(0)) % 360;
  if (Math.abs(h - 122) < 30) h = (h + 60) % 360; // keep clear of the cooking green
  return `hsl(${h}, 55%, 52%)`;
};
const visStyle = (pc) => (pc ? { "--vis": visColor(pc) } : undefined);

// Message-bubble time (his ask: "we need to see the time") — compact clock, full date on hover.
const msgTime = (ts) =>
  new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

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
            {/* One hit, everyone files into the dock line (his ask: "hit them all at once"). */}
            <button
              type="button"
              className="bot-hub__row bot-hub__row--dock-all"
              title="Send every on-screen bot to the dock line, evenly spaced"
              onClick={() => {
                dockAllBots();
                setOpen(false);
              }}
            >
              <span className="bot-hub__pc">line them up</span>
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
  // THE KICK (right-click a roster name) — the human's bouncer power; which visitor is targeted.
  const [kickTarget, setKickTarget] = useState(null);
  // Click-to-front: this bot's place in the focus order (see topZ above).
  const [z, setZ] = useState(8500);
  const bringToFront = () => setZ(++topZ);
  // Double-click the bot → take the lowest free slot and go there. Only THIS bot moves.
  const dockHere = () => {
    if (dockSlots[projectCode] === undefined) dockSlots[projectCode] = freeSlot();
    saveDockSlots();
    const p = dockSlotPos(dockSlots[projectCode]);
    setPos(p);
    try { localStorage.setItem(`sv.chatPos.${projectCode}`, JSON.stringify(p)); } catch {}
  };
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
    const dockAll = () => {
      if (dockSlots[projectCode] === undefined) dockSlots[projectCode] = freeSlot();
      saveDockSlots();
      const p = dockSlotPos(dockSlots[projectCode]);
      setPos(p);
      try { localStorage.setItem(`sv.chatPos.${projectCode}`, JSON.stringify(p)); } catch {}
    };
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
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const micSupported = !!SR;
  const toggleMic = () => {
    if (listening) {
      try { if (recRef.current) recRef.current.stop(); } catch {}
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
        } else if (args.text) {
          setTv({ id: record.id, text: args.text, label: record.label || "show" });
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

  const scrollToEnd = () => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  };
  // Opening the panel lands you at the LATEST message — the list mounts on open, so scroll after
  // it exists.
  useEffect(() => {
    if (open) setTimeout(scrollToEnd, 30);
  }, [open]);

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
          if (!dead) setTv({ id: lastShow.id, text, label: lastShow.label || "show" });
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
      setMessages((prev) => (prev.some((m) => m.id === record.id) ? prev : [...prev, record]));
      // A command MOVES the screen — that's its own notification; no unread count for it.
      if (record.kind === "command") {
        execedRef.current.add(record.id);
        execCommand(record);
      }
      else if (record.from === "agent" && !openRef.current) setUnread((n) => n + 1);
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
      // The line appears when you REACH it, not when you head that way — measured off the bot's own
      // top edge, so it shows exactly when the bot is standing on the line. A wide band around the
      // pointer had it lighting up halfway up the screen.
      d.overLine = clamp(d.origY + dy, DOCK_EDGE, window.innerHeight) <= dockLineY() + 12;
      setDragging(d.overLine);
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
      // NOTHING GRAVITATES. A drag lands where you let go — on the line, next to the line, in the
      // corner, anywhere. Dropping over the line used to pull the bot to the nearest slot, and the
      // corner IS slot 0's place, so the top strip was un-droppable: you were always pulled
      // somewhere, and if that slot was taken you got flung off to another one entirely.
      // The rings say where the places ARE. Putting yourself in one is your hand, not the app's.
      // Double-click (and the hub's dock-all) is the deliberate gesture that still moves a bot.
      const p0 = posRef.current;
      let claimed;
      if (d.overLine && p0) {
        // Landed ON a slot without being moved there → register it, so a later double-click
        // doesn't hand the same place to someone else. Registering only; no movement.
        for (let i = 0; i < dockSlotCount(); i += 1) {
          if (Math.abs(dockSlotPos(i).x - p0.x) <= 23) { claimed = i; break; }
        }
      }
      const taken = new Set(dockedBots().filter((pc) => pc !== projectCode).map((pc) => dockSlots[pc]));
      if (claimed !== undefined && !taken.has(claimed)) {
        dockSlots[projectCode] = claimed;
        saveDockSlots();
      } else if (dockSlots[projectCode] !== undefined) {
        // Dragging a docked bot away gives its slot back. Nobody else shifts to fill it — a free
        // slot just stays free until someone drops into it.
        delete dockSlots[projectCode];
        saveDockSlots();
      }
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
    const text = input.trim();
    if (!text) return;
    // Sending ends the dictation — you said what you had to say (his call). `onend` arrives a beat
    // later, so drop the flag HERE: otherwise the transcript panel hangs on screen after the
    // message is already gone, which reads as it popping up because you sent something.
    if (listening) {
      setListening(false);
      setInterim("");
      try { if (recRef.current) recRef.current.stop(); } catch {}
    }
    setInput("");
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
    try {
      // OPTIMISTIC: the returned record goes straight into the thread — your own message must
      // never depend on the push channel to become visible (his catch: send → nothing → refresh).
      const rec = await SystemView.chatSend(projectCode, { chat, from: "you", text, view });
      if (rec && rec.id)
        setMessages((prev) => (prev.some((m) => m.id === rec.id) ? prev : [...prev, rec]));
      setTimeout(scrollToEnd, 50);
    } catch {}
  };

  // RFC-031 — the roster: who's in this room besides its own agent, and where this project's
  // own agent is off visiting (both derived hub-side from real holds, so they can't lie).
  const visitors = p.visitors || [];
  const visiting = p.visiting || [];
  // Visiting counts as LIVE (his rule: "if you're visiting other people then you're actually
  // live") — a real hold somewhere is a live agent, just not in this room right now.
  // BUSY (his design: the ring answers "if I send this right now, when does it land?"): the
  // home agent's cooking line is fresh but NO line is held — really working, head down, and a
  // message will WAIT until it checks back. Derived (status ts + hold flag), so it can't lie —
  // and it's the tell for an agent that didn't re-arm before cooking (agents/chat.md step 3).
  const busy =
    !p.live && (p.statuses || []).some((s) => !s.as) && !visiting.length;
  const ring = p.live ? "live" : visiting.length ? "visiting" : busy ? "busy" : p.listener ? "listener" : "none";
  const mode = p.live ? "LIVE" : visiting.length ? "VISITING" : busy ? "BUSY" : p.listener ? "FILE" : "OFFLINE";
  const modeText = p.live
    ? visitors.length
      ? `joined — ${visitors.join(" + ")} in the room too`
      : "joined — answers now"
    : visiting.length
    ? `live — visiting ${visiting.join(", ")}`
    : busy
    ? `head down cooking — ${p.pending ? `${p.pending} message${p.pending === 1 ? "" : "s"} waiting` : "has your messages"}; replies when it surfaces`
    : p.listener
    ? `hears you at its next turn — send freely, nothing is ever lost${p.pending ? ` · ${p.pending} waiting` : ""}`
    : `out right now — your message waits in the room for its next wake${p.pending ? ` · ${p.pending} waiting` : ""}`;
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
  const openShow = React.useCallback(
    async (id, label, pristineText) => {
      let text = pristineText;
      try {
        const saved = await SystemView.chatGetTv(projectCode, { chat, show: id });
        if (saved && saved.id === id && saved.text) text = saved.text;
      } catch {
        /* hub unreachable — the pristine copy is still the right thing to show */
      }
      setTv({ id, text, label: label || "show" });
      setTvOpen(true);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [SystemView, projectCode, chat],
  );
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
  useEffect(() => {
    if (!linksOpen || !SystemView) return;
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
  }, [linksOpen, messages.length]);
  // Every show this room has had, newest first — what the TV's title picker lists. Unfiltered by
  // the collector's search box, because that box belongs to the collector.
  const shows = React.useMemo(() => {
    const src = fullHist || messages;
    return src
      .filter((m) => m.kind === "command" && m.cmd === "show" && m.args && m.args.text)
      .slice()
      .reverse();
  }, [fullHist, messages]);
  const collected = React.useMemo(() => {
    const src = fullHist || messages;
    const q = linkQ.trim().toLowerCase();
    const out = [];
    for (const m of src) {
      if (m.kind === "command") {
        if (m.cmd === "show" && m.args && m.args.text) {
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
    const wide = size.w + (tvOpen && tv ? tvSize.w + 20 : 0) + (linksOpen ? 320 : 0) - 46;
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
  // Double-click any border → back to the original size (the same convention the page's panel
  // dividers use).
  const resetSize = (setter, def, key) => () => {
    setter(def);
    try { localStorage.setItem(key, JSON.stringify(def)); } catch {}
  };
  const panelReset = resetSize(setSize, { w: 340, h: 480 }, `sv.chatSize.${projectCode}`);
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
    const room = Math.max(240, window.innerHeight - ((pos && pos.y) || 0) - 40);
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
  const docked = dockSlots[projectCode] !== undefined && !!pos && pos.y < 60;
  // THE ICONS LIVE ON THE RIGHT. They move out of the way only when something is actually in the
  // way — the message display or the live transcript, hanging on that same side. Flipping them by
  // screen half would move them for no reason half the time.
  const peekShowing = !open && (listening || (!animating && (p.status || unread > 0)));
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
  return (
    <div
      ref={rootRef}
      className={`${CLASSNAME} ${topHalf ? `${CLASSNAME}--top` : ""} ${leftHalf ? `${CLASSNAME}--left` : ""} ${flip ? `${CLASSNAME}--flipx` : ""} ${docked ? `${CLASSNAME}--docked` : ""}${saying ? ` ${CLASSNAME}--errand` : ""}${iconsLeft ? ` ${CLASSNAME}--iconsleft` : ""}`}
      style={style}
      // Touch any part of a bot — its bubble, panel, or TV — and it comes to the FRONT (his
      // ask: "if I click on it, I'm trying to be in that chat").
      onPointerDownCapture={bringToFront}
    >
      {/* The anchor also stands up for the COLLECTOR alone — the links table opens from the closed
          bot now, so it can't live behind the panel being open. */}
      {(open || linksOpen || (tvOpen && tv)) && (
        <div className={`${CLASSNAME}__panel-anchor`}>
        {/* THE TV — the show-and-tell surface beside the panel: one show at a time (the Canvas
            model), interactive markdown through the one renderer, full-border resizable.
            It stands on its own too: picking a show out of the links table with the chat closed
            has to actually put it ON, not shuffle the table sideways to make room for nothing. */}
        {tvOpen && tv && (
          <div
            data-sv="tv"
            className={`${CLASSNAME}__tv`}
            style={{
              width: tvSize.w,
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
                        openShow(s.id, s.label, s.args.text);
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
              width: 300,
              height: Math.min(480, window.innerHeight - 120),
              ...(tvOpen && tv
                ? flip
                  ? { left: "auto", right: `calc(100% + ${tvSize.w + 20}px)` }
                  : { left: `calc(100% + ${tvSize.w + 20}px)` }
                : {}),
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
                    <button
                      type="button"
                      key={e.m.id}
                      className={`${CLASSNAME}__links-item ${CLASSNAME}__links-item--show`}
                      title="Put this show back on the TV"
                      onClick={() => openShow(e.m.id, e.m.label, e.m.args.text)}
                    >
                      <span>📺 {e.m.label || "show"}</span>
                      <span className={`${CLASSNAME}__links-time`}>{msgTime(e.m.ts)}</span>
                    </button>
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
          style={{
            width: size.w,
            height: size.h,
            // It keeps the height you gave it. Tying the cap to how close the bot was to an edge is
            // what squeezed the panel as you moved down and cut its bottom off.
            maxHeight: window.innerHeight - 40,
          }}
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
          {p.records > 0 && (
            <div
              className={`${CLASSNAME}__meter`}
              title={`${p.records} records — agents compact around ${COMPACT_MARK}`}
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
            </div>
          )}
          {/* RFC-031 — the roster: every identity currently holding a line in THIS room. ALWAYS
              visible (his catch: with the strip hidden, "nobody else here" was indistinguishable
              from "did they come back?" — old name-tagged bubbles read as presence). Right-click
              a visitor = the kick menu; the × on the chip is the same bounce. */}
          {(
            <div className={`${CLASSNAME}__roster`}>
              in the room:{" "}
              {(p.live || p.listener) ? (
                <span className={`${CLASSNAME}__roster-name ${CLASSNAME}__roster-name--home`}>{projectCode}</span>
              ) : (
                <span className={`${CLASSNAME}__roster-empty`}>nobody — the agent is out</span>
              )}
              {visitors.map((v) => (
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
              ))}
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
          <div className={`${CLASSNAME}__list`} ref={listRef}>
            {messages.length === 0 && (
              <div className={`${CLASSNAME}__empty`}>
                Say something — it arrives with where you're standing (page, tab, namespace).
              </div>
            )}
            {messages.map((m) =>
              m.kind === "command" ? (
                m.cmd === "show" && m.args && m.args.text ? (
                  // A SHOW is a clickable line — the Canvas model: click any show in history and
                  // THAT show goes (back) on the TV.
                  <button
                    type="button"
                    key={m.id}
                    className={`${CLASSNAME}__cmd ${CLASSNAME}__cmd--show ${tv && tv.id === m.id && tvOpen ? `${CLASSNAME}__cmd--live` : ""}`}
                    title="Put this show on the TV"
                    onClick={() => openShow(m.id, m.label, m.args.text)}
                  >
                    <span className={`${CLASSNAME}__cmd-arrow`}>📺</span> {m.label || "show"}
                  </button>
                ) : (
                  // A command shows AS a command — the window moved because the agent moved it, and
                  // this line is the receipt. CLICK IT TO RUN IT AGAIN (his ask, for exactly the
                  // loop we're in: watch it, change the styling, watch it again without asking me
                  // to resend). It re-executes locally; it never writes a new record, so replaying
                  // a trip twenty times leaves the room exactly as long as it was.
                  <button
                    type="button"
                    key={m.id}
                    className={`${CLASSNAME}__cmd ${CLASSNAME}__cmd--replay`}
                    title={`Run it again — ${m.cmd}`}
                    onClick={() => execCommand(m, { replay: true })}
                  >
                    <span className={`${CLASSNAME}__cmd-arrow`}>→</span>{" "}
                    {m.label || `${m.cmd} ${JSON.stringify(m.args || {})}`}
                    <span className={`${CLASSNAME}__cmd-replay`}>↻</span>
                  </button>
                )
              ) : m.kind === "system" ? (
                // RFC-031 — the room announces comings and goings itself: a subtle centered line,
                // no bubble, no unread. "He just said he's leaving, cool — what if someone just
                // leaves? You need to SEE it."
                <div key={m.id} className={`${CLASSNAME}__sys`} style={visStyle(m.who)} title={new Date(m.ts).toLocaleString()}>
                  {m.text}
                </div>
              ) : (
                // RFC-031 — a VISITOR's bubble wears its project's name; the room's own agent
                // stays unlabeled (records without `as` are the room's agent from before identities).
                <div
                  key={m.id}
                  className={`${CLASSNAME}__msg ${
                    m.from === "agent" ? `${CLASSNAME}__msg--agent` : `${CLASSNAME}__msg--you`
                  }${m.from === "agent" && m.as && m.as !== projectCode ? ` ${CLASSNAME}__msg--visitor` : ""}`}
                  style={m.from === "agent" && m.as && m.as !== projectCode ? visStyle(m.as) : undefined}
                >
                  {m.from === "agent" && m.as && m.as !== projectCode && (
                    <span className={`${CLASSNAME}__visitor-tag`}>{m.as}</span>
                  )}
                  {renderChatMessage(String(m.text || ""))}
                  {/* the time, quietly in the corner — hover for the full date. Your bubbles
                      also carry a READ receipt (his ask): ✓✓ once the agent has actually
                      DRAINED past this message; a dot while it's still queued. */}
                  <span className={`${CLASSNAME}__msg-time`} title={new Date(m.ts).toLocaleString()}>
                    {m.from === "you" &&
                      ((p.agentSeen || 0) >= m.ts ? (
                        <span className={`${CLASSNAME}__read`} title="seen — the agent has collected this">✓✓ </span>
                      ) : (
                        <span className={`${CLASSNAME}__read ${CLASSNAME}__read--queued`} title="sent — waiting for the agent to collect it">✓ </span>
                      ))}
                    {msgTime(m.ts)}
                  </span>
                </div>
              ),
            )}
            {/* Every identity cooking gets its OWN line (his catch: one shared line meant
                simultaneous cooks erased each other) — home first, visitors in plum below. */}
            {(p.statuses || (p.status ? [{ as: p.statusAs, text: p.status }] : [])).map((s) => (
              <StatusLine
                key={s.as || "home"}
                status={s.text}
                visitor={s.as && s.as !== projectCode ? s.as : null}
              />
            ))}
          </div>
          {/* While the mic listens: the words appear HERE as you speak (interim), then commit
              into the input as they finalize. The line itself is the recording indicator. */}
          {listening && (
            <div className={`${CLASSNAME}__interim`}>
              <span className={`${CLASSNAME}__interim-dot`} />
              {interim || "listening…"}
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
            <button type="button" className={`${CLASSNAME}__send`} onClick={send} disabled={!input.trim()} title="Send">
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
              disabled={!input.trim()}
              onClick={send}
            >
              send
            </button>
          </div>
        </div>
      )}
      {!open && !animating && !listening && (p.status || unread > 0) && (
        <div
          className={`${CLASSNAME}__peek ${unread > 0 ? `${CLASSNAME}__peek--thread` : ""} ${leftHalf ? `${CLASSNAME}__peek--right` : ""}`}
          style={peekShift ? { marginLeft: peekShift } : undefined}
          onClick={() => {
            openRef.current = true;
            setOpen(true);
            setUnread(0);
            try { localStorage.setItem(`sv.chatSeen.${projectCode}`, String(Date.now())); } catch {}
          }}
        >
          {!unread ? (
            // Closed ≠ blind (his ask: the peek shows MORE): every live cooking line stacks
            // here — home first, visitors named in plum — so a closed chat still tells you
            // who's cooking on what. A waiting CONVERSATION outranks it: the thread is the chat.
            (p.statuses && p.statuses.length ? p.statuses : [{ as: p.statusAs, text: p.status }]).map((s) => (
              <StatusLine
                key={s.as || "home"}
                status={s.text}
                visitor={s.as && s.as !== projectCode ? s.as : null}
              />
            ))
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
      {/* THE DOCK LINE while you drag near it, and EVERY SLOT ON IT. All of them, up front: there
          are N bots on screen so the line has N places, and they don't move as bots arrive. You can
          see the whole line and pick a spot instead of dropping one and finding out. */}
      {dragging && (
        <>
          <div className={`${CLASSNAME}__dockline`} style={{ top: dockLineY() }} aria-hidden="true" />
          {Array.from({ length: dockSlotCount() }).map(
            (_, i) => {
              const sp = dockSlotPos(i);
              return (
                <div
                  key={i}
                  className={`${CLASSNAME}__dockslot`}
                  style={{ left: sp.x, top: sp.y }}
                  aria-hidden="true"
                />
              );
            },
          )}
        </>
      )}
      {/* WHICH bot. Several projects are open at once, each with its own icon in the DOM, and a bare
          [data-sv="bot"] lookup finds whichever mounted first — so the line came out of buAPI's icon
          while systemview-test was the one talking. */}
      <div
        data-sv="bot"
        data-sv-pc={projectCode}
        className={`${CLASSNAME}__bot`}
        onPointerDown={onBotPointerDown}
        onDoubleClick={dockHere}
        onContextMenu={(e) => {
          e.preventDefault();
          setCtxMenu(true);
        }}
      >
        <button
          type="button"
          className={`${CLASSNAME}__fab ${CLASSNAME}__fab--${ring}`}
          title={`${projectCode} — ${modeText}${unread ? ` — ${unread} waiting` : ""} — drag to move, release near an edge to dock`}
          onClick={() => {
            if (suppressClickRef.current) return; // a drag is not a click
            // THE BOT IS THE MASTER SWITCH. Anything open — chat, TV, collector — and one click on
            // the bot puts all of it away. Closing three panels with three clicks isn't closing,
            // it's tidying. The icons beside the name tag are how you toggle one on its own.
            if (open || tvOpen || linksOpen) {
              openRef.current = false;
              setOpen(false);
              setTvOpen(false);
              setLinksOpen(false);
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
          {unread > 0 && !animating && <span className={`${CLASSNAME}__unread`}>{unread}</span>}
          {/* RFC-031 — a visit never hides behind a closed panel: the plum shoulder badge says
              someone's in this room right now; hover names them. */}
          {visitors.length > 0 && (
            <span className={`${CLASSNAME}__visitors-badge`} title={`in the room: ${visitors.join(", ")}`}>
              ✦{visitors.length > 1 ? visitors.length : ""}
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
            if (tvOpen) {
              setTvOpen(false);
              if (endErrandRef.current) endErrandRef.current(true);
              return;
            }
            // Nothing on it yet — put the latest show up rather than opening an empty box.
            if (!tv && shows.length) openShow(shows[0].id, shows[0].label, shows[0].args.text);
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
            setLinksOpen((v) => !v);
          }}
        >
          🔗
        </button>
        {!open && micSupported && (
          <button
            type="button"
            className={`${CLASSNAME}__minimic${listening ? ` ${CLASSNAME}__minimic--on` : ""}`}
            title={listening ? "Stop recording" : "Record a message without opening the chat"}
            onPointerDown={(e) => e.stopPropagation()} // the bot drags; this button does not
            onClick={(e) => {
              e.stopPropagation();
              toggleMic();
            }}
          >
            🎙
          </button>
        )}
      </div>
    </div>
  );
}
