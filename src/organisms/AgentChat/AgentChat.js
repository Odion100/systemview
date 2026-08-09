import React, { useState, useEffect, useRef, useContext, useMemo } from "react";
import { useHistory, useLocation, useParams } from "react-router-dom";
import ServiceContext from "../../ServiceContext";
import ReportLink from "../../atoms/Markdown/blocks/ReportLink";
import Markdown from "../../atoms/Markdown/Markdown";
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
const SNAP = 72; // release within this of an edge → dock to it
const STACK = 78; // default vertical spacing per undragged bot

// Chat messages are PLAIN TEXT — bubbles stay bubbles (full markdown in bubbles was tried and
// looked wrong; his call). The ONE enrichment is links: a `:report[path]{title="…"}` chip,
// `[text](url)` links, and bare URLs render clickable; everything else is verbatim pre-wrap text.
const LINKISH =
  /:report\[([^\]]+)\](?:\{([^}]*)\})?|\[([^\]]+)\]\((\/[^)\s]+|https?:\/\/[^)\s]+)\)|(https?:\/\/[^\s]+)/g;

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
function renderChatText(text) {
  const out = [];
  let last = 0;
  let k = 0;
  let m;
  LINKISH.lastIndex = 0;
  while ((m = LINKISH.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined) {
      const attrs = {};
      const t = (m[2] || "").match(/title=(?:"([^"]*)"|'([^']*)'|([^\s}]+))/);
      if (t) attrs.title = t[1] || t[2] || t[3];
      out.push(<ReportLink key={k++} label={m[1]} attrs={attrs} />);
    } else if (m[3] !== undefined) {
      out.push(
        <ChatLink key={k++} href={m[4]}>
          {m[3]}
        </ChatLink>,
      );
    } else {
      const short = m[5].replace(/^https?:\/\//, "").replace(/\/$/, "");
      out.push(
        <ChatLink key={k++} href={m[5]}>
          {short.length > 42 ? `${short.slice(0, 40)}…` : short}
        </ChatLink>,
      );
    }
    last = LINKISH.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
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
const ResizeBorder = ({ start, onReset }) =>
  RESIZE_ZONES.map((z) => (
    <div
      key={z.k}
      className={`${CLASSNAME}__rz ${CLASSNAME}__rz--${z.k}`}
      title="Drag to resize · double-click to reset"
      onPointerDown={start(z.mw, z.mh)}
      onDoubleClick={onReset}
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
const COOKING = ["thinking", "cooking", "working on it", "chewing on it", "still at it"];
function StatusLine({ status }) {
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
  return (
    <div className="agent-chat__status">
      {text}
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
  const { connectedServices } = useContext(ServiceContext);
  const [open, setOpen] = useState(false);
  const [, force] = useState(0);
  useEffect(() => {
    const on = () => force((n) => n + 1);
    window.addEventListener("sv:botHub", on);
    return () => window.removeEventListener("sv:botHub", on);
  }, []);
  const projects = [...new Set((connectedServices || []).map((s) => s.projectCode))];
  if (!projects.length) return null;
  const parkedCount = projects.filter(isParked).length;
  return (
    <span className="bot-hub">
      <button
        type="button"
        className="bot-hub__btn"
        title="The agent hub — every bot lives here; parked ones wait here"
        onClick={() => setOpen(!open)}
      >
        🤖
        {parkedCount > 0 && <span className="bot-hub__count">{parkedCount}</span>}
      </button>
      {open && (
        <>
          <div className="bot-hub__overlay" onClick={() => setOpen(false)} />
          <div className="bot-hub__menu">
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
  const { serviceId, moduleName, methodName } = useParams();
  const { SystemViewService } = useContext(ServiceContext);
  const { SystemView } = SystemViewService;
  const [open, setOpen] = useState(false);
  const [ctxMenu, setCtxMenu] = useState(false);
  const [messages, setMessages] = useState([]);
  const inputRef = useRef(null);

  // VOICE — the mic (browser-native speech recognition). Press to listen, transcripts land in
  // the input (editable before send), press again to stop. Input only — no TTS, no duplex.
  const recRef = useRef(null);
  const [listening, setListening] = useState(false);
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
        x: Math.max(EDGE, Math.min(saved.x, window.innerWidth - 96 - EDGE)),
        y: Math.max(EDGE, Math.min(saved.y, window.innerHeight - 72 - EDGE)),
      };
    } catch { return null; }
  });
  const listRef = useRef(null);
  const rootRef = useRef(null);
  const dragRef = useRef(null);
  const chat = "main";
  const p = (presence && presence[chat]) || { live: false, listener: false, status: null };

  // RFC-029 — THE EXECUTOR. Commands execute ONLY here, off the live push; loading history
  // renders old command lines but never re-executes them (the replay rule — a refresh must not
  // replay every place the agent ever sent you). Reads window.location, not the hook — a command
  // can arrive long after this closure was made.
  const execCommand = (record) => {
    const { cmd, args = {} } = record || {};
    try {
      if (cmd === "nav") {
        if (args.file) {
          // Open the file by URL DIRECTLY — the same params SystemView.openFile writes (the
          // event-based open silently didn't land; the URL door is the proven one). Mirrors
          // openFile: remember the lens/tab we came from, flip the center to Code.
          const p = new URLSearchParams(window.location.search);
          if (!p.get("file")) {
            p.set("fnav", "files");
            p.set("ftab", p.get("tab") || "docs");
          }
          p.set("tab", "docs");
          p.delete("help");
          p.set("file", args.file);
          p.set("fproj", projectCode);
          if (args.lines && args.lines[0]) p.set("flines", args.lines.join("-"));
          else p.delete("flines");
          const pathname = window.location.pathname.startsWith(`/specs/${projectCode}`)
            ? window.location.pathname
            : `/specs/${projectCode}`;
          history.push({ pathname, search: `?${p.toString()}` });
          // …and point the TREE at it too — expands to and highlights the file (the part he
          // called out as "very cool, keep").
          window.dispatchEvent(
            new CustomEvent("sv:revealInNav", {
              detail: { kind: "file", path: args.file, projectCode },
            }),
          );
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
          params.set("rdoc", args.report);
        }
        if (args.tab) params.set("tab", args.tab);
        if (args.help) params.set("help", args.help);
        history.push({ pathname, search: `?${params.toString()}` });
      } else if (cmd === "highlight") {
        // POINT, don't navigate — his rule: highlight and selection are two different commands.
        // The tree expands to the target, marks it, scrolls it into view; the center is untouched.
        if (args.file) {
          window.dispatchEvent(
            new CustomEvent("sv:revealInNav", {
              detail: { kind: "file", path: args.file, projectCode },
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
            history.push({ pathname: `/specs/${projectCode}`, search: window.location.search });
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
        if (lastShow)
          setTv({ id: lastShow.id, text: lastShow.args.text, label: lastShow.label || "show" });
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
      } catch {}
    };
    const timer = setInterval(refetchPresence, 10000);
    window.addEventListener("focus", refetchPresence);
    const unsubMsg = SystemView.on(`chat-updated:${projectCode}`, ({ record }) => {
      setMessages((prev) => (prev.some((m) => m.id === record.id) ? prev : [...prev, record]));
      // A command MOVES the screen — that's its own notification; no unread count for it.
      if (record.kind === "command") execCommand(record);
      else if (record.from === "agent" && !openRef.current) setUnread((n) => n + 1);
      if (openRef.current) {
        try { localStorage.setItem(`sv.chatSeen.${projectCode}`, String(record.ts)); } catch {}
      }
      setTimeout(scrollToEnd, 50);
    });
    const unsubStatus = SystemView.on(`chat-status:${projectCode}`, ({ text }) => {
      setPresence((prev) => ({ ...prev, [chat]: { ...(prev[chat] || {}), status: text } }));
    });
    // Presence PUSHES on join/leave/drain — the ring flips the moment it happens, no refresh.
    const unsubPresence = SystemView.on(`chat-presence:${projectCode}`, (pres) => {
      if (!dead && pres) setPresence(pres);
    });
    return () => {
      dead = true;
      clearInterval(timer);
      window.removeEventListener("focus", refetchPresence);
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
  const onBotPointerDown = (e) => {
    const el = rootRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: r.left, origY: r.top, w: r.width, h: r.height, moved: false };
    const move = (ev) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = ev.clientX - d.startX;
      const dy = ev.clientY - d.startY;
      if (!d.moved && Math.abs(dx) + Math.abs(dy) < 6) return;
      d.moved = true;
      setPos({ x: d.origX + dx, y: d.origY + dy });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      const d = dragRef.current;
      dragRef.current = null;
      if (!d || !d.moved) return;
      suppressClickRef.current = true;
      setTimeout(() => { suppressClickRef.current = false; }, 0);
      // DOCK: snap flush to any edge released near; clamp inside the viewport; remember the spot.
      setPos((cur) => {
        if (!cur) return cur;
        let { x, y } = cur;
        const W = window.innerWidth;
        const H = window.innerHeight;
        if (x < SNAP) x = EDGE;
        else if (x > W - d.w - SNAP) x = W - d.w - EDGE;
        if (y < SNAP) y = EDGE;
        else if (y > H - d.h - SNAP) y = H - d.h - EDGE;
        const snapped = { x: clamp(x, EDGE, W - d.w - EDGE), y: clamp(y, EDGE, H - d.h - EDGE) };
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
    // Sending ends the dictation — you said what you had to say (his call).
    if (listening) {
      try { if (recRef.current) recRef.current.stop(); } catch {}
    }
    setInput("");
    // Shrink the grown textarea back to one line — HERE, so every send path (Enter, the send
    // button, mic flows) resets it, not just the keyboard one.
    if (inputRef.current) inputRef.current.style.height = "auto";
    // The vantage point, stamped NOW — the reader arrives later, after you've moved on.
    // RFC-029: the THREE-SECTION breakdown (nav / center / scratchpad), mostly a URL decode —
    // "on stage" says WHICH report, "in the scratchpad" says which namespace it's pointed at.
    const params = new URLSearchParams(location.search);
    const nsSelected = [serviceId, moduleName, methodName].filter(Boolean).join("/") || null;
    const view = {
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
      await SystemView.chatSend(projectCode, { chat, from: "you", text, view });
    } catch {}
  };

  const ring = p.live ? "live" : p.listener ? "listener" : "none";
  const mode = p.live ? "LIVE" : p.listener ? "FILE" : "OFFLINE";
  const modeText = p.live
    ? "joined — answers now"
    : p.listener
    ? "listening by file — hears you at its next turn"
    : "no agent connected";
  const leftHalf = pos ? pos.x < window.innerWidth / 2 : false;
  const topHalf = pos ? pos.y < window.innerHeight / 2 : false;

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
    try {
      const s = JSON.parse(localStorage.getItem(`sv.tvSize.${projectCode}`));
      if (s && s.w && s.h) return s;
    } catch {}
    return { w: 430, h: 480 };
  });
  const makeResize = (getStart, apply, persistKey) => (mw, mh) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    const start = { x: e.clientX, y: e.clientY, ...getStart() };
    let latest = null;
    const move = (ev) => {
      latest = {
        w: Math.min(820, Math.max(240, start.w + mw * (ev.clientX - start.x))),
        h: Math.min(window.innerHeight - 90, Math.max(200, start.h + mh * (ev.clientY - start.y))),
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
  const panelResize = makeResize(() => size, setSize, `sv.chatSize.${projectCode}`);
  const tvResize = makeResize(() => tvSize, setTvSize, `sv.tvSize.${projectCode}`);
  // Double-click any border → back to the original size (the same convention the page's panel
  // dividers use).
  const resetSize = (setter, def, key) => () => {
    setter(def);
    try { localStorage.setItem(key, JSON.stringify(def)); } catch {}
  };
  const panelReset = resetSize(setSize, { w: 340, h: 480 }, `sv.chatSize.${projectCode}`);
  const tvReset = resetSize(setTvSize, { w: 430, h: 480 }, `sv.tvSize.${projectCode}`);
  const style = pos
    ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto" }
    : { bottom: EDGE + index * STACK };
  return (
    <div
      ref={rootRef}
      className={`${CLASSNAME} ${topHalf ? `${CLASSNAME}--top` : ""} ${leftHalf ? `${CLASSNAME}--left` : ""}`}
      style={style}
    >
      {open && (
        <div className={`${CLASSNAME}__panel-anchor`}>
        {/* THE TV — the show-and-tell surface beside the panel: one show at a time (the Canvas
            model), interactive markdown through the one renderer, full-border resizable. */}
        {tvOpen && tv && (
          <div className={`${CLASSNAME}__tv`} style={{ width: tvSize.w, height: tvSize.h }}>
            <ResizeBorder start={tvResize} onReset={tvReset} />
            <div className={`${CLASSNAME}__tv-head`}>
              <span className={`${CLASSNAME}__tv-badge`}>📺</span>
              <span className={`${CLASSNAME}__tv-title`}>{tv.label || "show"}</span>
              <button
                type="button"
                className={`${CLASSNAME}__close`}
                title="Close the TV — any show line in the chat brings it back"
                onClick={() => setTvOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className={`${CLASSNAME}__tv-body`}>
              <Markdown dark={appDark} scope={{ projectCode }}>{tv.text}</Markdown>
            </div>
          </div>
        )}
        <div
          className={`${CLASSNAME}__panel`}
          // A free-parked bubble may not have the panel's height of room on its open side — cap
          // to the space that actually exists so it never runs off the top or bottom.
          style={{
            width: size.w,
            height: size.h,
            maxHeight: pos
              ? Math.min(
                  size.h,
                  Math.max(200, topHalf ? window.innerHeight - pos.y - 100 : pos.y - 16),
                )
              : undefined,
          }}
        >
          <ResizeBorder start={panelResize} onReset={panelReset} />
          <div className={`${CLASSNAME}__head`}>
            <span className={`${CLASSNAME}__mode ${CLASSNAME}__mode--${ring}`}>{mode}</span>
            <span className={`${CLASSNAME}__title`}>{projectCode}</span>
            <span className={`${CLASSNAME}__presence`}>{modeText}</span>
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
                    onClick={() => {
                      setTv({ id: m.id, text: m.args.text, label: m.label || "show" });
                      setTvOpen(true);
                    }}
                  >
                    <span className={`${CLASSNAME}__cmd-arrow`}>📺</span> {m.label || "show"}
                  </button>
                ) : (
                  // A command shows AS a command — the window moved because the agent moved it,
                  // and this line is the receipt.
                  <div key={m.id} className={`${CLASSNAME}__cmd`} title={m.cmd}>
                    <span className={`${CLASSNAME}__cmd-arrow`}>→</span>{" "}
                    {m.label || `${m.cmd} ${JSON.stringify(m.args || {})}`}
                  </div>
                )
              ) : (
                <div
                  key={m.id}
                  className={`${CLASSNAME}__msg ${m.from === "agent" ? `${CLASSNAME}__msg--agent` : `${CLASSNAME}__msg--you`}`}
                >
                  {renderChatText(String(m.text || ""))}
                </div>
              ),
            )}
            {p.status && <StatusLine status={p.status} />}
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
        </div>
      )}
      {/* PEEK — the closed bubble still talks: while cooking, the status sticks out beside it;
          when a reply lands unseen, a green preview of the message does. Click = open. */}
      {!open && (p.status || unread > 0) && (
        <div
          className={`${CLASSNAME}__peek ${leftHalf ? `${CLASSNAME}__peek--right` : ""}`}
          onClick={() => {
            openRef.current = true;
            setOpen(true);
            setUnread(0);
            try { localStorage.setItem(`sv.chatSeen.${projectCode}`, String(Date.now())); } catch {}
          }}
        >
          {p.status ? (
            <StatusLine status={p.status} />
          ) : (
            <span className={`${CLASSNAME}__peek-msg`}>
              {[...messages].reverse().find((m) => m.from === "agent")?.text || "new reply"}
            </span>
          )}
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
      <div
        className={`${CLASSNAME}__bot`}
        onPointerDown={onBotPointerDown}
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
          {unread > 0 && <span className={`${CLASSNAME}__unread`}>{unread}</span>}
        </button>
        <span className={`${CLASSNAME}__label`}>{projectCode}</span>
      </div>
    </div>
  );
}
