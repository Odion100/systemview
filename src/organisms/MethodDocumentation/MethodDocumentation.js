import React, { useState, useContext } from "react";
import "./styles.scss";
import Text from "../../atoms/Text/Text";
import DescriptionText from "../../atoms/DescriptionText/DescriptionText";
import DescriptionBox from "../../atoms/DescriptionBox/DescriptionBox";
import EditBox from "../../molecules/EditBox/EditBox";
import DataTable from "../../atoms/DataTable/DataTable";
import MethodDataForm from "../../molecules/MethodDataForm/MethodDataForm";
import Title from "../../atoms/Title/Title";
import ServiceContext from "../../ServiceContext";

const MethodDoc = ({
  project_code,
  service_id,
  module_name,
  method_name,
  document,
  fetchDocument,
}) => {
  const { MethodDocumentation } = useContext(ServiceContext).SystemLinkService;
  const [description, setDescription] = useState(document.description);
  console.log(description, project_code, service_id, module_name, method_name, document);
  const saveDescription = async () => {
    console.log(description, project_code, service_id, module_name, method_name, document);
    try {
      const { status } = await MethodDocumentation.saveDoc({
        project_code,
        service_id,
        module_name,
        method_name,
        description,
      });
      if (status === 200) fetchDocument();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="documentation-view">
      <div className="row">
        <Title
          text={
            <span>
              {`${service_id}.${module_name}.${method_name}`}(
              <span className="documentation-view__parameter">data</span>, callback)
            </span>
          }
        />
      </div>

      <div className="row">
        <EditBox
          mainObject={
            <DescriptionText text={document.description || "What does this methed do?"} />
          }
          hiddenForm={<DescriptionBox text={document.description} setValue={setDescription} />}
          formSubmit={saveDescription}
        />
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

export default MethodDoc;
