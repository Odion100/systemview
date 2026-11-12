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
        <Question label="host or sender?" attrs={{ options: "host|sender" }} line={3}>
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

  it("puts the body AFTER the question and BEFORE the options", () => {
    const { container } = render(
      <MarkdownWriteProvider value={{ editable: true, setAttr: () => {} }}>
        <Question label="q" attrs={{ options: "a|b" }} line={1}>
          <p>context</p>
        </Question>
      </MarkdownWriteProvider>,
    );
    const kids = [...container.querySelector(".md-input").children].map((n) => n.className);
    expect(kids.indexOf("md-input__head")).toBeLessThan(kids.indexOf("md-input__body"));
    expect(kids.indexOf("md-input__body")).toBeLessThan(kids.indexOf("md-input__options"));
  });
});
