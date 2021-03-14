import SystemViewer from "./pages/SystemViewer/SystemViewer";
import "./App.css";

import { useRoutes, useRedirect } from "hookrouter";

const App = () => {
  useRedirect("/", "/systemview/");
  return useRoutes({
    "/systemview/": () => <SystemViewer />,
    "/systemview/:project*": ({ project }) => <SystemViewer project={project} />,
    "/systemview/:project/:document*": ({ project, document }) => (
      <SystemViewer project={project} document={document} />
    ),
  });
};

export default App;
