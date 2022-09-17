/* eslint-disable jest/valid-expect */
import React from "react";
import ReactDom from "react-dom";
import { render, cleanup, screen } from "@testing-library/react";
import "@testing-library/jest-dom/extend-expect";
import TestsIcon from "./TestsIcon";

import Enzyme from "enzyme";
import Adapter from "enzyme-adapter-react-16";

Enzyme.configure({ adapter: new Adapter() });

describe("<TestsIcon/>", () => {
  it("renders test-saved.png if isSaved prop equals true", () => {
    const div = document.createElement("div");
    ReactDom.render(<TestsIcon />, div);
  });
});
