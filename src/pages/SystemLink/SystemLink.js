import React from "react";
import "./styles.scss";
import SystemNavigator from "../../organisms/SystemNavigator/SystemNavigator";
import MethodDocumentation from "../../organisms/MethodDocumentation/MethodDocumentation";

const SystemViewer = ({ project, service, module, method }) => {
  console.log(project, service, module, method);
  return (
    <section className="system-viewer">
      <div className="row">
        <div className="col-4">
          <SystemNavigator project_code={project} />
        </div>
        <div className="col-6">
          <MethodDocumentation />
        </div>
        <div className="col-2"></div>
      </div>
    </section>
  );
};

export default SystemViewer;
