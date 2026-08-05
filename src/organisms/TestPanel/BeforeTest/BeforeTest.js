import React from "react";
import MultiTestSection from "../../MultiTestSection/MultiTestSection";
import "./styles.scss";

const BeforeTest = ({ TestSection, TestController, sectionKey, onStepMove, onStepDuplicate, sectionDragKey }) => {
  return (
    <MultiTestSection
      dynamic={true}
      TestSection={TestSection}
      TestController={TestController}
      caption="Before"
      sectionTag="section"
      tagColor="var(--sv-blue)"
      titleColor="#46608f"
      sectionKey={sectionKey}
      onStepMove={onStepMove}
      onStepDuplicate={onStepDuplicate}
      sectionDragKey={sectionDragKey}
    />
  );
};

export default BeforeTest;
