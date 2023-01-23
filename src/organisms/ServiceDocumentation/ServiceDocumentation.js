import React from "react";
import "./styles.scss";
import Title from "../../atoms/Title/Title";

const ServiceDocumentation = ({ serviceId }) => {
  return (
    <section className="service-documentation">
      <Title text={`Service Documentation:${serviceId}`} />
    </section>
  );
};

export default ServiceDocumentation;
