import SystemLink from "./pages/SystemLink/SystemLink";

import { BrowserRouter as Router, Route } from "react-router-dom";

function App() {
  return (
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
  );
}

export default App;
