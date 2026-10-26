import React from "react";
import fs from "fs";
import path from "path";
import { render, screen } from "@testing-library/react";
import Rfc from "./Rfc";
import Report from "./Report";
import Gap from "./Gap";

// NOT `import { BLOCKS } from "../registry"` — the registry pulls in FileEmbed → Markdown.js →
// react-markdown, which ships ESM that CRA's jest leaves untransformed, and the suite dies before an
// assertion runs. So the registration is checked the one way that cannot drag the renderer in: by
// reading the file.
const registrySource = fs.readFileSync(path.join(__dirname, "..", "registry.js"), "utf8");

// RFC-073 §1.2 — THE LEAVES THAT MAKE A DOCUMENT A KIND. What this pins: they render as identity and
// nothing else — no press, no state — and they are in the registry, because a block that renders
// but is not registered is a block the renderer shows as "unknown block".
describe("::rfc", () => {
  it("names the RFC and the arc it serves", () => {
    render(<Rfc attrs={{ id: "RFC-073", arc: "ARC-004" }} />);
    expect(screen.getByText("RFC-073")).toBeInTheDocument();
    expect(screen.getByText("for ARC-004")).toBeInTheDocument();
    expect(screen.getByTitle("this RFC serves ARC-004")).toBeInTheDocument();
  });

  it("an RFC that serves no arc says only what it is", () => {
    render(<Rfc attrs={{ id: "RFC-012" }} />);
    expect(screen.getByText("RFC-012")).toBeInTheDocument();
    expect(screen.queryByText(/^for /)).not.toBeInTheDocument();
  });

  it("has nothing to press — identity is not edited by accident", () => {
    const { container } = render(<Rfc attrs={{ id: "RFC-073", arc: "ARC-004" }} />);
    expect(container.querySelector("button")).toBeNull();
  });
});

describe("::report", () => {
  it("names the report", () => {
    render(<Report attrs={{ id: "subscribe-and-registration", title: "Two ideas" }} />);
    expect(screen.getByText("subscribe-and-registration")).toBeInTheDocument();
    expect(screen.getByText("Two ideas")).toBeInTheDocument();
  });
});

describe("::gap", () => {
  it("names the gap and says nothing else while it is open", () => {
    render(<Gap attrs={{ id: "G-12" }} />);
    expect(screen.getByText("G-12")).toBeInTheDocument();
    expect(screen.queryByText("resolved")).not.toBeInTheDocument();
  });

  it("a resolved gap says so — the one answer a reader needs", () => {
    render(<Gap attrs={{ id: "G-12", resolved: "2026-10-25" }} />);
    expect(screen.getByText("resolved")).toBeInTheDocument();
    expect(screen.getByTitle("resolved 2026-10-25")).toBeInTheDocument();
  });

  it("has nothing to press", () => {
    const { container } = render(<Gap attrs={{ id: "G-12" }} />);
    expect(container.querySelector("button")).toBeNull();
  });
});

describe("the registry knows them", () => {
  it("rfc and report are registered beside arc — a block that renders but is not registered shows as 'unknown block'", () => {
    expect(registrySource).toMatch(/import Rfc from "\.\/blocks\/Rfc";/);
    expect(registrySource).toMatch(/import Report from "\.\/blocks\/Report";/);
    expect(registrySource).toMatch(/arc: \{ Component: Arc \},/);
    expect(registrySource).toMatch(/rfc: \{ Component: Rfc \},/);
    expect(registrySource).toMatch(/report: \{ Component: Report \},/);
    expect(registrySource).toMatch(/gap: \{ Component: Gap \},/);
  });
});
