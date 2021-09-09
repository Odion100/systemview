import React from "react";
import ReactJson from "react-json-view";
import ExpandableSection from "../../molecules/ExpandableSection/ExpandableSection";

import "./styles.scss";

const testfn = (data) => console.log(data);
const TestCenterSection = ({ project_code, service_id, module_name, method_name }) => {
  return (
    <section className="test-center-section">
      <ExpandableSection
        title={
          <div className="d-flex">
            <span className="test-center-section__title">Test Data:</span>
            <span className="test-center-section__json-btn">
              +<span className="test-center-section__json-btn--hide-effect">json</span>
            </span>
          </div>
        }
        title_color="#0d8065"
      >
        <div className="test-center-section__test-data">
          {`${service_id}.${module_name}.${method_name}`}(
          <ReactJson
            src={{}}
            name="data"
            onAdd={testfn}
            onEdit={testfn}
            onDelete={testfn}
            displayObjectSize={false}
            displayDataTypes={false}
            collapsed={true}
          />
          )
        </div>
      </ExpandableSection>
    </section>
  );
};

export default TestCenterSection;
