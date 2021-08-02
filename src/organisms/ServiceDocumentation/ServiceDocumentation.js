import React from "react";
import "./styles.scss";
import Title from "../../atoms/Title/Title";

const ServiceDocumentation = ({ service_id }) => {
  return (
    <section className="service-documentation">
      <Title text={`Service Documentation:${service_id}`} />
    </section>
  );
};

export default ServiceDocumentation;
