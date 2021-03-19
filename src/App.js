import SystemLink from "./pages/SystemLink/SystemLink";
import "./App.css";

import { useRoutes, useRedirect } from "hookrouter";
const Routes = {
  "/systemlink": () => {
    console.log(-1);
    return <SystemLink />;
  },
  "/systemlink/:project": ({ project }) => {
    console.log(0);
    return <SystemLink project={project} />;
  },
  "/systemlink/:project/:service": ({ project, service }) => {
    console.log(1);
    return <SystemLink project={project} service={service} />;
  },
  "/systemlink/:project/:service/:module": ({ project, service, module }) => {
    console.log(2);
    return <SystemLink project={project} service={service} module={module} />;
  },
  "/systemlink/:project/:service/:module/:method": ({ project, service, module, method }) => {
    console.log(3);
    return <SystemLink project={project} service={service} module={module} method={method} />;
  },
};
const App = () => {
  useRedirect("/", "/systemlink");
  return useRoutes(Routes);
};

export default App;
