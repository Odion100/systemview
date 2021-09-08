import React, { useState, useContext, useEffect } from "react";

import Title from "../../atoms/Title/Title";
import "./styles.scss";

const TestCenter = ({ project_code, service_id, module_name, method_name }) => {
  return (
    <section className="test-center">
      <div className="container">
        <div className="row test-center__test-data">
          <span>
            {`${service_id}.${module_name}.${method_name}`}(
            <span className="documentation-view__parameter">&#123;...&#125;</span>)
          </span>
        </div>
      </div>
    </section>
  );
};

export default TestCenter;
