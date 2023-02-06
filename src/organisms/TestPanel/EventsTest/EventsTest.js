import React from "react";
import MultiTestSection from "../../MultiTestSection/MultiTestSection";
import "./styles.scss";

const EventsTest = ({ TestSection, TestController, namespace, FullTest, connection }) => {
  return (
    <MultiTestSection
      dynamic={false}
      TestSection={TestSection}
      TestController={TestController}
      namespace={namespace}
      arg={{ name: "event_name", input_type: "string", FullTest }}
      caption="Events"
      staticArguments={true}
    />
  );
};

export default EventsTest;
