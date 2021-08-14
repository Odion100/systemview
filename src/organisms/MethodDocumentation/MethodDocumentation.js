import React, { useState, useContext, useEffect } from "react";
import "./styles.scss";
import Text from "../../atoms/Text/Text";
import DescriptionText from "../../atoms/DescriptionText/DescriptionText";
import DescriptionBox from "../../atoms/DescriptionBox/DescriptionBox";
import EditBox from "../../molecules/EditBox/EditBox";
import DataTableForm from "../../molecules/DataTableForm/DataTableForm";
import Title from "../../atoms/Title/Title";
import ServiceContext from "../../ServiceContext";

const MethodDoc = ({ project_code, service_id, module_name, method_name }) => {
  const { MethodDocumentation } = useContext(ServiceContext).SystemLinkService;
  const [doc, setDocument] = useState({});

  const fetchDocument = async () => {
    try {
      const results = await MethodDocumentation.get({
        project_code,
        service_id,
        module_name,
        method_name,
      });
      if (results.status === 200) setDocument(results.documentation);
      else setDocument({});
    } catch (error) {
      setDocument({});
      console.error(error);
    }
  };

  useEffect(() => {
    fetchDocument();
  }, [method_name]);

  return (
    <div className="documentation-view">
      <div className="row">
        <DocTitle service_id={service_id} module_name={module_name} method_name={method_name} />
      </div>

      <div className="row">
        <RequestDescription doc={doc} setDocument={setDocument} />
      </div>
      <div className="row">
        <RequestDataTable doc={doc} setDocument={setDocument} />
      </div>
    </div>
  );
};

const DocTitle = ({ service_id, module_name, method_name, variable_name = "data" }) => {
  return (
    <Title
      text={
        <span>
          {`${service_id}.${module_name}.${method_name}`}(
          <span className="documentation-view__parameter">{variable_name}</span>, callback)
        </span>
      }
    />
  );
};

const RequestDescription = ({ doc, setDocument }) => {
  const { MethodDocumentation } = useContext(ServiceContext).SystemLinkService;
  let description = doc.description;
  const updateDescription = (new_description) => (description = new_description);

  const saveDescription = async () => {
    try {
      const results = await MethodDocumentation.saveDoc({
        project_code: doc.project_code,
        service_id: doc.service_id,
        module_name: doc.module_name,
        method_name: doc.method_name,
        description: description,
      });

      if (results.status === 200) setDocument(results.documentation);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <EditBox
      mainObject={<DescriptionText text={doc.description || "What does this methed do?"} />}
      hiddenForm={<DescriptionBox text={doc.description} setValue={updateDescription} />}
      formSubmit={saveDescription}
    />
  );
};

const RequestDataTable = ({ doc, setDocument }) => {
  const { MethodDocumentation } = useContext(ServiceContext).SystemLinkService;
  const mockData = [
    {
      name: "test",
      data_type: "String",
      description: "The best thing ever!",
      default_value: "nothing",
      required: false,
    },
  ];
  const saveRequestData = async (request_data) => {
    return console.log(request_data);
    try {
      const results = await MethodDocumentation.saveDoc({
        project_code: doc.project_code,
        service_id: doc.service_id,
        module_name: doc.module_name,
        method_name: doc.method_name,
        request_data: request_data,
      });

      if (results.status === 200) setDocument(results.documentation);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <React.Fragment>
      <Text
        text={
          <span>
            The following table describes the properties of the{" "}
            <span className="documentation-view__parameter">data</span> parameter of the above
            method.
          </span>
        }
      />
      <DataTableForm data={mockData || doc.request_data} submit={saveRequestData} />
    </React.Fragment>
  );
};
const ResponseDataTable = () => {};
export default MethodDoc;
