import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import Members, { splitWho, AUTO_QUIET_MS } from "./Members";
import { MarkdownWriteProvider, MarkdownMembersProvider } from "../context";
import ServiceContext from "../../../ServiceContext";

// RFC-071 — WHO IS ON THIS DOCUMENT, and the two things that make it trustworthy: the membership is
// WRITTEN INTO the document (so there is no second store to drift), and a member that is not a
// connected project is REFUSED at the press (so a chip can never point at a room that would be
// delivered to nobody while still looking sent).
//
// Mounting this is possible because the block imports no markdown renderer — the rest of the
// markdown surface cannot be mounted at all today (react-markdown is ESM and jest will not parse
// it), which is on his board as its own card.

const SERVICES = [
  { projectCode: "buapi", serviceId: "Profiles" },
  { projectCode: "buapi", serviceId: "Basketball" },
  { projectCode: "systemlynx", serviceId: "Core" },
];

const mount = ({ who = "", editable = true, services = SERVICES } = {}) => {
  const setAttr = jest.fn();
  render(
    <ServiceContext.Provider value={{ connectedServices: services }}>
      <MarkdownWriteProvider value={{ editable, setAttr }}>
        <Members attrs={{ who }} line={7} />
      </MarkdownWriteProvider>
    </ServiceContext.Provider>,
  );
  return { setAttr };
};

describe("splitWho — the attribute is a list", () => {
  it("splits on | and , and drops blanks and duplicates", () => {
    expect(splitWho("buapi|systemlynx")).toEqual(["buapi", "systemlynx"]);
    expect(splitWho("buapi, systemlynx ,")).toEqual(["buapi", "systemlynx"]);
    expect(splitWho("buapi|buapi")).toEqual(["buapi"]);
  });
  it("an absent or empty attribute is nobody, never a crash", () => {
    expect(splitWho(undefined)).toEqual([]);
    expect(splitWho("")).toEqual([]);
  });
});

describe("the chips are the membership", () => {
  it("draws a chip per member", () => {
    mount({ who: "buapi|systemlynx" });
    expect(screen.getByText("buapi")).toBeTruthy();
    expect(screen.getByText("systemlynx")).toBeTruthy();
  });

  it("says nobody yet rather than rendering an empty row", () => {
    mount();
    expect(screen.getByText("nobody yet")).toBeTruthy();
  });

  // The whole argument for keeping membership in the markdown: the press writes the document.
  it("adding a member writes the attribute back into the document", () => {
    const { setAttr } = mount({ who: "buapi" });
    fireEvent.click(screen.getByTitle("add a member"));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "systemlynx" } });
    expect(setAttr).toHaveBeenCalledWith(7, "who", "buapi|systemlynx");
  });

  it("removing the last member clears the attribute rather than writing an empty string", () => {
    const { setAttr } = mount({ who: "buapi" });
    fireEvent.click(screen.getByTitle("take buapi off this document"));
    expect(setAttr).toHaveBeenCalledWith(7, "who", null);
  });

  // An update aimed at a room that does not exist is delivered to nobody and still looks sent.
  it("only offers connected projects, and never the ones already on", () => {
    mount({ who: "buapi" });
    fireEvent.click(screen.getByTitle("add a member"));
    const options = screen.getAllByRole("option").map((o) => o.textContent);
    expect(options).toContain("systemlynx");
    expect(options).not.toContain("buapi");
  });

  // A read-only surface must SAY so — the same rule :::approval follows — rather than drawing a
  // press that silently persists nothing.
  it("a read-only surface renders the chips, offers no press, and says why", () => {
    const { setAttr } = mount({ who: "buapi", editable: false });
    expect(screen.getByText("buapi")).toBeTruthy();
    expect(screen.getByText("read-only here")).toBeTruthy();
    expect(screen.queryByTitle("add a member")).toBeNull();
    expect(screen.queryByTitle("take buapi off this document")).toBeNull();
    expect(setAttr).not.toHaveBeenCalled();
  });
});

