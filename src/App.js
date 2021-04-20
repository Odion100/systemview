import SystemLink from "./pages/SystemLink/SystemLink";
import "./App.css";

import { useRoutes, useRedirect } from "hookrouter";
const Routes = {
  "/systemlink": () => {
    console.log(-1);
    return <SystemLink />;
  },
  "/systemlink/:project*": ({ project }) => {
    console.log(0);
    return <SystemLink project_code={project} />;
  },
};
const App = () => {
  useRedirect("/", "/systemlink");
  return useRoutes(Routes);
};

export default App;
