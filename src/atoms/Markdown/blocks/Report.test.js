import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Report from "./Report";
import Rfc from "./Rfc";
import Arc from "./Arc";
import Gap from "./Gap";
import { MarkdownWriteProvider, InDocumentProvider } from "../context";
import { setHub } from "../../../utils/hub";

// RFC-076 §4.6 at the leaf — the clock's face (c44), the two presses (c38's divert, c45's
// permanent), the invalid wear (c42/c43's document half), and the stamp riding the render.
// A LEAF UNDER TEST IS A LEAF IN A DOCUMENT — which is what every claim below already assumed.
// `useInDocument` defaults to false (the chat, a help topic, a preview), so saying it here is the
// difference between testing the registration and testing the refusal that replaced it elsewhere.
const mount = (ui) => render(<MemoryRouter><InDocumentProvider>{ui}</InDocumentProvider></MemoryRouter>);

describe("the report leaf", () => {
  let opened;
  beforeEach(() => {
    opened = jest.fn(async ({ id, restart }) => ({ ok: true, id, openedAt: Date.now(), restart: !!restart }));
    setHub({ SystemView: {}, Agent: { documentOpened: opened } });
  });

  it("rendering IS the reading — the mount stamps the first open, and the countdown counts from it (c44)", async () => {
    mount(<Report attrs={{ id: "r-x", as: "account", retain: "14d" }} line={1} />);
    await waitFor(() => expect(opened).toHaveBeenCalledWith({ id: "r-x" }));
    await screen.findByText("retires in 14 days");
  });

  it("divert restarts the clock from now (c38)", async () => {
    mount(<Report attrs={{ id: "r-x", as: "account", retain: "14d" }} line={1} />);
    fireEvent.click(await screen.findByTitle("restart the clock from now"));
    await waitFor(() => expect(opened).toHaveBeenCalledWith({ id: "r-x", restart: true }));
  });

  it("permanent writes retain=permanent into the leaf — the explicit forever (c45)", async () => {
    const setAttr = jest.fn();
    mount(
      <MarkdownWriteProvider value={{ editable: true, setAttr }}>
        <Report attrs={{ id: "r-x", as: "account", retain: "14d" }} line={7} />
      </MarkdownWriteProvider>
    );
    // The clock is a picker now — press the chip, pick the word (his direction, 2026-10-29).
    fireEvent.click(await screen.findByTitle("when this report leaves — a window from first read, or the explicit forever"));
    fireEvent.click(screen.getByText("permanent"));
    expect(setAttr).toHaveBeenCalledWith(7, "retain", "permanent");
  });

  it("the subtype badge is a picker — picking a word writes as= into the leaf", async () => {
    const setAttr = jest.fn();
    mount(
      <MarkdownWriteProvider value={{ editable: true, setAttr }}>
        <Report attrs={{ id: "r-x", as: "account", retain: "14d" }} line={7} />
      </MarkdownWriteProvider>
    );
    fireEvent.click(await screen.findByTitle("what kind of report this is — as= picks what done means"));
    fireEvent.click(screen.getByText("spec"));
    expect(setAttr).toHaveBeenCalledWith(7, "as", "spec");
  });

  it("the retention free field refuses a word no clock can read", async () => {
    const setAttr = jest.fn();
    mount(
      <MarkdownWriteProvider value={{ editable: true, setAttr }}>
        <Report attrs={{ id: "r-x", as: "account", retain: "14d" }} line={7} />
      </MarkdownWriteProvider>
    );
    fireEvent.click(await screen.findByTitle("when this report leaves — a window from first read, or the explicit forever"));
    const free = screen.getByPlaceholderText("or 45d…");
    fireEvent.change(free, { target: { value: "whenever" } });
    fireEvent.keyDown(free, { key: "Enter" });
    expect(setAttr).not.toHaveBeenCalled();
    // and a readable window lands
    fireEvent.change(free, { target: { value: "45d" } });
    fireEvent.keyDown(free, { key: "Enter" });
    expect(setAttr).toHaveBeenCalledWith(7, "retain", "45d");
  });

  it("a leaf missing its declarations wears what is missing, on the document itself (c42, c43)", () => {
    mount(<Report attrs={{ id: "r-bare" }} line={1} />);
    expect(screen.getByText("invalid — no subtype, no retention")).toBeInTheDocument();
  });

  it("permanent renders as a word, never a countdown (c45's render half)", async () => {
    mount(<Report attrs={{ id: "r-perm", as: "account", retain: "permanent" }} line={1} />);
    await screen.findByText("permanent");
    expect(screen.queryByText(/retires/)).toBeNull();
  });

  it("un-retiring fires the clock restart in the same press (c39)", async () => {
    const setAttr = jest.fn();
    const registry = jest.fn(async () => [
      { id: "r-back", kind: "report", state: { retired: true, retiredAs: "shelf", retain: "3d", subtype: "account" } },
    ]);
    setHub({ SystemView: {}, Agent: { documentOpened: opened, documentsRegistry: registry } });
    mount(
      <MarkdownWriteProvider value={{ editable: true, setAttr }}>
        <Report attrs={{ id: "r-back", as: "account", retain: "3d", retired: "2026-10-28", retiredAs: "shelf" }} line={3} />
      </MarkdownWriteProvider>
    );
    await waitFor(() => expect(registry).toHaveBeenCalled());
    fireEvent.click(screen.getByText("filed"));
    await waitFor(() => expect(opened).toHaveBeenCalledWith({ id: "r-back", restart: true }));
    // and the same press cleared the leaf's retirement — one motion, two facts
    expect(setAttr).toHaveBeenCalledWith(3, expect.objectContaining({ retired: null }));
  });

  it("a retired report has no clock and stamps nothing — its clock already spoke", () => {
    mount(<Report attrs={{ id: "r-done", as: "account", retain: "14d", retired: "2026-10-28" }} line={1} />);
    expect(screen.queryByText(/retires/)).toBeNull();
    expect(opened).not.toHaveBeenCalled();
  });
});

