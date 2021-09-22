import React, { useState } from "react";
import ExpandableSection from "../../molecules/ExpandableSection/ExpandableSection";
import TestCaption from "../../molecules/TestCaption/TestCaption";
import QuickTestSection from "../QuickTestSection/QuickTestSection";
import "./styles.scss";

const AuxillaryTestSection = ({ project_code, caption }) => {
  const classname = "auxillary-test-section";
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
    <section className={classname}>
      <ExpandableSection
        open={true}
        title={
          <>
            <TestCaption caption={`${caption}:`} />
            <AddButton onClick={addAction} />
          </>
        }
        title_color="#0d8065"
      >
        <div className={`${classname}__test-data`}>
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

const AddButton = ({ onClick }) => {
  return (
    <span className="add-btn btn" onClick={onClick}>
      +
    </span>
  );
};
export default AuxillaryTestSection;
