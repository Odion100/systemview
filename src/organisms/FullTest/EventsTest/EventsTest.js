import React from "react";
import MultiTestSection from "../../MultiTestSection/MultiTestSection";
import "./styles.scss";

const EventsTest = ({ testData, TestController, namespace, Tests, connection }) => {
  return (
    <MultiTestSection
      dynamic={false}
      testData={testData}
      TestController={TestController}
      namespace={namespace}
      arg={{ name: "event_name", input_type: "string", Tests }}
      caption="Events"
      staticArguments={true}
    />
  );
};

export default EventsTest;
