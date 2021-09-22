import React from "react";
import AuxillaryTestSection from "../../organisms/AuxillaryTestSection/AuxillaryTestSection";
import "./styles.scss";

const TestBeforeSection = ({ project_code, service_id, module_name, method_name }) => {
  return (
    <AuxillaryTestSection
      project_code={project_code}
      service_id={service_id}
      module_name={module_name}
      method_name={method_name}
      caption="Test Before"
    />
  );
};

export default TestBeforeSection;
