import React from "react";
import MultiTestSection from "../../MultiTestSection/MultiTestSection";
import "./styles.scss";

const EventsTest = ({ testData, TestController, nsp, Tests, connection }) => {
  return (
    <MultiTestSection
      dynamic={false}
      testData={testData}
      TestController={TestController}
      nsp={nsp}
      arg={{ name: "event_name", input_type: "string", Tests }}
      caption="Events Test"
      staticArguments={true}
    />
  );
};

export default EventsTest;
