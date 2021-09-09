import React, { useState, useContext, useEffect } from "react";
import ReactJson from "react-json-view";
import ObjectEditor from "../../molecules/JsonEditor/JsonEditor";
import "./styles.scss";
const mockData = {
  _id: "6138caa3560d159aaf0c39b9",
  index: 0,
  guid: "f3e5241a-80a6-4765-8fe5-726a81514e3e",
  isActive: true,
  friends: [
    {
      id: 0,
      name: "Sylvia Finch",
    },
    {
      id: 1,
      name: "Yolanda Dotson",
    },
    {
      id: 2,
      name: "Miriam Payne",
    },
  ],
  greeting: "Hello, undefined! You have 5 unread messages.",
  favoriteFruit: "apple",
};
const testfn = (data) => console.log(data);
const TestCenter = ({ project_code, service_id, module_name, method_name }) => {
  return (
    <section className="test-center">
      <div className="container">
        <div className="row d-flex">
          <span className="test-center__json-btn">Test Data:</span>
          <span className="test-center__json-btn">
            +<span className="test-center__json-btn--hide-effect">json</span>
          </span>
        </div>
        <div className="row">
          <div className="test-center__test-data">
            {`${service_id}.${module_name}.${method_name}`}(
            <ReactJson
              src={mockData}
              name="data"
              onAdd={testfn}
              onEdit={testfn}
              onDelete={testfn}
              displayObjectSize={false}
              displayDataTypes={false}
              collapsed={true}
            />
            )
          </div>{" "}
        </div>
      </div>
    </section>
  );
};

export default TestCenter;
