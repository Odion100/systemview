import React from "react";
import "./styles.scss";
import Title from "../../atoms/Title/Title";

const ServiceDocumentation = ({ project, service }) => {
  return (
    <section className="service-documentation">
      <Title text={"Basketball"} />
    </section>
  );
};

export default ServiceDocumentation;
