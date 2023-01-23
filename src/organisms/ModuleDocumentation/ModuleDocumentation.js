import React from "react";
import "./styles.scss";
import Title from "../../atoms/Title/Title";

const ModuleDocumentation = ({ moduleName }) => {
  return (
    <section className="module-documentation">
      <Title text={`Module Documetation:${moduleName}`} />
    </section>
  );
};

export default ModuleDocumentation;
