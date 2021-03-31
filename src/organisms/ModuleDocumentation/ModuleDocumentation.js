import React from "react";
import "./styles.scss";
import Title from "../../atoms/Title/Title";

const ModuleDocumentation = ({ project, service, module }) => {
  return (
    <section className="module-documentation">
      <Title text={`${module}`} />
    </section>
  );
};

export default ModuleDocumentation;
