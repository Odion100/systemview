import React from "react";
import TestDataSection from "../../organisms/TestDataSection/TestDataSection";
import "./styles.scss";

const TestPanel = ({ project_code, service_id, module_name, method_name }) => {
  return (
    <section className="test-center">
      <div className="container">
        <div className="row">
          <TestDataSection
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

export default TestPanel;
