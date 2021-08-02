import React, { useState, useContext, useEffect } from "react";
import ProjectDocumentation from "../ProjectDocumentation/ProjectDocumentation";
import ServiceDocumentation from "../ServiceDocumentation/ServiceDocumentation";
import ModuleDocumentation from "../ModuleDocumentation/ModuleDocumentation";
import MethodDocumentation from "../MethodDocumentation/MethodDocumentation";
import Title from "../../atoms/Title/Title";
import "./styles.scss";

const Documentation = ({ project_code, service_id, module_name, method_name }) => {
  return (
    <section className="documentation">
      {method_name && module_name && service_id && project_code ? (
        <MethodDocumentation
          method_name={method_name}
          module_name={module_name}
          service_id={service_id}
          project_code={project_code}
        />
      ) : module_name && service_id && project_code ? (
        <ModuleDocumentation
          module_name={module_name}
          service_id={service_id}
          project_code={project_code}
        />
      ) : service_id && project_code ? (
        <ServiceDocumentation service_id={service_id} project_code={project_code} />
      ) : project_code ? (
        <ProjectDocumentation project_code={project_code} />
      ) : (
        <Title text={`Default Documentation`} />
      )}
    </section>
  );
};

export default Documentation;
