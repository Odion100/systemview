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
    // AND THE STRUCTURAL HALF OF THE SAME CLAIM: every button on this page is one of four things —
    // a stack face, a card, a dot on the current, or an owed row. There is no fifth control, so
    // there is nothing here that can sign, resolve, retire or divert anything.
    const strays = [...document.querySelectorAll(".dbc button")].filter(
      (b) =>
        !b.classList.contains("dbc-stack__face") &&
        !b.classList.contains("dbc-card") &&
        !b.classList.contains("dbc-dot") &&
        !b.classList.contains("dbc-owed"),
    );
    expect(strays).toEqual([]);
  });
});
