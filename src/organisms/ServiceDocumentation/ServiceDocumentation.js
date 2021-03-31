import React from "react";
import "./styles.scss";
import Title from "../../atoms/Title/Title";

const ServiceDocumentation = ({ project_code, service_id }) => {
  return (
    <section className="service-documentation">
      <Title text={service_id} />
    </section>
  );
};

export default ServiceDocumentation;
