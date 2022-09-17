/* eslint-disable jest/valid-expect */
import React from "react";
import ReactDom from "react-dom";
import { render, cleanup, screen } from "@testing-library/react";
import "@testing-library/jest-dom/extend-expect";
import DocsIcon from "./DocsIcon";

const SAVED_DOC_ICON = "saved-doc.png";

afterEach(cleanup);
jest.mock("../../assets/saved-doc.png", () => SAVED_DOC_ICON);

describe("<DocsIcon/>", () => {
  it("renders without crashing", () => {
    const div = document.createElement("div");
    ReactDom.render(<DocsIcon />, div);
  });

  it("renders saved-doc image if isSaved prop is true", () => {
    const { getByRole } = render(<DocsIcon isSaved={true} />);
    expect(getByRole("img")).toHaveAttribute("src", SAVED_DOC_ICON);
  });
});
