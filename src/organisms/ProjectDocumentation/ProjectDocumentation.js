import React from "react";
import "./styles.scss";
import Title from "../../atoms/Title/Title";

const ProjectDocumentation = ({ projectCode }) => {
  return (
    <section className="project-documentation">
      <Title text={`Project Documentation:${projectCode}`} />
    </section>
  );
};

export default ProjectDocumentation;
