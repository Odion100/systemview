import React, { Suspense, useEffect, useState } from "react";
import { hasTerminalHost, terminalHost } from "../Terminal/host";
import { THEMES, readLook, writeLook } from "../Terminal/themes";
import { useAppDark } from "../../atoms/appTheme";

const Terminal = React.lazy(() => import("../Terminal/Terminal"));

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

const TerminalSection = ({ projectCode, CLASSNAME, Chevron }) => {
  const [open, setOpen] = useState(
    () => localStorage.getItem(`sv.cbNav.term.${projectCode}`) === "true",
  );
  const [{ tabs, active }, setTabs] = useState(() => loadTabs(projectCode));
  const [gear, setGear] = useState(false);
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
