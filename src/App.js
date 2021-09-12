import React, { useState } from "react";
import SystemLink from "./pages/SystemLink/SystemLink";
import ServiceContext from "./ServiceContext";
import { BrowserRouter as Router, Route } from "react-router-dom";

function App({ SystemLinkService }) {
  const [TestServices, setServices] = useState([]);

  return (
    <ServiceContext.Provider value={{ SystemLinkService, TestServices, setServices }}>
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
          <SystemLink />
        </Route>
      </Router>
    </ServiceContext.Provider>
  );
}

export default App;
