import React from "react";
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import HowWeWork, { HWW_TAB_KEY } from "./HowWeWork";

// A SMOKE TEST, one real walk through the only live thing on the page, and the tab contract. The
// page is TABS now — every page the same header shape, a strip, and a body that SWITCHES — so what
// is worth asserting is exactly that: one body at a time, the stored tab honoured, and the pages
// still reachable. The content itself is markup and needs no snapshot.

describe("HowWeWork", () => {
  beforeEach(() => window.localStorage.clear());

  it("renders the flow page in a bare jsdom, and ONLY the flow page's body", () => {
    render(<HowWeWork />);
    expect(screen.getByText("SystemView")).toBeVisible();
    // the other pages' bodies are not mounted — the body switches, it does not stack
    // (a body-only string: every page's HEADER is mounted, so lede words cannot prove absence)
    expect(screen.queryByText(/registering the document lands it here/)).toBeNull();
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
    fireEvent.click(screen.getByRole("tab", { name: "Living specs" }));
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
    expect(screen.getByRole("tab", { name: "Documentation" })).toHaveAttribute("aria-selected", "true");
    // a short drag snaps home instead of committing
    point("pointerdown", 400);
    point("pointermove", 380);
    point("pointerup", 380);
    expect(screen.getByRole("tab", { name: "Documentation" })).toHaveAttribute("aria-selected", "true");
  });

  it("a wheel over the top section does nothing — scroll-to-slide was removed on purpose", async () => {
    render(<HowWeWork />);
    const heads = document.querySelector(".hww-heads");
    fireEvent.wheel(heads, { deltaX: 400, deltaY: 0 });
    await new Promise((res) => setTimeout(res, 150));
    expect(screen.getByRole("tab", { name: "The flow" })).toHaveAttribute("aria-selected", "true");
  });

  it("switching tabs swaps the header and the body together", () => {
    render(<HowWeWork />);
    fireEvent.click(screen.getByRole("tab", { name: "Lifecycles" }));
    expect(screen.getByText("Nothing is marked done by hand")).toBeVisible();
    // the flow header is mid-push — still painted, but no longer the page's header
    expect(screen.getByText("SystemView").closest(".hww-hero")).toHaveAttribute(
      "aria-hidden",
      "true"
    );
    expect(screen.getByText(/A state is a condition over facts/)).toBeInTheDocument();
    // the trail opens on the first kind's first station — the arc's draft
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

  it("the agents page stands between Being told and Context, six cards deep", () => {
    render(<HowWeWork />);
    const labels = screen.getAllByRole("tab").map((t) => t.textContent);
    expect(labels).toEqual([
      "The flow",
      "Documentation",
      "Lifecycles",
      "Living specs",
      "Being told",
      "Agents",
      "Context",
      "Hooks & jobs",
      "Start something",
    ]);
    fireEvent.click(screen.getByRole("tab", { name: "Agents" }));
    expect(document.querySelectorAll(".hww-agent").length).toBe(6);
    expect(screen.getByText("one owner per project")).toBeInTheDocument();
  });

  it("a stage card is a facilitator — finish the stem and it sends sv:say", () => {
    render(<HowWeWork />);
    const heard = [];
    const on = (e) => heard.push(e.detail.text);
    window.addEventListener("sv:say", on);
    const input = screen.getByLabelText("say it to the agent");
    // the stem is OURS — a fixed label beside the field, never deletable text inside it
    expect(input.value).toBe("");
    expect(screen.getByText("Plan with me —")).toBeInTheDocument();
    fireEvent.change(input, { target: { value: "a voice recorder" } });
    fireEvent.keyDown(input, { key: "Enter" });
    window.removeEventListener("sv:say", on);
    expect(heard).toEqual(["Plan with me — a voice recorder"]);
    // the send button is the chat's icon — the receipt rides its title
    expect(screen.getByTitle("sent ✓")).toBeInTheDocument();
  });

  it("a teach stage is a button, and its press carries the prepared context", () => {
    render(<HowWeWork />);
    fireEvent.click(screen.getByRole("tab", { name: "Lifecycles" })); // any tab; the rail is on flow
    fireEvent.click(screen.getByRole("tab", { name: "The flow" }));
    const heard = [];
    const on = (e) => heard.push(e.detail.text);
    window.addEventListener("sv:say", on);
    // walk the rail to the Living specs stage, whose door is a teach button
    fireEvent.click(screen.getByRole("button", { name: /Living specs/ }));
    fireEvent.click(screen.getByRole("button", { name: "teach me claims & proofs" }));
    window.removeEventListener("sv:say", on);
    expect(heard.length).toBe(1);
    // the prepared ask carries the grounding a bare "teach me" lacks
    expect(heard[0]).toMatch(/docs\/how-we-work/);
    expect(heard[0]).toMatch(/met = marked AND proved/);
  });

  it("the trail answers for the station you press", () => {
    render(<HowWeWork />);
    fireEvent.click(screen.getByRole("tab", { name: "Lifecycles" }));
    fireEvent.click(screen.getByRole("tab", { name: /GAP/ }));
    // scoped to the trail: the word also appears in the station's own prose
    const trail = document.querySelector(".sv-trail");
    fireEvent.click(within(trail).getByText("resolved"));
    expect(screen.getByRole("heading", { level: 3, name: "resolved" })).toBeInTheDocument();
    // the press answers with the state's one human sentence
    expect(screen.getByText(/least arguable state/)).toBeInTheDocument();
  });

  it("settling the plans walks the arc upward, and an unplanned objective holds it back", () => {
    // The readout strip is gone (his call, 2026-10-28 — the page teaches, it does not coach
    // presses), so the derivation is read where it lands: the arc chip's own station.
    const { container } = render(<HowWeWork />);
    fireEvent.click(screen.getByRole("tab", { name: "Living specs" }));
    const station = () => container.querySelector(".hww-up__station").textContent;
    // RFC-073 and RFC-074 serve O1, RFC-075 serves O2, and O3 has no plan at all
    ["RFC-073", "RFC-074", "RFC-075"].forEach((id) => fireEvent.click(screen.getByText(id)));
    expect(station()).toBe("approved"); // the unplanned objective holds the arc

    fireEvent.click(screen.getByText("+ attach a plan"));
    expect(station()).toBe("inProgress");

    fireEvent.click(screen.getByText("RFC-076"));
    expect(station()).toBe("settled");
  });
});
