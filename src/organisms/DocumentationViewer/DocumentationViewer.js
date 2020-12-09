import React from "react";
import "./styles.scss";
import DataTable from "../../atoms/DataTable/DataTable";
import Text from "../../atoms/Text/Text";
import DescriptionBox from "../../atoms/DescriptionBox/DescriptionBox";
import DescriptionEditor from "../../molecules/DescriptionEditor/DescriptionEditor";
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
        <DescriptionEditor />
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
        <DataTable
          headers={[
            { name: "Property" },
            { name: "Type" },
            { name: "Description" },
            { name: "Events" },
            { name: "Defalut" },
            { name: "required" },
          ]}
          table={[
            ["test1", "test2", "test1", "test2", "test1", "test2"],
            ["test3", "test4", "test1", "test2", "test1", "test2"],
          ]}
        />
      </div>
    </div>
  );
};

export default Documentation;
