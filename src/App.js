import React, { useState } from "react";
import SystemView from "./pages/SystemView/SystemView";
import Logs from "./pages/Logs/Logs";
import Reports from "./pages/Reports/Reports";
import ServiceContext from "./ServiceContext";
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

function App({ SystemViewService }) {
  const [connectedServices, setConnectedServices] = useState([]);
  return (
    <ServiceContext.Provider
      value={{ SystemViewService, connectedServices, setConnectedServices }}
    >
      <Router>
        <DebugRouter>
          <Switch>
            <Route path="/logs" exact>
              <Logs />
            </Route>
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
