import React from "react";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import BandSettings from "./BandSettings";
import NudgeCog from "./NudgeCog";

// RFC-078 §2.5 — the settings as a BAND PANE rather than a popup over the band.
//
// THIS PANEL IS TESTABLE AND AgentChat IS NOT, which is the whole reason it is its own file.
// Anything mounting AgentChat pulls in the markdown renderer (ESM, untransformed) and the suite dies
// before it runs; BandSettings imports only sibling data modules, so it mounts. Same rung the
// corpora panel's own suite already stands on for c22/c38.
//
// THE DOORS ARE THE SHELL'S, so `window.systemview` is the one thing stubbed — the panel's job is to
// draw what the harness said and to send one changed field back to it, keeping no copy of its own.

let writes = [];
// `chaser` SEEDS THE SETTINGS THE DOOR ANSWERS WITH. A set field has to be testable from a
// non-empty starting state — "pressing a second one keeps the first" cannot be asserted from a
// panel that always opens with nothing selected.
const doors = ({ nudge = true, compaction = true, agents = ["manager", "systemview-test", "blink"], chaser = {} } = {}) => {
  writes = [];
  const api = {};
  if (nudge)
    api.nudge = {
      read: async () => ({
        ok: true,
        settings: { on: true, idleMin: 20, cooldownMin: 30, giveUpAfter: 10, sources: ["job:", "skill:"], ...chaser },
      }),
      write: async (patch) => {
        writes.push({ chaserKnobs: patch });
        return { ok: true, settings: { on: true, idleMin: 20, cooldownMin: 30, giveUpAfter: 10, sources: [] } };
      },
    };
  if (compaction)
    api.compaction = {
      read: async () => ({ ok: true, settings: { on: true, softPct: 60, hardPct: 70, countdownSec: 12, snoozeSec: 60 } }),
      write: async (patch) => {
        writes.push({ compaction: patch });
        return { ok: true, settings: { on: true, softPct: 60, hardPct: 70, countdownSec: 12, snoozeSec: 60 } };
      },
    };
  // THE ROSTER DOOR the manager select reads — the same one the Agents page uses. Stubbed with
  // more than one agent, because a select with one option proves nothing about choosing.
  if (agents) api.agent = { defs: async () => agents.map((id) => ({ id })) };
  window.systemview = api;
};

afterEach(() => {
  delete window.systemview;
});

describe("the cog is a button and nothing else (c15)", () => {
  // THE STRUCTURAL HALF OF c15: it cannot pop anything up, because it no longer HAS a panel. The
  // pane is a sibling of the tab row in the band, which is why the open state had to move up.
  it("renders one control, owns no panel, and reports its press upward", () => {
    const seen = [];
    const { container } = render(<NudgeCog open={false} onToggle={(v) => seen.push(v)} />);
    expect(container.querySelectorAll("button")).toHaveLength(1);
    expect(container.querySelector(".agent-chat__bandcog-panel")).toBeNull();
    fireEvent.click(container.querySelector("button"));
    expect(seen).toEqual([true]);
  });

  it("reads pressed while the pane is open, so the cog and the band agree", () => {
    const { container } = render(<NudgeCog open onToggle={() => {}} />);
    expect(container.querySelector("button").getAttribute("aria-pressed")).toBe("true");
    expect(container.querySelector(".agent-chat__bandcog-btn--on")).not.toBeNull();
  });
});

describe("the sections that were already there keep every control (c19)", () => {
  it("the worklist knobs are all present on their own tab", async () => {
    doors();
    render(<BandSettings />);
    fireEvent.click(screen.getByText("worklist settings"));
    await waitFor(() => expect(screen.getByText("nudge unfinished runs")).toBeInTheDocument());
    ["quiet first", "cooldown", "cycle length"].forEach((l) =>
      expect(screen.getAllByText(l).length).toBeGreaterThan(0),
    );
  });

  it("the auto-compaction knobs are all present on theirs", async () => {
    doors();
    render(<BandSettings />);
    fireEvent.click(screen.getByText("auto-compaction"));
    await waitFor(() => expect(writes).toEqual([]));
    expect(screen.getAllByText(/compact|soft|hard|countdown|snooze/i).length).toBeGreaterThan(0);
  });
});

describe("each section states its own absence", () => {





});

describe("a flip writes through the harness's own door, and the panel keeps no copy (c17)", () => {
  // WHY THIS IS A CLAIM AT ALL: the harness reads these values on every idle tick and every usage
  // report, so a value the window kept would be a setting that changes nothing — the bug is silent
  // and looks like the knob working. The panel therefore sends and re-reads rather than storing.
  //
  // This claim used to be about the nudge RECORD, which is withdrawn. What it checks now is the half
  // that never depended on it: both surviving sections write through their own door, one field at a
  // time.
  it("a worklist knob goes to the chaser's door and nowhere else", async () => {
    doors();
    render(<BandSettings />);
    const box = await screen.findByLabelText(/idle/i).catch(() => null);
    const input = box || (await screen.findAllByRole("spinbutton"))[0];
    fireEvent.change(input, { target: { value: "25" } });
    await waitFor(() => expect(writes.length).toBe(1));
    expect(Object.keys(writes[0])).toEqual(["chaserKnobs"]);
    expect(Object.keys(writes[0].chaserKnobs)).toHaveLength(1);
  });

  it("an auto-compaction knob goes to the valve's door, and the two never cross", async () => {
    doors();
    render(<BandSettings />);
    fireEvent.click(screen.getByRole("button", { name: /auto-compaction/i }));
    const inputs = await screen.findAllByRole("spinbutton");
    fireEvent.change(inputs[inputs.length - 1], { target: { value: "55" } });
    await waitFor(() => expect(writes.length).toBe(1));
    expect(Object.keys(writes[0])).toEqual(["compaction"]);
  });
});

