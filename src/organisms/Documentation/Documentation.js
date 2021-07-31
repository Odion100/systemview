import React, { useState, useContext, useEffect } from "react";
import { useRouteMatch, useParams, Route, Switch } from "react-router-dom";
import ProjectDocumentation from "../ProjectDocumentation/ProjectDocumentation";
import ServiceDocumentation from "../ServiceDocumentation/ServiceDocumentation";
import ModuleDocumentation from "../ModuleDocumentation/ModuleDocumentation";
import MethodDocumentation from "../MethodDocumentation/MethodDocumentation";
import Title from "../../atoms/Title/Title";
import "./styles.scss";

const Documentation = () => {
  return (
    <section className="documentation">
      <Switch>
        <Route exact path={"/"}>
          <Title text={`Default Documentation`} />
        </Route>
        <Route
          path={[
            "/:project_code/:service_id/:module_name/:method_name",
            "/:project_code/:service_id/:module_name",
            "/:project_code/:service_id",
            "/:project_code/",
          ]}
        >
          <RenderDocument />
        </Route>
      </Switch>
    </section>
  );
};

const RenderDocument = () => {
  const { project_code, service_id, module_name, method_name } = useParams();

  if (method_name && module_name && service_id && project_code) return <MethodDocumentation />;
  else if (module_name && service_id && project_code) return <ModuleDocumentation />;
  else if (service_id && project_code) return <ServiceDocumentation />;
  else if (project_code) return <ProjectDocumentation />;
  else return <Title text={`Default Documentation`} />;
};
export default Documentation;
