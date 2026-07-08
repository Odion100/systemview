import React from "react";
import { useParams, Link } from "react-router-dom";
import SystemNavigator from "../../organisms/SystemNavigator/SystemNavigator";
import Documentation from "../../organisms/Documentation/Documentation";
import TestPanel from "../../organisms/TestPanel/TestPanel";
import LOGO from "../../assets/sysly.png";
import "./styles.scss";
const { version: VERSION } = require("../../../package.json");

const SystemViewPage = () => {
  const { projectCode, serviceId, moduleName, methodName } = useParams();
  return (
    <section className="system-viewer">
      <div className="page-header">
        <span
          style={{
            fontSize: "28px",
            fontFamily: "Malkor",
            color: "#3f51b5",
            marginRight: "10px",
            textShadow: "1px 1px 2px #d6cbca",
          }}
        >
          SystemView
        </span>
        <img src={LOGO} alt="logo" />
        <Link to="/logs" className="logs-nav-link">
          Logs
        </Link>
        <span
          style={{
            position: "absolute",
            fontFamily: "Malkor",
            left: "40px",
            fontSize: "18px",
            color: "#2db432",
          }}
        >
          v{VERSION}
        </span>
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