describe("each section states its own absence (c19's other half)", () => {
  // TWO DOORS ON TWO DIFFERENT SHELLS, so a shell can have either, neither or both — and a section
  // whose door is missing has to say so for ITSELF. One section hiding behind another's answer is
  // how a panel ends up showing defaults that write nowhere, which is worse than saying nothing.
  it("the worklist section says so when its own door is missing, and the valve still draws", async () => {
    doors({ nudge: false });
    render(<BandSettings />);
    await waitFor(() => expect(screen.getByText(/no nudge door yet/i)).toBeInTheDocument());
    // the OTHER section is unaffected — it has its own door and draws its own knobs
    fireEvent.click(screen.getByRole("button", { name: /auto-compaction/i }));
    await waitFor(() => expect(screen.getAllByRole("spinbutton").length).toBeGreaterThan(0));
    expect(screen.queryByText(/no auto-compaction door/i)).toBeNull();
  });

  it("and the valve says so when ITS door is missing, without blaming the other", async () => {
    doors({ compaction: false });
    render(<BandSettings />);
    fireEvent.click(screen.getByRole("button", { name: /auto-compaction/i }));
    await waitFor(() => expect(screen.getByText(/no auto-compaction door yet/i)).toBeInTheDocument());
    expect(screen.queryByText(/no nudge door yet/i)).toBeNull();
  });
});

describe("the managers field — his control over who may assign work", () => {
  // WHY IT IS HERE AND NOT ON EVERY AGENT'S DEFINITION: the profile's lever is allow/deny per
  // agent, so gating assign that way would mean unchecking a tool on every agent that must not
  // have it. A list, in the panel he already opens to control the nudging.
  //
  // AND IT IS PRESSED, NOT TYPED (his correction, 2026-11-09). The authority is compared to a
  // session's slot exactly, so a typo names nobody and the refusal that follows is correct and
  // unactionable — "that is managr". A switch cannot misspell.
  //
  // SWITCHES, NOT A PICKER (his ask, 2026-11-10: "we should be able to assign more than one
  // manager"). A select could only ever hold one, so naming a second agent meant un-naming the
  // first — and the ability is not a role: one agent reading finished work against the doctrine and
  // another sitting above an arc hold the same verb at once.
  // QUERIED BY TEXT WITHIN THE ROW, NOT BY ROLE AND NAME, and the reason is a real trap: `<button>`
  // is a LABELABLE element, so a button inside this row's `<label>` takes the label's whole text
  // content as its accessible name — "managers" plus every switch plus the help line. So
  // `getByRole("button", { name: "manager" })` can never match, however correct the render is.
  // Scoping to the row also keeps these from colliding with the `sources` switches, which are the
  // same class in the same panel.
  const row = () => screen.getByText("managers").closest("label");
  const mgr = async (id) => {
    await waitFor(() => expect(within(row()).getByText(id)).toBeTruthy());
    return within(row()).getByText(id);
  };
  const isOn = (b) => /--on/.test(b.className);

  it("offers every defined agent, with nobody selected by default", async () => {
    doors();
    render(<BandSettings />);
    expect(isOn(await mgr("systemview-test"))).toBe(false);
    expect(isOn(await mgr("manager"))).toBe(false);
    expect(isOn(await mgr("blink"))).toBe(false);
    // NOBODY IS THE DEFAULT AND IT IS NOT A PLACEHOLDER: an empty authority admits nobody, so
    // drawing nothing selected is the honest resting state rather than "unset, therefore anyone".
    expect(writes.length).toBe(0);
  });

  it("pressing one writes it once — a grant is a single discrete act", async () => {
    doors();
    render(<BandSettings />);
    fireEvent.click(await mgr("manager"));
    await waitFor(() => expect(writes.length).toBe(1));
    expect(writes[0].chaserKnobs).toEqual({ managers: ["manager"] });
  });

  it("PRESSING A SECOND ONE KEEPS THE FIRST — the whole reason this is not a select", async () => {
    doors({ chaser: { managers: ["manager"] } });
    render(<BandSettings />);
    await waitFor(() => expect(isOn(within(row()).getByText("manager"))).toBe(true));
    fireEvent.click(await mgr("systemview-test"));
    await waitFor(() => expect(writes.length).toBe(1));
    expect(writes[0].chaserKnobs).toEqual({ managers: ["manager", "systemview-test"] });
  });

  it("taking one back is one press, and emptying it writes the empty authority", async () => {
    doors({ chaser: { managers: ["manager"] } });
    render(<BandSettings />);
    const b = await mgr("manager");
    await waitFor(() => expect(isOn(within(row()).getByText("manager"))).toBe(true));
    fireEvent.click(b);
    await waitFor(() => expect(writes.length).toBe(1));
    // AN EMPTY LIST IS A REAL SETTING the harness reads as REFUSED, so returning to nobody has to
    // actually be sent rather than suppressed as "no change".
    expect(writes[0].chaserKnobs).toEqual({ managers: [] });
  });

  it("says the roster is empty rather than drawing a menu of one", async () => {
    doors({ agents: [] });
    render(<BandSettings />);
    expect(await screen.findByText(/no agents defined to choose from/i)).toBeInTheDocument();
  });
});
