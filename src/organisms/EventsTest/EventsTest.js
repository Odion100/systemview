import React from "react";
import MultiTestSection from "../MultiTestSection/MultiTestSection";
import "./styles.scss";

const EventsTest = ({ testData, TestController }) => {
  return (
    <MultiTestSection testData={testData} TestController={TestController} caption="Events Test" />
  );
};

export default EventsTest;
