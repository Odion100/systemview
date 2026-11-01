import React from "react";
import { render, screen } from "@testing-library/react";
import ServiceContext from "../../ServiceContext";
import DashboardB from "./DashboardB";

// THE COMPONENT IS A WIRE — every number it shows is proven in dashboardB.data.test.js, so what is
// left to prove here is that it mounts, and that the two answers it must never get wrong are the
// ones it gives: an unmeasured nothing is not a nothing, and a hub with no registry door says so.

const mount = (SystemViewService) =>
  render(
    <ServiceContext.Provider value={{ SystemViewService }}>
      <DashboardB />
    </ServiceContext.Provider>,
  );

describe("the floor mounts on real doors only", () => {
  // A ZERO OVER DOCUMENTS NOBODY COULD READ IS NOT A ZERO. An empty state that reads as "nothing to
  // do" when it means "nothing was read" is the lie this whole system exists to stop.
  it("refuses to call an empty registry a clear floor", async () => {
    mount({ Agent: { documentsRegistry: async () => [] }, SystemView: { projectRoots: async () => ({ a: "/a" }) } });
    await screen.findByText(/nothing is registered in any project — the registry is empty/);
    // and it names the project it could see but found nothing in, rather than drawing a blank page
    expect(screen.getByText(/1 project the hub knows with no registered documents/)).toBeInTheDocument();
  });

  it("says so when the hub has no registry door at all", async () => {
    mount({ Agent: {}, SystemView: {} });
    await screen.findByText(/no document registry door/);
  });

  // THE PRESS IS NEVER HERE. Every control on this page opens a document; nothing on it signs,
  // resolves, retires or ticks anything — the control lives in the document, which is where the
  // facilitation ladder and the clock's keep-or-let-go already are.
  it("offers no verdict control of its own", async () => {
    mount({ Agent: { documentsRegistry: async () => [] }, SystemView: { projectRoots: async () => ({}) } });
    await screen.findByText("The floor");
    const words = screen.getAllByRole("button").map((b) => b.textContent.toLowerCase());
    expect(words.some((w) => /approve|reject|resolve|retire|sign/.test(w))).toBe(false);
  });
});
