import React, { useEffect, useRef, useState } from "react";
import { Terminal as Xterm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import "./styles.scss";
import { THEMES, readLook } from "./themes";
import { useAppDark } from "../../atoms/appTheme";

// RFC-045 — A REAL TERMINAL, RENDERED HERE, RUN BY THE HOST.
//
// This is the piece RFC-042 got wrong and RFC-043 diagnosed: that build shipped an append-only
// transcript with the escape codes STRIPPED, which cannot host anything that repaints — `systemview
// logs` following a stream, interactive mode, spinners, `clear`, any TUI. It was not a terminal with
// bugs in it, it was a different thing that resembled one from a distance, and no amount of polish
// was going to close the gap.
//
// So: a real emulator (xterm.js, the one VS Code uses), fed RAW bytes, with a pty on the other end
// of the transport. Nothing here parses, strips, trims or reflows output — the moment this layer
// gets "helpful" it recreates RFC-042 one level down.
//
// The whole module is loaded on demand (TerminalSection lazy-imports it), so the ~250KB is paid by
// people who open a terminal and by nobody else.
// xterm's own stylesheet paints `.xterm-viewport` BLACK and leaves it there — the theme's background
// only reaches the renderer's layers, so a light theme rendered dark-on-dark everywhere except the
// glyphs. Measured, not assumed: after switching to `paper`, the row colour changed and the viewport
// stayed rgb(0,0,0). So the background is ours to paint: the wrapper, the pane, and the viewport
// element itself.
const paint = (root, term, look) => {
  const t = (THEMES[look.theme] || THEMES.midnight).theme;
  if (term) {
    term.options.theme = t;
    term.options.fontSize = look.fontSize;
  }
  if (!root) return;
  root.style.background = t.background;
  const wrap = root.closest(".sv-term");
  if (wrap) wrap.style.background = t.background;
  const vp = root.querySelector(".xterm-viewport");
  if (vp) vp.style.backgroundColor = t.background;
};

const Terminal = ({ projectCode, sessionId = null, cwd = null, onExit = null }) => {
  const [appDark] = useAppDark();
  const hostRef = useRef(null); // the DOM node xterm draws into
  const termRef = useRef(null); // the emulator, for the things that reach it after mount
  const transportRef = useRef(null);
  const [error, setError] = useState(null);
  const [exit, setExit] = useState(null);

  useEffect(() => {
    let dead = false;
    let term = null;
    let transport = null;
    let ro = null;
    let offData = null;
    let offExit = null;

    (async () => {
      const host = (window.systemview || {}).terminal;
      if (!host) return; // TerminalSection gates on this; belt and braces
      const look = readLook(appDark);
      term = new Xterm({
        fontSize: look.fontSize,
        fontFamily: '"SF Mono", Menlo, Consolas, monospace',
        cursorBlink: true,
        scrollback: 5000,
        theme: (THEMES[look.theme] || THEMES.midnight).theme,
      });
      termRef.current = term;
      const fit = new FitAddon();
      term.loadAddon(fit);
      if (dead || !hostRef.current) return;
      term.open(hostRef.current);
      try {
        fit.fit();
      } catch {}

      try {
        // THE COMPONENT MEASURES, THE HOST FOLLOWS. xterm knows the real cols/rows for this font at
        // this width; a host sizing the pty from window geometry is always one repaint behind.
        transport = await host.open({ projectCode, sessionId, cwd, cols: term.cols, rows: term.rows });
      } catch (e) {
        if (!dead) setError((e && (e.message || String(e))) || "the host refused to open a terminal");
        return;
      }
      transportRef.current = transport;
      if (dead || !transport) {
        transport && transport.dispose && transport.dispose();
        return;
      }

      // A RE-MOUNTED PANE IS THE SAME SESSION. Folding the card, switching tabs or navigating away
      // disposes this VIEW; the session keeps running on the host, so the first thing a new view
      // does is repaint what it missed.
      if (typeof transport.history === "function") {
        try {
          const past = await transport.history();
          if (!dead && past) term.write(past);
        } catch {
          /* no scrollback is not an error — a fresh session has none */
        }
      }

      offData = transport.onData((chunk) => term.write(chunk));
      if (typeof transport.onExit === "function")
        offExit = transport.onExit((info = {}) => {
          // A shell that exits is a normal event, not a failure: say so in the terminal's own voice
          // and leave the buffer alone, because what it printed before dying is usually the point.
          term.write(`\r\n\x1b[2m[session ended${info.code != null ? ` — code ${info.code}` : ""}]\x1b[0m\r\n`);
          if (!dead) setExit(info);
          if (onExit) onExit(info);
        });
      term.onData((data) => transport.write(data));

      // Refit on any size change — the column is resizable and the card folds.
      if (typeof ResizeObserver !== "undefined" && hostRef.current) {
        ro = new ResizeObserver(() => {
          try {
            fit.fit();
            transport.resize(term.cols, term.rows);
          } catch {}
        });
        ro.observe(hostRef.current);
      }
      // ⌘K / Ctrl-K CLEARS, the way it does in every terminal he uses. It clears the emulator AND
      // asks the host to drop the session's scrollback, or the next re-mount would repaint through
      // history() everything he just cleared.
      paint(hostRef.current, term, look);
      term.attachCustomKeyEventHandler((e) => {
        if (e.type !== "keydown") return true;
        if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
          e.preventDefault();
          term.clear();
          term.write("\x1b[2J\x1b[H");
          if (transport && typeof transport.clear === "function") transport.clear();
          return false;
        }
        return true;
      });
      term.focus();
    })();

    return () => {
      dead = true;
      if (ro) ro.disconnect();
      if (offData) offData();
      if (offExit) offExit();
      // DETACH, DO NOT KILL. `dispose()` is "this view is going away" — the running build, the dev
      // server, the tailing log all survive it. Killing the session on unmount would mean folding a
      // card costs you whatever was running in it.
      if (transport && transport.dispose) transport.dispose();
      if (term) term.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectCode, sessionId, cwd]);

  // The app's own light/dark switch moves the terminal with it — each mode has its own choice.
  useEffect(() => {
    paint(hostRef.current, termRef.current, readLook(appDark));
  }, [appDark]);

  // The gear writes one setting; every open pane follows immediately rather than on next mount.
  useEffect(() => {
    const onLook = () => {
      const look = readLook(appDark);
      paint(hostRef.current, termRef.current, look);
    };
    window.addEventListener("sv:termLook", onLook);
    return () => window.removeEventListener("sv:termLook", onLook);
  }, [appDark]);

  return (
    <div className="sv-term">
      {error ? <div className="sv-term__error">{error}</div> : null}
      <div className="sv-term__screen" ref={hostRef} />
      {exit ? <div className="sv-term__exit">session ended — close and reopen for a new one</div> : null}
    </div>
  );
};

export default Terminal;
