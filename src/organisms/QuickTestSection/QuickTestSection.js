import React from "react";
import ExpandableSection from "../../molecules/ExpandableSection/ExpandableSection";
import ScratchPad from "../ScratchPad/ScratchPad";

import "./styles.scss";

const QuickTestSection = ({
  project_code,
  service_id,
  module_name,
  method_name,
  open,
  testData,
  title,
  onSubmit,
  children,
  dynamic,
}) => {
  const classname = "quick-test";
  return (
    <section className={classname}>
      <ExpandableSection
        open={open}
        title_color="#0d8065"
        title={
          <>
            <div className={`${classname}__title-section`}>
              <span className={`${classname}__title`}>
                <b>{title}</b>
              </span>
              <span className={`${classname}__save-input`}>
                <input type="text" />
              </span>
            </div>
          </>
        }
      >
        <ScratchPad
          project_code={project_code}
          service_id={service_id}
          module_name={module_name}
          method_name={method_name}
          testData={testData}
          onSubmit={onSubmit}
          dynamic={dynamic}
        />
        {children}
      </ExpandableSection>
    </section>
  );
};

export default QuickTestSection;
