import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import Claim from "./Claim";
import CmdBlock from "./CmdBlock";
import { MarkdownWriteProvider, MarkdownMembersProvider } from "../context";
import { useCapability, useCapabilityState } from "../capabilities";
// A REAL CmdBlock reads its project scope off the URL (`useMarkdownScope` → `useLocation`), so the
// composition only mounts inside a router. CmdBlock.test avoids this by mocking the whole context
// module — which is exactly why it could never hold this test: the context here has to be real.
import { MemoryRouter } from "react-router-dom";

// RFC-075 c2 — THE COMPOSITION, which neither suite was asserting. `Claim.test` put a plain `<div>`
// in the fold and checked it was hidden rather than unmounted; `CmdBlock.test` ran a block standing
// on its own. Both true, and the claim lives exactly between them: *expand the fold and press the
// `:::cmd` → it runs where it stands and keeps its exit and output in the fold.*
//
// So this file renders a REAL CmdBlock as a claim's proof and does the whole gesture: expand, run,
// collapse, re-expand. The defect this guards is the one he found by doing it — the fold used to
// unmount its children on collapse, so a finished proof's exit (and a run still in flight) died
// while the process lived on.
jest.mock("../capabilities", () => ({
  useCapability: jest.fn(),
  useCapabilityState: jest.fn(),
}));

function makeRunner() {
  let resolve;
  const calls = [];
  return {
    runner: {
      run: (opts) => {
        calls.push(opts);
        return { done: new Promise((r) => (resolve = r)), cancel: jest.fn() };
      },
    },
    calls,
    finish: (r) => resolve(r),
    emit: (s) => act(() => calls[calls.length - 1].onOutput(s)),
  };
}

const SOURCE = [
  "# RFC-9",
  ":::claim[Press the proof → it runs where it stands]{id=c2 state=met by=sv at=1}",
  ":::cmd",
  "yarn test",
  ":::",
  ":::",
].join("\n");

describe("a :::cmd inside a claim's fold — the proof is the live block", () => {
  let rig;
  const proofOf = (el) => el.closest(".md-claim__proof");
  // the command renders twice (title and body), so it is queried by class, never by text
  const cmdEl = () => document.querySelector(".md-cmd__command");

  const mountProof = () => {
    render(
      <MemoryRouter>
      <MarkdownMembersProvider value={{ source: SOURCE }}>
        <MarkdownWriteProvider value={{ editable: true, setAttr: jest.fn() }}>
          <Claim kind="container" attrs={{ id: "c2", state: "met", by: "sv", at: "1" }} label="Press the proof → it runs where it stands" line={2}>
            <CmdBlock src={"yarn test"} attrs={{}} line={3} />
          </Claim>
        </MarkdownWriteProvider>
      </MarkdownMembersProvider>
      </MemoryRouter>,
    );
    return screen.getByText(/▸ proof/);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    useCapabilityState.mockReturnValue("granted");
    rig = makeRunner();
    useCapability.mockReturnValue(() => rig.runner);
  });

  it("the fold holds the REAL block — folded away, and nothing has run", () => {
    mountProof();
    // the command is there, in the document, unrun: a proof that ran itself would make opening a
    // document an execution
    expect(cmdEl().textContent).toBe("yarn test");
    expect(proofOf(cmdEl()).style.display).toBe("none");
    expect(screen.getByText("not run")).toBeTruthy();
    expect(rig.calls).toHaveLength(0);
  });

  it("expand and press → it runs where it stands and keeps its exit and output IN the fold", async () => {
    const head = mountProof();
    fireEvent.click(head);
    expect(proofOf(cmdEl()).style.display).not.toBe("none");
    fireEvent.click(screen.getByText("run"));
    expect(rig.calls[0].command).toBe("yarn test");
    rig.emit({ started: true, text: "1163 passing", exit: 0 });
    rig.finish({ started: true, code: 0 });
    await waitFor(() => expect(screen.getByText(/exit 0/)).toBeTruthy());
    // the result is inside the claim's own proof body — not in a pane somewhere else
    expect(proofOf(screen.getByText(/exit 0/))).toBeTruthy();
    expect(screen.getByText("1163 passing")).toBeTruthy();
  });

  it("COLLAPSE AFTER A RUN and the exit survives — a curtain, never a teardown", async () => {
    const head = mountProof();
    fireEvent.click(head);
    fireEvent.click(screen.getByText("run"));
    rig.emit({ started: true, text: "1163 passing", exit: 0 });
    rig.finish({ started: true, code: 0 });
    await waitFor(() => expect(screen.getByText(/exit 0/)).toBeTruthy());
    fireEvent.click(head); // collapse
    expect(proofOf(cmdEl()).style.display).toBe("none");
    // still mounted, still carrying the result — the bug was the VIEW forgetting a run the process
    // was still serving
    expect(screen.getByText(/exit 0/)).toBeTruthy();
    expect(screen.getByText("1163 passing")).toBeTruthy();
    fireEvent.click(head); // re-expand
    expect(screen.getByText(/exit 0/)).toBeTruthy();
  });

  it("a run still IN FLIGHT survives a collapse — the view keeps what the process is still doing", async () => {
    const head = mountProof();
    fireEvent.click(head);
    fireEvent.click(screen.getByText("run"));
    rig.emit({ started: true, text: "Compiling…", exit: null });
    fireEvent.click(head); // collapse mid-run
    expect(screen.getByText(/running/)).toBeTruthy();
    rig.finish({ started: true, code: 0 });
    // the exit lands on a block inside a CLOSED fold, and is there when it opens again
    await waitFor(() => expect(screen.getByText(/exit 0/)).toBeTruthy());
    fireEvent.click(head);
    expect(screen.getByText(/exit 0/)).toBeTruthy();
  });

});
