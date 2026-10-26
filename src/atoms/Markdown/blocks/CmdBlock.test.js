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
  useMarkdownWrite: jest.fn(() => ({})),
  useDocMembers: jest.fn(() => ({})),
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

  it("clear wipes a finished run back to the unrun block — and is not offered before one exists", async () => {
    const { container } = render(<CmdBlock src={"yarn test"} attrs={{}} />);
    expect(screen.queryByText("clear")).toBeNull(); // nothing to wipe yet
    fireEvent.click(screen.getByText("run"));
    rig.emit({ started: true, text: "2 passing", exit: 0 });
    rig.finish({ started: true, code: 0 });
    await waitFor(() => expect(container.firstChild.className).toContain("md-cmd--ok"));
    fireEvent.click(screen.getByText("clear"));
    expect(container.querySelector(".md-cmd__text")).toBeNull();
    expect(screen.getByText("not run")).toBeInTheDocument();
    expect(screen.getByText("run")).toBeInTheDocument(); // "run", not "run again" — the slate is clean
    expect(container.firstChild.className).not.toContain("md-cmd--ok");
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

// `dir=` — the machine-address form: run anywhere, the way ::file takes `~/…`. The default stays
// the room's project root; the dir only AIMS, it never becomes part of the command.
describe("dir= aims the shell at a machine path", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useCapabilityState.mockReturnValue("granted");
    useMarkdownScope.mockReturnValue({ projectCode: "systemview" });
  });

  it("hands the capability the dir, and keeps the project for session identity", () => {
    const factory = jest.fn(() => ({ run: jest.fn(() => ({ done: new Promise(() => {}), cancel: jest.fn() })) }));
    useCapability.mockReturnValue(factory);
    render(<CmdBlock src={"ls"} attrs={{ dir: "~/Systemly/lanes" }} />);
    expect(factory).toHaveBeenCalledWith("systemview", "~/Systemly/lanes", expect.stringMatching(/^cmd-/));
  });

  it("the prompt wears the folder, not the project, when a dir aims the run", () => {
    useCapability.mockReturnValue(() => ({ run: jest.fn() }));
    const { container } = render(<CmdBlock src={"ls"} attrs={{ dir: "~/Systemly/lanes" }} />);
    expect(container.querySelector(".md-cmd__prompt").textContent).toBe("~/Systemly/lanes $ ");
  });

  it("a dir block outside any project still offers run", () => {
    const factory = jest.fn(() => ({ run: jest.fn() }));
    useCapability.mockReturnValue(factory);
    useMarkdownScope.mockReturnValue({});
    render(<CmdBlock src={"ls"} attrs={{ dir: "/tmp" }} />);
    expect(screen.getByText("run")).toBeInTheDocument();
    expect(factory).toHaveBeenCalledWith("machine", "/tmp", expect.stringMatching(/^cmd-/));
  });
});

// THE TELL — a block pressed in the chat reports back through the write context's optional
// `tellRun`. Surfaces that don't implement it (documents, the default) hear nothing and break nothing.
describe("a finished run is told to the surface that offered it", () => {
  const { useMarkdownWrite } = require("../context");
  let rig;
  beforeEach(() => {
    jest.clearAllMocks();
    useCapabilityState.mockReturnValue("granted");
    useMarkdownScope.mockReturnValue({ projectCode: "systemview" });
    rig = makeRunner();
    useCapability.mockReturnValue(() => rig.runner);
  });

  it("tells the result — title and exit, NEVER the output (the transcript lives on disk)", async () => {
    const tellRun = jest.fn();
    useMarkdownWrite.mockReturnValue({ tellRun });
    render(<CmdBlock src={"yarn test"} attrs={{ title: "Run the suite" }} />);
    fireEvent.click(screen.getByText("run"));
    rig.emit({ text: "1 failing" });
    rig.finish({ started: true, code: 1 });
    await waitFor(() => expect(tellRun).toHaveBeenCalled());
    const told = tellRun.mock.calls[0][0];
    expect(told.title).toBe("Run the suite");
    expect(told.exit).toBe(1);
    expect(told.started).toBe(true);
    expect(told.tail).toBeUndefined();
    expect(JSON.stringify(told)).not.toContain("1 failing");
  });

  it("a surface with no tellRun hears nothing and nothing breaks", async () => {
    useMarkdownWrite.mockReturnValue({});
    const { container } = render(<CmdBlock src={"yarn test"} attrs={{}} />);
    fireEvent.click(screen.getByText("run"));
    rig.finish({ started: true, code: 0 });
    await waitFor(() => expect(container.firstChild.className).toContain("md-cmd--ok"));
  });
});

describe("a remount finds its run again", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useMarkdownScope.mockReturnValue({ projectCode: "systemview" });
    useCapabilityState.mockReturnValue("granted");
  });

  it("adopts a surviving session on mount: seeded text, running state, then the real exit", async () => {
    let resolveDone;
    const handle = {
      done: new Promise((r) => (resolveDone = r)),
      state: () => ({ started: true, text: "half the build already printed", exit: null }),
      detach: jest.fn(),
      cancel: jest.fn(),
    };
    const runner = { run: jest.fn(), resume: jest.fn(async () => handle) };
    useCapability.mockReturnValue(() => runner);
    render(<CmdBlock src={BUILD} attrs={{ title: "Rebuild" }} />);
    // the survivor is adopted without any press
    await waitFor(() => expect(runner.resume).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText(/half the build already printed/)).toBeInTheDocument());
    expect(screen.getByText(/running/)).toBeInTheDocument();
    // …and the stream settles to the real exit
    await act(async () => resolveDone({ started: true, code: 0, resumed: true }));
    await waitFor(() => expect(screen.getByText(/exit 0/)).toBeInTheDocument());
  });

  it("stays honestly cold when nothing survived — no invented result, no receipt", async () => {
    const resume = jest.fn(async () => null);
    useCapability.mockReturnValue(() => ({ run: jest.fn(), resume }));
    render(<CmdBlock src={BUILD} attrs={{ title: "Rebuild" }} />);
    await waitFor(() => expect(resume).toHaveBeenCalled());
    expect(screen.queryByText(/running/)).toBeNull();
    expect(screen.queryByText(/exit/)).toBeNull();
  });
});
