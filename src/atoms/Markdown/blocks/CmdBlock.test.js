import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import CmdBlock from "./CmdBlock";
import { useCapability, useCapabilityState } from "../capabilities";
import { useMarkdownScope } from "../context";

// The block owns no execution — it presses the `shell` capability and renders what comes back. So
// the tests stand up no shell at all and judge the block on what it does with each answer a host
// can give, including the two that matter most: "ran and failed" and "never ran".
jest.mock("../capabilities", () => ({
  useCapability: jest.fn(),
  useCapabilityState: jest.fn(),
}));
jest.mock("../context", () => ({
  useMarkdownScope: jest.fn(),
}));

const BUILD =
  "BUILD_PATH=build.next NODE_OPTIONS=--max-old-space-size=4096 ./node_modules/.bin/react-scripts build && rm -rf build && mv build.next build";

// A runner whose `done` is resolved by the test, so each outcome can be posted deliberately.
function makeRunner() {
  let resolve;
  const calls = [];
  const runner = {
    run: (opts) => {
      calls.push(opts);
      return { done: new Promise((r) => (resolve = r)), cancel: jest.fn() };
    },
  };
  return { runner, calls, finish: (r) => resolve(r), emit: (s) => act(() => calls[calls.length - 1].onOutput(s)) };
}

describe("a :::cmd block runs one command through the shell capability", () => {
  let rig;

  beforeEach(() => {
    jest.clearAllMocks();
    useMarkdownScope.mockReturnValue({ projectCode: "systemview" });
    useCapabilityState.mockReturnValue("granted");
    rig = makeRunner();
    useCapability.mockReturnValue(() => rig.runner);
  });

  it("shows the command verbatim, and never runs it on its own", () => {
    const { container } = render(<CmdBlock src={BUILD} attrs={{ title: "Rebuild the bundle" }} />);
    expect(container.querySelector(".md-cmd__command").textContent).toBe(BUILD);
    expect(screen.getByText("Rebuild the bundle")).toBeInTheDocument();
    expect(screen.getByText("not run")).toBeInTheDocument();
    // A block that ran itself on render would make every report an execution.
    expect(rig.calls).toHaveLength(0);
  });

  it("unwraps a fenced body so what runs is what is written", () => {
    const { container } = render(<CmdBlock src={"```bash\nyarn test\n```"} attrs={{}} />);
    expect(container.querySelector(".md-cmd__command").textContent).toBe("yarn test");
  });

  it("hands the shell exactly the command in the block", () => {
    render(<CmdBlock src={BUILD} attrs={{}} />);
    fireEvent.click(screen.getByText("run"));
    expect(rig.calls[0].command).toBe(BUILD);
  });

  it("says it is running, and streams what comes back", () => {
    const { container } = render(<CmdBlock src={"yarn test"} attrs={{}} />);
    fireEvent.click(screen.getByText("run"));
    expect(container.firstChild.className).toContain("md-cmd--busy");
    expect(screen.getByText(/running/)).toBeInTheDocument();
    expect(screen.getByText("stop")).toBeInTheDocument();
    rig.emit({ started: true, text: "Compiling…", exit: null });
    expect(container.querySelector(".md-cmd__text").textContent).toBe("Compiling…");
  });

  it("exit 0 reads as a success", async () => {
    const { container } = render(<CmdBlock src={"yarn test"} attrs={{}} />);
    fireEvent.click(screen.getByText("run"));
    rig.emit({ started: true, text: "2 passing", exit: 0 });
    rig.finish({ started: true, code: 0 });
    await waitFor(() => expect(container.firstChild.className).toContain("md-cmd--ok"));
    expect(screen.getByText(/exit 0/)).toBeInTheDocument();
  });

  it("a non-zero exit LOOKS failed and keeps the output that explains it", async () => {
    const { container } = render(<CmdBlock src={"yarn test"} attrs={{}} />);
    fireEvent.click(screen.getByText("run"));
    rig.emit({ started: true, text: "1 failing", exit: 1 });
    rig.finish({ started: true, code: 1 });
    await waitFor(() => expect(container.firstChild.className).toContain("md-cmd--fail"));
    expect(screen.getByText(/exit 1/)).toBeInTheDocument();
    expect(container.querySelector(".md-cmd__text").textContent).toBe("1 failing");
  });

  it("NEVER RAN is its own face, not a failed run", async () => {
    const { container } = render(<CmdBlock src={"yarn test"} attrs={{}} />);
    fireEvent.click(screen.getByText("run"));
    rig.finish({ started: false, error: "the host refused to open a shell" });
    await waitFor(() => expect(container.firstChild.className).toContain("md-cmd--unrun"));
    expect(container.firstChild.className).not.toContain("md-cmd--fail");
    expect(screen.getByText("didn't run")).toBeInTheDocument();
    expect(screen.getByText("the host refused to open a shell")).toBeInTheDocument();
  });

  it("offers nothing to press on a surface with no shell", () => {
    useCapability.mockReturnValue(null);
    useCapabilityState.mockReturnValue("absent");
    render(<CmdBlock src={BUILD} attrs={{}} />);
    expect(screen.getByText(/can't run commands/)).toBeInTheDocument();
    expect(screen.queryByText("run")).toBeNull();
  });

  it("says DENIED differently from absent", () => {
    useCapability.mockReturnValue(null);
    useCapabilityState.mockReturnValue("denied");
    render(<CmdBlock src={BUILD} attrs={{}} />);
    expect(screen.getByText(/isn't allowed here/)).toBeInTheDocument();
  });

  it("renders inert when there is no command to run", () => {
    render(<CmdBlock src={"# just a note"} attrs={{}} />);
    expect(screen.getByText(/no command in this block/)).toBeInTheDocument();
  });
});

describe("the three absences read as three different sentences", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useCapabilityState.mockReturnValue("granted");
    useMarkdownScope.mockReturnValue({ projectCode: "systemview" });
  });

  it("names the missing project rather than blaming the surface", () => {
    useMarkdownScope.mockReturnValue({});
    useCapability.mockReturnValue(() => null);
    render(<CmdBlock src={"yarn test"} attrs={{}} />);
    expect(screen.getByText(/names no project/)).toBeInTheDocument();
  });

  it("says which project has no shell when one is named", () => {
    useCapability.mockReturnValue(() => null);
    render(<CmdBlock src={"yarn test"} attrs={{}} />);
    expect(screen.getByText(/no shell for systemview/)).toBeInTheDocument();
  });
});
