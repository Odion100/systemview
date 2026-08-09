import React, { useEffect, useState } from "react";
import SystemView from "./pages/SystemView/SystemView";
import Reports from "./pages/Reports/Reports";
import ServiceContext from "./ServiceContext";
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
    const current = (() => {
      const s = document.querySelector('script[src*="static/js/main."]');
      const m = s && s.src.match(/main\.[a-z0-9]+\.js/);
      return m ? m[0] : null;
    })();
    if (!current) return undefined;
    const check = async () => {
      try {
        const res = await fetch("/sv-bundle");
        const { bundle } = await res.json();
        if (!bundle || bundle === current) return;
        if (sessionStorage.getItem("sv.reloadedFor") === bundle) return; // loop-guard
        sessionStorage.setItem("sv.reloadedFor", bundle);
        window.location.reload();
      } catch {}
    };
    const t = setInterval(check, 15000);
    return () => clearInterval(t);
  }, []);
}

function App({ SystemViewService }) {
  const [connectedServices, setConnectedServices] = useState([]);
  useSelfUpdate();
  return (
    <ServiceContext.Provider
      value={{ SystemViewService, connectedServices, setConnectedServices }}
    >
      <BannerStack />
      <Router>
        <DebugRouter>
          <Switch>
            <Route path="/reports/:projectCode?" exact>
              <Reports />
            </Route>
            <Route path="/specs/:projectCode?/:serviceId?/:moduleName?/:methodName?">
              <SystemView />
            </Route>
            <Redirect to="/specs" />
          </Switch>
        </DebugRouter>
      </Router>
    </ServiceContext.Provider>
  );
}

export default App;
