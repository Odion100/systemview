// Ported from enzyme (2026-10-16) — the suite imported enzyme-adapter-react-16, which is not
// installed, so it failed to LOAD under CI and sat silent in watch mode, reading as coverage.
// Claims kept, plus the ones the atom earns today (Enter submits; placeholder — the original had
// it commented out).
import React from "react";
import { render, fireEvent } from "@testing-library/react";
import Textbox from "./Textbox";

describe("<Textbox/>", () => {
  it("renders a div with class textbox and a nested input", () => {
    const { container } = render(<Textbox />);
    expect(container.querySelectorAll("div.textbox > input")).toHaveLength(1);
  });

  it("uses the placeholderText prop as the input placeholder", () => {
    const { container } = render(<Textbox placeholderText="textbox test" />);
    expect(container.querySelector("input").placeholder).toBe("textbox test");
  });

  it("Enter submits through TextboxSubmit", () => {
    const submit = jest.fn();
    const { container } = render(<Textbox TextboxSubmit={submit} />);
    fireEvent.keyDown(container.querySelector("input"), { key: "Enter" });
    expect(submit).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(container.querySelector("input"), { key: "a" });
    expect(submit).toHaveBeenCalledTimes(1);
  });
});
