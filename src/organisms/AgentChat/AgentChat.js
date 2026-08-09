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
const dockOrder = (() => {
  try {
    const a = JSON.parse(localStorage.getItem("sv.dockOrder"));
    return Array.isArray(a) ? a : [];
  } catch {
    return [];
  }
})();
const saveDockOrder = () => {
  try { localStorage.setItem("sv.dockOrder", JSON.stringify(dockOrder)); } catch {}
};
// Only bots actually ON SCREEN count toward the spread — a parked or removed project keeps its
// remembered place in dockOrder but never skews the spacing.
const mountedBots = new Set();
const dockedBots = () => dockOrder.filter((pc) => mountedBots.has(pc));
// The floor keeps bubbles, labels, AND hanging peeks clear of each other (his rule: "even if
// they're cooking... they don't end up going over each other") — sized for the 150px docked
// peek pill; the right margin keeps the line off the header's buttons.
const DOCK_MIN_SPACING = 160;
const DOCK_RIGHT_MARGIN = 260;
function dockSlotPos(slot, count) {
  const v = document.querySelector(".page-header__version");
  const startX = v ? v.getBoundingClientRect().right + 14 : 150;
  const span = Math.max(window.innerWidth - DOCK_RIGHT_MARGIN - startX, DOCK_MIN_SPACING);
  const gap = count > 1 ? Math.max(span / (count - 1), DOCK_MIN_SPACING) : 0;
  return { x: startX + slot * gap, y: 6 };
}
const relayoutDock = () => window.dispatchEvent(new Event("sv:dockLine"));
// The hub's one-hit button: every on-screen bot files into the line at once.
const dockAllBots = () => {
  window.dispatchEvent(new Event("sv:dockAll"));
  relayoutDock();
};
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
  // THE KICK (right-click a roster name) — the human's bouncer power; which visitor is targeted.
  const [kickTarget, setKickTarget] = useState(null);
  // Click-to-front: this bot's place in the focus order (see topZ above).
  const [z, setZ] = useState(8500);
  const bringToFront = () => setZ(++topZ);
  // Double-click the bot → join the dock line (keeps an existing slot). The relayout broadcast
  // re-spaces EVERYONE — the whole line shifts to share the width evenly (dock v2).
  const dockHere = () => {
    if (!dockOrder.includes(projectCode)) dockOrder.push(projectCode);
    saveDockOrder();
    relayoutDock();
  };
  // Dock-line membership: every relayout broadcast (a dock, an undock, dock-all, a window
  // resize, a reload) snaps this bot to its CURRENT slot in the CURRENT window width. Runs
  // once on mount too — that's what makes the line survive a reload.
  useEffect(() => {
    mountedBots.add(projectCode);
    const relayout = () => {
      const order = dockedBots();
      const slot = order.indexOf(projectCode);
      if (slot < 0) return;
      const p = dockSlotPos(slot, order.length);
      setPos(p);
      try { localStorage.setItem(`sv.chatPos.${projectCode}`, JSON.stringify(p)); } catch {}
    };
    const dockAll = () => {
      if (!dockOrder.includes(projectCode)) dockOrder.push(projectCode);
      saveDockOrder();
    };
    window.addEventListener("sv:dockLine", relayout);
    window.addEventListener("sv:dockAll", dockAll);
    window.addEventListener("resize", relayout);
    relayout();
    return () => {
      mountedBots.delete(projectCode);
      window.removeEventListener("sv:dockLine", relayout);
      window.removeEventListener("sv:dockAll", dockAll);
      window.removeEventListener("resize", relayout);
      setTimeout(relayoutDock, 0); // a parked bot frees its width for the rest of the line
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectCode]);
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
      // Dragging a docked bot away gives up its dock-line slot — and the rest of the line
      // re-spaces into the freed width.
      const di = dockOrder.indexOf(projectCode);
      if (di >= 0) {
        dockOrder.splice(di, 1);
        saveDockOrder();
        relayoutDock();
      }
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
  const leftHalf = pos ? pos.x < window.innerWidth / 2 : false;
  const topHalf = pos ? pos.y < window.innerHeight / 2 : false;

  // THE COLLECTOR — every link/show in the room, resurfaceable (his ask). Opening it fetches
  // the WHOLE file (the thread itself caps at 200), then it's a pure lens over those records.
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
  const collected = React.useMemo(() => {
    const src = fullHist || messages;
    const q = linkQ.trim().toLowerCase();
    const out = [];
    for (const m of src) {
      if (m.kind === "command") {
        if (m.cmd === "show" && m.args && m.args.text) {
          if (!q || String(m.label || "show").toLowerCase().includes(q) || String(m.args.text).toLowerCase().includes(q))
            out.push({ kind: "show", m });
        }
        continue;
      }
      if (m.kind === "system") continue;
      if (q && !String(m.text || "").toLowerCase().includes(q)) continue;
      // Chips only — renderChatText returns strings for prose and elements for links/reports.
      const parts = renderChatText(String(m.text || "")).filter((p) => typeof p !== "string");
      if (parts.length) out.push({ kind: "links", m, parts });
    }
    return out.reverse(); // newest first — "I want that link again" is usually a recent one
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
  // The TV's double-click means "give me my natural FLEX size" (his call, matching the story
  // panes) — PER AXIS: the edge you double-click hands back its own dimension (side = width,
  // top/bottom = height, corner = both), and the TV header flexes the whole thing at once.
  const tvReset = (mw = 1, mh = 1) => {
    const nat = {
      w: mw ? Math.max(280, Math.min(window.innerWidth - size.w - 140, 1280)) : tvSize.w,
      h: mh ? Math.max(360, window.innerHeight - 120) : tvSize.h,
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
  const docked = dockOrder.includes(projectCode) && !!pos && pos.y < 60;
  return (
    <div
      ref={rootRef}
      className={`${CLASSNAME} ${topHalf ? `${CLASSNAME}--top` : ""} ${leftHalf ? `${CLASSNAME}--left` : ""} ${docked ? `${CLASSNAME}--docked` : ""}`}
      style={style}
      // Touch any part of a bot — its bubble, panel, or TV — and it comes to the FRONT (his
      // ask: "if I click on it, I'm trying to be in that chat").
      onPointerDownCapture={bringToFront}
    >
      {open && (
        <div className={`${CLASSNAME}__panel-anchor`}>
        {/* THE TV — the show-and-tell surface beside the panel: one show at a time (the Canvas
            model), interactive markdown through the one renderer, full-border resizable. */}
        {tvOpen && tv && (
          <div className={`${CLASSNAME}__tv`} style={{ width: tvSize.w, height: tvSize.h }}>
            <ResizeBorder start={tvResize} onReset={tvReset} />
            {/* Double-click the header → the whole TV takes its natural flex size (his call). */}
            <div
              className={`${CLASSNAME}__tv-head`}
              title="Double-click for natural size"
              onDoubleClick={() => tvReset(1, 1)}
            >
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
            className={`${CLASSNAME}__tv ${CLASSNAME}__links`}
            style={{
              width: 300,
              height: Math.min(480, window.innerHeight - 120),
              ...(tvOpen && tv
                ? leftHalf
                  ? { left: `calc(100% + ${tvSize.w + 20}px)` }
                  : { right: `calc(100% + ${tvSize.w + 20}px)` }
                : {}),
            }}
          >
            <div className={`${CLASSNAME}__tv-head`}>
              <span className={`${CLASSNAME}__tv-badge`}>🔗</span>
              <span className={`${CLASSNAME}__tv-title`}>links & shows</span>
              <button
                type="button"
                className={`${CLASSNAME}__close`}
                title="Close"
                onClick={() => setLinksOpen(false)}
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
                      onClick={() => {
                        setTv({ id: e.m.id, text: e.m.args.text, label: e.m.label || "show" });
                        setTvOpen(true);
                      }}
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
            {/* the collector — every link & show from this room, in a side panel like the TV */}
            <button
              type="button"
              className={`${CLASSNAME}__close ${CLASSNAME}__links-btn${linksOpen ? ` ${CLASSNAME}__links-btn--on` : ""}`}
              title="All links & shows sent in this room"
              onClick={() => setLinksOpen((v) => !v)}
            >
              🔗
            </button>
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
                  {renderChatText(String(m.text || ""))}
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
            // Closed ≠ blind (his ask: the peek shows MORE): every live cooking line stacks
            // here — home first, visitors named in plum — so a closed chat still tells you
            // who's cooking on what.
            (p.statuses && p.statuses.length ? p.statuses : [{ as: p.statusAs, text: p.status }]).map((s) => (
              <StatusLine
                key={s.as || "home"}
                status={s.text}
                visitor={s.as && s.as !== projectCode ? s.as : null}
              />
            ))
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
          {/* RFC-031 — a visit never hides behind a closed panel: the plum shoulder badge says
              someone's in this room right now; hover names them. */}
          {visitors.length > 0 && (
            <span className={`${CLASSNAME}__visitors-badge`} title={`in the room: ${visitors.join(", ")}`}>
              ✦{visitors.length > 1 ? visitors.length : ""}
            </span>
          )}
        </button>
        <span className={`${CLASSNAME}__label`}>{projectCode}</span>
      </div>
    </div>
  );
}
