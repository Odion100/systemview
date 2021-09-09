import React from "react";
import TestCenterSection from "../../molecules/TestCenterSection/TestCenterSection";
import "./styles.scss";

const TestCenter = ({ project_code, service_id, module_name, method_name }) => {
  return (
    <section className="test-center">
      <div className="container">
        <div className="row">
          <TestCenterSection
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

export default TestCenter;
