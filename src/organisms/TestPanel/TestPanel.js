import React from "react";
import TestBeforeSection from "../TestBeforeSection/TestBeforeSection";
import TestAfterSection from "../TestAfterSection/TestAfterSection";
import FullTestSection from "../FullTestSection/FullTestSection";
import TestSavedSection from "../TestSavedSection/TestSavedSection";
import Title from "../../atoms/Title/Title";
import "./styles.scss";

const TestPanel = ({ project_code, service_id, module_name, method_name }) => {
  return (
    <section className="test-panel">
      <div className="container">
        <div className="row">
          <Title text="SystemLink Test Panel" />
        </div>
        <div className="row test-panel__section">
          <TestBeforeSection
            project_code={project_code}
            service_id={service_id}
            module_name={module_name}
            method_name={method_name}
          />
        </div>
        <div className="row test-panel__section">
          <FullTestSection
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
