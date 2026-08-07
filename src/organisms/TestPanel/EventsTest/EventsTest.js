import React from "react";
import MultiTestSection from "../../MultiTestSection/MultiTestSection";
import "./styles.scss";

const EventsTest = ({ TestSection, TestController, namespace, FullTest, sectionKey, onStepMove, onStepDuplicate, sectionDragKey }) => {
  return (
    <MultiTestSection
      dynamic={true}
      TestSection={TestSection}
      TestController={TestController}
      namespace={namespace}
      arg={{ name: "event_name", input_type: "string", FullTest }}
      caption="Events"
      staticArguments={true}
      sectionTag="section"
      tagColor="var(--sv-blue)"
      titleColor="#46608f"
      sectionKey={sectionKey}
      onStepMove={onStepMove}
      onStepDuplicate={onStepDuplicate}
      sectionDragKey={sectionDragKey}
      helpTopic="events"
    />
  );
};

export default EventsTest;
