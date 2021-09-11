import React from "react";
import QuickTestSection from "../QuickTestSection/QuickTestSection";
import "./styles.scss";

const FullTestSection = ({ project_code, service_id, module_name, method_name }) => {
  return (
    <section className="current-data-section">
      <QuickTestSection
        project_code={project_code}
        service_id={service_id}
        module_name={module_name}
        method_name={method_name}
        title="Test:"
        open={true}
      />
    </section>
  );
};

export default FullTestSection;
