import React, { useState, useContext, useEffect } from "react";
import "./styles.scss";
import Text from "../../atoms/Text/Text";
import DescriptionText from "../../atoms/DescriptionText/DescriptionText";
import DescriptionBox from "../../atoms/DescriptionBox/DescriptionBox";
import EditBox from "../../molecules/EditBox/EditBox";
import DataTable from "../../atoms/DataTable/DataTable";
import MethodDataForm from "../../molecules/MethodDataForm/MethodDataForm";
import Title from "../../atoms/Title/Title";
import ServiceContext from "../../ServiceContext";

const MethodDoc = ({ project_code, service_id, module_name, method_name }) => {
  const { MethodDocumentation } = useContext(ServiceContext).SystemLinkService;
  const [doc, setDocument] = useState({});

  const fetchDocument = async () => {
    console.log(project_code);
    try {
      const results = await MethodDocumentation.get({
        project_code,
        service_id,
        module_name,
        method_name,
      });
      if (results.status === 200) setDocument(results.documentation);
      else setDocument({});
      console.log(results);
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
        <RequestDescription doc={doc} />
      </div>
      <div className="row">
        <div>
          <Text
            text={
              <span>
                The following table describes the properties of the{" "}
                <span className="documentation-view__parameter">data</span> parameter of the above
                method.
              </span>
            }
          />
        </div>
        <EditBox
          mainObject={
            <DataTable
              table={[
                ["id", "Object", "MongoDB object id of the user you are adding", "n/a", "true"],
              ]}
              headers={[
                { name: "Property" },
                { name: "Type" },
                { name: "Description" },

                { name: "Defalut" },
                { name: "required" },
              ]}
            />
          }
          hiddenForm={
            <MethodDataForm
              data={[["id", "Object", "MongoDB object id of the user you are adding", "n/a", true]]}
            />
          }
        />
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

const RequestDescription = ({ doc }) => {
  const { MethodDocumentation } = useContext(ServiceContext).SystemLinkService;

  const saveDoc = async () => {
    try {
      const { status } = await MethodDocumentation.saveDoc({
        project_code: doc.project_code,
        service_id: doc.service_id,
        module_name: doc.module_name,
        method_name: doc.method_name,
        description: doc.description,
      });
      //if (status === 200) fetchDocument();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <EditBox
      mainObject={<DescriptionText text={doc.description || "What does this methed do?"} />}
      hiddenForm={<DescriptionBox text={doc.description} />}
      formSubmit={saveDoc}
    />
  );
};
const RequestDataTable = () => {};
const ResponseDataTable = () => {};
export default MethodDoc;