// THE SEND — the window observes the press, the HOST emits the event. These claims are about what
// the block does around that call: who it offers to send to, what it hands over, and what it
// writes back so the same change is never announced twice.
describe("sending an update", () => {
  const SRC = "::members{who=buapi}\n# A plan\n\nbody\n";
  const mountSend = ({ who = "buapi", sent = "", source = SRC, bridge = jest.fn(async () => ({ ok: true })) } = {}) => {
    const setAttr = jest.fn();
    global.window.systemview = { documents: { sendUpdate: bridge } };
    render(
      <ServiceContext.Provider value={{ connectedServices: SERVICES }}>
        <MarkdownWriteProvider value={{ editable: true, setAttr }}>
          <MarkdownMembersProvider value={{ members: [who], source, docPath: "RFCs/x.md", projectCode: "systemview-test" }}>
            <Members attrs={{ who, sent }} line={3} />
          </MarkdownMembersProvider>
        </MarkdownWriteProvider>
      </ServiceContext.Provider>,
    );
    return { setAttr, bridge };
  };

  afterEach(() => {
    delete global.window.systemview;
  });

  // THE BLOCK HAS NO SEND. His, 2026-10-19: *"we don't even need a send update button next to the
  // members."* Every pending update is pressed in the pinned row at the top of the document, which
  // is reachable from anywhere in the file — the payload, the refusal and the stamp are claimed
  // there, in MembersPin.test.js.
  it("marks a member who has never been told, and offers no send of its own", () => {
    mountSend();
    expect(screen.getByTitle("buapi has not been told about this version")).toBeTruthy();
    expect(screen.queryByText("send update")).toBeNull();
    expect(screen.queryByText(/^send to /)).toBeNull();
  });

  it("never announces anything from here — the gear is the only control beside the membership", () => {
    const { bridge } = mountSend();
    fireEvent.click(screen.getByTitle("who hears about this document automatically"));
    expect(bridge).not.toHaveBeenCalled();
  });
});

describe("the auto toggle", () => {
  const SRC = "::members{who=buapi}\n# A plan\n";
  const mountAuto = ({ auto, bridge = jest.fn(async () => ({ ok: true })) } = {}) => {
    const setAttr = jest.fn();
    global.window.systemview = { documents: { sendUpdate: bridge } };
    render(
      <ServiceContext.Provider value={{ connectedServices: SERVICES }}>
        <MarkdownWriteProvider value={{ editable: true, setAttr }}>
          <MarkdownMembersProvider value={{ members: ["buapi"], source: SRC, docPath: "x.md", projectCode: "p" }}>
            <Members attrs={{ who: "buapi", ...(auto ? { auto: "buapi" } : {}) }} line={1} />
          </MarkdownMembersProvider>
        </MarkdownWriteProvider>
      </ServiceContext.Provider>,
    );
    return { setAttr, bridge };
  };

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    delete global.window.systemview;
  });

  it("is OFF unless the document says so, and off means nothing is ever sent unpressed", () => {
    const { bridge } = mountAuto({ auto: false });
    jest.advanceTimersByTime(AUTO_QUIET_MS * 3);
    expect(bridge).not.toHaveBeenCalled();
  });

  it("does not fire the instant the document changes — it waits for quiet", () => {
    const { bridge } = mountAuto({ auto: true });
    jest.advanceTimersByTime(AUTO_QUIET_MS - 1000);
    expect(bridge).not.toHaveBeenCalled();
  });

  it("sends once the document has been still, to exactly the members who are behind", () => {
    const { bridge } = mountAuto({ auto: true });
    // `act` because the send sets state as it goes — without it the assertion races the render and
    // the warning it prints is the test telling the truth about a real ordering.
    act(() => {
      jest.advanceTimersByTime(AUTO_QUIET_MS + 100);
    });
    expect(bridge).toHaveBeenCalledTimes(1);
    expect(bridge.mock.calls[0][0].members).toEqual(["buapi"]);
  });

  // AUTO IS PER MEMBER — "I should be able to choose exactly who I want to be auto, not just
  // everyone" — so the toggle names the member and the attribute is a LIST.
  it("turning auto on for one member writes that member into the list", () => {
    const { setAttr } = mountAuto({ auto: false });
    fireEvent.click(screen.getByTitle("who hears about this document automatically"));
    fireEvent.click(screen.getByTitle(/tell buapi automatically/));
    expect(setAttr).toHaveBeenCalledWith(1, "auto", "buapi");
  });

  it("turning the last one off clears the attribute rather than leaving an empty list", () => {
    const { setAttr } = mountAuto({ auto: true });
    fireEvent.click(screen.getByTitle("who hears about this document automatically"));
    fireEvent.click(screen.getByTitle(/press to stop that/));
    expect(setAttr).toHaveBeenCalledWith(1, "auto", null);
  });

  it("an auto member is marked on the chip, so a standing decision is visible without opening anything", () => {
    mountAuto({ auto: true });
    expect(screen.getByTitle("buapi is told automatically")).toBeTruthy();
  });
});
