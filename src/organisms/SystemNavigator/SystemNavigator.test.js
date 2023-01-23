/* eslint-disable jest/valid-expect */
import React from "react";
import ReactDom from "react-dom";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom/extend-expect";
import SystemNavigator from "./SystemNavigator";

const mockService = (fn, name, serviceId) => {
  return {
    serviceId,
    system_modules: [{ methods: [{ fn }], name }],
  };
};
describe("<SystemNavigator/>", () => {
  it("renders without crashing", () => {
    const div = document.createElement("div");
    ReactDom.render(
      <SystemNavigator
        servicesList={[mockService("test_fn", "test_name", "test_serviceId")]}
      />,
      div
    );
  });
});
