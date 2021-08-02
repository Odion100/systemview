import React from "react";
import "./styles.scss";
import Title from "../../atoms/Title/Title";

const ModuleDocumentation = ({ module_name }) => {
  return (
    <section className="module-documentation">
      <Title text={`Module Documetation:${module_name}`} />
    </section>
  );
};

export default ModuleDocumentation;
