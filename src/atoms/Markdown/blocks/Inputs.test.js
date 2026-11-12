import React from "react";
import { render } from "@testing-library/react";
import { Question } from "./Inputs";
import { MarkdownWriteProvider } from "../context";

// PROSE IN A QUESTION — his, 2026-11-12. Between the question and the options, so the reading
// order is: what is being asked, what you need to know, then the choice.
describe("a question can carry prose", () => {
  it("renders a body when it has one, and the leaf form is untouched", () => {
    const { container, rerender } = render(
      <MarkdownWriteProvider value={{ editable: true, setAttr: () => {} }}>
        <Question label="host or sender?" attrs={{ options: "host|sender" }} line={3} kind="container">
          <p>why it matters</p>
        </Question>
      </MarkdownWriteProvider>,
    );
    expect(container.querySelector(".md-input__body").textContent).toBe("why it matters");
    rerender(
      <MarkdownWriteProvider value={{ editable: true, setAttr: () => {} }}>
        <Question label="host or sender?" attrs={{ options: "host|sender" }} line={3} />
      </MarkdownWriteProvider>,
    );
    expect(container.querySelector(".md-input__body")).toBeNull();
  });

  // THE REGRESSION, PINNED. A LEAF directive's children ARE its label text — so rendering children
  // without checking the form printed every one-line question a second time underneath itself.
  // His: "drop one without prose and see that the question repeats itself in the body."
  it("does NOT echo the label when the one-line form is given its own label as children", () => {
    const { container } = render(
      <MarkdownWriteProvider value={{ editable: true, setAttr: () => {} }}>
        <Question label="host or sender?" attrs={{ options: "host|sender" }} line={3} kind="leaf">
          host or sender?
        </Question>
      </MarkdownWriteProvider>,
    );
    expect(container.querySelector(".md-input__body")).toBeNull();
    expect(container.querySelectorAll(".md-input__label")).toHaveLength(1);
    expect(container.textContent.match(/host or sender\?/g)).toHaveLength(1);
  });

  it("puts the body AFTER the question and BEFORE the options", () => {
    const { container } = render(
      <MarkdownWriteProvider value={{ editable: true, setAttr: () => {} }}>
        <Question label="q" attrs={{ options: "a|b" }} line={1} kind="container">
          <p>context</p>
        </Question>
      </MarkdownWriteProvider>,
    );
    const kids = [...container.querySelector(".md-input").children].map((n) => n.className);
    expect(kids.indexOf("md-input__head")).toBeLessThan(kids.indexOf("md-input__body"));
    expect(kids.indexOf("md-input__body")).toBeLessThan(kids.indexOf("md-input__options"));
  });
});
