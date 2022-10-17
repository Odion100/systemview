import React, { useState } from "react";
import SystemView from "./pages/SystemView/SystemView";
import ServiceContext from "./ServiceContext";
import { BrowserRouter as Router, Route } from "react-router-dom";

function App({ SystemViewService }) {
  const [ConnectedProject, setConnectedProject] = useState([]);

  return (
    <ServiceContext.Provider
      value={{ SystemViewService, ConnectedProject, setConnectedProject }}
    >
      <Router>
        <Route
          path={[
            "/:project_code/:service_id/:module_name/:method_name",
            "/:project_code/:service_id/:module_name",
            "/:project_code/:service_id",
            "/:project_code/",
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
