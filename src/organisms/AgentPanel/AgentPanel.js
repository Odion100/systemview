import React, { useCallback, useEffect, useState } from "react";
import "./styles.scss";
import { hasAgents, listDefs, liveSessions, agentRuns, killSession } from "../../utils/hostAgents";
import { spotId, useDockOrder, orderProjects, moveInDock } from "../AgentChat/navDock";

// RFC-055 — THE AGENT PANEL, IN THE NAV. His ask: the little card the browser's agent panel shows
// — who's running, where, on what — should show on ANY view, as the nav's Agents tab, "because I
// don't like the fact that there's nothing there." This is SystemView's version of that card, the
// one we refine here before it moves back into the browser chrome.
//
// Same derivation as the browser panel: ONE list — live runs first, then defined agents with
// nothing running. State (running / defined) is a dot and a word, not a section.
const ago = (ts) => {
  if (!ts) return "";
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

const AgentPanel = () => {
  const available = hasAgents();
  const [defs, setDefs] = useState([]);
  const [live, setLive] = useState([]);
  const [runs, setRuns] = useState({});
  // per SECTION, not per card (his call): "card:skills" open leaves that card's tools shut
  const [expanded, setExpanded] = useState(() => new Set());
  const dockOrderList = useDockOrder();
  const [dragPc, setDragPc] = useState(null);
  const [overPc, setOverPc] = useState(null);
  // ending a session is destructive — TWO steps, like every delete (his rule: the
  // confirmation IS the safety). First click arms, second ends, anything else disarms.
  const [armedEnd, setArmedEnd] = useState(null);
  const toggleSection = (k) =>
    setExpanded((cur) => {
      const next = new Set(cur);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  const refresh = useCallback(async () => {
    const [d, l, r] = await Promise.all([listDefs(), liveSessions(), agentRuns()]);
    setDefs(d);
    setLive(l);
    setRuns(r);
  }, []);

  useEffect(() => {
    if (!available) return;
    refresh();
    const on = () => refresh();
    window.addEventListener("sv:botHub", on);
    const t = setInterval(refresh, 8000); // liveness drifts without a signal; same cadence as the browser panel
    return () => {
      window.removeEventListener("sv:botHub", on);
      clearInterval(t);
    };
  }, [available, refresh]);

  if (!available)
    return <div className="agent-panel agent-panel--empty">Agents live in the SystemView browser.</div>;

  const byId = new Map(defs.map((d) => [d.id, d]));
  const cards = [];
  for (const s of live) {
    const d = s.agentId ? byId.get(s.agentId) : null;
    cards.push({
      key: s.key,
      state: "running",
      name: (d && d.name) || s.projectCode,
      projectCode: s.projectCode,
      sessionId: s.sessionId,
      cwd: s.cwd,
      permissionMode: s.permissionMode,
      capabilities: s.capabilities,
      worklist: s.worklist || [],
      usedBy: s.usedBy || [],
      lastActive: s.startedAt,
      agentId: s.agentId,
    });
  }
  for (const d of defs) {
    if (live.some((s) => s.agentId === d.id)) continue;
    const r = runs[d.id];
    cards.push({
      key: `def:${d.id}`,
      state: "defined",
      name: d.name,
      projectCode: d.projectCode,
      cwd: d.cwd,
      permissionMode: d.permissionMode,
      capabilities: r && r.capabilities,
      worklist: [],
      usedBy: [],
      lastActive: (r && r.lastActive) || d.updatedAt,
      agentId: d.id,
    });
  }

  // THE FACE, IN ITS OWN ROW — no icon row at the top of the open panel (his call: "the dumbest
  // shit I've ever seen"), and no chat/panels inline in the card either. A docked agent's face
  // sits on its own line inside its card — rail dock mode, so every panel it opens HOVERS outside.
  // One slot per project, on the first card that carries it; a docked bot with no card just floats.
  const seenPc = new Set();

  // THE CARDS ARE IN THE DOCK'S ORDER, AND DRAGGING A CARD REORDERS THE DOCK — same rule as the
  // codebase panel ("one order everywhere"): switch it here, the rail switches; and back.
  const pcs = [...new Set(cards.map((c) => c.projectCode).filter(Boolean))];
  const orderedPcs = orderProjects(dockOrderList, pcs);
  const orderedCards = [
    ...orderedPcs.flatMap((pc) => cards.filter((c) => c.projectCode === pc)),
    ...cards.filter((c) => !c.projectCode),
  ];

  return (
    <div className="agent-panel">
      <div className="agent-panel__note">
        {live.length ? `${live.length} running` : "none running"} · {cards.length} total
      </div>
      {orderedCards.map((a) => {
        const cap = a.capabilities;
        const active = a.worklist.find((i) => i.state === "active");
        const done = a.worklist.filter((i) => i.state === "done").length;
        const carriesSlot = a.projectCode && !seenPc.has(a.projectCode);
        if (carriesSlot) seenPc.add(a.projectCode);
        return (
          <div
            key={a.key}
            className={`agent-panel__card${dragPc === a.projectCode ? " agent-panel__card--dragging" : ""}${overPc === a.projectCode && dragPc !== a.projectCode ? " agent-panel__card--dropover" : ""}`}
            onDragOver={(e) => {
              if (dragPc && dragPc !== a.projectCode && a.projectCode) {
                e.preventDefault();
                setOverPc(a.projectCode);
              }
            }}
            onDrop={(e) => {
              if (dragPc && dragPc !== a.projectCode && a.projectCode) {
                e.preventDefault();
                moveInDock(dragPc, a.projectCode, orderedPcs);
              }
              setDragPc(null);
              setOverPc(null);
            }}
          >
            <div
              className="agent-panel__card-head"
              draggable={!!a.projectCode}
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = "move";
                try { e.dataTransfer.setData("text/plain", a.projectCode); } catch {}
                setDragPc(a.projectCode);
              }}
              onDragEnd={() => {
                setDragPc(null);
                setOverPc(null);
              }}
            >
              <span className={`agent-panel__state agent-panel__state--${a.state}`} />
              <span className="agent-panel__name">{a.name}</span>
              <span className={`agent-panel__word agent-panel__word--${a.state}`}>{a.state}</span>
              <span className="agent-panel__spacer" />
              <a className="agent-panel__edit" href="/agents" title="Open the profile — docs, tools, knowledge">
                edit
              </a>
              {a.state === "running" &&
                (armedEnd === a.key ? (
                  <>
                    <button
                      className="agent-panel__end agent-panel__end--confirm"
                      title="Really end this agent's session"
                      onClick={() => {
                        setArmedEnd(null);
                        killSession(a.projectCode, a.sessionId).then(refresh);
                      }}
                    >
                      end?
                    </button>
                    <button className="agent-panel__keep" onClick={() => setArmedEnd(null)}>
                      keep
                    </button>
                  </>
                ) : (
                  <button
                    className="agent-panel__end"
                    title="End this agent's session"
                    onClick={() => setArmedEnd(a.key)}
                  >
                    ✕
                  </button>
                ))}
            </div>

            {a.worklist.length > 0 && (
              <div className="agent-panel__work">
                <span className="agent-panel__work-count">{done}/{a.worklist.length}</span>
                <span className="agent-panel__work-now">{active ? active.text : "no active step"}</span>
              </div>
            )}

            <div className="agent-panel__facts">
              <span><b>on</b> {a.projectCode || "—"}</span>
              <span><b>in</b> {a.cwd ? a.cwd.replace(/^\/Users\/[^/]+/, "~") : "—"}</span>
              <span><b>gating</b> {a.permissionMode === "default" ? "asks" : "open"}</span>
              {a.lastActive ? <span><b>active</b> {ago(a.lastActive)}</span> : null}
            </div>

            {cap && (
              <div className="agent-panel__lists">
                {/* EACH SECTION OPENS ON ITS OWN (his call) — skills open, tools stay shut.
                    Same four lists as the browser panel: sub-agents, MCPs, tools, skills. */}
                {[
                  { sec: "skills", label: "skills", items: (cap.skills || []).map((s) => ({ key: s.name || String(s), text: s.name || String(s), cls: " agent-panel__chip--skill" })) },
                  { sec: "tools", label: "tools", items: (cap.tools || []).map((t) => ({ key: t, text: t.replace(/^mcp__/, ""), cls: t.startsWith("mcp__") ? " agent-panel__chip--mcp" : "" })) },
                  { sec: "mcp", label: "mcp", items: (cap.mcpServers || []).map((m) => ({ key: m.name || String(m), text: m.name || String(m), cls: " agent-panel__chip--mcp" })) },
                  { sec: "agents", label: "sub-agents", items: (cap.agents || []).map((g) => ({ key: g.name || String(g), text: g.name || String(g), cls: "" })) },
                ].map(({ sec, label, items }) => {
                  const k = `${a.key}:${sec}`;
                  const isFull = expanded.has(k);
                  const shown = isFull ? items : items.slice(0, 4);
                  return (
                    <div key={sec} className="agent-panel__list" onClick={() => toggleSection(k)}>
                      <span className="agent-panel__list-k">{label} <b>{items.length}</b></span>
                      {shown.length === 0 && <span className="agent-panel__chip agent-panel__chip--more">none</span>}
                      {shown.map((it) => (
                        <span key={it.key} className={`agent-panel__chip${it.cls}`}>{it.text}</span>
                      ))}
                      {!isFull && items.length > 4 && <span className="agent-panel__chip agent-panel__chip--more">+{items.length - 4}</span>}
                    </div>
                  );
                })}
              </div>
            )}
            {/* THE DOCKED FACE — its own row at the BOTTOM of the card, icon in the corner (his
                call). Face only, small, rail dock mode: everything it opens HOVERS outside the
                card — no chat, no icons, no title in here. Drag pulls it out; click is its click. */}
            {carriesSlot && <div id={spotId(a.projectCode)} data-spot={a.projectCode} className="agent-panel__slot" />}
          </div>
        );
      })}
      {!cards.length && <div className="agent-panel__none">No agents defined yet.</div>}
    </div>
  );
};

export default AgentPanel;
