import React from "react";
import MultiTestSection from "../MultiTestSection/MultiTestSection";
import "./styles.scss";

const AfterTest = ({ testData, TestController }) => {
  return (
    <MultiTestSection testData={testData} TestController={TestController} caption="After Test" />
  );
};

export default AfterTest;
