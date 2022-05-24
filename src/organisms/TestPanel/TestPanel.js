import React from "react";
import TestSavedSection from "../TestSavedSection/TestSavedSection";
import FullTest from "../FullTest/FullTest";
import Title from "../../atoms/Title/Title";
import "./styles.scss";

const TestPanel = ({ project_code, service_id, module_name, method_name }) => {
  return (
    <section className="test-panel">
      <div className="container">
        <div className="row">
          <Title text="Scratch Pad" />
        </div>
        <FullTest
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
