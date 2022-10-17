import React, { useState, useContext, useEffect } from "react";
import "./styles.scss";
import DescriptionBox from "../../atoms/DescriptionBox/DescriptionBox";
import EditBox from "../../molecules/EditBox/EditBox";
import Title from "../../atoms/Title/Title";
import Markdown from "../../atoms/Markdown/Markdown";
import remarkGfm from "remark-gfm";
import ServiceContext from "../../ServiceContext";

const MethodDoc = ({ project_code, service_id, module_name, method_name }) => {
  const { MethodDocumentation } = useContext(ServiceContext).SystemViewService;
  const [doc, setDocument] = useState({
    project_code,
    service_id,
    module_name,
    method_name,
    description: "",
  });

  const fetchDocument = async () => {
    try {
      const results = await MethodDocumentation.get({
        project_code,
        service_id,
        module_name,
        method_name,
      });
      setDocument(results);
    } catch (error) {
      setDocument({ project_code, service_id, module_name, method_name });
      console.error(error);
    }
  };

  useEffect(() => {
    fetchDocument();
  }, [method_name, module_name, service_id]);

  return (
    <div className="documentation-view">
      <div className="row">
        <DocTitle
          service_id={service_id}
          module_name={module_name}
          method_name={method_name}
        />
      </div>
      <div className="row documentation-view__data-table">
        <DocDescription doc={doc} setDocument={setDocument} />
      </div>
    </div>
  );
};

const DocTitle = ({
  service_id,
  module_name,
  method_name,
  variable_name = "payload",
}) => {
  return (
    <Title
      text={
        <span className="documentation-view__title">
          {`${service_id}.${module_name}.${method_name}`}(
          <span className="documentation-view__parameter">{variable_name}</span>,
          [callback])
        </span>
      }
    />
  );
};

const DocDescription = ({ doc, setDocument }) => {
  const { MethodDocumentation } = useContext(ServiceContext).SystemViewService;
  let description = doc.description;
  const updateDescription = (new_description) => (description = new_description);

  const saveDescription = async (setFormDisplay) => {
    try {
      const results = await MethodDocumentation.saveDoc({
        project_code: doc.project_code,
        service_id: doc.service_id,
        module_name: doc.module_name,
        method_name: doc.method_name,
        description: description,
      });

      setDocument(results);
      setFormDisplay(false);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <EditBox
      mainObject={
        <Markdown
          children={doc.description || "What does this method do?"}
          remarkPlugins={[remarkGfm]}
        />
      }
      hiddenForm={
        <DescriptionBox text={doc.description || ""} setValue={updateDescription} />
      }
      formSubmit={saveDescription}
      stateChange={[doc.method_name, doc.module_name, doc.service_id]}
    />
  );
};

export default MethodDoc;
