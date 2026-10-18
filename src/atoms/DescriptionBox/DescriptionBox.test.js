import React from "react";
import { render, cleanup, screen } from "@testing-library/react";
import "@testing-library/jest-dom/extend-expect";
import DescriptionBox from "./DescriptionBox";

// THE OLD SUITE TESTED A TEXTAREA THAT NO LONGER EXISTS. RFC-018 Phase 4 made DescriptionBox a real
// CodeMirror (markdown) behind the same `text`/`setValue` contract — deliberately, with every caller
// unchanged — and two claims kept asserting the dead world: `toHaveValue` (meaningless on CM's
// contenteditable) and a snapshot of the old textarea markup. These are the SAME claims ported to
// what the component actually is now.
//
// What jsdom cannot honestly exercise: real typing. CM6 turns keystrokes into transactions through
// DOM measurement jsdom doesn't do, so a userEvent.type claim would either fail or fake. The
// value→onChange seam belongs to CodeEditor (where `v.docChanged` fires it); HERE the honest claims
// are the contract this atom adds: the editor renders, wears the text, and is editable exactly when
// a setter is handed in.

afterEach(cleanup);

describe("<DescriptionBox/>", () => {
  it("renders a markdown editor without crashing", () => {
    const { container } = render(<DescriptionBox />);
    expect(container.querySelector(".description-box")).toBeInTheDocument();
    expect(container.querySelector(".cm-content")).toBeInTheDocument();
  });

  it("wears the text prop as the editor's content", () => {
    render(<DescriptionBox text={"test"} />);
    expect(screen.getByRole("textbox")).toHaveTextContent("test");
  });

  it("is editable when given setValue — and the surface says so", () => {
    const { container } = render(<DescriptionBox text="x" setValue={() => {}} />);
    expect(container.querySelector('.cm-content[contenteditable="true"]')).toBeInTheDocument();
  });

  it("new text from above replaces the content — the controlled half of the contract", () => {
    const { rerender } = render(<DescriptionBox text="before" />);
    expect(screen.getByRole("textbox")).toHaveTextContent("before");
    rerender(<DescriptionBox text="after" />);
    expect(screen.getByRole("textbox")).toHaveTextContent("after");
    expect(screen.getByRole("textbox")).not.toHaveTextContent("before");
  });
});
