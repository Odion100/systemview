import React, { useState } from "react";
import { useRouteMatch, useParams, Route, Switch } from "react-router-dom";
import SystemNavigator from "../../organisms/SystemNavigator/SystemNavigator";
import Documentation from "../../organisms/Documentation/Documentation";
import "./styles.scss";

const SystemLink = () => {
  return (
    <section className="system-viewer">
      <div className="row">
        <div className="col-4">
          <SystemNavigator />
        </div>
        <div className="col-6">
          <Route
            path={[
              "/:project_code/:service_id/:module_name/:method_name",
              "/:project_code/:service_id/:module_name",
              "/:project_code/:service_id",
              "/:project_code/",
              "/",
            ]}
          >
            <DocumentationSection />
          </Route>
        </div>
        <div className="col-2"></div>
      </div>
    </section>
  );
};
const DocumentationSection = () => {
  const { project_code, service_id, module_name, method_name } = useParams();
  return (
    <Documentation
      project_code={project_code}
      service_id={service_id}
      module_name={module_name}
      method_name={method_name}
    />
  );
};
export default SystemLink;
