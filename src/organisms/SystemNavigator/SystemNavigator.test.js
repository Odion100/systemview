/* eslint-disable jest/valid-expect */
import React from "react";
import ReactDom from "react-dom";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom/extend-expect";
import SystemNavigator from "./SystemNavigator";

// The old fixture passed a `servicesList` prop the component never accepted — a remnant of the
// pre-transition tree. Services arrive through ServiceContext now; the smoke test just mounts.
describe("<SystemNavigator/>", () => {
  it("renders without crashing", () => {
    const div = document.createElement("div");
    ReactDom.render(<SystemNavigator />, div);
  });
});
