import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Report from "./Report";
import { MarkdownWriteProvider } from "../context";
import { setHub } from "../../../utils/hub";

// RFC-076 §4.6 at the leaf — the clock's face (c44), the two presses (c38's divert, c45's
// permanent), the invalid wear (c42/c43's document half), and the stamp riding the render.
const mount = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe("the report leaf", () => {
  let opened;
  beforeEach(() => {
    opened = jest.fn(async ({ id, restart }) => ({ ok: true, id, openedAt: Date.now(), restart: !!restart }));
    setHub({ SystemView: {}, Agent: { documentOpened: opened } });
  });

  it("rendering IS the reading — the mount stamps the first open, and the countdown counts from it (c44)", async () => {
    mount(<Report attrs={{ id: "r-x", as: "notice", retain: "14d" }} line={1} />);
    await waitFor(() => expect(opened).toHaveBeenCalledWith({ id: "r-x" }));
    await screen.findByText("retires in 14 days");
  });

  it("divert restarts the clock from now (c38)", async () => {
    mount(<Report attrs={{ id: "r-x", as: "notice", retain: "14d" }} line={1} />);
    fireEvent.click(await screen.findByTitle("restart the clock from now"));
    await waitFor(() => expect(opened).toHaveBeenCalledWith({ id: "r-x", restart: true }));
  });

  it("permanent writes retain=permanent into the leaf — the explicit forever (c45)", async () => {
    const setAttr = jest.fn();
    mount(
      <MarkdownWriteProvider value={{ editable: true, setAttr }}>
        <Report attrs={{ id: "r-x", as: "notice", retain: "14d" }} line={7} />
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
        <Report attrs={{ id: "r-x", as: "notice", retain: "14d" }} line={7} />
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
        <Report attrs={{ id: "r-x", as: "notice", retain: "14d" }} line={7} />
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
      { id: "r-back", kind: "report", state: { retired: true, retiredAs: "shelf", retain: "3d", subtype: "notice" } },
    ]);
    setHub({ SystemView: {}, Agent: { documentOpened: opened, documentsRegistry: registry } });
    mount(
      <MarkdownWriteProvider value={{ editable: true, setAttr }}>
        <Report attrs={{ id: "r-back", as: "notice", retain: "3d", retired: "2026-10-28", retiredAs: "shelf" }} line={3} />
      </MarkdownWriteProvider>
    );
    await waitFor(() => expect(registry).toHaveBeenCalled());
    fireEvent.click(screen.getByText("filed"));
    await waitFor(() => expect(opened).toHaveBeenCalledWith({ id: "r-back", restart: true }));
    // and the same press cleared the leaf's retirement — one motion, two facts
    expect(setAttr).toHaveBeenCalledWith(3, expect.objectContaining({ retired: null }));
  });

  it("a retired report has no clock and stamps nothing — its clock already spoke", () => {
    mount(<Report attrs={{ id: "r-done", as: "notice", retain: "14d", retired: "2026-10-28" }} line={1} />);
    expect(screen.queryByText(/retires/)).toBeNull();
    expect(opened).not.toHaveBeenCalled();
  });
});
