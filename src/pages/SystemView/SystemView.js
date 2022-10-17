import React from "react";
import { useParams } from "react-router-dom";
import SystemNavigator from "../../organisms/SystemNavigator/SystemNavigator";
import Documentation from "../../organisms/Documentation/Documentation";
import TestPanel from "../../organisms/TestPanel/TestPanel";
import "./styles.scss";

const SystemViewPage = () => {
  const { project_code, service_id, module_name, method_name } = useParams();
  return (
    <section className="system-viewer">
      <div className="page-header"></div>
      <div className="row">
        <div className="col-3">
          <SystemNavigator
            project_code={project_code}
            service_id={service_id}
            module_name={module_name}
            method_name={method_name}
          />
        </div>
        <div className="col-6">
          <Documentation
            project_code={project_code}
            service_id={service_id}
            module_name={module_name}
            method_name={method_name}
          />
        </div>
        <div className="col-3">
          <TestPanel
            project_code={project_code}
            service_id={service_id}
            module_name={module_name}
            method_name={method_name}
          />
        </div>
      </div>
    </section>
  );
};

export default SystemViewPage;
