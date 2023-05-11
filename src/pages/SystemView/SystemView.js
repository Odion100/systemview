import React from "react";
import { useParams } from "react-router-dom";
import SystemNavigator from "../../organisms/SystemNavigator/SystemNavigator";
import Documentation from "../../organisms/Documentation/Documentation";
import TestPanel from "../../organisms/TestPanel/TestPanel";
import LOGO from "../../assets/sysly.png";
import "./styles.scss";

const SystemViewPage = () => {
  const { projectCode, serviceId, moduleName, methodName } = useParams();
  return (
    <section className="system-viewer">
      <div className="page-header">
        <span
          style={{
            fontSize: "28px",
            fontFamily: "Malkor",
            color: "#6886ba",
            marginRight: "10px",
            textShadow: "1px 1px 2px #d6cbca",
          }}
        >
          SystemView
        </span>
        <img src={LOGO} alt="logo" />
        {/* <span
          style={{
            fontSize: "28px",
            fontFamily: "Malkor",
            color: "#6886ba",
            marginLeft: "10px",
            textShadow: "1px 1px 2px #d6cbca",
          }}
        >
          SystemLynx
        </span> */}
      </div>
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
