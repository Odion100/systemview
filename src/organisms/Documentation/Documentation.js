import React from "react";
import "./styles.scss";
import MethodDocumentation from "../MethodDocumentation/MethodDocumentation";
import ModuleDocumentation from "../ModuleDocumentation/ModuleDocumentation";
import ServiceDocumentation from "../ServiceDocumentation/ServiceDocumentation";
import ProjectDocumentation from "../ProjectDocumentaton/ProjectDocumentation";

const Documentation = ({ project_code, service_id, module_name, method_name }) => {
  return (
    <section className="module-documentation">
      {method_name ? (
        <MethodDocumentation
          project_code={project_code}
          service_id={service_id}
          module_name={module_name}
          method_name={method_name}
        />
      ) : module_name ? (
        <ModuleDocumentation
          project_code={project_code}
          service_id={service_id}
          module_name={module_name}
        />
      ) : service_id ? (
        <ServiceDocumentation project_code={project_code} service_id={service_id} />
      ) : project_code ? (
        <ProjectDocumentation project_code={project_code} />
      ) : (
        <ProjectDocumentation project_code={project_code} />
      )}
    </section>
  );
};

export default Documentation;
