import React, { useState, useContext, useEffect } from "react";
import ServiceContext from "../../ServiceContext";
import "./styles.scss";
import MethodDoc from "../MethodDocumentation/MethodDocumentation";
import ModuleDoc from "../ModuleDocumentation/ModuleDocumentation";
import ServiceDoc from "../ServiceDocumentation/ServiceDocumentation";
import ProjectDoc from "../ProjectDocumentaton/ProjectDocumentation";

const Documentation = ({ project_code, service_id, module_name, method_name }) => {
  const {
    ProjectDocumentation,
    ServiceDocumentation,
    ModuleDocumentation,
    MethodDocumentation,
  } = useContext(ServiceContext).SystemLinkService;
  const [doc, setDocument] = useState({});

  const fetchDocument = async () => {
    let results = {};
    console.log(project_code);
    try {
      switch (true) {
        case method_name:
          results = await MethodDocumentation.get({
            project_code,
            service_id,
            module_name,
            method_name,
          });
          break;
        case module_name:
          results = await ModuleDocumentation.get({
            project_code,
            service_id,
            module_name,
          });
          break;
        case service_id:
          results = await ServiceDocumentation.get({
            project_code,
            service_id,
            module_name,
          });
          break;
        case project_code:
          results = await ProjectDocumentation.get({
            project_code,
            service_id,
            module_name,
          });
          break;
        default:
          break;
      }
      if (results.status === 200) setDocument(results.services);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => fetchDocument(), []);

  return (
    <section className="documentation">
      {method_name ? (
        <MethodDoc
          project_code={project_code}
          service_id={service_id}
          module_name={module_name}
          method_name={method_name}
          document={doc}
          fetchDocument={fetchDocument}
        />
      ) : module_name ? (
        <ModuleDoc
          project_code={project_code}
          service_id={service_id}
          module_name={module_name}
          document={doc}
          fetchDocument={fetchDocument}
        />
      ) : service_id ? (
        <ServiceDoc
          project_code={project_code}
          service_id={service_id}
          document={doc}
          fetchDocument={fetchDocument}
        />
      ) : project_code ? (
        <ProjectDoc project_code={project_code} document={doc} fetchDocument={fetchDocument} />
      ) : (
        <ProjectDoc project_code={project_code} document={doc} fetchDocument={fetchDocument} />
      )}
    </section>
  );
};

export default Documentation;
