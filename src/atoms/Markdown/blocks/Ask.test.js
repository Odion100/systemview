import React from "react";
import { render, screen } from "@testing-library/react";
import Ask from "./Ask";

// A PURE RULE'S TESTS SAY NOTHING ABOUT THE COMPONENT — so this mounts the component. `::ask`
// reads its text from the LABEL and nothing else, and the way that gets written wrongly is
// `::ask{question="…"}`, which arrives here as attrs with no label at all.
describe("::ask", () => {
  it("draws the label, with ? when it is a question", () => {
    render(<Ask label="Which folder?" />);
    expect(screen.getByText("Which folder?")).toBeInTheDocument();
    expect(screen.getByText("?")).toBeInTheDocument();
  });

  it("draws → when it is a thing to DO, not a question", () => {
    render(<Ask label="Restart the shell" />);
    expect(screen.getByText("→")).toBeInTheDocument();
  });

  it("carries why= under it", () => {
    render(<Ask label="Which first?" attrs={{ why: "both touch the same file" }} />);
    expect(screen.getByText("both touch the same file")).toBeInTheDocument();
  });

  it("SAYS SO rather than painting an empty band — `question=` is not a field here", () => {
    render(<Ask attrs={{ question: "Drop the paragraph?" }} />);
    expect(screen.getByText("empty ask")).toBeInTheDocument();
    expect(screen.queryByText("→")).not.toBeInTheDocument();
  });

  it("an ask with no label still renders its children", () => {
    render(<Ask>the body carries it</Ask>);
    expect(screen.getByText("the body carries it")).toBeInTheDocument();
    expect(screen.queryByText("empty ask")).not.toBeInTheDocument();
  });
});
