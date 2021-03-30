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

const MethodDoc = ({ project_code, service_id, module_name, method_name, document }) => {
  const { MethodDocumentation } = useContext(ServiceContext).SystemLinkService;
  const [description, setDescription] = useState("What does this method do?");
  const [request_data, setRequestData] = useState({});
  const [response_data, setResonseData] = useState({});
  const [triggered_events, setTriggeredEvents] = useState({});
  console.log(project_code, service_id, module_name, method_name);
  const saveDescription = async (description) => {
    try {
      const { methodDocumentation, status } = await MethodDocumentation.saveDoc({
        project_code,
        service_id,
        module_name,
        method_name,
        description,
      });
      if (status === 200) setDescription(methodDocumentation);
    } catch (error) {
      console.error(error);
    }
  };
  const descriptionBoxSubmit = () => saveDescription(description);

  return (
    <div className="documentation-view">
      <div className="row">
        <Title
          text={
            <span>
              Basketball.Users.add(<span className="documentation-view__parameter">data</span>,
              callback)
            </span>
          }
        />
      </div>

      <div className="row">
        <EditBox
          mainObject={<DescriptionText text={description} />}
          hiddenForm={<DescriptionBox text={description} setValue={setDescription} />}
          formSubmit={descriptionBoxSubmit}
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
