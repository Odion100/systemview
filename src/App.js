import React, { useEffect, useState } from "react";
import SystemView from "./pages/SystemView/SystemView";
import Reports from "./pages/Reports/Reports";
import Context from "./pages/Context/Context";
import Agents from "./pages/Agents/Agents";
import ServiceContext from "./ServiceContext";
import { MarkdownCapabilitiesProvider } from "./atoms/Markdown/capabilities";
import { systemviewCapabilities } from "./markdownCapabilities";
import BannerStack from "./atoms/Banner/Banner";
import { installGlobalErrorChannel } from "./atoms/Banner/bannerStore";
import {
  BrowserRouter as Router,
  Route,
  Switch,
  Redirect,
  useLocation,
} from "react-router-dom";

function DebugRouter({ children }) {
  const location = useLocation();
  console.log("[Router] path:", location.pathname, "search:", location.search);
  return children;
}

// A promise nobody caught used to be console-only; now it reaches the banner stack like everything
// else. Installed once, outside the component, so a re-render can't re-register it.
installGlobalErrorChannel();

// SELF-UPDATING TABS (his rule: "never suggest page reload to me again") — the tab watches the
// hub's served bundle and swaps itself the moment a new build lands. State survives because the
// app is URL-backed; the loop-guard stops a reload cycle if the server ever serves stale.
function useSelfUpdate() {
  useEffect(() => {
    // THE STYLESHEET IS PART OF THE BUILD. This keyed on the JS bundle alone — so a build that
    // changed only CSS kept the same script hash, `/sv-bundle` answered "same", and his tab never
    // swapped: he sat on a stale stylesheet while I reported the fix served. Measured in his window
    // (js hash equal, css hash behind). The key is now js + css together.
    const current = (() => {
      const s = document.querySelector('script[src*="static/js/main."]');
      const c = document.querySelector('link[href*="static/css/main."]');
      const m = s && s.src.match(/main\.[a-z0-9]+\.js/);
      const mc = c && c.href.match(/main\.[a-z0-9]+\.css/);
      return m ? `${m[0]}${mc ? `+${mc[0]}` : ""}` : null;
    })();
    if (!current) return undefined;
    // IT WAITS FOR A MOMENT THAT COSTS HIM NOTHING.
    //
    // His report, 2026-10-12: *"why is this fucking app keep refreshing… Refreshing and losing my
    // tabs."* Four bundle swaps in one day, and this fired on every one of them: a 15-second poll
    // and an unconditional `location.reload()`. The tab is not destroyed — tabs are the shell's
    // native views — but everything INSIDE it is: the page you were on, the open panel, the TV,
    // the scroll. Four times, mid-work, for builds he never asked for.
    //
    // His rule stands and is not in question — *"never suggest page reload to me again."* The bug
    // was never the automatic swap; it was the TIMING. A new build is something he is waiting on
    // when he asked for it and an interruption when somebody else made it, and this cannot tell
    // the difference — so it waits for a moment where the difference does not matter.
    //
    // Two such moments, and nothing else triggers a swap:
    //   - THE TAB IS HIDDEN. He is not looking at it; there is no state in front of him to lose.
    //   - HE HAS BEEN IDLE for IDLE_MS with the page visible. Nothing in flight, nothing typed.
    // Until one arrives the new build is simply held. A pending swap never expires and never
    // nags — the point is that it costs nothing, not that it happens soon.
    const IDLE_MS = 90000;
    let lastTouch = Date.now();
    let pending = null;
    const touched = () => { lastTouch = Date.now(); };
    // `capture` and `passive`: this must see the interaction without being able to affect it —
    // a listener that could swallow a scroll would be a worse bug than the one it is fixing.
    const EVENTS = ["keydown", "pointerdown", "pointermove", "wheel", "scroll", "input"];
    for (const e of EVENTS) window.addEventListener(e, touched, { capture: true, passive: true });

    const swap = async (key) => {
      if (sessionStorage.getItem("sv.reloadedFor") === key) return; // loop-guard
      sessionStorage.setItem("sv.reloadedFor", key);
      // PULL THE PAGE THROUGH THE CACHE FIRST. A plain reload can be answered from the disk cache
      // with the OLD index.html — which names the old bundle — so the tab comes back on exactly
      // the build it was trying to leave, and the guard above then stops it trying again. This
      // forces a network fetch that replaces the cached copy, so the reload after it boots the new
      // one. The server also sends `no-store` for index.html now; this is the half that fixes tabs
      // already holding a stale copy.
      try {
        await fetch(window.location.href, { cache: "reload", credentials: "same-origin" });
      } catch {}
      window.location.reload();
    };

    // Checked on its own clock rather than inside the poll, so a build that lands while he is busy
    // still swaps the moment he walks away — without waiting up to 15s more to notice.
    const maybeSwap = () => {
      if (!pending) return;
      if (document.visibilityState === "hidden") return swap(pending);
      if (Date.now() - lastTouch >= IDLE_MS) return swap(pending);
      return undefined;
    };

    const check = async () => {
      try {
        const res = await fetch("/sv-bundle");
        const { bundle, css } = await res.json();
        const key = bundle ? `${bundle}${css ? `+${css}` : ""}` : null;
        if (!key || key === current) return;
        pending = key;
        maybeSwap();
      } catch {}
    };
    const t = setInterval(check, 15000);
    const idleT = setInterval(maybeSwap, 5000);
    // Leaving the tab is the cheapest moment there is, so take it immediately rather than waiting
    // up to 5s for the next tick.
    document.addEventListener("visibilitychange", maybeSwap);
    return () => {
      clearInterval(t);
      clearInterval(idleT);
      document.removeEventListener("visibilitychange", maybeSwap);
      for (const e of EVENTS) window.removeEventListener(e, touched, { capture: true });
    };
  }, []);
}

function App({ SystemViewService }) {
  const [connectedServices, setConnectedServices] = useState([]);
  useSelfUpdate();
  return (
    <ServiceContext.Provider
      value={{ SystemViewService, connectedServices, setConnectedServices }}
    >
      {/* RFC-053 — what a document is allowed to touch IN THIS APP, granted once at the root so
          every markdown surface inherits it: the docs tab, help, story panes, code comments, the
          chat. A block asks the bag; nothing in the registry knows which app it is running in. */}
      <MarkdownCapabilitiesProvider value={systemviewCapabilities}>
      <BannerStack />
      <Router>
        <DebugRouter>
          <Switch>
            <Route path="/reports/:projectCode?" exact>
              <Reports />
            </Route>
            <Route path="/context/:projectCode?" exact>
              <Context />
            </Route>
            <Route path="/agents/:projectCode?" exact>
              <Context />
            </Route>
            {/* The /ide pages are gone — the transition landed IN /specs (the husk model, the
                codebase card, the attached agent), so the "build it beside, swap when ready" page
                was superseded by never needing the swap. It preached the retired model ("a project
                here is a folder you picked and named") and nothing linked to it. */}
            <Route path="/specs/:projectCode?/:serviceId?/:moduleName?/:methodName?">
              <SystemView />
            </Route>
            <Redirect to="/specs" />
          </Switch>
        </DebugRouter>
      </Router>
      </MarkdownCapabilitiesProvider>
    </ServiceContext.Provider>
  );
}

export default App;
