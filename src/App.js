import SystemViewer from "./pages/SystemViewer/SystemViewer";
import "./App.css";

import { useRoutes } from "hookrouter";

const App = () =>
  useRoutes({
    "/": () => <SystemViewer />,
  });

export default App;
