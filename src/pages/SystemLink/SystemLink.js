import React, { useState } from "react";
import { useParams } from "react-router-dom";
import SystemNavigator from "../../organisms/SystemNavigator/SystemNavigator";
import Documentation from "../../organisms/Documentation/Documentation";
import "./styles.scss";

const SystemLinkPage = () => {
  const { project_code, service_id, module_name, method_name } = useParams();
  return (
    <section className="system-viewer">
      <div className="row">
        <div className="col-4">
          <SystemNavigator project_code={project_code} />
        </div>
        <div className="col-6">
          <Documentation
            project_code={project_code}
            service_id={service_id}
            module_name={module_name}
            method_name={method_name}
          />
        </div>
        <div className="col-2"></div>
      </div>
    </section>
  );
};

export default SystemLinkPage;
