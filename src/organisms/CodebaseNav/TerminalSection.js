import React, { Suspense, useEffect, useState } from "react";
import useFold from "./useFold";
import lazyLoad from "../../utils/lazyLoad";
import { hasTerminalHost, terminalHost } from "../Terminal/host";
import { THEMES, readLook, writeLook } from "../Terminal/themes";
import { useAppDark } from "../../atoms/appTheme";
import { listDefs } from "../../utils/hostAgents";
import { canGrantTerminals, terminalGrants, setTerminalGrant } from "../../utils/hostTerminalGrants";
import { getHub } from "../../utils/hub";

const Terminal = lazyLoad(() => import("../Terminal/Terminal"));

// RFC-045 — THE TERMINAL AS A SECTION OF THE CODEBASE CARD, beside `services` and `code`. His reason,
// unchanged since RFC-042: he wants to stay in SystemView with several projects open instead of going
// back to VS Code, and a shell belongs to a codebase the same way its services and its files do.
//
// SystemView renders; the host runs. With no host this says so and mounts nothing — the first
// version's failure mode was a thing that LOOKED like a terminal and wasn't.
//
// MORE THAN ONE PER CODEBASE (his ask, and obvious in hindsight: one shell per project is one shell
// short the moment something is running in it). Tabs live here, sessions live on the host: a tab is
// a `sessionId`, and the host keys its pty by it — so a tab that is not on screen keeps running, and
// coming back to it repaints from the host's scrollback.
const sessKey = (pc) => `sv.cbNav.termTabs.${pc}`;
const heightKey = (pc) => `sv.cbNav.termH.${pc}`;

const loadTabs = (pc) => {
  try {
    const raw = JSON.parse(localStorage.getItem(sessKey(pc)) || "null");
    if (raw && Array.isArray(raw.tabs) && raw.tabs.length) return raw;
  } catch {}
  return { tabs: [{ id: `${pc}-1`, n: 1 }], active: `${pc}-1` };
};

