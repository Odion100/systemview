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
    expect(heads.length).toBe(7);
    const active = () =>
      [...document.querySelectorAll(".hww-heads .hww-hero")].filter(
        (h) => h.getAttribute("aria-hidden") === "false"
      );
    expect(active().length).toBe(1);
    fireEvent.click(screen.getByRole("tab", { name: "Living specs" }));
    // same seven headers holding the height; only the words changed — and the one just left is
    // still VISIBLE (it is mid-push), but no longer the active one
    expect(document.querySelectorAll(".hww-heads .hww-hero").length).toBe(7);
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
    expect(screen.getByText("An agent is its context")).toBeVisible();
  });

  it("every header carries the one action — teach me, no links", () => {
    render(<HowWeWork />);
    // the links are gone from every hero; the teach button stands where they stood
    expect(document.querySelectorAll(".hww-hero__links").length).toBe(0);
    expect(document.querySelectorAll(".hww-heads .hww-hero__teach").length).toBe(7);
    // and it is out of the voice's reach — a pointer cue reading the hero never speaks it
    document.querySelectorAll(".hww-hero__teach").forEach((n) => {
      expect(n.getAttribute("data-voice-skip")).toBe("true");
    });
  });

  it("the agents page stands between Living specs and Context, and draws the fleet", () => {
    render(<HowWeWork />);
    const labels = screen.getAllByRole("tab").map((t) => t.textContent);
    expect(labels).toEqual([
      "The flow",
      "Documentation",
      "Lifecycles",
      "Living specs",
      "Agents",
      "Context",
      "Hooks & jobs",
    ]);
    fireEvent.click(screen.getByRole("tab", { name: "Agents" }));
    // the structure IS the chapter: one window, three projects, one owner apiece, the anatomy
    expect(document.querySelectorAll(".hww-fleet__you").length).toBe(1);
    expect(document.querySelectorAll(".hww-fleet__proj").length).toBe(3);
    // five satellites — the doc, sub-agents (his add: the tentacles were missing one), skills,
    // jobs, the record
    expect(document.querySelectorAll(".hww-fleet__sat").length).toBe(5);
    // the six facts did not leave — the card answers for whatever part is pressed
    expect(screen.getByText("one owner per project")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "the record" }));
    expect(screen.getByText(/died-in-place is the record/)).toBeInTheDocument();
    // the wire down from the window is the room — pressing the window says so
    fireEvent.click(screen.getByRole("button", { name: /one window/ }));
    expect(screen.getByText(/its owner answers/)).toBeInTheDocument();
    // sub-agents is a tentacle too (his add) — pressing it answers with the delegation fact
    fireEvent.click(screen.getByRole("button", { name: "sub-agents" }));
    expect(screen.getByText(/the owner stays the owner/i)).toBeInTheDocument();
  });

  it("the context page draws the stack — eight bricks in three strata, each one answerable", () => {
    render(<HowWeWork />);
    fireEvent.click(screen.getByRole("tab", { name: "Context" }));
    expect(document.querySelectorAll(".hww-ctx__stratum").length).toBe(3);
    expect(document.querySelectorAll(".hww-ctx__layer").length).toBe(8);
    // the card opens on the first layer, and a pressed brick answers with what it carries
    expect(screen.getByText(/where it is, what the harness offers/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "the note store" }));
    expect(screen.getByText(/written the moment something is learned/)).toBeInTheDocument();
    // the pipeline is a timeline now — four stations on one directed line
    expect(document.querySelectorAll(".hww-pipe__dot").length).toBe(4);
  });

  it("the machine draws the fork — five stations, two labelled roads, a press answers", () => {
    render(<HowWeWork />);
    fireEvent.click(screen.getByRole("tab", { name: "Hooks & jobs" }));
    expect(document.querySelectorAll(".hww-chain__st").length).toBe(5);
    // offered and given are different roads, drawn as a literal fork
    expect(screen.getByText("offered")).toBeInTheDocument();
    expect(screen.getByText("given")).toBeInTheDocument();
    // the card opens on the hook; pressing a station swaps the answer
    expect(screen.getByText(/stays inert until an agent CARRIES it/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /a job/ }));
    expect(screen.getByText(/refused at the writing/)).toBeInTheDocument();
  });

  it("the told and start chapters are gone — no pill, no dangling door", () => {
    render(<HowWeWork />);
    expect(document.querySelector('[data-chap="told"]')).toBeNull();
    expect(document.querySelector('[data-chap="start"]')).toBeNull();
    // no header link points at either removed page
    expect(screen.queryByRole("button", { name: /start something/i })).toBeNull();
    expect(screen.queryByText("Being told")).toBeNull();
  });

  it("the refined chapters wear the standard shape — pill, hero title, intro, note", () => {
    render(<HowWeWork />);
    [
      { id: "agents", tab: "Agents", title: "One agent owns each project" },
      { id: "context", tab: "Context", title: "An agent is its context" },
      { id: "machine", tab: "Hooks & jobs", title: "What runs when nobody is in the room" },
    ].forEach(({ id, tab, title }) => {
      const pill = document.querySelector(`.hww-chaps [data-chap="${id}"]`);
      expect(pill).toBeTruthy();
      fireEvent.click(screen.getByRole("tab", { name: tab }));
      expect(screen.getByText(title)).toBeVisible();
      // the first-four shape: one intro making one point, one note carrying the rule
      expect(document.querySelectorAll(".hww-page .hww-intro").length).toBe(1);
      expect(document.querySelectorAll(".hww-page .hww-note").length).toBe(1);
    });
    // and the context page still carries all eight layers under its intro
    fireEvent.click(screen.getByRole("tab", { name: "Context" }));
    expect(document.querySelectorAll(".hww-ctx__layer").length).toBe(8);
  });

  it("no inputs anywhere — the page asks nothing, it offers the tour", () => {
    render(<HowWeWork />);
    // the station inputs are gone entirely (his rule: one call to action per page, never an input)
    expect(screen.queryByLabelText("say it to the agent")).toBeNull();
    expect(document.querySelectorAll("textarea").length).toBe(0);
  });

  it("teach me sends the prepared ask that invokes the voice tour, scoped to its page", () => {
    render(<HowWeWork />);
    const heard = [];
    const on = (e) => heard.push(e.detail.text);
    window.addEventListener("sv:say", on);
    fireEvent.click(screen.getByRole("tab", { name: "Living specs" }));
    // only the ACTIVE header's button is reachable — the six others are aria-hidden with it
    fireEvent.click(screen.getByRole("button", { name: "teach me" }));
    window.removeEventListener("sv:say", on);
    // the ask invokes the TOUR, never the work (his rule, 2026-10-29)
    expect(heard).toEqual(["Run the voice tour of the Living specs chapter of the How-we-work page."]);
    expect(screen.getByRole("button", { name: /sent ✓/ })).toBeInTheDocument();
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
