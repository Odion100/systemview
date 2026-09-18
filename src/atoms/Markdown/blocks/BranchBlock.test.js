import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import BranchBlock from "./BranchBlock";
import { useCapability, useCapabilityState } from "../capabilities";
import { useMarkdownScope } from "../context";

// `::branch[name]` is a POINTER, not a patch — everything it shows is computed from git at view
// time through the host's git capability. So the tests stand up no git at all: the capability layer
// is mocked, and the block is judged on what it does with each answer the bridge can give.
jest.mock("../capabilities", () => ({
  useCapability: jest.fn(),
  useCapabilityState: jest.fn(),
}));
jest.mock("../context", () => ({
  useMarkdownScope: jest.fn(),
}));

const PATCH = [
  "diff --git a/src/a.js b/src/a.js",
  "index 111..222 100644",
  "--- a/src/a.js",
  "+++ b/src/a.js",
  "@@ -1 +1 @@",
  "-old line",
  "+new line",
  "diff --git a/docs/readme.md b/docs/readme.md",
  "new file mode 100644",
  "+++ b/docs/readme.md",
  "@@ -0,0 +1 @@",
  "+hello",
].join("\n");

const makeBridge = (over = {}) => ({
  branchDiff: jest.fn().mockResolvedValue({
    ok: true,
    base: "main",
    files: [
      { path: "src/a.js", status: "M" },
      { path: "docs/readme.md", status: "A" },
    ],
    patch: PATCH,
  }),
  gitState: jest.fn().mockResolvedValue({ branch: "main" }),
  switchBranch: jest.fn().mockResolvedValue({ ok: true }),
  ...over,
});

describe("a ::branch block reviews a live branch through the git capability", () => {
  let bridge;

  beforeEach(() => {
    jest.clearAllMocks();
    useMarkdownScope.mockReturnValue({ projectCode: "systemview" });
    useCapabilityState.mockReturnValue("granted");
    bridge = makeBridge();
    useCapability.mockReturnValue(() => bridge);
  });

  it("is an error with no branch name", () => {
    render(<BranchBlock attrs={{}} />);
    expect(screen.getByText("::branch needs a branch name")).toBeTruthy();
  });

  // "the browser can't do this" and "you can't do this here" are opposite sentences —
  // absent and denied must not render as the same grey box.
  it("says the surface has no version control when the git capability is absent", () => {
    useCapability.mockReturnValue(null);
    useCapabilityState.mockReturnValue("absent");
    render(<BranchBlock label="refine/dead-code" />);
    expect(screen.getByText("this surface has no version control")).toBeTruthy();
  });

  it("says version control is withheld when the grant is denied", () => {
    useCapability.mockReturnValue(null);
    useCapabilityState.mockReturnValue("denied");
    render(<BranchBlock label="refine/dead-code" />);
    expect(screen.getByText("version control isn't allowed here")).toBeTruthy();
  });

  it("loads the diff and shows the base and the file count", async () => {
    render(<BranchBlock label="refine/dead-code" />);
    expect(await screen.findByText("vs main")).toBeTruthy();
    expect(screen.getByText("2 files")).toBeTruthy();
    expect(screen.getByText("src/a.js")).toBeTruthy();
    expect(screen.getByText("docs/readme.md")).toBeTruthy();
    expect(bridge.branchDiff).toHaveBeenCalledWith({ branch: "refine/dead-code", base: undefined });
  });

  it("toggles a file row's own patch open and closed", async () => {
    render(<BranchBlock label="refine/dead-code" />);
    fireEvent.click(await screen.findByText("src/a.js"));
    expect(screen.getByText(/diff --git a\/src\/a\.js/)).toBeTruthy();
    // its OWN patch — the other file's chunk stays out of this row
    expect(screen.queryByText(/readme\.md/, { selector: "pre" })).toBe(null);
    fireEvent.click(screen.getByText("src/a.js"));
    expect(screen.queryByText(/diff --git a\/src\/a\.js/)).toBe(null);
  });

  // Switching moves the user's working tree — one click may not do that.
  it("arms the switch first, and 'no' stands down without touching git", async () => {
    render(<BranchBlock label="refine/dead-code" />);
    fireEvent.click(await screen.findByText("switch to it"));
    expect(screen.getByText("switch your working tree?")).toBeTruthy();
    fireEvent.click(screen.getByText("no"));
    expect(screen.queryByText("switch your working tree?")).toBe(null);
    expect(screen.getByText("switch to it")).toBeTruthy();
    expect(bridge.switchBranch).not.toHaveBeenCalled();
  });

  it("confirming the switch calls switchBranch with the branch name", async () => {
    render(<BranchBlock label="refine/dead-code" />);
    fireEvent.click(await screen.findByText("switch to it"));
    fireEvent.click(screen.getByText("yes"));
    await waitFor(() =>
      expect(bridge.switchBranch).toHaveBeenCalledWith({ name: "refine/dead-code" }),
    );
  });

  it("offers the way back when the working tree is already on the branch", async () => {
    bridge.gitState.mockResolvedValue({ branch: "refine/dead-code" });
    render(<BranchBlock label="refine/dead-code" />);
    expect(await screen.findByText("back to main")).toBeTruthy();
    expect(screen.getByText("your working tree is on this branch")).toBeTruthy();
    fireEvent.click(screen.getByText("back to main"));
    await waitFor(() => expect(bridge.switchBranch).toHaveBeenCalledWith({ name: "main" }));
  });

  // `git switch` refusing over dirty files is an ANSWER — the block shows it, never stashes around it.
  it("surfaces a refused switch as the error it is", async () => {
    bridge.switchBranch.mockResolvedValue({ ok: false, error: "your working tree is dirty" });
    render(<BranchBlock label="refine/dead-code" />);
    fireEvent.click(await screen.findByText("switch to it"));
    fireEvent.click(screen.getByText("yes"));
    expect(await screen.findByText("your working tree is dirty")).toBeTruthy();
    // still offering the switch — nothing moved
    expect(screen.getByText("switch to it")).toBeTruthy();
  });
});
