import React, { useState, useEffect } from "react";
import ExpandableSection from "../../molecules/ExpandableSection/ExpandableSection";
import AddButton from "../../atoms/AddButton/AddButton";
import TestPanelCaption from "../../atoms/TestPanelCaption/TestPanelCaption";
import QuickTestSection from "../../organisms/QuickTestSection/QuickTestSection";
import "./styles.scss";

const TestBeforeSection = ({ project_code, service_id, module_name, method_name }) => {
  const [actions, setActions] = useState([]);
  const [state, updateState] = useState(true);
  const addAction = () => {
    actions.push({
      title: "",
      service_id: undefined,
      module_name: undefined,
      method_name: undefined,
    });
    setActions(actions);
    updateState(!state);
  };
  const onSubmit = (index, results) => console.log(index, results);

  return (
    <section className="test-before-section">
      <ExpandableSection
        open={true}
        title={
          <>
            <TestPanelCaption text="Before Test:" />
            <AddButton hiddenCaption="action before test" onClick={addAction} />
          </>
        }
        title_color="#0d8065"
      >
        <div className="test-before-section__test-data">
          {actions.length > 0 ? (
            actions.map(({ title, service_id, module_name, method_name }, i) => (
              <QuickTestSection
                key={i}
                project_code={project_code}
                service_id={service_id}
                module_name={module_name}
                method_name={method_name}
                title={`Action${i + 1}:`}
                onSubmit={onSubmit}
                dynamic={true}
              />
            ))
          ) : (
            <span>no actions</span>
          )}
        </div>
      </ExpandableSection>
    </section>
  );
};

export default TestBeforeSection;
