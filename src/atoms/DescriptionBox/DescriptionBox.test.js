/* eslint-disable jest/valid-expect */
import React from "react";
import ReactDom from "react-dom";
import { render, cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/extend-expect";
import renderer from "react-test-renderer";
import DescriptionBox from "./DescriptionBox";

afterEach(cleanup);

describe("<DescriptionBox/>", () => {
  it("renders without crashing", () => {
    const div = document.createElement("div");
    ReactDom.render(<DescriptionBox />, div);
  });

  it("apply text using the text prop", () => {
    const { getByRole } = render(<DescriptionBox text={"test"} />);
    expect(getByRole("textbox")).toHaveTextContent("test");
  });

  it("take text from user input", () => {
    render(<DescriptionBox />);

    screen.getByRole("textbox");
    userEvent.type(screen.getByRole("textbox"), "user input");

    expect(screen.getByRole("textbox")).toHaveValue("user input");
  });

  it("should match snapshot", () => {
    const tree = renderer.create(<DescriptionBox />).toJSON();
    expect(tree).toMatchSnapshot();
  });
});
