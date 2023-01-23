import React from "react";
import SavedTests from "../SavedTests/SavedTests";
import FullTest from "../FullTest/FullTest";
import Title from "../../atoms/Title/Title";
import "./styles.scss";

const TestPanel = ({ projectCode, serviceId, moduleName, methodName }) => {
  return (
    <section className="test-panel">
      <div className="container">
        <div className="row">
          <Title text="Scratch Pad" />
        </div>
        <FullTest
          projectCode={projectCode}
          serviceId={serviceId}
          moduleName={moduleName}
          methodName={methodName}
        />

        <div className="row test-panel__section">
          <SavedTests
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

export default TestPanel;
