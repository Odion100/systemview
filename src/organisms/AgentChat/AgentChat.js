import React, { useState, useEffect, useRef, useContext, useMemo } from "react";
import { useLocation, useParams } from "react-router-dom";
import ServiceContext from "../../ServiceContext";
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

export default function AgentChats() {
  const { connectedServices } = useContext(ServiceContext);
  const projects = useMemo(
    () => [...new Set((connectedServices || []).map((s) => s.projectCode))],
    [connectedServices],
  );
  return projects.map((pc, i) => <BotBubble key={pc} projectCode={pc} index={i} />);
}

function BotBubble({ projectCode, index }) {
  const location = useLocation();
  const { serviceId, moduleName, methodName } = useParams();
  const { SystemViewService } = useContext(ServiceContext);
  const { SystemView } = SystemViewService;
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
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
      if (record.from === "agent" && !openRef.current) setUnread((n) => n + 1);
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
    setInput("");
    // The vantage point, stamped NOW — the reader arrives later, after you've moved on.
    const params = new URLSearchParams(location.search);
    const view = {
      path: location.pathname + location.search,
      projectCode,
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
        <div
          className={`${CLASSNAME}__panel`}
          // A free-parked bubble may not have 480px of room on its open side — cap the panel to
          // the space that actually exists so it never runs off the top or bottom.
          style={
            pos
              ? {
                  maxHeight: Math.min(
                    480,
                    Math.max(200, topHalf ? window.innerHeight - pos.y - 100 : pos.y - 16),
                  ),
                }
              : undefined
          }
        >
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
            {messages.map((m) => (
              <div
                key={m.id}
                className={`${CLASSNAME}__msg ${m.from === "agent" ? `${CLASSNAME}__msg--agent` : `${CLASSNAME}__msg--you`}`}
              >
                {m.text}
              </div>
            ))}
            {p.status && <StatusLine status={p.status} />}
          </div>
          <div className={`${CLASSNAME}__inputrow`}>
            <input
              className={`${CLASSNAME}__input`}
              value={input}
              placeholder={p.live ? "the agent is in — talk" : "message (delivered at the agent's next turn)"}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") send();
              }}
            />
            <button type="button" className={`${CLASSNAME}__send`} onClick={send} disabled={!input.trim()}>
              ↑
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
      <div className={`${CLASSNAME}__bot`} onPointerDown={onBotPointerDown}>
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
