import SystemViewer from "./pages/SystemViewer/SystemViewer";
import "./App.css";

import { useRoutes } from "hookrouter";

const App = () =>
  useRoutes({
    "/systemview": () => <SystemViewer />,
    "/systemview/:project*": ({ project }) => <SystemViewer project={project} />,
    "/systemview/:project/:document*": ({ project, document }) => (
      <SystemViewer project={project} document={document} />
    ),
  });

export default App;
