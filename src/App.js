import React, { useState } from "react";
import SystemView from "./pages/SystemView/SystemView";
import ServiceContext from "./ServiceContext";
import { BrowserRouter as Router, Route, Redirect } from "react-router-dom";
console.log("file has loaded");
function App({ SystemViewService }) {
  const [connectedServices, setConnectedServices] = useState([]);
  console.log("App is running");
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
