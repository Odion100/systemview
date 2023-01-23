import React, { useState } from "react";
import SystemView from "./pages/SystemView/SystemView";
import ServiceContext from "./ServiceContext";
import { BrowserRouter as Router, Route } from "react-router-dom";

function App({ SystemViewService }) {
  const [connectedServices, setConnectedServices] = useState([]);

  return (
    <ServiceContext.Provider
      value={{ SystemViewService, connectedServices, setConnectedServices }}
    >
      <Router>
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
      </Router>
    </ServiceContext.Provider>
  );
}

export default App;
