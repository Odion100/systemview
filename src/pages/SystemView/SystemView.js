import React from "react";
import { useParams } from "react-router-dom";
import SystemNavigator from "../../organisms/SystemNavigator/SystemNavigator";
import Documentation from "../../organisms/Documentation/Documentation";
import TestPanel from "../../organisms/TestPanel/TestPanel";
import "./styles.scss";

const SystemViewPage = () => {
  const { projectCode, serviceId, moduleName, methodName } = useParams();
  return (
    <section className="system-viewer">
      <div className="page-header"></div>
      <div className="row">
        <div className="col-3">
          <SystemNavigator
            projectCode={projectCode}
            serviceId={serviceId}
            moduleName={moduleName}
            methodName={methodName}
          />
        </div>
        <div className="col-6">
          <Documentation
            projectCode={projectCode}
            serviceId={serviceId}
            moduleName={moduleName}
            methodName={methodName}
          />
        </div>
        <div className="col-3">
          <TestPanel
            projectCode={projectCode}
            serviceId={serviceId}
            moduleName={moduleName}
            methodName={methodName}
          />
        </div>
      </div>
    </section>
  );
};

export default SystemViewPage;
