import React, { useState } from "react";
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

function App({ SystemViewService }) {
  const [connectedServices, setConnectedServices] = useState([]);
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
