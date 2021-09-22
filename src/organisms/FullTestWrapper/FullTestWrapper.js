import React from "react";
import TestBeforeSection from "../TestBeforeSection/TestBeforeSection";
import TestAfterSection from "../TestAfterSection/TestAfterSection";
import MainTestSection from "../MainTestSection/MainTestSection";

const FullTestWrapper = ({ project_code, service_id, module_name, method_name }) => {
  return (
    <>
      <div className="row test-panel__section">
        <TestBeforeSection
          project_code={project_code}
          service_id={service_id}
          module_name={module_name}
          method_name={method_name}
        />
      </div>
      <div className="row test-panel__section">
        <MainTestSection
          project_code={project_code}
          service_id={service_id}
          module_name={module_name}
          method_name={method_name}
        />
      </div>
      <div className="row test-panel__section">
        <TestAfterSection
          project_code={project_code}
          service_id={service_id}
          module_name={module_name}
          method_name={method_name}
        />
      </div>
    </>
  );
};

export default FullTestWrapper;
