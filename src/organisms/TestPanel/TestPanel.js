import React from "react";
import TestSavedSection from "../TestSavedSection/TestSavedSection";
import FullTestWrapper from "../FullTestWrapper/FullTestWrapper";
import Title from "../../atoms/Title/Title";
import "./styles.scss";

const TestPanel = ({ project_code, service_id, module_name, method_name }) => {
  return (
    <section className="test-panel">
      <div className="container">
        <div className="row">
          <Title text="SystemLink Test Panel" />
        </div>
        <FullTestWrapper
          project_code={project_code}
          service_id={service_id}
          module_name={module_name}
          method_name={method_name}
        />

        <div className="row test-panel__section">
          <TestSavedSection
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
