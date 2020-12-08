import React from "react";
import "./styles.scss";
import DataTable from "../../atoms/DataTable/DataTable";
import Text from "../../atoms/Text/Text";
const Documentation = ({ doc_type }) => {
  return (
    <div className="documentation">
      <div className="row">
        <span className="documentation__title">Basketball.Users.add(data, cb)</span>
      </div>
      <div className="row">
        <div className="description-box">
          <p className="description-box__text">
            Returns middleware that only parses JSON and only looks at requests where the
            Content-Type header matches the type option. This parser accepts any Unicode encoding of
            the body and supports automatic inflation of gzip and deflate encodings.
          </p>
        </div>
      </div>
      <div className="row">
        <div>
          <Text
            text={`The following table describes the properties of the data parameter of the above method.`}
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
