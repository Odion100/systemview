import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import Prompt from "./Prompt";

describe("::prompt — a prompt, in a document, pressable", () => {
  it("renders the label and sends its words through sv:say on press", () => {
    const heard = [];
    const on = (e) => heard.push(e.detail);
    window.addEventListener("sv:say", on);
    render(<Prompt label="run the demo" attrs={{ text: "Walk me through this fixture." }} />);
    fireEvent.click(screen.getByRole("button", { name: "run the demo" }));
    window.removeEventListener("sv:say", on);
    expect(heard).toEqual([expect.objectContaining({ text: "🔘 Walk me through this fixture." })]);
    // the press answers on the button itself — he sees it went somewhere
    expect(screen.getByRole("button").textContent).toMatch(/sent/);
  });

  it("a prompt with no words says so instead of rendering a dead button", () => {
    render(<Prompt label="run the demo" attrs={{}} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText(/no text to send/)).toBeTruthy();
  });

  it("the sent words wear the press mark, so the row and the agent read a button, not his typing", () => {
    const heard = [];
    const on = (e) => heard.push(e.detail.text);
    window.addEventListener("sv:say", on);
    render(<Prompt label="go" attrs={{ text: "demo the clock" }} />);
    fireEvent.click(screen.getByRole("button", { name: "go" }));
    window.removeEventListener("sv:say", on);
    expect(heard[0]).toMatch(/^🔘 /);
  });
});
