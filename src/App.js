import React, { useState } from "react";
import SystemView from "./pages/SystemView/SystemView";
import Logs from "./pages/Logs/Logs";
import ServiceContext from "./ServiceContext";
import { BrowserRouter as Router, Route, Switch } from "react-router-dom";
function App({ SystemViewService }) {
  const [connectedServices, setConnectedServices] = useState([]);
  return (
    <ServiceContext.Provider
      value={{ SystemViewService, connectedServices, setConnectedServices }}
    >
      <Router>
        <Switch>
          <Route path="/logs" exact>
            <Logs />
          </Route>
          <Route
            path={[
              "/:projectCode/:serviceId/:moduleName/:methodName",
              "/:projectCode/:serviceId/:moduleName",
              "/:projectCode/:serviceId",
              "/:projectCode/",
              "/",
            ]}
          >
            <SystemView />
          </Route>
        </Switch>
      </Router>
    </ServiceContext.Provider>
  );
}

export default App;
