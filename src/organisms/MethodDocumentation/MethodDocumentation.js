import React from "react";
import "./styles.scss";
import Text from "../../atoms/Text/Text";
import DescriptionEditor from "../../molecules/DescriptionEditor/DescriptionEditor";
import DescriptionText from "../../atoms/DescriptionText/DescriptionText";
import DescriptionBox from "../../atoms/DescriptionBox/DescriptionBox";
import EditBox from "../../molecules/EditBox/EditBox";
import TableEditor from "../../molecules/TableEditor/TableEditor";

import Title from "../../atoms/Title/Title";

const Documentation = ({ doc_type }) => {
  return (
    <div className="documentation-view">
      <div className="row">
        <Title
          text={
            <span>
              Basketball.Users.add(<span className="documentation-view__parameter">data</span>, cb)
            </span>
          }
        />
      </div>

      <div className="row">
        <EditBox
          mainObject={<DescriptionText text={"Click to add a description"} />}
          hiddenForm={<DescriptionBox text={""} />}
          formSubmit={() => {
            console.log("description editor test");
          }}
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
        <TableEditor
          headers={[
            { name: "Property" },
            { name: "Type" },
            { name: "Description" },

            { name: "Defalut" },
            { name: "required" },
          ]}
          table={[["Click to add / edit proprty"]]}
        />
      </div>
    </div>
  );
};

export default Documentation;