// THE REFUSAL — his complaint, 2026-11-07: a `::report` leaf written in a CHAT MESSAGE rendered the
// whole registration UI badged "invalid", in a place where registering is impossible.
describe("a registration leaf read outside a document", () => {
  const bare = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

  // Its own stub: this describe is a sibling, so the hub the other one set is not in scope here.
  let stamped;
  beforeEach(() => {
    stamped = jest.fn(async () => ({ ok: true, openedAt: Date.now() }));
    setHub({ SystemView: {}, Agent: { documentOpened: stamped } });
  });

  it("refuses by name instead of wearing an invalid badge", () => {
    bare(<Report attrs={{ id: "A title" }} line={1} />);
    expect(screen.getByText(/this is not a document/i)).toBeInTheDocument();
    expect(screen.getByText("::report")).toBeInTheDocument();
    // The lie that was being told: a validity verdict about a document that does not exist.
    expect(screen.queryByText(/invalid/i)).toBeNull();
    expect(screen.queryByText(/retires in/i)).toBeNull();
    expect(screen.queryByText(/SUBTYPE/i)).toBeNull();
  });

  it("names the block that WOULD have worked, because the leaf has no path to become a chip from", () => {
    bare(<Report attrs={{ id: "A title" }} line={1} />);
    expect(screen.getByText(":file[path]")).toBeInTheDocument();
  });

  it("does not stamp the clock — rendering is only reading when there is something to read", async () => {
    bare(<Report attrs={{ id: "r-y", as: "account", retain: "14d" }} line={1} />);
    await new Promise((r) => setTimeout(r, 0));
    // A report's clock starts when the leaf is RENDERED. If a mention in a message could start it,
    // a 24h account could be half spent by the time he opened the file.
    expect(stamped).not.toHaveBeenCalled();
  });

  it("the other three leaves refuse the same way, from one definition", () => {
    const { unmount } = bare(<Rfc attrs={{ id: "RFC-1" }} line={1} />);
    expect(screen.getByText("::rfc")).toBeInTheDocument();
    unmount();
    const a = bare(<Arc attrs={{ id: "ARC-1" }} line={1} />);
    expect(screen.getByText("::arc")).toBeInTheDocument();
    a.unmount();
    bare(<Gap attrs={{ id: "G-1" }} line={1} />);
    expect(screen.getByText("::gap")).toBeInTheDocument();
  });
});
