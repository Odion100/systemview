import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import BranchBlock from "./BranchBlock";
import { useCapability, useCapabilityState } from "../capabilities";
import { useMarkdownScope, useMarkdownWrite } from "../context";

// `::branch[name]` is a POINTER, not a patch — everything it shows is computed from git at view
// time through the host's git capability. So the tests stand up no git at all: the capability layer
// is mocked, and the block is judged on what it does with each answer the bridge can give.
jest.mock("../capabilities", () => ({
  useCapability: jest.fn(),
  useCapabilityState: jest.fn(),
}));
jest.mock("../context", () => ({
  useMarkdownScope: jest.fn(),
  useDocMembers: jest.fn(() => ({})),
  useMarkdownWrite: jest.fn(() => ({})),
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

// A BRING-IN HE DID HIMSELF LEAVES A RECEIPT. The reason this is worth four claims: derivation
// decays (a lane reads "in" only while its files still match, and the normal flow breaks the match
// within minutes), the removal door accepts a decayed verdict only when a receipt backs it, and
// these presses used to write nothing at all — so the lanes he landed personally were exactly the
// ones that later got refused with "can't tell".
describe("accepting a lane records that it was brought in", () => {
  let bridge;
  const laneBridge = (over = {}) => ({
    branchDiff: jest.fn().mockResolvedValue({
      ok: true,
      base: "main",
      files: [{ path: "src/a.js", status: "M" }],
      commits: [{ sha: "abc1234", subject: "the lane's work" }],
      patch: "diff --git a/src/a.js b/src/a.js\n@@ -1 +1 @@\n-a\n+b\n",
    }),
    gitState: jest.fn().mockResolvedValue({ branch: "main" }),
    switchBranch: jest.fn().mockResolvedValue({ ok: true }),
    mergeBranch: jest.fn().mockResolvedValue({ ok: true, into: "main" }),
    applyBranch: jest.fn().mockResolvedValue({ ok: true }),
    laneBroughtIn: jest.fn().mockResolvedValue({ ok: true }),
    ...over,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    useMarkdownScope.mockReturnValue({ projectCode: "systemview" });
    useCapabilityState.mockReturnValue("granted");
    bridge = laneBridge();
    useCapability.mockReturnValue(() => bridge);
  });

  const landIt = async (name = "lane/a-thing") => {
    render(<BranchBlock label={name} attrs={{ base: "main" }} />);
    await waitFor(() => expect(bridge.branchDiff).toHaveBeenCalled());
    fireEvent.click(await screen.findByText(/land onto/));
    fireEvent.click(await screen.findByText("yes"));
  };

  it("writes the receipt after a successful land, attributed to him", async () => {
    await landIt();
    await waitFor(() => expect(bridge.laneBroughtIn).toHaveBeenCalled());
    expect(bridge.laneBroughtIn).toHaveBeenCalledWith({ branch: "lane/a-thing", by: "you" });
  });

  it("writes it after bringing the work over as changes, too — that is a bring-in as much as a merge is", async () => {
    render(<BranchBlock label="lane/a-thing" attrs={{ base: "main" }} />);
    await waitFor(() => expect(bridge.branchDiff).toHaveBeenCalled());
    fireEvent.click(await screen.findByText(/bring over as changes/));
    fireEvent.click(await screen.findByText("yes"));
    await waitFor(() => expect(bridge.laneBroughtIn).toHaveBeenCalledWith({ branch: "lane/a-thing", by: "you" }));
  });

  it("writes NOTHING when the merge was refused — a receipt for work that never landed is the dangerous one", async () => {
    bridge = laneBridge({ mergeBranch: jest.fn().mockResolvedValue({ ok: false, error: "merge conflict" }) });
    useCapability.mockReturnValue(() => bridge);
    await landIt();
    await waitFor(() => expect(screen.getByText(/merge conflict/)).toBeInTheDocument());
    expect(bridge.laneBroughtIn).not.toHaveBeenCalled();
  });

  it("asks nothing for an ordinary branch — only a lane has a record to write on", async () => {
    await landIt("refine/dead-code");
    await waitFor(() => expect(bridge.mergeBranch).toHaveBeenCalled());
    expect(bridge.laneBroughtIn).not.toHaveBeenCalled();
  });

  it("still lands when the receipt door is missing or throws — the work is already in the tree", async () => {
    bridge = laneBridge({ laneBroughtIn: jest.fn().mockRejectedValue(new Error("no such door")) });
    useCapability.mockReturnValue(() => bridge);
    await landIt();
    await waitFor(() => expect(screen.getByText(/landed onto main/)).toBeInTheDocument());
    expect(bridge.mergeBranch).toHaveBeenCalled();
    expect(screen.queryByText(/no such door/)).toBeNull(); // the receipt's failure is not his problem
  });
});

// WHERE HE CAME FROM HAS TO SURVIVE A REMOUNT — it used to live in React state only, so a refresh
// or a page hop silently swapped "back to the branch you wrote from" for "back to base", a place he
// may never have stood. The document is the state, exactly as `::commit` stamps its sha.
describe("the way back is written into the document", () => {
  let bridge;
  beforeEach(() => {
    jest.clearAllMocks();
    bridge = {
      branchDiff: jest.fn().mockResolvedValue({ ok: true, base: "main", branch: "refine/dead-code", files: [], commits: [] }),
      gitState: jest.fn().mockResolvedValue({ branch: "feature/mine" }),
      switchBranch: jest.fn().mockResolvedValue({ ok: true }),
    };
    useCapability.mockReturnValue(() => bridge);
    useCapabilityState.mockReturnValue("granted");
    useMarkdownScope.mockReturnValue({ projectCode: "systemview-test" });
    useMarkdownWrite.mockReturnValue({});
  });

  it("stamps camefrom= onto its own line when he switches onto the branch", async () => {
    const setAttr = jest.fn();
    useMarkdownWrite.mockReturnValue({ editable: true, setAttr });
    render(<BranchBlock label="refine/dead-code" line={12} />);
    fireEvent.click(await screen.findByText("switch to it"));
    fireEvent.click(screen.getByText("yes"));
    await waitFor(() => expect(setAttr).toHaveBeenCalledWith(12, "camefrom", "feature/mine"));
  });

  it("reads it back on mount — the trip home survives a remount", async () => {
    bridge.gitState.mockResolvedValue({ branch: "refine/dead-code" });
    render(<BranchBlock label="refine/dead-code" attrs={{ camefrom: "feature/mine" }} line={12} />);
    expect(await screen.findByText("back to feature/mine")).toBeTruthy();
    fireEvent.click(screen.getByText("back to feature/mine"));
    await waitFor(() => expect(bridge.switchBranch).toHaveBeenCalledWith({ name: "feature/mine" }));
  });

  it("clears the note once he has taken the trip back", async () => {
    const setAttr = jest.fn();
    useMarkdownWrite.mockReturnValue({ editable: true, setAttr });
    bridge.gitState.mockResolvedValue({ branch: "refine/dead-code" });
    render(<BranchBlock label="refine/dead-code" attrs={{ camefrom: "feature/mine" }} line={7} />);
    fireEvent.click(await screen.findByText("back to feature/mine"));
    await waitFor(() => expect(setAttr).toHaveBeenCalledWith(7, "camefrom", null));
  });

  it("falls back to base when nobody ever stamped a return, and never writes on a read-only doc", async () => {
    const setAttr = jest.fn();
    useMarkdownWrite.mockReturnValue({ editable: false, setAttr });
    bridge.gitState.mockResolvedValue({ branch: "refine/dead-code" });
    render(<BranchBlock label="refine/dead-code" line={3} />);
    expect(await screen.findByText("back to main")).toBeTruthy();
    fireEvent.click(screen.getByText("back to main"));
    await waitFor(() => expect(bridge.switchBranch).toHaveBeenCalledWith({ name: "main" }));
    expect(setAttr).not.toHaveBeenCalled();
  });
});
