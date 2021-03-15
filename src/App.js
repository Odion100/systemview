import SystemLink from "./pages/SystemLink/SystemLink";
import "./App.css";

import { useRoutes, useRedirect } from "hookrouter";

const App = () => {
  useRedirect("/", "/systemlink/");
  return useRoutes({
    "/systemlink/": () => <SystemLink />,
    "/systemlink/:project*": ({ project }) => <SystemLink project={project} />,
    "/systemlink/:project/:document*": ({ project, document }) => (
      <SystemLink project={project} document={document} />
    ),
  });
};

export default App;
