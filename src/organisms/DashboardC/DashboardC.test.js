import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import DashboardC from "./DashboardC";
import ServiceContext from "../../ServiceContext";

// THE WIRE, SMOKE-TESTED. The numbers are proved in dashboardC.data.test.js; what is worth
// asserting here is the three things a component can get wrong on its own: that an empty answer
// NAMES ITS EMPTINESS instead of reading as "nothing to do", that a document nobody could read is
// still on the shelf saying so, and that a stack fans when pressed and presses nothing else.
//
// REAL DATA FROM DAY ONE — there are no fixtures inside the component, which is exactly why the
// service has to be handed in from out here for the test to have anything to show.

// THE FILES ARE THE SHELL'S, so they are the one thing stubbed — `mock`-prefixed because
// babel-plugin-jest-hoist lifts the factory above every declaration and refuses any other name.
// Empty by default, which is the honest jsdom case: every readFile fails and the page says so.
var mockFiles = null;
jest.mock("../../utils/hostFiles", () => ({
  hostFiles: () => ({
    readFile: async ({ path }) => {
      if (!mockFiles || !(path in mockFiles)) throw new Error("no hub in jsdom");
      return { path, content: mockFiles[path] };
    },
  }),
}));

beforeEach(() => {
  mockFiles = null;
});

const mount = (service) =>
  render(
    <ServiceContext.Provider value={{ SystemViewService: service }}>
      <DashboardC />
    </ServiceContext.Provider>,
  );

const ROW = (over = {}) => ({ id: "RFC-001", kind: "rfc", path: "RFCs/RFC-001-a-thing.md", project: "alpha", at: 1, state: {}, ...over });

describe("the dashboard with nothing behind it", () => {
  it("says a hub with no registry read NOTHING, rather than drawing a clear desk", async () => {
    mount({});
    await waitFor(() => expect(screen.getByText(/no document registry/)).toBeVisible());
    expect(screen.getByText(/this is not an empty inbox/)).toBeVisible();
  });

  it("names the emptiness when projects exist and the registry is cold", async () => {
    mount({
      Agent: { documentsRegistry: async () => [] },
      SystemView: { projectRoots: async () => ({ alpha: "/a" }) },
    });
    await waitFor(() => expect(screen.getByText(/cold registry, not a clear desk/)).toBeVisible());
    // the project still gets its shelf — "never parsed" must not read as "nothing to do"
    expect(screen.getByText("alpha")).toBeVisible();
    expect(screen.getByText("nothing registered here")).toBeVisible();
  });
});

describe("the dashboard over a registry it cannot read the files of", () => {
  // No hub in jsdom, so every readFile throws — which is the honest version of a real failure, and
  // the one the page must not hide.
  const service = {
    Agent: { documentsRegistry: async () => [ROW(), ROW({ id: "ARC-9", kind: "arc", path: "RFCs/arcs/ARC-9-b.md" })] },
    SystemView: { projectRoots: async () => ({ alpha: "/a" }) },
  };

  it("keeps every unreadable document on the shelf, each saying it could not be read", async () => {
    mount(service);
    await waitFor(() => expect(screen.getByText(/not one of them could be opened/)).toBeVisible());
    expect(screen.getByText("2 unreadable")).toBeVisible();
    expect(screen.getByText(/could not be read/)).toBeVisible(); // owed.js's own skipped sentence
  });

  const arcFace = async () => {
    await waitFor(() => expect(document.querySelector(".dbc-stack--arc .dbc-stack__face")).toBeTruthy());
    return document.querySelector(".dbc-stack--arc .dbc-stack__face");
  };

  it("fans a stack on press and collapses it again, and the cards are the only thing in it", async () => {
    mount(service);
    const face = await arcFace();
    expect(face.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("ARC-9")).toBeNull();
    fireEvent.click(face);
    expect(face.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("ARC-9")).toBeVisible();
    // ONE PRESS IS ONE STACK — opening the arcs must not open the RFCs on the same shelf.
    expect(screen.queryByText("RFC-001")).toBeNull();
    fireEvent.click(face);
    expect(screen.queryByText("ARC-9")).toBeNull();
  });

  it("presses nothing — a card dispatches the file door, and the page carries no control but doors", async () => {
    mount(service);
    fireEvent.click(await arcFace());
    const seen = [];
    const spy = (e) => seen.push(e.detail);
    window.addEventListener("sv:openFileInNav", spy);
    fireEvent.click(screen.getByText("ARC-9").closest("button"));
    window.removeEventListener("sv:openFileInNav", spy);
    expect(seen.length).toBe(1);
    expect(seen[0]).toMatchObject({ projectCode: "alpha", path: "RFCs/arcs/ARC-9-b.md", language: "markdown" });
    // AND THE STRUCTURAL HALF OF THE SAME CLAIM: every button on this page either OPENS a
    // document — a stack face, a card, a dot, an owed row — or changes what is SHOWN, which is
    // the head's counts and nothing else. Both are safe; what the page may never grow is a
    // control that signs, resolves, retires or diverts anything, because those live in the
    // document where the facilitation ladder is.
    const strays = [...document.querySelectorAll(".dbc button")].filter(
      (b) =>
        !b.classList.contains("dbc-stack__face") &&
        !b.classList.contains("dbc-card") &&
        !b.classList.contains("dbc-dot") &&
        !b.classList.contains("dbc-seg") &&
        !b.classList.contains("dbc-owed"),
    );
    expect(strays).toEqual([]);
  });
});

