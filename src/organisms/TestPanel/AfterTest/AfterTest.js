import React from "react";
import MultiTestSection from "../../MultiTestSection/MultiTestSection";
import "./styles.scss";

const AfterTest = ({ TestSection, TestController, sectionKey, onStepMove, onStepDuplicate, sectionDragKey }) => {
  return (
    <MultiTestSection
      dynamic={true}
      TestSection={TestSection}
      TestController={TestController}
      caption="After"
      sectionTag="section"
      tagColor="#6886ba"
      titleColor="#46608f"
      sectionKey={sectionKey}
      onStepMove={onStepMove}
      onStepDuplicate={onStepDuplicate}
      sectionDragKey={sectionDragKey}
    />
  );
};

export default AfterTest;
