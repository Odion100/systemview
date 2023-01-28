import React from "react";
import SavedTests from "../SavedTests/SavedTests";
import FullTest from "../FullTest/FullTest";
import Title from "../../atoms/Title/Title";
import "./styles.scss";
import TestsIcon from "../../atoms/TestsIcon/TestsIcon";
import { SavedFile } from "../../atoms/StatusIndicator/StatusIndicator";

const TestPanel = ({ projectCode, serviceId, moduleName, methodName }) => {
  return (
    <section className="test-panel">
      <div className="container">
        <div className="row">
          <Title text="Scratch Pad" /> <SavedFile name={""} />
        </div>
        <FullTest
          projectCode={projectCode}
          serviceId={serviceId}
          moduleName={moduleName}
          methodName={methodName}
        />
      </div>
    </section>
  );
};

export default TestPanel;