const TerminalSection = ({ projectCode, CLASSNAME, Chevron, bulk = null }) => {
  // A section of the card like any other: it folds with the head's chevron (useFold obeys `bulk`).
  const [open, , setOpenFold] = useFold(`sv.cbNav.term.${projectCode}`, false, bulk);
  const setOpen = (v) => setOpenFold(typeof v === "function" ? v(open) : v);
  const [{ tabs, active }, setTabs] = useState(() => loadTabs(projectCode));
  const [gear, setGear] = useState(false);
  // WHOSE KEYBOARD THIS IS (2026-09-21, his ask). An agent cannot open a terminal, name a host or
  // authenticate — it can only type into a session he already started and already handed over. He
  // is SSH'd into his remote box; the agent inherits that keyboard instead of being given keys.
  //
  // The grant is PER TERMINAL because that is the unit that means something: the shell on the
  // remote is not the shell building the bundle, and sharing one should not share the other.
  // Its home is the hub's file, never this component — see utils/hostTerminalGrants.
  const [grants, setGrants] = useState({});
  const [pick, setPick] = useState(false);
  const [agents, setAgents] = useState([]);
  const canGrant = canGrantTerminals();
  const loadGrants = React.useCallback(async () => {
    if (!canGrant) return;
    setGrants(await terminalGrants());
  }, [canGrant]);
  useEffect(() => {
    if (!open || !canGrant) return;
    loadGrants();
    // EVERY AGENT, NOT THIS PROJECT'S — his call: "I may want to bring an agent from another project
    // over." An agent's home repo has nothing to do with which keyboard it can borrow.
    listDefs().then((d) => setAgents(Array.isArray(d) ? d : []));
  }, [open, canGrant, loadGrants]);
  // THE GRANT HAS TO ARRIVE, NOT BE DISCOVERED (his ask: "the communication needs to be seamless").
  // Nothing in an agent's competence tells it a keyboard was handed over, and an agent that has to
  // poll to find out does not have it in any useful sense. So the toggle also says so, in that
  // agent's own room — and says it again when it is taken away, because a capability that goes
  // quiet is worse than one that was never given.
  const tellAgent = async (def, session, granted) => {
    const pc = def && def.projectCode;
    if (!pc) return;
    const where = `\`${session}\``;
    const body = granted
      ? `You now have terminal ${where} — my own shell, already open and already authenticated. ` +
        `Run things in it with the systemview MCP's \`terminal\` tool (\`terminals\` lists what you hold). ` +
        `It is a shared session: a \`cd\` moves my prompt too.`
      : `Terminal ${where} is no longer yours — I took it back.`;
    try {
      await getHub().chatSend(pc, { chat: undefined, from: "you", text: body });
    } catch {
      /* the grant still stands; only the notice failed, and `terminals` will still answer */
    }
  };
  const grantTo = async (session, agent, def) => {
    const r = await setTerminalGrant({ session, agent, by: "the window" });
    if (r && r.ok === false) return;
    loadGrants();
    if (def) tellAgent(def, session, !!agent);
  };
  // WHAT IS ACTUALLY RUNNING ON THE MACHINE — not what this card has tabs for. His worry, and it was
  // not hypothetical: autobot's first `sessions()` call found EIGHT live shells left over from an
  // evening of testing, none of them visible anywhere. A terminal that survives the window is a
  // feature; a terminal that survives it INVISIBLY is a leak.
  const [live, setLive] = useState([]);
  // THE TERMINAL IS THE LAST SECTION, so by default it takes whatever space is left — resize the
  // panel and the shell grows with it. Drag its top edge and you have said a number out loud, and
  // that number wins from then on (double-click the grip hands the space back to the flex).
  const [height, setHeight] = useState(() => {
    const v = Number(localStorage.getItem(heightKey(projectCode)));
    return Number.isFinite(v) && v > 60 ? v : null;
  });
  const dragRef = React.useRef(null);
  const startDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const box = e.currentTarget.parentElement.querySelector(".sv-term");
    const from = box ? box.getBoundingClientRect().height : height || 220;
    dragRef.current = { y: e.clientY, from };
    const move = (ev) => {
      if (!dragRef.current) return;
      const next = Math.max(90, Math.round(dragRef.current.from + (dragRef.current.y - ev.clientY)));
      setHeight(next);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      dragRef.current = null;
      setHeight((h) => {
        try {
          if (h) localStorage.setItem(heightKey(projectCode), String(h));
        } catch {}
        return h;
      });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const releaseHeight = () => {
    setHeight(null);
    try {
      localStorage.removeItem(heightKey(projectCode));
    } catch {}
  };
  const [appDark] = useAppDark();
  const [look, setLook] = useState(() => readLook(appDark));
  useEffect(() => setLook(readLook(appDark)), [appDark]);
  // The tabs sit ON the terminal, so they take its colour — his catch: "the tab background stays
  // dark regardless, that needs to tweak per style". A light terminal with a black tab strip reads
  // as two different components stacked.
  const skin = (THEMES[look.theme] || THEMES.midnight).theme;
  const hosted = hasTerminalHost();

  useEffect(() => {
    try {
      localStorage.setItem(sessKey(projectCode), JSON.stringify({ tabs, active }));
    } catch {}
  }, [projectCode, tabs, active]);

  const refreshLive = React.useCallback(async () => {
    const host = terminalHost();
    if (!host || typeof host.sessions !== "function") return setLive([]);
    try {
      const all = await host.sessions();
      setLive(Array.isArray(all) ? all : []);
    } catch {
      setLive([]);
    }
  }, []);
  useEffect(() => {
    if (!gear) return undefined;
    refreshLive();
    const t = setInterval(refreshLive, 4000);
    return () => clearInterval(t);
  }, [gear, refreshLive]);

  const endSession = async (pc, id) => {
    const host = terminalHost();
    if (host && typeof host.killSession === "function") {
      try {
        await host.killSession(pc, id);
      } catch {}
    }
    setTabs(({ tabs: cur, active: act }) => {
      const left = cur.filter((t) => t.id !== id);
      if (!left.length) return { tabs: cur, active: act }; // never leave the section empty
      return { tabs: left, active: act === id ? left[left.length - 1].id : act };
    });
    refreshLive();
  };

  const flip = () =>
    setOpen((v) => {
      localStorage.setItem(`sv.cbNav.term.${projectCode}`, String(!v));
      return !v;
    });

  const addTab = (e) => {
    e.stopPropagation(); // the row is the fold; this button is not
    setTabs(({ tabs: cur }) => {
      const n = cur.reduce((m, t) => Math.max(m, t.n), 0) + 1;
      const id = `${projectCode}-${n}`;
      return { tabs: [...cur, { id, n }], active: id };
    });
    if (!open) flip();
  };

  // ✕ ENDS THE SHELL. It used to detach, which meant a tab you closed kept running with nothing on
  // screen naming it — the invisible-survivor problem in miniature. Detaching still happens on its
  // own whenever the section folds or the card unmounts; that is the safe direction. Closing on
  // purpose is the one that should mean it.
  const closeTab = (e, id) => {
    e.stopPropagation();
    endSession(projectCode, id);
  };

  // Setting a colour sets it for the mode you are IN. Switch the app to light and you are choosing
  // the light terminal, which is what the label above the swatches says out loud.
  const setThemeName = (name) => {
    const next = { ...look, [look.mode]: name, theme: name };
    setLook(next);
    writeLook(next);
  };
  const setFont = (delta) => {
    const next = { ...look, fontSize: Math.min(20, Math.max(9, Math.round((look.fontSize + delta) * 2) / 2)) };
    setLook(next);
    writeLook(next);
  };

  return (
    <>
      {open && hosted && (
        <div
          className={`${CLASSNAME}__term-grip`}
          title="Drag to size the terminal · double-click to let it fill what's left"
          onPointerDown={startDrag}
          onDoubleClick={releaseHeight}
        />
      )}
      <button
        type="button"
        className={`${CLASSNAME}__code-fold`}
        title={
          hosted
            ? open
              ? "Collapse the terminal"
              : "A shell in this codebase"
            : "Terminals need a host — this is the desktop shell's job"
        }
        onClick={flip}
      >
        <Chevron open={open} />
        <span className={`${CLASSNAME}__code-fold-label`}>terminal</span>
        {hosted && (
          <span className={`${CLASSNAME}__term-tools`}>
            <span
              role="button"
              tabIndex={0}
              className={`${CLASSNAME}__term-tool ${CLASSNAME}__term-tool--gear`}
              title="Settings — colours and text size"
              onClick={(e) => {
                e.stopPropagation();
                setGear((g) => !g);
                if (!open) flip();
              }}
            >
              ⚙
            </span>
            <span
              role="button"
              tabIndex={0}
              className={`${CLASSNAME}__term-tool ${CLASSNAME}__term-tool--plus`}
              title="Another terminal in this codebase"
              onClick={addTab}
            >
              +
            </span>
          </span>
        )}
      </button>

      {open && !hosted && (
        <div className={`${CLASSNAME}__empty`}>
          no terminal host here — a shell runs in the desktop app
        </div>
      )}

      {open && hosted && gear && (
        <div className={`${CLASSNAME}__term-gear`}>
          <div className={`${CLASSNAME}__term-gear-row`}>
            <span className={`${CLASSNAME}__term-gear-label`}>
              colours for {look.mode} mode
            </span>
          </div>
          <div className={`${CLASSNAME}__term-gear-row`}>
            {Object.entries(THEMES).map(([name, t]) => (
              <button
                key={name}
                type="button"
                className={`${CLASSNAME}__term-swatch${look.theme === name ? " is-on" : ""}`}
                title={t.label}
                style={{ background: t.theme.background, color: t.theme.foreground }}
                onClick={() => setThemeName(name)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className={`${CLASSNAME}__term-gear-row`}>
            <span className={`${CLASSNAME}__term-gear-label`}>
              running ({live.length})
            </span>
            <span className={`${CLASSNAME}__term-gear-hint`}>anywhere on this machine</span>
          </div>
          {live.length === 0 ? (
            <div className={`${CLASSNAME}__term-gear-row`}>
              <span className={`${CLASSNAME}__term-gear-hint`}>nothing running</span>
            </div>
          ) : (
            live.map((s) => (
              <div className={`${CLASSNAME}__term-live`} key={`${s.projectCode}:${s.sessionId}`}>
                <span className={`${CLASSNAME}__term-live-name`} title={s.key || ""}>
                  {s.projectCode === projectCode ? s.sessionId : `${s.projectCode} · ${s.sessionId}`}
                </span>
                {s.pid ? <span className={`${CLASSNAME}__term-live-pid`}>pid {s.pid}</span> : null}
                {s.projectCode === projectCode && !tabs.some((t) => t.id === s.sessionId) && (
                  <button
                    type="button"
                    className={`${CLASSNAME}__term-step`}
                    title="Show this one here — it is already running"
                    onClick={() =>
                      setTabs(({ tabs: cur }) => ({
                        tabs: [...cur, { id: s.sessionId, n: cur.reduce((m, t) => Math.max(m, t.n), 0) + 1 }],
                        active: s.sessionId,
                      }))
                    }
                  >
                    open
                  </button>
                )}
                <button
                  type="button"
                  className={`${CLASSNAME}__term-step`}
                  title="End this shell"
                  onClick={() => endSession(s.projectCode, s.sessionId)}
                >
                  end
                </button>
              </div>
            ))
          )}
          <div className={`${CLASSNAME}__term-gear-row`}>
            <span className={`${CLASSNAME}__term-gear-label`}>text</span>
            <button type="button" className={`${CLASSNAME}__term-step`} onClick={() => setFont(-0.5)}>
              −
            </button>
            <span className={`${CLASSNAME}__term-gear-val`}>{look.fontSize}px</span>
            <button type="button" className={`${CLASSNAME}__term-step`} onClick={() => setFont(0.5)}>
              +
            </button>
            <span className={`${CLASSNAME}__term-gear-hint`}>⌘K clears</span>
          </div>
        </div>
      )}

      {open && hosted && tabs.length > 1 && (
        <div className={`${CLASSNAME}__term-tabs`} style={{ background: skin.background }}>
          {tabs.map((t) => (
            <span
              key={t.id}
              role="button"
              tabIndex={0}
              className={`${CLASSNAME}__term-tab${t.id === active ? " is-on" : ""}`}
              style={
                t.id === active
                  ? { color: skin.foreground, background: skin.selectionBackground || "rgba(127,127,127,0.25)" }
                  : { color: skin.foreground, opacity: 0.55 }
              }
              onClick={() => setTabs((cur) => ({ ...cur, active: t.id }))}
            >
              shell {t.n}
              {/* THE TAB SAYS WHOSE IT IS. The dangerous state is not granting, it is FORGETTING you
                  granted — and a toggle that only exists in a panel you have to open is exactly how
                  that happens. A shared terminal is legible from the strip. */}
              {grants[t.id] && grants[t.id].agent && (
                <span className={`${CLASSNAME}__term-tab-agent`} title={`${grants[t.id].agent} may type in this terminal`}>
                  🤖
                </span>
              )}
              {/* THE ✕ ONLY ON THE TAB YOU ARE ON. His catch: a number and an ✕ jammed together is a
                  target you hit by accident — and closing the tab you were not even looking at is
                  the worst version of that. The rest of the strip is just a label to click. */}
              {t.id === active && (
                <span
                  role="button"
                  tabIndex={0}
                  className={`${CLASSNAME}__term-tab-x`}
                  title="Close this tab — the session keeps running on the host"
                  onClick={(e) => closeTab(e, t.id)}
                >
                  ✕
                </span>
              )}
            </span>
          ))}
        </div>
      )}

      {open && hosted && canGrant && (() => {
        // A PILL AND ITS OWN LIST, not a native select. The rest of this app does not use raw form
        // controls in a surface like this, and a `<select>` dropped into the terminal card reads as
        // something half-built — which is what it was. The pill follows the header's theme pill:
        // bordered, round, quiet until it means something.
        // THE GRANT IS KEYED BY THE DEF'S **id**, NEVER ITS NAME. The MCP server is built with
        // `slot: agent.id` (autobot sessions.cjs), so an agent asking "which terminals are mine"
        // compares against its id — and BUApp's id is `buapp` while its name is `BUApp`. Writing the
        // name here produced a grant that was real, visible in the file, and invisible to the agent
        // it was for. It passed my own testing because MY def has id and name identical, which is
        // the one case where the bug cannot appear.
        const who = (grants[active] && grants[active].agent) || "";
        const whoName = (agents.find((a) => a.id === who) || {}).name || who;
        return (
          <div className={`${CLASSNAME}__term-grant`} style={{ background: skin.background, color: skin.foreground }}>
            <span className={`${CLASSNAME}__term-grant-label`} style={{ color: skin.foreground }}>
              {who ? `${whoName} can type in this terminal` : ""}
            </span>
            <button
              type="button"
              className={`${CLASSNAME}__term-pill${who ? " is-on" : ""}`}
              style={{
                color: skin.foreground,
                borderColor: skin.selectionBackground || "rgba(127,127,127,0.45)",
                background: who ? skin.selectionBackground || "rgba(127,127,127,0.25)" : "transparent",
              }}
              onClick={() => setPick((v) => !v)}
              title={who ? `${who} can type in this terminal` : "Hand this terminal to an agent"}
            >
              <span className={`${CLASSNAME}__term-pill-face`}>🤖</span>
              {/* THE LABEL IS AN OFFER, NOT A STATUS. "no agent can type here" states an absence
                  nobody asked about; the control should say what pressing it DOES. */}
              {whoName || "grant access"}
              <span className={`${CLASSNAME}__term-pill-caret`}>⌄</span>
            </button>
            {who && (
              <button type="button" className={`${CLASSNAME}__term-pill-off`} style={{ color: skin.foreground }} onClick={() => { setPick(false); grantTo(active, "", agents.find((a) => a.id === who)); }}>
                no access
              </button>
            )}
            {pick && (
              <div className={`${CLASSNAME}__term-picker`} style={{ background: skin.background, color: skin.foreground, borderColor: skin.selectionBackground || "rgba(127,127,127,0.35)" }}>
                <div className={`${CLASSNAME}__term-picker-head`}>who may type in shell {(tabs.find((x) => x.id === active) || {}).n}</div>
                {agents.length === 0 && <div className={`${CLASSNAME}__term-picker-empty`}>no agents are defined</div>}
                {agents.map((a) => {
                  const nm = a.name || a.id;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      className={`${CLASSNAME}__term-picker-row${a.id === who ? " is-on" : ""}`}
                      style={a.id === who ? { background: skin.selectionBackground || "rgba(127,127,127,0.25)", color: skin.foreground } : { color: skin.foreground }}
                      onClick={() => { setPick(false); grantTo(active, a.id, a); }}
                    >
                      <span className={`${CLASSNAME}__term-picker-name`}>{nm}</span>
                      {a.projectCode && <span className={`${CLASSNAME}__term-picker-pc`}>{a.projectCode}</span>}
                    </button>
                  );
                })}
                {who && (
                  <button type="button" className={`${CLASSNAME}__term-picker-row ${CLASSNAME}__term-picker-none`} onClick={() => { setPick(false); grantTo(active, "", agents.find((a) => a.id === who)); }}>
                    no access
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {open && hosted && (
        <Suspense fallback={<div className={`${CLASSNAME}__empty`}>starting a shell…</div>}>
          {/* One mounted pane — the others keep running on the host, which is the whole reason a tab
              is a sessionId rather than a component instance. `key` forces a clean re-open on switch,
              and history() repaints what happened while you were on the other tab. */}
          <Terminal key={active} projectCode={projectCode} sessionId={active} height={height} />
        </Suspense>
      )}
    </>
  );
};

export default TerminalSection;
