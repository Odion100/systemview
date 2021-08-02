import React from "react";
import "./styles.scss";
import Title from "../../atoms/Title/Title";

const ProjectDocumentation = ({ project_code }) => {
  return (
    <section className="project-documentation">
      <Title text={`Project Documentation:${project_code}`} />
    </section>
  );
};

export default ProjectDocumentation;
