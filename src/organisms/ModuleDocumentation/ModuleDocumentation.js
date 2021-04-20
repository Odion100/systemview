import React from "react";
import "./styles.scss";
import Title from "../../atoms/Title/Title";

const ModuleDocumentation = ({ project_code, service_id, module_name }) => {
  return (
    <section className="module-documentation">
      <Title text={`${service_id}.${module_name}`} />
    </section>
  );
};

export default ModuleDocumentation;
