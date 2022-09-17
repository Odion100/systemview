/* eslint-disable jest/valid-expect */
import React from "react";
import ReactDom from "react-dom";
import { render, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/extend-expect";
import renderer from "react-test-renderer";
import Button from "./Button";

afterEach(cleanup);

describe("<Button/>", () => {
  it("renders without crashing", () => {
    const div = document.createElement("div");
    ReactDom.render(<Button />, div);
  });

  it("renders an <button></button> element with text and class button", () => {
    const { getByRole } = render(<Button>test</Button>);
    expect(getByRole("button")).toHaveTextContent("test");
    expect(getByRole("button")).toHaveClass("button");
  });

  it("should match snapshot", () => {
    const tree = renderer.create(<Button>test</Button>).toJSON();
    expect(tree).toMatchSnapshot();
  });
});