// THE SECTION HAS TO EXPLAIN ITSELF. *"I can't read the current… just make this section make
// sense, I don't understand what it means."* A field of coloured dots under a metaphor is
// readable only to whoever drew it, so these are the three things that carry the meaning: a
// heading in plain words, a key saying what a dot IS, and a count under every station including
// the empty ones.
describe("where everything stands — the section says what it means", () => {
  const service = {
    Agent: { documentsRegistry: async () => [ROW(), ROW({ id: "RFC-002", path: "RFCs/RFC-002-b.md" })] },
    SystemView: { projectRoots: async () => ({ alpha: "/a" }) },
  };

  it("is headed in words nobody has to decode, and says what a dot is before showing any", async () => {
    mount(service);
    await waitFor(() => expect(screen.getByText("Where everything stands")).toBeVisible());
    expect(screen.getByText(/each dot is one document/)).toBeVisible();
    expect(screen.getByText(/waiting on your press/)).toBeVisible();
    // The key's swatches are NOT controls — the page has exactly four, and a legend is not one.
    expect(document.querySelectorAll(".dbc-key button")).toHaveLength(0);
  });

  it("gives every station a count, zero included, with its name on the same line", async () => {
    mount(service);
    await waitFor(() => expect(document.querySelector(".dbc-stn")).toBeTruthy());
    const stations = [...document.querySelectorAll(".dbc-track--rfc .dbc-stn")];
    expect(stations.length).toBeGreaterThan(1);
    for (const st of stations) {
      const foot = st.querySelector(".dbc-stn__foot");
      // ONE LINE, NOT TWO STACKED FACTS: the name and its number share a parent.
      expect(foot.querySelector(".dbc-stn__name")).toBeTruthy();
      // A blank could mean none, or could mean nobody measured it. Those are different answers.
      expect(foot.querySelector(".dbc-stn__n").textContent).toMatch(/^\d+$/);
    }
    // The tick only marks a station something actually reached.
    const empty = stations.filter((s) => s.querySelector(".dbc-stn__n").textContent === "0");
    expect(empty.length).toBeGreaterThan(0);
    for (const st of empty) expect(st.classList.contains("has-mass")).toBe(false);
  });
});


// THE COUNTS ARE DOORS. *"Waiting, expiring, outstanding — those look like you should be able to
// click them."* Pressing one must show exactly the rows its number was computed from, and
// pressing it again must give everything back — a filter you cannot get out of is a trap.
describe("pressing a count shows what it counted", () => {
  const RFC = (id, ask) =>
    [`# ${id}`, "", `::rfc{id=${id}}`, "", `:::approval{ask="${ask}"}`, "sign it", ":::"].join("\n");

  const service = {
    Agent: {
      documentsRegistry: async () => [
        ROW({ id: "RFC-001", path: "a.md", state: { verdict: "approved", parsed: 1 } }),
        ROW({ id: "ARC-9", kind: "arc", path: "b.md", state: { verdict: "approved", parsed: 1 } }),
      ],
    },
    SystemView: { projectRoots: async () => ({ alpha: "/a" }) },
  };

  const setFiles = () => {
    mockFiles = {
      "a.md": RFC("RFC-001", "ship the read path?"),
      "b.md": [
        "# ARC-9",
        "",
        "::arc{id=ARC-9}",
        "",
        ':::objective{id=O1 owner=you state=open}',
        "mine to do",
        ":::",
        "",
        ':::approval{ask="approve the arc?"}',
        "sign it",
        ":::",
      ].join("\n"),
    };
  };

  it("filters the owed lists to the segment's own items, and lets go when pressed again", async () => {
    setFiles();
    mount(service);
    const waiting = await screen.findByRole("button", { name: /approvals waiting/ });
    // Everything is on screen before anything is pressed: both presses and the outstanding row.
    expect(screen.getByText("ship the read path?")).toBeVisible();
    expect(screen.getByText(/yours, and open/)).toBeVisible();

    fireEvent.click(waiting);
    expect(waiting).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("ship the read path?")).toBeVisible();
    // The outstanding column is not merely empty — it says the filter is why.
    expect(screen.queryByText(/yours, and open/)).not.toBeInTheDocument();
    expect(screen.getByText(/none of these are in what you pressed/)).toBeVisible();

    fireEvent.click(waiting);
    expect(waiting).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText(/yours, and open/)).toBeVisible();
  });

  it("a count with nothing behind it is a label, not a button that filters to nothing", async () => {
    mount({ Agent: { documentsRegistry: async () => [] }, SystemView: { projectRoots: async () => ({ alpha: "/a" }) } });
    await waitFor(() => expect(screen.getByText(/cold registry/)).toBeVisible());
    const segs = [...document.querySelectorAll(".dbc-seg")];
    for (const seg of segs) if (/nothing owed/.test(seg.textContent)) expect(seg.tagName).toBe("SPAN");
  });
});
