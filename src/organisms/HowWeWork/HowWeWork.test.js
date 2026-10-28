import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import HowWeWork, { HWW_TAB_KEY } from "./HowWeWork";

// A SMOKE TEST, one real walk through the only live thing on the page, and the tab contract. The
// page is TABS now — every page the same header shape, a strip, and a body that SWITCHES — so what
// is worth asserting is exactly that: one body at a time, the stored tab honoured, and the pages
// still reachable. The content itself is markup and needs no snapshot.

describe("HowWeWork", () => {
  beforeEach(() => window.localStorage.clear());

  it("renders the flow page in a bare jsdom, and ONLY the flow page's body", () => {
    render(<HowWeWork />);
    expect(screen.getByText("How this works")).toBeVisible();
    // the other pages' bodies are not mounted — the body switches, it does not stack
    expect(screen.queryByText("The state is in the document, and nowhere else.")).toBeNull();
    expect(screen.queryByText("RFC-073")).toBeNull();
  });

  it("the top section does not move — every header is mounted, exactly one active", () => {
    render(<HowWeWork />);
    const heads = document.querySelectorAll(".hww-heads .hww-hero");
    expect(heads.length).toBe(9);
    const active = () =>
      [...document.querySelectorAll(".hww-heads .hww-hero")].filter(
        (h) => h.getAttribute("aria-hidden") === "false"
      );
    expect(active().length).toBe(1);
    fireEvent.click(screen.getByRole("tab", { name: "Upward" }));
    // same nine headers holding the height; only the words changed — and the one just left is
    // still VISIBLE (it is mid-push), but no longer the active one
    expect(document.querySelectorAll(".hww-heads .hww-hero").length).toBe(9);
    expect(active().length).toBe(1);
    expect(active()[0].className).toContain("is-from-right");
  });

  it("the top section is a slider — drag it past the threshold and the tab changes", () => {
    render(<HowWeWork />);
    const heads = document.querySelector(".hww-heads");
    // jsdom has no PointerEvent — a MouseEvent wearing the pointer type name reaches the same
    // React handler WITH its clientX, which a bare Event would drop
    const point = (type, clientX) =>
      fireEvent(heads, new MouseEvent(type, { clientX, button: 0, bubbles: true }));
    // a drag to the LEFT travels right: the next tab
    point("pointerdown", 400);
    point("pointermove", 300);
    point("pointerup", 300);
    expect(screen.getByRole("tab", { name: "Registration" })).toHaveAttribute("aria-selected", "true");
    // a short drag snaps home instead of committing
    point("pointerdown", 400);
    point("pointermove", 380);
    point("pointerup", 380);
    expect(screen.getByRole("tab", { name: "Registration" })).toHaveAttribute("aria-selected", "true");
  });

  it("the top section pages on a horizontal scroll, one step per gesture", () => {
    render(<HowWeWork />);
    const heads = document.querySelector(".hww-heads");
    fireEvent.wheel(heads, { deltaX: 50, deltaY: 0 });
    fireEvent.wheel(heads, { deltaX: 50, deltaY: 0 });
    expect(screen.getByRole("tab", { name: "Registration" })).toHaveAttribute("aria-selected", "true");
    // the momentum tail of the same gesture does not page twice
    fireEvent.wheel(heads, { deltaX: 90, deltaY: 0 });
    expect(screen.getByRole("tab", { name: "Registration" })).toHaveAttribute("aria-selected", "true");
    // and a vertical scroll is none of the slider's business
    fireEvent.wheel(heads, { deltaX: 4, deltaY: 120 });
    expect(screen.getByRole("tab", { name: "Registration" })).toHaveAttribute("aria-selected", "true");
  });

  it("switching tabs swaps the header and the body together", () => {
    render(<HowWeWork />);
    fireEvent.click(screen.getByRole("tab", { name: "Lifecycles" }));
    expect(
      screen.getByText("Each kind walks its own trail, and the state is read off the document")
    ).toBeVisible();
    // the flow header is mid-push — still painted, but no longer the page's header
    expect(screen.getByText("How this works").closest(".hww-hero")).toHaveAttribute(
      "aria-hidden",
      "true"
    );
    expect(screen.getByText("The state is in the document, and nowhere else.")).toBeInTheDocument();
    // the trail opens on the RFC's first station
    expect(screen.getByRole("heading", { level: 3, name: "draft" })).toBeInTheDocument();
    // and the flow page's body is gone
    expect(screen.queryByText(/It is walking itself/)).toBeNull();
  });

  it("the tab you were on is where you come back to", () => {
    const first = render(<HowWeWork />);
    fireEvent.click(screen.getByRole("tab", { name: "Context" }));
    expect(window.localStorage.getItem(HWW_TAB_KEY)).toBe("context");
    first.unmount();

    render(<HowWeWork />);
    expect(screen.getByRole("tab", { name: "Context" })).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getByText("Context arrives in layers, and the layers differ in who pulls the trigger")
    ).toBeVisible();
  });

  it("a header link is a door to another tab", () => {
    render(<HowWeWork />);
    fireEvent.click(screen.getByRole("button", { name: /start something/ }));
    expect(screen.getByRole("tab", { name: "Start something" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText(/These copy to your clipboard/)).toBeInTheDocument();
  });

  it("the trail answers for the station you press", () => {
    render(<HowWeWork />);
    fireEvent.click(screen.getByRole("tab", { name: "Lifecycles" }));
    fireEvent.click(screen.getByRole("tab", { name: /GAP/ }));
    // scoped to the trail: the word also appears in the station's own prose
    const trail = document.querySelector(".hww-trail");
    fireEvent.click(within(trail).getByText("resolved"));
    expect(screen.getByRole("heading", { level: 3, name: "resolved" })).toBeInTheDocument();
    // the one state a press cannot outrun: pressing it with no proof OFFERS one
    expect(screen.getByText(/OFFERS one/)).toBeInTheDocument();
  });

  it("settling the plans walks the arc upward, and an unplanned objective holds it back", () => {
    render(<HowWeWork />);
    fireEvent.click(screen.getByRole("tab", { name: "Upward" }));
    // RFC-073 and RFC-074 serve O1, RFC-075 serves O2, and O3 has no plan at all
    ["RFC-073", "RFC-074", "RFC-075"].forEach((id) => fireEvent.click(screen.getByText(id)));
    expect(screen.getByText(/has no plan attached/)).toBeInTheDocument();

    fireEvent.click(screen.getByText("+ attach a plan"));
    expect(screen.getByText(/1 plan is still moving/)).toBeInTheDocument();

    fireEvent.click(screen.getByText("RFC-076"));
    expect(screen.getByText(/derived upward, never pressed/)).toBeInTheDocument();
  });
});
